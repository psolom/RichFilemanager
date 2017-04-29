<?php

namespace RFM\Storage\S3;

use RFM\Storage\BaseUploadHandler;

class UploadHandler extends BaseUploadHandler
{
    /**
     * Upload path (target folder) model.
     *
     * @var ItemModel
     */
    protected $model;

    /**
     * Storage instance.
     *
     * @var Storage
     */
    protected $storage;

    /**
     * UploadHandler constructor.
     *
     * @param null|array $options
     * @param bool $initialize
     * @param null|array $error_messages
     */
    public function __construct($options = null, $initialize = false, $error_messages = null)
    {
        parent::__construct($options, $initialize, $error_messages);

        $this->model = $this->options['model'];
        $this->storage = $this->options['storage'];

        $this->options['upload_dir'] = $this->model->pathAbsolute;
        $this->options['param_name'] = 'files';
        $this->options['readfile_chunk_size'] = 10 * 1024 * 1024;
        $this->options['max_file_size'] = $this->storage->config('upload.fileSizeLimit');
        // ItemModel::checkWritePermission() is used instead of this regex check
        $this->options['accept_file_types'] = '/.+$/i';
        // no need to override, this list fits for images handling libs
        $this->options['image_file_types'] = '/\.(gif|jpe?g|png)$/i';

        // Only GD was tested for local and S3 uploaders
        $this->options['image_library'] = 0;
        // Use GD on Windows OS because Imagick "readImage" method causes fatal error:
        // http://stackoverflow.com/a/10037579/1789808
        //$this->options['image_library'] = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? 0 : 1;

        // original image settings
        $this->options['image_versions'] = array(
            '' => array(
                'auto_orient' => $this->storage->config('images.main.autoOrient'),
                'max_width' => $this->storage->config('images.main.maxWidth'),
                'max_height' => $this->storage->config('images.main.maxHeight'),
            ),
        );
        // image thumbnail settings
        if($this->storage->config('images.thumbnail.enabled') === true) {
            $this->options['image_versions']['thumbnail'] = array(
                'upload_dir' => rtrim($this->model->thumbnail()->pathAbsolute, '/'),
                'crop' => $this->storage->config('images.thumbnail.crop'),
                'max_width' => $this->storage->config('images.thumbnail.maxWidth'),
                'max_height' => $this->storage->config('images.thumbnail.maxHeight'),
            );
        }

        $this->error_messages['accept_file_types'] = 'INVALID_FILE_TYPE';
        $this->error_messages['max_file_size'] = ['UPLOAD_FILES_SMALLER_THAN', [round($this->storage->config('upload.fileSizeLimit') / 1000 / 1000, 2) . ' Mb']];
        $this->error_messages['max_storage_size'] = ['STORAGE_SIZE_EXCEED', [round($this->storage->config('options.fileRootSizeLimit') / 1000 / 1000, 2) . ' Mb']];
    }

    public function create_thumbnail_image($file_name)
    {
        $file = new \stdClass();
        $file->name = $file_name;
        $file->path = $this->get_upload_path($file->name);
        $file->size = $this->get_file_size($file->path);

        if ($this->is_valid_image_file($file)) {
            $version = 'thumbnail';
            if (isset($this->options['image_versions'][$version])) {
                $thumbnail_options = $this->options['image_versions'][$version];
                $this->create_scaled_image($file, $version, $thumbnail_options);
                // Free memory:
                $this->destroy_image_object($file->path);
            }
        }
    }

    protected function trim_file_name($file_path, $name, $size, $type, $error, $index, $content_range)
    {
        return $this->storage->normalizeString($name, array('.', '-'));
    }

    protected function get_unique_filename($file_path, $name, $size, $type, $error, $index, $content_range)
    {
        if ($this->storage->config('upload.overwrite')) {
            return $name;
        }
        return parent::get_unique_filename($file_path, $name, $size, $type, $error, $index, $content_range);
    }

