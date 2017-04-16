<?php

namespace RFM\Storage\Local;

class ItemModel
{
    const TYPE_FILE = 'file';
    const TYPE_FOLDER = 'folder';

    /**
     * @var \RFM\Storage\Local\Storage
     */
    protected $storage;

    /**
     * File item model template
     * @var array
     */
    protected $file_model = [
        "id"    => '',
        "type"  => self::TYPE_FILE,
        "attributes" => [
            'name'      => '',
            'extension' => '',
            'path'      => '',
            'readable'  => 1,
            'writable'  => 1,
            'created'   => '',
            'modified'  => '',
            'timestamp' => '',
            'height'    => 0,
            'width'     => 0,
            'size'      => 0,
        ]
    ];

    /**
     * Folder item model template
     * @var array
     */
    protected $folder_model = [
        "id"    => '',
        "type"  => self::TYPE_FOLDER,
        "attributes" => [
            'name'      => '',
            'path'      => '',
            'readable'  => 1,
            'writable'  => 1,
            'created'   => '',
            'modified'  => '',
            'timestamp' => '',
        ]
    ];

    public $pathAbsolute;
    public $pathRelative;
    public $isExists;
    public $isDir;

    /**
     * ItemModel constructor.
     *
     * @param string $path
     */
    public function __construct($path)
    {
        $this->storage = app()->getStorage('local');
        $this->pathRelative = $path;
        $this->pathAbsolute = $this->storage->getFullPath($path);
        $this->isExists = $this->getIsExists();
        $this->isDir = $this->getIsDirectory();
    }

    /**
     * Create array with file properties
     *
     * @return array
     */
    public function get_file_info()
    {
        $pathInfo = pathinfo($this->pathAbsolute);
        $filemtime = filemtime($this->pathAbsolute);

        // check if file is readable
        $is_readable = $this->storage->has_read_permission($this->pathAbsolute);

        // check if file is writable
        $is_writable = $this->storage->has_write_permission($this->pathAbsolute);

        if($this->isDir) {
            $model = $this->folder_model;
        } else {
            $model = $this->file_model;
            $model['attributes']['extension'] = isset($pathInfo['extension']) ? $pathInfo['extension'] : '';

            if ($is_readable) {
                $model['attributes']['size'] = $this->storage->get_real_filesize($this->pathAbsolute);

                if($this->storage->is_image_file($this->pathAbsolute)) {
                    if($model['attributes']['size']) {
                        list($width, $height, $type, $attr) = getimagesize($this->pathAbsolute);
                    } else {
                        list($width, $height) = [0, 0];
                    }

                    $model['attributes']['width'] = $width;
                    $model['attributes']['height'] = $height;
                }
            }
        }

        $model['id'] = $this->pathRelative;
        $model['attributes']['name'] = $pathInfo['basename'];
        $model['attributes']['path'] = $this->storage->getDynamicPath($this->pathAbsolute);
        $model['attributes']['readable'] = (int) $is_readable;
        $model['attributes']['writable'] = (int) $is_writable;
        $model['attributes']['timestamp'] = $filemtime;
        $model['attributes']['modified'] = $this->storage->formatDate($filemtime);
        //$model['attributes']['created'] = $model['attributes']['modified']; // PHP cannot get create timestamp
        return $model;
    }

    /**
     * Define whether item is file or folder.
     * In case item doesn't exists we check the trailing slash.
     * That is why it's important to add slashes to the wnd of folders path.
     *
     * @return bool
     */
    public function getIsDirectory()
    {
        if ($this->isExists) {
            return is_dir($this->pathAbsolute);
        } else {
            return substr($this->pathRelative, -1, 1) === '/';
        }
    }

    /**
     * Check if file or folder exists.
     *
     * @return bool
     */
    public function getIsExists()
    {
        return file_exists($this->pathAbsolute);
    }

    /**
     * Return thumbnail path from given path.
     * Work for both files and dirs paths.
     *
     * @return string
     */
    public function getThumbnailPath()
    {
        $path =  '/' . config('local.images.thumbnail.dir') . '/' . $this->pathRelative;

        return $this->storage->cleanPath($path);
    }


    /**
     * Check that item exists and path is valid.
     *
     * @return void
     */
    public function check_path()
    {
        if(!$this->isExists || !$this->storage->is_valid_path($this->pathAbsolute)) {
            $langKey = $this->isDir ? 'DIRECTORY_NOT_EXIST' : 'FILE_DOES_NOT_EXIST';
            app()->error($langKey, [$this->pathAbsolute]);
        }
    }

    /**
     * Check that item has read permission.
     *
     * @return void
     */
    public function check_restrictions()
    {
        $path = $this->pathRelative;
        if (!$this->isDir) {
            if ($this->storage->is_allowed_extension($path) === false) {
                app()->error('FORBIDDEN_NAME', [$path]);
            }
        }

        if ($this->storage->is_allowed_extension($path) === false) {
            app()->error('INVALID_FILE_TYPE');
        }

        // Nothing is restricting access to this file or dir, so it is readable.
        return;
    }

    /**
     * Check the global blacklists for this file path.
     *
     * @return bool
     */
    public function is_unrestricted()
    {
        $valid = true;

        if (!$this->isDir) {
            $valid = $valid && $this->storage->is_allowed_extension($this->pathRelative);
        }

        return $valid && $this->storage->is_allowed_path($this->pathRelative);
    }

    /**
     * Check that item has read permission.
     *
     * @return void -- exits with error response if the permission is not allowed
     */
    public function check_read_permission()
    {
        // Check system permission (O.S./filesystem/NAS)
        if ($this->storage->has_system_read_permission($this->pathAbsolute) === false) {
            app()->error('NOT_ALLOWED_SYSTEM');
        }

        // Check the user's Auth API callback:
        if (fm_has_read_permission($this->pathAbsolute) === false) {
            app()->error('NOT_ALLOWED');
        }

        // Nothing is restricting access to this file or dir, so it is readable
        return;
    }

    /**
     * Check that item can be written to.
     * If the filepath does not exist, this assumes we want to CREATE a new
     * dir entry at $filepath (a new file or new subdir), and thus it checks the
     * parent dir for write permissions.
     *
     * @param string $filepath
     * @return void -- exits with error response if the permission is not allowed
     */
    public function check_write_permission($filepath)
    {
        // Does the path already exist?
        if (!file_exists($filepath)) {
            // It does not exist (yet). Check to see if we could write to this
            // path, by seeing if we can write new entries into its parent dir.
            $parent_dir = pathinfo($filepath, PATHINFO_DIRNAME);
            $this->check_write_permission($parent_dir);
        }

        //
        // The filepath (file or dir) does exist, so check its permissions:
        //

        // Check system permission (O.S./filesystem/NAS)
        if ($this->storage->has_system_write_permission($filepath) === false) {
            app()->error('NOT_ALLOWED_SYSTEM');
        }

//        // Check the global blacklists:
//        if ($this->is_unrestricted($filepath) === false) {
//            app()->error('FORBIDDEN_NAME', [$filepath]);
//        }

        // Check the global read_only config flag:
        if (config('local.security.read_only') !== false) {
            app()->error('NOT_ALLOWED');
        }

        // Check the user's Auth API callback:
        if (fm_has_write_permission($filepath) === false) {
            app()->error('NOT_ALLOWED');
        }

        // Nothing is restricting access to this file, so it is writable
        return;
    }
}