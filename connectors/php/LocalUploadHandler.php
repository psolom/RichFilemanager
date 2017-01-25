<?php

require_once('BaseUploadHandler.php');

class LocalUploadHandler extends BaseUploadHandler
{
    /**
     * Filemanager class instance
     * @var LocalFilemanager
     */
    protected $fm;

    /**
     * Data passed from filemanager
     * @var array
     */
    protected $fmData;


    public function __construct($options = null, $initialize = false, $error_messages = null)
    {
        parent::__construct($options, $initialize, $error_messages);

        $this->fm = $this->options['fm']['instance'];
        $this->fmData = $this->options['fm']['data'];

        $this->options['upload_dir'] = $this->fmData['upload_dir'];
        $this->options['param_name'] = $this->fm->config['upload']['paramName'];
        $this->options['readfile_chunk_size'] = $this->fm->config['upload']['chunkSize'];
        $this->options['max_file_size'] = $this->fm->config['upload']['fileSizeLimit'];
        // BaseFilemanager::is_allowed_file_type() is used instead of this regex check
        $this->options['accept_file_types'] = '/.+$/i';
        // no need to override, this list fits for images handling libs
        $this->options['image_file_types'] = '/\.(gif|jpe?g|png)$/i';

        // Only GD was tested for local and S3 uploaders
        $this->options['image_library'] = 0;
        // Use GD on Windows OS because Imagick "readImage" method causes fatal error:
        // http://stackoverflow.com/a/10037579/1789808
        //$this->options['image_library'] = (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') ? 0 : 1;

        $images = $this->fm->config['images'];
        // original image settings
        $this->options['image_versions'] = array(
            '' => array(
                'auto_orient' => $images['main']['autoOrient'],
                'max_width' => $images['main']['maxWidth'],
                'max_height' => $images['main']['maxHeight'],
            ),
        );
        // image thumbnail settings
        if(isset($images['thumbnail']) && $images['thumbnail']['enabled'] === true) {
            $this->options['image_versions']['thumbnail'] = array(
                'upload_dir' => $this->fmData['thumbnails_dir'],
                'crop' => $images['thumbnail']['crop'],
                'max_width' => $images['thumbnail']['maxWidth'],
                'max_height' => $images['thumbnail']['maxHeight'],
            );
        }

        $this->error_messages['accept_file_types'] = $this->fm->lang('INVALID_FILE_TYPE');
        $this->error_messages['max_file_size'] = sprintf($this->fm->lang('UPLOAD_FILES_SMALLER_THAN'), (round($this->fm->config['upload']['fileSizeLimit'] / 1000 / 1000, 2)) . ' ' . $this->fm->lang('unit_mb'));
        $this->error_messages['max_storage_size'] = sprintf($this->fm->lang('STORAGE_SIZE_EXCEED'), (round($this->fm->config['options']['fileRootSizeLimit'] / 1000 / 1000, 2)) . ' ' . $this->fm->lang('unit_mb'));
    }

    public function create_thumbnail_image($image_path)
    {
        $file_name = basename($image_path);
        $file_path = $this->get_upload_path($file_name);
        if ($this->is_valid_image_file($file_path)) {
            $version = 'thumbnail';
            if(isset($this->options['image_versions'][$version])) {
                $thumbnail_options = $this->options['image_versions'][$version];
                $this->create_scaled_image($file_name, $version, $thumbnail_options);
                // Free memory:
                $this->destroy_image_object($file_path);
            }
        }
    }

    protected function trim_file_name($file_path, $name, $size, $type, $error, $index, $content_range)
    {
        return $this->fm->normalizeString($name, array('.', '-'));
    }

    protected function get_unique_filename($file_path, $name, $size, $type, $error, $index, $content_range) {
        if($this->fm->config['upload']['overwrite']) {
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
        if (!$this->fm->is_allowed_file_type($file->name)) {
            $file->error = $this->get_error_message('accept_file_types');
            return false;
        }
        if(!$this->fm->is_allowed_name($file->name, false)) {
            $file->error = sprintf($this->fm->lang('FORBIDDEN_NAME'), $file->name);
            return false;
        }
        if ($uploaded_file && is_uploaded_file($uploaded_file)) {
            $file_size = $this->get_file_size($uploaded_file);
        } else {
            $file_size = $content_length;
        }
        if ($this->fm->config['options']['fileRootSizeLimit'] > 0 &&
            ($file_size + $this->fm->getRootTotalSize()) > $this->fm->config['options']['fileRootSizeLimit']) {
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
        if($this->fmData['images_only'] && !$this->is_valid_image_file($uploaded_file)) {
            $file->error = sprintf($this->fm->lang('UPLOAD_IMAGES_ONLY'));
            return false;
        }
        $max_width = @$this->options['max_width'];
        $max_height = @$this->options['max_height'];
        $min_width = @$this->options['min_width'];
        $min_height = @$this->options['min_height'];
        if (($max_width || $max_height || $min_width || $min_height)
            && preg_match($this->options['image_file_types'], $file->name)) {
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
}