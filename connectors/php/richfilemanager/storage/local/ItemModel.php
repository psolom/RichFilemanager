<?php

namespace RFM\Storage\Local;

use RFM\Facade\Log;
use RFM\Storage\StorageTrait;

class ItemModel
{
    use IdentityTrait;
    use StorageTrait;

    const TYPE_FILE = 'file';
    const TYPE_FOLDER = 'folder';

    /**
     * File item model template
     *
     * @var array
     */
    protected $fileModel = [
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
     *
     * @var array
     */
    protected $folderModel = [
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

    /**
     * Absolute path for item model, based on relative path.
     *
     * @var string
     */
    public $pathAbsolute;

    /**
     * Relative path for item model, the only value required to create item model.
     *
     * @var string
     */
    public $pathRelative;

    /**
     * Whether item exists in file system on any other storage.
     * Defined and cached upon creating new item instance.
     *
     * @var bool
     */
    public $isExists;

    /**
     * Whether item is folder.
     * Defined and cached upon creating new item instance.
     *
     * @var bool
     */
    public $isDir;

    /**
     * Define whether item is thumbnail file or thumbnails folder.
     * Set up in constructor upon initialization and can't be modified.
     *
     * @var bool
     */
    private $isThumbnail;

    /**
     * Model for parent folder of the current item.
     * Return NULL if there is no parent folder (user storage root folder).
     *
     * @var null|ItemModel
     */
    private $parent;

    /**
     * Model for thumbnail file or folder of the current item.
     *
     * @var null|ItemModel
     */
    private $thumbnail;

    /**
     * ItemModel constructor.
     *
     * @param string $path
     * @param bool $isThumbnail
     */
    public function __construct($path, $isThumbnail = false)
    {
        $this->pathRelative = $path;
        $this->isThumbnail = $isThumbnail;
        $this->pathAbsolute = $this->getAbsolutePath();
        $this->isExists = $this->getIsExists();
        $this->isDir = $this->getIsDirectory();
    }

    /**
     * Build and return item details info.
     *
     * @return array
     */
    public function getInfo()
    {
        $pathInfo = pathinfo($this->pathAbsolute);
        $filemtime = filemtime($this->pathAbsolute);

        // check file permissions
        $isReadable = $this->hasReadPermission();
        $isWritable = $this->hasWritePermission();

        if ($this->isDir) {
            $model = $this->folderModel;
        } else {
            $model = $this->fileModel;
            $model['attributes']['extension'] = isset($pathInfo['extension']) ? $pathInfo['extension'] : '';

            if ($isReadable) {
                $model['attributes']['size'] = $this->storage()->getRealFileSize($this->pathAbsolute);

                if ($this->isImageFile()) {
                    if ($model['attributes']['size']) {
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
        $model['attributes']['path'] = $this->getDynamicPath();
        $model['attributes']['readable'] = (int)$isReadable;
        $model['attributes']['writable'] = (int)$isWritable;
        $model['attributes']['timestamp'] = $filemtime;
        $model['attributes']['modified'] = $this->storage()->formatDate($filemtime);
        //$model['attributes']['created'] = $model['attributes']['modified']; // PHP cannot get create timestamp
        return $model;
    }

    /**
     * Return model for parent folder on the current item.
     * Create and cache if not existing yet.
     *
     * @return null|ItemModel
     */
    public function closest()
    {
        if (is_null($this->parent)) {
            // dirname() trims trailing slash
            $path = dirname($this->pathRelative) . '/';
            // root folder returned as backslash for Windows
            $path = $this->storage()->cleanPath($path);

            // can't get parent
            if ($this->isRoot()) {
                return null;
            }
            $this->parent = new self($path, $this->isThumbnail);
        }

        return $this->parent;
    }

    /**
     * Return model for thumbnail of the current item.
     * Create and cache if not existing yet.
     *
     * @return null|ItemModel
     */
    public function thumbnail()
    {
        if (is_null($this->thumbnail)) {
            $this->thumbnail = new self($this->getThumbnailPath(), true);
        }

        return $this->thumbnail;
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
     * Return absolute path to item.
     * Based on relative item path.
     *
     * @return string
     */
    public function getAbsolutePath()
    {
        return $this->storage()->cleanPath($this->storage()->getRoot() . '/' . $this->pathRelative);
    }

    /**
     * Return path without storage root path, prepended with dynamic folder.
     * Based on relative item path.
     *
     * @return mixed
     */
    public function getDynamicPath()
    {
        $path = $this->storage()->getDynamicRoot() . '/' . $this->pathRelative;

        return $this->storage()->cleanPath($path);
    }

    /**
     * Return path without storage root path.
     * Based on absolute item path.
     *
     * @return mixed
     */
    public function getRelativePath()
    {
        return $this->storage()->subtractPath($this->pathAbsolute, $this->storage()->getRoot());
    }

    /**
     * Return thumbnail relative path from given path.
     * Work for both files and dirs paths.
     *
     * @return string
     */
    public function getThumbnailPath()
    {
        $path = '/' . $this->config('images.thumbnail.dir') . '/' . $this->pathRelative;

        return $this->storage()->cleanPath($path);
    }

    /**
     * Return original relative path for thumbnail model.
     * Work for both files and dirs paths.
     *
     * @return string
     */
    public function getOriginalPath()
    {
        $path = $this->pathRelative;

        if (!$this->isThumbnail) {
            return $path;
        }

        $thumbRoot = '/' . trim($this->config('images.thumbnail.dir'), '/');
        if (strpos($path, $thumbRoot) === 0) {
            // remove thumbnails root folder
            $path = substr($path, strlen($thumbRoot));
        }

        return $path;
    }

    /**
     * Check whether the item is root folder.
     *
     * @return bool
     */
    public function isRoot()
    {
        $rootPath = $this->storage()->getRoot();

        // root for thumbnails is defined in config file
        if ($this->isThumbnail) {
            $rootPath = $this->storage()->cleanPath($rootPath . '/' . $this->config('images.thumbnail.dir'));
        }

        return rtrim($rootPath, '/') === rtrim($this->pathAbsolute, '/');
    }

    /**
     * Check whether file is image, based on its mime type.
     *
     * @return string
     */
    public function isImageFile()
    {
        $mime = mime_content_type($this->pathAbsolute);

        return $this->storage()->isImageMimeType($mime);
    }

    /**
     * Remove current file or folder.
     */
    public function remove()
    {
        if ($this->isDir) {
            $this->storage()->unlinkRecursive($this->pathAbsolute);
        } else {
            unlink($this->pathAbsolute);
        }
    }

    /**
     * Create thumbnail from the original image.
     *
     * @return void
     */
    public function createThumbnail()
    {
        // check is readable current item
        if (!$this->hasReadPermission()) {
            return;
        }

        // check that thumbnail creation is allowed in config file
        if (!$this->config('images.thumbnail.enabled')) {
            return;
        }

        $modelThumb = $this->thumbnail();
        $modelTarget = $modelThumb->closest();
        $modelExistent = $modelTarget;

        // look for closest existent folder
        while (!$modelExistent->isRoot() && !$modelExistent->isExists) {
            $modelExistent = $modelExistent->closest();
        }

        // check that the closest existent folder is writable
        if ($modelExistent->isExists && !$modelExistent->hasWritePermission()) {
            return;
        }

        Log::info('generating thumbnail "' . $modelThumb->pathAbsolute . '"');

        // create folder if it does not exist
        if (!$modelThumb->closest()->isExists) {
            mkdir($modelTarget->pathAbsolute, 0755, true);
        }

        $this->storage()->initUploader($this->closest())
            ->create_thumbnail_image(basename($this->pathAbsolute));
    }

    /**
     * Check the extensions blacklist for item.
     *
     * @return bool
     */
    public function isAllowedExtension()
    {
        // check the extension (for files):
        $extension = pathinfo($this->pathRelative, PATHINFO_EXTENSION);
        $extensionRestrictions = $this->config('security.extensions.restrictions');

        if ($this->config('security.extensions.ignoreCase')) {
            $extension = strtolower($extension);
            $extensionRestrictions = array_map('strtolower', $extensionRestrictions);
        }

        if ($this->config('security.extensions.policy') === 'ALLOW_LIST') {
            if (!in_array($extension, $extensionRestrictions)) {
                // Not in the allowed list, so it's restricted.
                return false;
            }
        } else if ($this->config('security.extensions.policy') === 'DISALLOW_LIST') {
            if (in_array($extension, $extensionRestrictions)) {
                // It's in the disallowed list, so it's restricted.
                return false;
            }
        } else {
            // Invalid config option for 'policy'. Deny everything for safety.
            return false;
        }

        // Nothing restricted this path, so it is allowed.
        return true;
    }

    /**
     * Check the patterns blacklist for path.
     *
     * @return bool
     */
    public function isAllowedPattern()
    {
        // check the relative path against the glob patterns:
        $pathRelative = $this->getOriginalPath();
        $patternRestrictions = $this->config('security.patterns.restrictions');

        if ($this->config('security.patterns.ignoreCase')) {
            $pathRelative = strtolower($pathRelative);
            $patternRestrictions = array_map('strtolower', $patternRestrictions);
        }

        // (check for a match before applying the restriction logic)
        $matchFound = false;
        foreach ($patternRestrictions as $pattern) {
            if (fnmatch($pattern, $pathRelative)) {
                $matchFound = true;
                break;  // Done.
            }
        }

        if ($this->config('security.patterns.policy') === 'ALLOW_LIST') {
            if (!$matchFound) {
                // relative path did not match the allowed pattern list, so it's restricted:
                return false;
            }
        } else if ($this->config('security.patterns.policy') === 'DISALLOW_LIST') {
            if ($matchFound) {
                // relative path matched the disallowed pattern list, so it's restricted:
                return false;
            }
        } else {
            // Invalid config option for 'policy'. Deny everything for safety.
            return false;
        }

        // Nothing is restricting access to this item, so it is allowed.
        return true;
    }

    /**
     * Check the global blacklists for this file path.
     *
     * @return bool
     */
    public function isUnrestricted()
    {
        $valid = true;

        if (!$this->isDir) {
            $valid = $valid && $this->isAllowedExtension();
        }

        return $valid && $this->isAllowedPattern();
    }

    /**
     * Verify if item has read permission.
     *
     * @return bool
     */
    public function hasReadPermission()
    {
        // Check system permission (O.S./filesystem/NAS)
        if ($this->storage()->hasSystemReadPermission($this->pathAbsolute) === false) {
            return false;
        }

        // Check the user's Auth API callback:
        if (fm_has_read_permission($this->pathAbsolute) === false) {
            return false;
        }

        // Nothing is restricting access to this item, so it is readable
        return true;
    }

    /**
     * Verify if item has write permission.
     *
     * @return bool
     */
    public function hasWritePermission()
    {
        // Check the global `readOnly` config flag:
        if ($this->config('security.readOnly') !== false) {
            return false;
        }

        // Check system permission (O.S./filesystem/NAS)
        if ($this->storage()->hasSystemWritePermission($this->pathAbsolute) === false) {
            return false;
        }

        // Check the user's Auth API callback:
        if (fm_has_write_permission($this->pathAbsolute) === false) {
            return false;
        }

        // Nothing is restricting access to this item, so it is writable
        return true;
    }

    /**
     * Check whether item path is valid by comparing paths.
     *
     * @return bool
     */
    public function isValidPath()
    {
        $rootPath = $this->storage()->getRoot();
        $rpSubstr = substr(realpath($this->pathAbsolute) . DS, 0, strlen(realpath($rootPath))) . DS;
        $rpFiles = realpath($rootPath) . DS;

        // handle better symlinks & network path
        $pattern = ['/\\\\+/', '/\/+/'];
        $replacement = ['\\\\', '/'];
        $rpSubstr = preg_replace($pattern, $replacement, $rpSubstr);
        $rpFiles = preg_replace($pattern, $replacement, $rpFiles);
        $match = ($rpSubstr === $rpFiles);

        if (!$match) {
            Log::info('Invalid path "' . $this->pathAbsolute . '"');
            Log::info('real path: "' . $rpSubstr . '"');
            Log::info('path to files: "' . $rpFiles . '"');
        }
        return $match;
    }

    /**
     * Check that item exists and path is valid.
     *
     * @return void
     */
    public function checkPath()
    {
        if (!$this->isExists || !$this->isValidPath()) {
            $langKey = $this->isDir ? 'DIRECTORY_NOT_EXIST' : 'FILE_DOES_NOT_EXIST';
            app()->error($langKey, [$this->pathRelative]);
        }
    }

    /**
     * Check that item has read permission.
     *
     * @return void
     */
    public function checkRestrictions()
    {
        if (!$this->isDir) {
            if ($this->isAllowedExtension() === false) {
                app()->error('FORBIDDEN_NAME', [$this->pathRelative]);
            }
        }

        if ($this->isAllowedPattern() === false) {
            app()->error('INVALID_FILE_TYPE');
        }

        // Nothing is restricting access to this file or dir, so it is readable.
        return;
    }

    /**
     * Check that item has read permission.
     *
     * @return void -- exits with error response if the permission is not allowed
     */
    public function checkReadPermission()
    {
        // Check system permission (O.S./filesystem/NAS)
        if ($this->storage()->hasSystemReadPermission($this->pathAbsolute) === false) {
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
     *
     * @return void -- exits with error response if the permission is not allowed
     */
    public function checkWritePermission()
    {
        // Check the global `readOnly` config flag:
        if ($this->config('security.readOnly') !== false) {
            app()->error('NOT_ALLOWED');
        }

        // Check system permission (O.S./filesystem/NAS)
        if ($this->storage()->hasSystemWritePermission($this->pathAbsolute) === false) {
            app()->error('NOT_ALLOWED_SYSTEM');
        }

        // Check the user's Auth API callback:
        if (fm_has_write_permission($this->pathAbsolute) === false) {
            app()->error('NOT_ALLOWED');
        }

        // Nothing is restricting access to this file, so it is writable
        return;
    }
}