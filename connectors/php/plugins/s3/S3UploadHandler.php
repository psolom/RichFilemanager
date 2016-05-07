<?php

require_once(__DIR__ . '/../../LocalUploadHandler.php');

class S3UploadHandler extends LocalUploadHandler
{
    /**
     * Filemanager class instance
     * @var S3Filemanager
     */
    protected $fm;

    /**
     * @var Aws\S3\S3Client
     */
    protected $s3;

    /**
     * Note there is no "folders" in S3 though you can prefix files with a string that resembles a file system.
     * @var string
     */
    protected $prefix;

    /**
     * Note there is no "folders" in S3 though you can prefix files with a string that resembles a file system.
     * @var string
     */
    protected $bucket;

    /**
     * Cached list of images exif data
     * @var array
     */
    protected $exif_image_objects = array();

    /**
     * @inheritdoc
     */
    public function __construct($options = null, $initialize = false, $error_messages = null)
    {
        parent::__construct($options, $initialize, $error_messages);

        // It is supposed that S3 stream wrapper is registered to use PHP's native file methods
        // http://docs.aws.amazon.com/aws-sdk-php/v2/guide/feature-s3-stream-wrapper.html
        $this->s3 = $this->fm->s3->getClient();
        $this->prefix = '';
        $this->bucket = $this->fm->s3->bucket;
    }

    /**
     * Retrieves file size
     * @param string $file_path
     * @param bool $clear_stat_cache
     * @return int|string
     */
    public function get_file_size($file_path, $clear_stat_cache = false) {
        if(substr($file_path, 0, 5) === 's3://') {
            // for s3 object path
            // you could use this approach only with AWS SDK version >= 3.18.0
            // @see https://github.com/aws/aws-sdk-php/issues/963 for details
            return strval(filesize($file_path));
        } else {
            // for local path (thumbnails e.g.)
            return parent::get_file_size($file_path, $clear_stat_cache);
        }
    }

    /**
     * Overridden to cache image exif data
     * @inheritdoc
     */
    protected function is_valid_image_file($file_path) {
        if (!preg_match($this->options['image_file_types'], $file_path)) {
            return false;
        }
        if (function_exists('exif_imagetype')) {
            $contents = file_get_contents($file_path);
            // create data:// wrapper is the only way to apply exif_imagetype() to string
            $data = 'data://image/jpeg;base64,' . base64_encode($contents);
            $image_type = exif_imagetype($data);
            $this->exif_image_objects[$file_path] = array(
                'type' => $image_type,
                'data' => @exif_read_data($data),
            );
            unset($contents);
            return $image_type;
        }
        $image_info = $this->get_image_size($file_path);
        return $image_info && $image_info[0] && $image_info[1];
    }

    /**
     * Overridden to use cached image exif data, because it is no possible to exif_read_data via S3 wrapper
     * It also might be a good idea to handle images on server BEFORE upload them to S3 storage, because handled image
     * should be reuploaded to S3 after it was changed, and it is uploaded entirely, not by chunks (while chunked upload).
     * @inheritdoc
     */
    protected function gd_orient_image($file_path, $src_img) {
        $exif = @$this->exif_image_objects[$file_path]['data'];
        if (!$exif) {
            return false;
        }
        $orientation = (int)@$exif['Orientation'];
        if ($orientation < 2 || $orientation > 8) {
            return false;
        }
        switch ($orientation) {
            case 2:
                $new_img = $this->gd_imageflip(
                    $src_img,
                    defined('IMG_FLIP_VERTICAL') ? IMG_FLIP_VERTICAL : 2
                );
                break;
            case 3:
                $new_img = imagerotate($src_img, 180, 0);
                break;
            case 4:
                $new_img = $this->gd_imageflip(
                    $src_img,
                    defined('IMG_FLIP_HORIZONTAL') ? IMG_FLIP_HORIZONTAL : 1
                );
                break;
            case 5:
                $tmp_img = $this->gd_imageflip(
                    $src_img,
                    defined('IMG_FLIP_HORIZONTAL') ? IMG_FLIP_HORIZONTAL : 1
                );
                $new_img = imagerotate($tmp_img, 270, 0);
                imagedestroy($tmp_img);
                break;
            case 6:
                $new_img = imagerotate($src_img, 270, 0);
                break;
            case 7:
                $tmp_img = $this->gd_imageflip(
                    $src_img,
                    defined('IMG_FLIP_VERTICAL') ? IMG_FLIP_VERTICAL : 2
                );
                $new_img = imagerotate($tmp_img, 270, 0);
                imagedestroy($tmp_img);
                break;
            case 8:
                $new_img = imagerotate($src_img, 90, 0);
                break;
            default:
                return false;
        }
        $this->gd_set_image_object($file_path, $new_img);
        return true;
    }

    /**
     * Overridden to add stream context while uploading files with actual ContentType
     * @inheritdoc
     */
    protected function handle_file_upload($uploaded_file, $name, $size, $type, $error,
                                          $index = null, $content_range = null) {
        $file = new \stdClass();
        $file->name = $this->get_file_name($uploaded_file, $name, $size, $type, $error,
            $index, $content_range);
        $file->size = strval($size);
        $file->type = $type;
        if ($this->validate($uploaded_file, $file, $error, $index)) {
            $this->handle_form_data($file, $index);
            $upload_dir = $this->get_upload_path();
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, $this->options['mkdir_mode'], true);
            }
            $file_path = $this->get_upload_path($file->name);
            $append_file = $content_range && is_file($file_path) &&
                $file->size > $this->get_file_size($file_path);
            if ($uploaded_file && is_uploaded_file($uploaded_file)) {
                // multipart/formdata uploads (POST method uploads)
                file_put_contents(
                    $file_path,
                    fopen($uploaded_file, 'r'),
                    $append_file ? FILE_APPEND : 0,
                    stream_context_create(array(
                        's3' => array(
                            // it's possible to define mime type only for the first chunk of a file, but each consecutive
                            // chunk that appended overrides object's ContentType to the S3 default "binary/octet-stream".
                            // The only solutions is to define mime type based on file extension
                            'ContentType' => mime_type_by_extension($name)
                        )
                    ))
                );
            } else {
                // Non-multipart uploads (PUT method support)
                file_put_contents(
                    $file_path,
                    fopen($this->options['input_stream'], 'r'),
                    $append_file ? FILE_APPEND : 0,
                    stream_context_create(array(
                        's3' => array(
                            // define mime type of stream content
                            'ContentType' => mime_content_type($uploaded_file)
                        )
                    ))
                );
            }
            $file_size = $this->get_file_size($file_path, $append_file);
            if ($file_size === $file->size) {
                $file->url = $this->get_download_url($file->name);
                if ($this->is_valid_image_file($file_path)) {
                    $this->handle_image_file($file_path, $file);
                }
            } else {
                $file->size = $file_size;
                if (!$content_range && $this->options['discard_aborted_uploads']) {
                    unlink($file_path);
                    $file->error = $this->get_error_message('abort');
                }
            }
            $this->set_additional_file_properties($file);
        }
        return $file;
    }
}