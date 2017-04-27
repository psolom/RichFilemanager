<?php

namespace RFM\Storage\Local;

use RFM\Facade\Log;
use RFM\Storage\BaseStorage;
use RFM\Storage\StorageInterface;
use RFM\Storage\StorageTrait;

/**
 *	Local storage class.
 *
 *	@license	MIT License
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

class Storage extends BaseStorage implements StorageInterface
{
    use IdentityTrait;
    use StorageTrait;

	protected $documentRoot;
	protected $storageRoot;
	protected $dynamicRoot;
    protected $defaultDir = 'userfiles';

    /**
     * Storage constructor.
     *
     * @param array $config
     */
	public function __construct($config = [])
    {
		parent::__construct($config);

		$fileRoot = $this->config('options.fileRoot');
		if ($fileRoot !== false) {
			// takes $_SERVER['DOCUMENT_ROOT'] as files root; "fileRoot" is a suffix
			if($this->config('options.serverRoot') === true) {
				$this->documentRoot = $_SERVER['DOCUMENT_ROOT'];
				$this->storageRoot = $_SERVER['DOCUMENT_ROOT'] . '/' . $fileRoot;
			}
			// takes "fileRoot" as files root; "fileRoot" is a full server path
			else {
				$this->documentRoot = $fileRoot;
				$this->storageRoot = $fileRoot;
			}
		} else {
            // default storage folder in case of default RFM structure
			$this->documentRoot = $_SERVER['DOCUMENT_ROOT'];
			$this->storageRoot = dirname(dirname(dirname($_SERVER['SCRIPT_FILENAME']))) . '/' . $this->defaultDir;
		}

		// normalize slashes in paths
        $this->documentRoot = $this->cleanPath($this->documentRoot);
		$this->storageRoot = $this->cleanPath($this->storageRoot . '/');
        $this->dynamicRoot = $this->subtractPath($this->storageRoot, $this->documentRoot);

		Log::info('$this->storageRoot: "' . $this->storageRoot . '"');
		Log::info('$this->documentRoot: "' . $this->documentRoot . '"');
		Log::info('$this->dynamicRoot: "' . $this->dynamicRoot . '"');
	}

    /**
     * Set user storage folder.
     *
     * @param string $path
     * @param bool $makeDir
     * @param bool $relativeToDocumentRoot
     */
	public function setRoot($path, $makeDir = false, $relativeToDocumentRoot = false)
    {
        $this->storageRoot = $path . '/';

        if($relativeToDocumentRoot) {
            $this->storageRoot = $this->documentRoot . '/' . $this->storageRoot;
        }

        // normalize slashes in paths
        $this->storageRoot = $this->cleanPath($this->storageRoot);
        $this->dynamicRoot = $this->subtractPath($this->storageRoot, $this->documentRoot);

		Log::info('Overwritten with setRoot() method:');
		Log::info('$this->storageRoot: "' . $this->storageRoot . '"');
		Log::info('$this->dynamicRoot: "' . $this->dynamicRoot . '"');

		if($makeDir && !file_exists($this->storageRoot)) {
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
        // In order to create an entry in a POSIX dir, it must have
        // both `-w-` write and `--x` execute permissions.
        //
        // NOTE: Windows PHP doesn't support standard POSIX permissions.
        if (is_dir($path) && !(app()->php_os_is_windows())) {
            return (is_writable($path) && is_executable($path));
        }

        return is_writable($path);
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
     * @param string $source - absolute path
     * @param string $target - absolute path
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
            mkdir($target, 0755, true);
        }

        $handle = opendir($source);
        // loop through the directory
        while (($file = readdir($handle)) !== false) {
            if ($file === '.' || $file === '..') {
                continue;
            }
            $from = $this->cleanPath($source . DIRECTORY_SEPARATOR . $file);
            $to = $this->cleanPath($target . DIRECTORY_SEPARATOR . $file);

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
     * @return bool
     */
    public function unlinkRecursive($dir, $deleteRootToo = true)
    {
		if(!$dh = @opendir($dir)) {
			return false;
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

		return true;
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

    /**
     * Defines real size of file.
     * Based on https://github.com/jkuchar/BigFileTools project by Jan Kuchar
     *
     * @param string $path - absolute path
     * @return int|string
     * @throws \Exception
     */
    public function getRealFileSize($path)
    {
        // This should work for large files on 64bit platforms and for small files everywhere
        $fp = fopen($path, "rb");
        if (!$fp) {
            throw new \Exception("Cannot open specified file for reading.");
        }
        $flockResult = flock($fp, LOCK_SH);
        $seekResult = fseek($fp, 0, SEEK_END);
        $position = ftell($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        if(!($flockResult === false || $seekResult !== 0 || $position === false)) {
            return sprintf("%u", $position);
        }

        // Try to define file size via CURL if installed
        if (function_exists("curl_init")) {
            $ch = curl_init("file://" . rawurlencode($path));
            curl_setopt($ch, CURLOPT_NOBODY, true);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HEADER, true);
            $data = curl_exec($ch);
            curl_close($ch);
            if ($data !== false && preg_match('/Content-Length: (\d+)/', $data, $matches)) {
                return $matches[1];
            }
        }

        return filesize($path);
    }
}
