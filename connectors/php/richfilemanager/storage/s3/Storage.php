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

        return $head ? $head['@metadata']['headers'] : $head;
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
        $result = $this->getDirSummary('/');

        return $result['size'];
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