    protected function validate($uploaded_file, $file, $error, $index)
    {
        if ($error) {
            $file->error = $this->get_error_message($error);
            return false;
        }
        $content_length = $this->fix_integer_overflow(
            $this->get_server_var('CONTENT_LENGTH')
        );
        $post_max_size = $this->get_config_bytes(ini_get('post_max_size'));
        if ($post_max_size && ($content_length > $post_max_size)) {
            $file->error = $this->get_error_message('post_max_size');
            return false;
        }
        $model = new ItemModel($this->model->pathRelative . $file->name);
        if (!$model->isAllowedExtension()) {
            $file->error = $this->get_error_message('accept_file_types');
            return false;
        }
        if (!$model->isAllowedPattern()) {
            $file->error = ['FORBIDDEN_NAME', [$model->pathRelative]];
            return false;
        }
        if ($uploaded_file && is_uploaded_file($uploaded_file)) {
            $file_size = $this->get_file_size($uploaded_file);
        } else {
            $file_size = $content_length;
        }
        if ($this->storage->config('options.fileRootSizeLimit') > 0 &&
            ($file_size + $this->storage->getRootTotalSize()) > $this->storage->config('options.fileRootSizeLimit')) {
            $file->error = $this->get_error_message('max_storage_size');
            return false;
        }
        if ($this->options['max_file_size'] && (
                $file_size > $this->options['max_file_size'] ||
                $file->size > $this->options['max_file_size'])
        ) {
            $file->error = $this->get_error_message('max_file_size');
            return false;
        }
        if ($this->options['min_file_size'] &&
            $file_size < $this->options['min_file_size']) {
            $file->error = $this->get_error_message('min_file_size');
            return false;
        }
        if (is_int($this->options['max_number_of_files']) &&
            ($this->count_file_objects() >= $this->options['max_number_of_files']) &&
            // Ignore additional chunks of existing files:
            !is_file($this->get_upload_path($file->name))) {
            $file->error = $this->get_error_message('max_number_of_files');
            return false;
        }
        $max_width = @$this->options['max_width'];
        $max_height = @$this->options['max_height'];
        $min_width = @$this->options['min_width'];
        $min_height = @$this->options['min_height'];
        if (($max_width || $max_height || $min_width || $min_height) && $this->is_valid_image_name($file->name)) {
            list($img_width, $img_height) = $this->get_image_size($uploaded_file);

            // If we are auto rotating the image by default, do the checks on
            // the correct orientation
            if (
                @$this->options['image_versions']['']['auto_orient'] &&
                function_exists('exif_read_data') &&
                ($exif = @exif_read_data($uploaded_file)) &&
                (((int) @$exif['Orientation']) >= 5 )
            ) {
                $tmp = $img_width;
                $img_width = $img_height;
                $img_height = $tmp;
                unset($tmp);
            }

        }
        if (!empty($img_width)) {
            if ($max_width && $img_width > $max_width) {
                $file->error = $this->get_error_message('max_width');
                return false;
            }
            if ($max_height && $img_height > $max_height) {
                $file->error = $this->get_error_message('max_height');
                return false;
            }
            if ($min_width && $img_width < $min_width) {
                $file->error = $this->get_error_message('min_width');
                return false;
            }
            if ($min_height && $img_height < $min_height) {
                $file->error = $this->get_error_message('min_height');
                return false;
            }
        }
        return true;
    }

    /**
     * Retrieves file size.
     *
     * @param string $file_path
     * @param bool $clear_stat_cache
     * @return int|string
     */
    public function get_file_size($file_path, $clear_stat_cache = false)
    {
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
     * Overridden to read file exif data.
     * Exif functions don't support stream wrappers.
     *
     * @inheritdoc
     */
    protected function get_file_exif_data($file) {
        $exif = [];
        $contents = file_get_contents($file->path);
        // create data:// wrapper is the only way to apply exif_imagetype() to string
        $data = 'data://image/jpeg;base64,' . base64_encode($contents);
        $exif['type'] = @exif_imagetype($data);
        $exif['data'] = @exif_read_data($data);
        unset($contents);

        return $exif;
    }

    /**
     * Overridden to add stream context while uploading files with actual ContentType.
     *
     * @inheritdoc
     */
    protected function handle_file_upload($uploaded_file, $name, $size, $type, $error,
                                          $index = null, $content_range = null) {
        $file = new \stdClass();
        $file->name = $this->get_file_name($uploaded_file, $name, $size, $type, $error,
            $index, $content_range);
        $file->size = strval($size);
        $file->type = $type;
        $file->path = $this->get_upload_path($file->name);

        if ($this->validate($uploaded_file, $file, $error, $index)) {
            $this->handle_form_data($file, $index);
            $upload_dir = $this->get_upload_path();
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, $this->options['mkdir_mode'], true);
            }
            $append_file = $content_range && is_file($file->path) &&
                $file->size > $this->get_file_size($file->path);
            if ($uploaded_file && is_uploaded_file($uploaded_file)) {
                // multipart/formdata uploads (POST method uploads)
                file_put_contents(
                    $file->path,
                    fopen($uploaded_file, 'r'),
                    $append_file ? FILE_APPEND : 0,
                    stream_context_create(array(
                        's3' => array(
                            // it's possible to define mime type only for the first chunk of a file, but each consecutive
                            // chunk that appended overrides object's ContentType to the S3 default "binary/octet-stream".
                            // The only solutions is to define mime type based on file extension
                            'ContentType' => mime_type_by_extension($name),
                            'ACL' => $this->storage->s3->defaultAcl,
                        )
                    ))
                );
            } else {
                // Non-multipart uploads (PUT method support)
                file_put_contents(
                    $file->path,
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
            $file_size = $this->get_file_size($file->path, $append_file);
            if ($file_size === $file->size) {
                $file->url = $this->get_download_url($file->name);
                if ($this->is_valid_image_file($file)) {
                    $this->handle_image_file($file);
                }
            } else {
                $file->size = $file_size;
                if (!$content_range && $this->options['discard_aborted_uploads']) {
                    unlink($file->path);
                    $file->error = $this->get_error_message('abort');
                }
            }
            $this->set_additional_file_properties($file);
        }

        // remove server-side related properties
        unset($file->exif);
        unset($file->path);

        return $file;
    }
}