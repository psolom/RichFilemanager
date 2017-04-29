<?php

namespace RFM\Storage\S3;

use RFM\Facade\Log;
use RFM\Storage\BaseStorage;
use RFM\Storage\StorageInterface;

/**
 *	AWS S3 storage class.
 *
 *	@license	MIT License
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

class Storage extends BaseStorage implements StorageInterface
{
    /**
     * Full path to S3 storage bucket including protocol.
     * Being built automatically at the base of S3 credentials.
     * Example: "s3://bucket_name/"
     *
     * @var mixed
     */
	protected $storageRoot;

    /**
     * Directory inside bucket for storing files.
     * Can be changed via "setRoot()" method.
     * Example: "user1" or "users/john"
     *
     * @var string
     */
    protected $dynamicRoot = 'userfiles';

    /**
     * S3 client wrapper class.
     *
     * @var StorageHelper
     */
    public $s3 = null;

    /**
     * Storage constructor.
     *
     * @param array $config
     */
    public function __construct($config = [])
    {
        $this->setName('s3');
        $this->setConfig($config);
        $this->setS3Client();

        $this->dynamicRoot = $this->cleanPath($this->dynamicRoot . '/');
        $this->storageRoot = $this->getS3WrapperPath($this->dynamicRoot);
    }

    /**
     * Set S3 client wrapper.
     */
    public function setS3Client()
    {
        if (!$this->config('credentials')) {
            throw new \Exception("S3 storage credentials isn't set");
        }

        $storage = new StorageHelper;
        $storage->region = $this->config('credentials.region');
        $storage->bucket = $this->config('credentials.bucket');
        $storage->credentials = $this->config('credentials.credentials');
        $storage->defaultAcl = $this->config('credentials.defaultAcl');
        $storage->cdnHostname = $this->config('credentials.cdnHostname');
        $storage->debug = $this->config('credentials.debug', false);
        $storage->options = $this->config('credentials.options', []);
        $storage->init();

        $this->s3 = $storage;
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
     * Return path without storage root path.
     *
     * @param string $path - absolute path
     * @return mixed
     */
    public function getRelativePath($path)
    {
        return $this->subtractPath($path, $this->storageRoot);
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
     * Get files list recursively.
     *
     * @param string $dir - absolute path
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
     * Retrieve metadata of an S3 object.
     *
     * @param string $key
     * @return array
     */
    public function getMetaData($key)
    {
        $head = $this->s3->head($key, true);

        return $head ? $head['@metadata']['headers'] : (array) $head;
    }

    /**
     * Check whether S3 object exists.
     * Could be used to check real state of cached object.
     *
     * @param string $key
     * @return bool
     */
    public function isObjectExists($key)
    {
        return $this->s3->exist($key);
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
            'storage' => $this,
		]);
	}

    /**
     * Calculate total size of all files.
     *
     * @return mixed
     */
    public function getRootTotalSize()
    {
        $result = $this->getDirSummary('/');

        return $result['size'];
    }

    /**
     * Copy a single file or a whole directory.
     * In case of directory it will be copied recursively.
     *
     * @param string $source - absolute path
     * @param string $target - absolute path
     * @return bool
     */
    public function copyRecursive($source, $target)
    {
        $flag = true;
        if (is_dir($source)) {
            $files = $this->getFilesList(rtrim($source, '/'));
            $files = array_reverse($files);
            $flag = $flag && mkdir($target, 0755);

            foreach ($files as $path) {
                $pathNew = str_replace($source, $target, $path);

                if (is_dir($path)) {
                    $flag = $flag && mkdir($pathNew, 0755);
                } else {
                    $flag = $flag && copy($path, $pathNew);
                }
            }
        } else {
            $flag = $flag && copy($source, $target);
        }

        return $flag;
    }

    /**
     * Rename/move a single file or a whole directory.
     * In case of directory it will be copied recursively.
     *
     * @param string $source - absolute path
     * @param string $target - absolute path
     * @return bool
     */
    public function renameRecursive($source, $target)
    {
        $flag = true;
        if (is_dir($source)) {
            $files = $this->getFilesList(rtrim($source, '/'));
            $files = array_reverse($files);
            $flag = $flag && mkdir($target, 0755);

            foreach ($files as $path) {
                $pathNew = str_replace($source, $target, $path);

                if (is_dir($path)) {
                    $flag = $flag && mkdir($pathNew, 0755);
                    rmdir($path);
                } else {
                    $flag = $flag && rename($path, $pathNew);
                }
            }
            rmdir($source);
        } else {
            $flag = $flag && rename($source, $target);
        }

        return $flag;
    }

	/**
	 * Return summary info for specified folder.
     *
	 * @param string $dir - relative path
	 * @param array $result
	 * @return array
	 */
	public function getDirSummary($dir, &$result = ['size' => 0, 'files' => 0])
	{
	    $modelDir = new ItemModel($dir);

        /**
         * set empty delimiter to get recursive objects list
         * @see \Aws\S3\StreamWrapper::dir_opendir()
         */
        $context = stream_context_create([
            's3' => [
                'delimiter' => ''
            ]
        ]);

        $handle = @opendir($modelDir->pathAbsolute, $context);

        while (false !== ($file = readdir($handle))) {
            if (is_dir($modelDir->pathAbsolute . $file)) {
                $file .= '/';
            }

            $model = new ItemModel($modelDir->pathRelative . $file);

            if ($model->hasReadPermission() && $model->isUnrestricted()) {
                if (!$model->isDir) {
                    $result['files']++;
                    $result['size'] += filesize($model->pathAbsolute);
                } else {
                    // stream wrapper opendir() lists only files
                }
            }
        }
        closedir($handle);

        return $result;
	}

}
