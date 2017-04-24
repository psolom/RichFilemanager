<?php

namespace RFM\Storage\S3;

use RFM\Facade\Log;
use RFM\Storage\BaseStorage;
use RFM\Storage\StorageInterface;
use RFM\Storage\StorageTrait;

/**
 *	AWS S3 storage class.
 *
 *	@license	MIT License
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

class Storage extends BaseStorage implements StorageInterface
{
    use IdentityTrait;
    use StorageTrait;

    const RETRIEVE_MODE_BROWSER = 'S3_To_Internet';
    const RETRIEVE_MODE_SERVER = 'S3_To_AWS';

	protected $storageRoot;

    /**
     * Root directory on S3 storage for storing files.
     * Example: "user1" or "users/john"
     *
     * @var string
     */
    public $dynamicRoot = 'userfiles';

    /**
     * S3 client wrapper class.
     *
     * @var \Aws\S3\S3Client
     */
    public $s3 = null;

    /**
     * Storage constructor.
     *
     * @param array $config
     * @throws \Exception
     */
    public function __construct($config = [])
    {
        parent::__construct($config);

        if (!$this->config('credentials')) {
            throw new \Exception("S3 credentials isn't set");
        }

        $this->s3 = $this->setS3Client($this->config('credentials'));

        $this->dynamicRoot = $this->cleanPath($this->dynamicRoot . '/');
        $this->storageRoot = $this->getS3WrapperPath($this->dynamicRoot);
    }

    /**
     * Set S3 client wrapper.
     *
     * @param array $settings
     * @return StorageHelper
     */
    public function setS3Client($settings)
    {
        $storage = new StorageHelper;
        $storage->region = $settings['region'];
        $storage->bucket = $settings['bucket'];
        $storage->credentials = $settings['credentials'];
        $storage->defaultAcl = $settings['defaultAcl'];

        if (isset($settings['cdnHostname'])) {
            $storage->cdnHostname = $settings['cdnHostname'];
        }
        if (isset($settings['debug'])) {
            $storage->debug = $settings['debug'];
        }
        if (isset($settings['options'])) {
            $storage->options = $settings['options'];
        }
        $storage->init();

        return $storage;
    }

    /**
     * @inheritdoc
     */
    public function setRoot($path, $makeDir = false)
    {
        $this->dynamicRoot = $this->cleanPath($path . '/');
        $this->storageRoot = $this->getS3WrapperPath($this->dynamicRoot);

        if($makeDir === true && !is_dir($this->storageRoot)) {
            Log::info('creating "' . $this->storageRoot . '" folder through mkdir()');
            mkdir($this->storageRoot, 0755, true);
        }
    }

    /**
     * @inheritdoc
     */
    public function getRoot()
    {
        return $this->storageRoot;
    }

    /**
     * @inheritdoc
     */
    public function getDynamicRoot()
    {
        return $this->dynamicRoot;
    }

    /**
     * Return path without storage root.
     *
     * @param string $path - absolute path
     * @param bool $stripDynamicFolder
     * @return mixed
     */
    public function getDynamicPath($path, $stripDynamicFolder = true)
    {
        $prefix = 's3://' . $this->s3->bucket . '/';
        if($stripDynamicFolder) {
            $prefix .= rtrim($this->dynamicRoot, '/');
        }
        $path = str_replace($prefix, '', $path);
        return $this->cleanPath($path);
    }

    /**
     * Returns full path to S3 object to use via PHP S3 wrapper stream
     * @param string $path
     * @return mixed
     */
    public function getS3WrapperPath($path)
    {
        $path = $this->cleanPath($this->s3->bucket . '/' . $path);

        return 's3://' . $path;
    }

    /**
     * Return path without "storageRoot"
     *
     * @param string $path - absolute path
     * @return mixed
     */
    public function getRelativePath($path)
    {
        return $this->subtractPath($path, $this->storageRoot);
    }

    /**
     * Subtracts subpath from the fullpath.
     *
     * @param string $fullPath
     * @param string $subPath
     * @return string
     */
    public function subtractPath($fullPath, $subPath)
    {
        $position = strrpos($fullPath, $subPath);
        if($position === 0) {
            $path = substr($fullPath, strlen($subPath));
            return $path ? $this->cleanPath('/' . $path) : '';
        }
        return '';
    }

    /**
     * Clean path string to remove multiple slashes, etc.
     *
     * @param string $string
     * @return string
     */
    public function cleanPath($string)
    {
        // replace backslashes (windows separators)
        $string = str_replace("\\", "/", $string);
        // remove multiple slashes
        $string = preg_replace('#/+#', '/', $string);

        return $string;
    }

    /**
     * Verify if system read permission is granted.
     *
     * @param string $path - absolute path
     * @return bool
     */
    public function hasSystemReadPermission($path)
    {
        return is_readable($path);
    }

    /**
     * Verify if system write permission is granted.
     *
     * @param string $path - absolute path
     * @return bool
     */
    public function hasSystemWritePermission($path)
    {
        return is_writable($path);
    }














    /**
     * Returns full path to local storage, used to store image thumbs locally
     * @param string $path
     * @return mixed
     */
    public function getLocalPath($path)
    {
        $path = $this->doc_root . '/' . $this->config['s3']['localThumbsPath'] . '/' . $path;

        return $this->cleanPath($path);
    }

	/**
     * Initiate uploader instance and handle uploads.
     *
	 * @param ItemModel $model
	 * @return UploadHandler
	 */
	public function initUploader($model)
	{
		return new UploadHandler([
			'model' => $model,
		]);
	}

    /**
     * Format timestamp string
     * @param string $timestamp
     * @return string
     */
    public function formatDate($timestamp)
    {
        return date($this->config('options.dateFormat'), $timestamp);
    }

    /**
     * Calculate total size of all files.
     *
     * @return mixed
     */
    public function getRootTotalSize()
    {
        $path = rtrim($this->storageRoot, '/') . '/';
        $result = $this->getDirSummary($path);
        return $result['size'];
    }

    /**
     * Get files list recursively
     * @param string $dir
     * @return array
     */
    public function getFilesList($dir)
    {
        $list = [];
        $iterator = \Aws\recursive_dir_iterator($dir);
        foreach ($iterator as $filename) {
            $list[] = $filename;
        }
        return $list;
    }

	/**
	 * Create a zip file from source to destination.
     *
	 * @param  	string $source Source path for zip
	 * @param  	string $destination Destination path for zip
	 * @param  	boolean $includeFolder If true includes the source folder also
	 * @return 	boolean
	 * @link	http://stackoverflow.com/questions/17584869/zip-main-folder-with-sub-folder-inside
	 */
	public function zipFile($source, $destination, $includeFolder = false)
	{
		if (!extension_loaded('zip') || !file_exists($source)) {
			return false;
		}

		$zip = new \ZipArchive();
		if (!$zip->open($destination, \ZipArchive::CREATE)) {
			return false;
		}

		$source = str_replace('\\', '/', realpath($source));
		$folder = $includeFolder ? basename($source) . '/' : '';

		if (is_dir($source) === true) {
			// add file to prevent empty archive error on download
			$zip->addFromString('fm.txt', "This archive has been generated by Rich Filemanager : https://github.com/servocoder/RichFilemanager/");

			$files = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($source, \RecursiveDirectoryIterator::SKIP_DOTS),
				\RecursiveIteratorIterator::SELF_FIRST
			);

			foreach ($files as $file) {
				$file = str_replace('\\', '/', realpath($file));

				if (is_dir($file) === true) {
					$path = str_replace($source . '/', '', $file . '/');
					$zip->addEmptyDir($folder . $path);
				} else if (is_file($file) === true) {
					$path = str_replace($source . '/', '', $file);
					$zip->addFile($file, $folder . $path);
				}
			}
		} else if (is_file($source) === true) {
			$zip->addFile($source, $folder . basename($source));
		}

		return $zip->close();
	}

    /**
     * Copies a single file, symlink or a whole directory.
     * In case of directory it will be copied recursively.
     *
     * @param $source
     * @param $target
     * @return bool
     */
    public function copyRecursive($source, $target)
    {
        // handle symlinks
        if (is_link($source)) {
            return symlink(readlink($source), $target);
        }

        // copy a single file
        if (is_file($source)) {
            return copy($source, $target);
        }

        // make target directory
        if (!is_dir($target)) {
            mkdir($target, 0755);
        }

        $handle = opendir($source);
        // loop through the directory
        while (($file = readdir($handle)) !== false) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            $from = $source . DIRECTORY_SEPARATOR . $file;
            $to = $target . DIRECTORY_SEPARATOR . $file;

            if (is_file($from)) {
                copy($from, $to);
            } else {
                // recursive copy
                $this->copyRecursive($from, $to);
            }
        }
        closedir($handle);

        return true;
    }

    /**
     * Delete folder recursive.
     *
     * @param string $dir
     * @param bool $deleteRootToo
     */
    public function unlinkRecursive($dir, $deleteRootToo = true)
    {
		if(!$dh = @opendir($dir)) {
			return;
		}
		while (false !== ($obj = readdir($dh))) {
			if($obj == '.' || $obj == '..') {
				continue;
			}

			if (!@unlink($dir . '/' . $obj)) {
				$this->unlinkRecursive($dir.'/'.$obj, true);
			}
		}
		closedir($dh);

		if ($deleteRootToo) {
			@rmdir($dir);
		}

		return;
	}

	/**
	 * Return summary info for specified folder.
     *
	 * @param string $dir - relative path
	 * @param array $result
	 * @return array
	 */
	public function getDirSummary($dir, &$result = ['size' => 0, 'files' => 0, 'folders' => 0])
	{
	    $modelDir = new ItemModel($dir);

		// suppress permission denied and other errors
		$files = @scandir($modelDir->pathAbsolute);
		if($files === false) {
			return $result;
		}

		foreach($files as $file) {
			if($file == "." || $file == "..") {
				continue;
			}
            if (is_dir($modelDir->pathAbsolute . $file)) {
                $file .= '/';
            }

            $model = new ItemModel($modelDir->pathRelative . $file);

            if ($model->hasReadPermission() && $model->isUnrestricted()) {
                if ($model->isDir) {
                    $result['folders']++;
                    $this->getDirSummary($model->pathRelative, $result);
                } else {
                    $result['files']++;
                    $result['size'] += filesize($model->pathAbsolute);
                }
            }
		}

		return $result;
	}
}
