<?php
/**
 *	Filemanager PHP S3 plugin class
 *
 *	Class for the filemanager connector which utilizes the AWS S3 storage API
 *	instead of the local filesystem. Initially created for PHP SDK v.3
 *
 *	@license	MIT License
 *  @author     Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

require_once(__DIR__ . '/../../LocalFilemanager.php');
require_once('S3UploadHandler.php');
require_once('S3StorageHelper.php');

use Aws\S3\Exception\S3Exception;

class S3Filemanager extends LocalFilemanager
{
	/*******************************************************************************
	 * Constants
	 ******************************************************************************/
	const MSG_OBJECT_EXISTS     = 'object (%s) not created as it already exists.';
	const MSG_DEBUG_UPLOAD_INI  = 'post_max_size: %s, upload_max_filesize: %s, max_input_time: %s';

	const RETRIEVE_MODE_BROWSER = 'S3_To_Internet';
	const RETRIEVE_MODE_SERVER = 'S3_To_AWS';

	/**
	 * Root directory on S3 storage for storing files.
	 * Example: "user1" or "users/john"
	 * @var string
	 */
	public $rootDirectory = 'userfiles';

	/**
	 * Full root path to s3 directory, including "rootDirectory" if specified
	 * @var string
	 */
	public $rootWrapperPath;

	/**
	 * S3 client wrapper class
	 * @var \Aws\S3\S3Client
	 */
	public $s3 = null;

	/**
	 * S3Filemanager constructor.
	 * @param array $config
	 * @throws Exception
	 */
	public function __construct($config = [])
	{
		parent::__construct($config);

		if(!isset($config['s3']) || empty($config['s3'])) {
			throw new Exception("S3 isn't configured");
		}

		if(!isset($config['s3']['settings']) || empty($config['s3']['settings'])) {
			throw new Exception("S3 credentials isn't set");
		}

		$this->s3 = $this->setS3Client($config['s3']['settings']);

		$this->rootWrapperPath = $this->getS3WrapperPath($this->rootDirectory);
	}


	/*******************************************************************************
	 * API
	 ******************************************************************************/

	/**
	 * Set S3 client wrapper
	 * @param array $settings
	 * @return S3StorageHelper
	 */
	public function setS3Client($settings)
	{
		$storage = new S3StorageHelper;
		$storage->region = $settings['region'];
		$storage->bucket = $settings['bucket'];
		$storage->credentials = $settings['credentials'];
		$storage->defaultAcl = $settings['defaultAcl'];

		if(isset($settings['cdnHostname'])) {
			$storage->cdnHostname = $settings['cdnHostname'];
		}
		if(isset($settings['debug'])) {
			$storage->debug = $settings['debug'];
		}
		if(isset($settings['options'])) {
			$storage->options = $settings['options'];
		}
		$storage->init();

		return $storage;
	}

    /**
     * @inheritdoc
     */
	public function setFileRoot($path, $mkdir = false)
	{
		$this->rootDirectory = $this->pathToFolder($path);
		$this->rootWrapperPath = $this->getS3WrapperPath($this->rootDirectory);

		if($mkdir === true && !is_dir($this->rootWrapperPath)) {
            Log::info('creating "' . $this->rootWrapperPath . '" folder through mkdir()');
			mkdir($this->rootWrapperPath, 0755, true);
		}
	}

	/**
	 * @param array $settings
	 * @return S3UploadHandler
	 */
	public function initUploader($settings = [])
	{
		$data = [
			'images_only' => $this->config['upload']['imagesOnly'] || (isset($this->refParams['type']) && strtolower($this->refParams['type'])=='images'),
		] + $settings;

		if(isset($data['upload_dir'])) {
			$data['thumbnails_dir'] = rtrim($this->get_thumbnail_path($data['upload_dir']), '/');
		}

		return new S3UploadHandler([
			'fm' => [
				'instance' => $this,
				'data' => $data,
			],
		]);
	}

    /**
     * @inheritdoc
     */
    public function actionInitiate()
    {
        $response = parent::actionInitiate();
        // disable files preview via absolute path
        $response['attributes']['config']['viewer']['absolutePath'] = false;

        return $response;
    }

	/**
	 * @inheritdoc
	 */
	public function actionGetFolder()
	{
        $files_list = [];
		$response_data = [];
        $target_path = $this->get['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
        Log::info('opening folder "' . $target_fullpath . '"');

		if (!is_dir($target_fullpath)) {
			$this->error(sprintf($this->lang('DIRECTORY_NOT_EXIST'), $target_path));
		}

		if(!$handle = @opendir($target_fullpath)) {
			$this->error(sprintf($this->lang('UNABLE_TO_OPEN_DIRECTORY'), $target_path));
		} else {
			while (false !== ($file = readdir($handle))) {
				array_push($files_list, $file);
			}
			closedir($handle);

			foreach($files_list as $file) {
				$file_path = $target_path . $file;
                if(is_dir($target_fullpath . $file)) {
                    $file_path .= '/';
                }

                $item = $this->get_file_info($file_path);
                if($this->filter_output($item)) {
                    $response_data[] = $item;
                }
			}
		}

		return $response_data;
	}

	/**
	 * @inheritdoc
	 */
	public function actionGetFile()
	{
		$target_path = $this->get['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
        Log::info('opening file "' . $target_fullpath . '"');

		// NOTE: S3 doesn't provide a way to check if file doesn't exist or just has a permissions restriction,
		// therefore it is supposed the file is prohibited by default and the appropriate message is returned.
		// https://github.com/aws/aws-sdk-php/issues/969
		if(!file_exists($target_fullpath)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		// check if the name is not in "excluded" list
        if(!$this->is_allowed_name($target_fullpath, false)) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

        return $this->get_file_info($target_path);
	}

	/**
	 * @inheritdoc
	 */
	public function actionUpload()
	{
        $target_path = $this->post['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
        Log::info('uploading to "' . $target_fullpath . '"');

		if(!$this->hasPermission('upload')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

        $content = $this->initUploader([
			'upload_dir' => $target_fullpath,
		])->post(false);

        $response_data = [];
        $files = isset($content[$this->config['upload']['paramName']]) ?
            $content[$this->config['upload']['paramName']] : null;
        // there is only one file in the array as long as "singleFileUploads" is set to "true"
        if ($files && is_array($files) && is_object($files[0])) {
            $file = $files[0];
            if(isset($file->error)) {
                $this->error($file->error);
            } else {
                $relative_path = $this->cleanPath('/' . $target_path . '/' . $file->name);
                $item = $this->get_file_info($relative_path);
                $response_data[] = $item;
            }
        } else {
            $this->error(sprintf($this->lang('ERROR_UPLOADING_FILE')));
        }

        return $response_data;
	}

	/**
	 * @inheritdoc
	 */
	public function actionAddFolder()
	{
		$target_path = $this->get['path'];
        $target_fullpath = $this->getFullPath($target_path, true);

        $target_name = $this->get['name'];
        $folder_name = $this->normalizeString($target_name);
        $new_fullpath = $target_fullpath . $this->pathToFolder($folder_name);
        Log::info('adding folder "' . $new_fullpath . '"');

        if(is_dir($new_fullpath)) {
            $this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), $target_name));
        }

        // check if the name is not in "excluded" list
        if(!$this->is_allowed_name($folder_name, true)) {
            $this->error(sprintf($this->lang('FORBIDDEN_NAME'), $target_name));
        }

		if(!mkdir($new_fullpath, 0755)) {
			$this->error(sprintf($this->lang('UNABLE_TO_CREATE_DIRECTORY'), $target_name));
		}

        $relative_path = $this->cleanPath('/' . $target_path . '/' . $folder_name . '/');
        return $this->get_file_info($relative_path);
	}

	/**
	 * @inheritdoc
	 */
	public function actionRename()
	{
		$suffix = '';

		if(substr($this->get['old'], -1, 1) == '/') {
			$this->get['old'] = substr($this->get['old'], 0, (strlen($this->get['old'])-1));
			$suffix = '/';
		}
		$tmp = explode('/', $this->get['old']);
		$filename = $tmp[(sizeof($tmp)-1)];

		$new_path = substr($this->get['old'], 0, strripos($this->get['old'], '/' . $filename));
		$new_name = $this->normalizeString($this->get['new'], ['.', '-']);
        $new_relative_path = $this->cleanPath('/' . $new_path . '/' . $new_name . $suffix);

		$old_file = $this->getFullPath($this->get['old'], true) . $suffix;
		$new_file = $this->getFullPath($new_path, true) . '/' . $new_name . $suffix;
		Log::info('renaming "' . $old_file . '" to "' . $new_file . '"');

		if(!$this->hasPermission('rename')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// forbid bulk rename of objects
		if($suffix == '/' && !$this->config['s3']['allowBulk']) {
			$this->error(sprintf($this->lang('FORBIDDEN_ACTION_DIR')));
		}

		// forbid to change path during rename
		if(strrpos($this->get['new'], '/') !== false) {
			$this->error(sprintf($this->lang('FORBIDDEN_CHAR_SLASH')));
		}

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($old_file)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

        // check if file extension is consistent to the security Policy settings
        if(is_file($old_file)) {
            if (!$this->config['security']['allowChangeExtensions']) {
                $ext_old = strtolower(pathinfo($old_file, PATHINFO_EXTENSION));
                $ext_new = strtolower(pathinfo($new_file, PATHINFO_EXTENSION));
                if($ext_old !== $ext_new) {
                    $this->error(sprintf($this->lang('FORBIDDEN_CHANGE_EXTENSION')));
                }
            }
            if (!$this->is_allowed_file_type($new_file)) {
                $this->error(sprintf($this->lang('INVALID_FILE_TYPE')));
            }
        }

        // check if the name is not in "excluded" list
        if(!$this->is_allowed_name($old_file, $suffix === '/')) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }
        if(!$this->is_allowed_name($new_name, $suffix === '/')) {
            $this->error(sprintf($this->lang('FORBIDDEN_NAME'), $new_name));
        }

		if(file_exists($new_file)) {
			if($suffix === '/' && is_dir($new_file)) {
				$this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), $new_name));
			}
			if($suffix === '' && is_file($new_file)) {
				$this->error(sprintf($this->lang('FILE_ALREADY_EXISTS'), $new_name));
			}
		}

		$valid = true;
		if($valid && is_dir($old_file)) {
			$files = $this->getFilesList(rtrim($old_file, '/'));
			foreach($files as $path) {
				$new_path = str_replace($old_file, $new_file, $path);
				$valid = rename($path, $new_path) && $valid;
			}
		}
		$valid = rename($old_file, $new_file);

		if($valid) {
            Log::info('renamed "' . $old_file . '" to "' . $new_file . '"');
			$thumbnail_path = $this->get_thumbnail_path($old_file);
			$this->deleteThumbnail($thumbnail_path);
		} else {
			if(is_dir($old_file)) {
				$this->error(sprintf($this->lang('ERROR_RENAMING_DIRECTORY'), $filename, $new_name));
			} else {
				$this->error(sprintf($this->lang('ERROR_RENAMING_FILE'), $filename, $new_name));
			}
		}

        return $this->get_file_info($new_relative_path);
	}

    /**
     * @inheritdoc
     */
    public function actionCopy()
    {
        $source_path = $this->get['source'];
        $suffix = (substr($source_path, -1, 1) == '/') ? '/' : '';
        $tmp = explode('/', trim($source_path, '/'));
        $filename = array_pop($tmp); // file name or new dir name

        $target_input = $this->get['target'];
        $target_path = $target_input . '/';
        $target_path = $this->expandPath($target_path, true);

        $source_fullpath = $this->getFullPath($source_path, true);
        $target_fullpath = $this->getFullPath($target_path, true);
        $new_fullpath = $target_fullpath . $filename . $suffix;
        $is_dir_source = is_dir($source_fullpath);
        Log::info('copying "' . $source_fullpath . '" to "' . $new_fullpath . '"');

        if(!$this->hasPermission('copy')) {
            $this->error(sprintf($this->lang('NOT_ALLOWED')));
        }

        if(!is_dir($target_fullpath)) {
            $this->error(sprintf($this->lang('DIRECTORY_NOT_EXIST'), $target_path));
        }

        // check if not requesting main FM userfiles folder
        if($this->is_root_folder($source_fullpath)) {
            $this->error(sprintf($this->lang('NOT_ALLOWED')));
        }

        // check if the name is not in "excluded" list
        if (!$this->is_allowed_name($target_fullpath, true) ||
            !$this->is_allowed_name($source_fullpath, is_dir($source_fullpath))
        ) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

        // forbid bulk operations on objects
        if($is_dir_source && !$this->config['s3']['allowBulk']) {
            $this->error(sprintf($this->lang('FORBIDDEN_ACTION_DIR')));
        }

        // check if file already exists
        if (file_exists($new_fullpath)) {
            if(is_dir($new_fullpath)) {
                $this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), rtrim($target_input, '/') . '/' . $filename));
            } else {
                $this->error(sprintf($this->lang('FILE_ALREADY_EXISTS'), rtrim($target_input, '/') . '/' . $filename));
            }
        }

        $copied = [];
        if($is_dir_source) {
            $files = $this->getFilesList(rtrim($source_fullpath, '/'));
            $files = array_reverse($files);
            foreach($files as $k => $path) {
                if(is_dir($path)) {
                    $path .= '/';
                };
                $new_path = str_replace($source_fullpath, $new_fullpath, $path);
                if(@copy($path, $new_path)) {
                    $copied[] = [
                        'old' => $path,
                        'new' => $new_path,
                    ];
                }
            }
        }

        if(@copy($source_fullpath, $new_fullpath)) {
            $copied[] = [
                'old' => $source_fullpath,
                'new' => $new_fullpath,
            ];
        }

        if(sizeof($copied) > 0) {
            Log::info('moved "' . $source_fullpath . '" to "' . $new_fullpath . '"');

            // try to move thumbs instead of get original images from S3 to create new thumbs
            $new_thumbnail = $this->get_thumbnail_path($new_fullpath);
            $old_thumbnail = $this->get_thumbnail_path($source_fullpath);

            if($this->config['s3']['localThumbsPath']) {
                if(file_exists($old_thumbnail)) {
                    $thumbnail_dir = dirname($new_thumbnail);
                    // create folder to move into
                    if(!is_dir($thumbnail_dir)) {
                        mkdir($thumbnail_dir, 0755, true);
                    }
                    // remove destination file/folder if exists
                    $this->deleteThumbnail($new_thumbnail);
                    @copy($old_thumbnail, $new_thumbnail);
                }
            } else {
                // to cache result of S3 objects
                $this->getFilesList(rtrim($old_thumbnail, '/'));
                foreach($copied as $item) {
                    $thumb_old = $this->get_thumbnail_path($item['old']);
                    if(file_exists($thumb_old)) {
                        $thumb_new = $this->get_thumbnail_path($item['new']);
                        @copy($thumb_old, $thumb_new);
                    }
                }
            }
        } else {
            if($is_dir_source) {
                $this->error(sprintf($this->lang('ERROR_COPYING_DIRECTORY'), $filename, $target_input));
            } else {
                $this->error(sprintf($this->lang('ERROR_COPYING_FILE'), $filename, $target_input));
            }
        }

        $relative_path = $this->cleanPath('/' . $target_path . '/' . $filename . $suffix);
        return $this->get_file_info($relative_path);
    }

	/**
	 * @inheritdoc
	 */
	public function actionMove()
	{
        $source_path = $this->get['old'];
        $suffix = (substr($source_path, -1, 1) == '/') ? '/' : '';
		$tmp = explode('/', trim($source_path, '/'));
		$filename = array_pop($tmp); // file name or new dir name

        $target_input = $this->get['new'];
        $target_path = $target_input . '/';
        $target_path = $this->expandPath($target_path, true);

		$source_fullpath = $this->getFullPath($source_path, true);
        $target_fullpath = $this->getFullPath($target_path, true);
		$new_fullpath = $target_fullpath . $filename . $suffix;
        $is_dir_source = is_dir($source_fullpath);
		Log::info('moving "' . $source_fullpath . '" to "' . $new_fullpath . '"');

        if(!$this->hasPermission('move')) {
            $this->error(sprintf($this->lang('NOT_ALLOWED')));
        }

        if(!is_dir($target_fullpath)) {
            $this->error(sprintf($this->lang('DIRECTORY_NOT_EXIST'), $target_path));
        }

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($source_fullpath)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

        // check if the name is not in "excluded" list
        if (!$this->is_allowed_name($target_fullpath, true) ||
            !$this->is_allowed_name($source_fullpath, is_dir($source_fullpath))
        ) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

		// forbid bulk operations on objects
		if($is_dir_source && !$this->config['s3']['allowBulk']) {
			$this->error(sprintf($this->lang('FORBIDDEN_ACTION_DIR')));
		}

		// check if file already exists
		if (file_exists($new_fullpath)) {
			if(is_dir($new_fullpath)) {
				$this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), rtrim($target_input, '/') . '/' . $filename));
			} else {
				$this->error(sprintf($this->lang('FILE_ALREADY_EXISTS'), rtrim($target_input, '/') . '/' . $filename));
			}
		}

		$moved = [];
		if($is_dir_source) {
			$files = $this->getFilesList(rtrim($source_fullpath, '/'));
			$files = array_reverse($files);
			foreach($files as $k => $path) {
				if(is_dir($path)) {
					$path .= '/';
				};
				$new_path = str_replace($source_fullpath, $new_fullpath, $path);
				if(@rename($path, $new_path)) {
					$moved[] = [
						'old' => $path,
						'new' => $new_path,
					];
				}
			}
		}

		if(@rename($source_fullpath, $new_fullpath)) {
			$moved[] = [
				'old' => $source_fullpath,
				'new' => $new_fullpath,
			];
		}

		if(sizeof($moved) > 0) {
            Log::info('moved "' . $source_fullpath . '" to "' . $new_fullpath . '"');

			// try to move thumbs instead of get original images from S3 to create new thumbs
			$new_thumbnail = $this->get_thumbnail_path($new_fullpath);
			$old_thumbnail = $this->get_thumbnail_path($source_fullpath);

			if($this->config['s3']['localThumbsPath']) {
				if(file_exists($old_thumbnail)) {
					$thumbnail_dir = dirname($new_thumbnail);
					// create folder to move into
					if(!is_dir($thumbnail_dir)) {
						mkdir($thumbnail_dir, 0755, true);
					}
					// remove destination file/folder if exists
					$this->deleteThumbnail($new_thumbnail);
					@rename($old_thumbnail, $new_thumbnail);
				}
			} else {
				// to cache result of S3 objects
				$this->getFilesList(rtrim($old_thumbnail, '/'));
				foreach($moved as $item) {
                    $thumb_old = $this->get_thumbnail_path($item['old']);
					if(file_exists($thumb_old)) {
                        $thumb_new = $this->get_thumbnail_path($item['new']);
						@rename($thumb_old, $thumb_new);
					}
				}
			}
		} else {
            if($is_dir_source) {
                $this->error(sprintf($this->lang('ERROR_MOVING_DIRECTORY'), $filename, $target_input));
            } else {
                $this->error(sprintf($this->lang('ERROR_MOVING_FILE'), $filename, $target_input));
            }
		}

        $relative_path = $this->cleanPath('/' . $target_path . '/' . $filename . $suffix);
        return $this->get_file_info($relative_path);
	}

	/**
	 * @inheritdoc
	 */
	public function actionReplace()
	{
        $source_path = $this->post['path'];
        $source_fullpath = $this->getFullPath($source_path);
        Log::info('replacing file "' . $source_fullpath . '"');

        $target_path = dirname($source_path) . '/';
        $target_fullpath = $this->getFullPath($target_path, true);
        Log::info('replacing target path "' . $target_fullpath . '"');

		if(!$this->hasPermission('replace') || !$this->hasPermission('upload')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if(is_dir($source_fullpath)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

        // check if the name is not in "excluded" list
        if(!$this->is_allowed_name($source_fullpath, false)) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

		// check if the given file has the same extension as the old one
		if(strtolower(pathinfo($_FILES[$this->config['upload']['paramName']]['name'], PATHINFO_EXTENSION)) != strtolower(pathinfo($source_path, PATHINFO_EXTENSION))) {
			$this->error(sprintf($this->lang('ERROR_REPLACING_FILE') . ' ' . pathinfo($source_path, PATHINFO_EXTENSION)));
		}

        $content = $this->initUploader([
            'upload_dir' => $target_fullpath,
        ])->post(false);

        $response_data = [];
        $files = isset($content[$this->config['upload']['paramName']]) ?
            $content[$this->config['upload']['paramName']] : null;
        // there is only one file in the array as long as "singleFileUploads" is set to "true"
        if ($files && is_array($files) && is_object($files[0])) {
            $file = $files[0];
            if(isset($file->error)) {
                $this->error($file->error);
            } else {
                $replacement_fullpath = $target_fullpath . $file->name;
                Log::info('replacing "' . $source_fullpath . '" with "' . $replacement_fullpath . '"');

                if(@rename($replacement_fullpath, $source_fullpath)) {
                    // try to move thumbs instead of get original images from S3 to create new thumbs
                    $new_thumbnail = $this->get_thumbnail_path($replacement_fullpath);
                    $old_thumbnail = $this->get_thumbnail_path($source_fullpath);

                    if(file_exists($new_thumbnail)) {
                        @rename($new_thumbnail, $old_thumbnail);
                    }
                }

                $relative_path = $this->cleanPath('/' . $source_path);
                $item = $this->get_file_info($relative_path);
                $response_data[] = $item;
            }
        } else {
            $this->error(sprintf($this->lang('ERROR_UPLOADING_FILE')));
        }

        return $response_data;
	}

	/**
	 * @inheritdoc
	 */
	public function actionEditFile()
	{
        $target_path = $this->get['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
		Log::info('opening "' . $target_fullpath . '"');

        $item = $this->get_file_info($target_path);

        if(is_dir($target_fullpath)) {
            $this->error(sprintf($this->lang('FORBIDDEN_ACTION_DIR')));
        }

        if(!$this->hasPermission('edit') || !$this->is_editable($item)) {
            $this->error(sprintf($this->lang('NOT_ALLOWED')));
        }

        // check if the name is not in "excluded" list
        if(!$this->is_allowed_name($target_fullpath, false)) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

		$content = file_get_contents($target_fullpath);
		$content = htmlspecialchars($content);

		if($content === false) {
			$this->error(sprintf($this->lang('ERROR_OPENING_FILE')));
		}

        $item['attributes']['content'] = $content;
        return $item;
	}

	/**
	 * @inheritdoc
	 */
	public function actionSaveFile()
	{
        $target_path = $this->post['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
		Log::info('saving "' . $target_fullpath . '"');

        $item = $this->get_file_info($target_path);

        if(is_dir($target_fullpath)) {
            $this->error(sprintf($this->lang('FORBIDDEN_ACTION_DIR')));
        }

        if(!$this->hasPermission('edit') || !$this->is_editable($item)) {
            $this->error(sprintf($this->lang('NOT_ALLOWED')));
        }

        // check if the name is not in "excluded" list
        if(!$this->is_allowed_name($target_fullpath, false)) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

		$content = htmlspecialchars_decode($this->post['content']);
		$result = file_put_contents($target_fullpath, $content);

		if(!is_numeric($result)) {
			$this->error(sprintf($this->lang('ERROR_SAVING_FILE')));
		}

		Log::info('saved "' . $target_fullpath . '"');

        return $item;
	}

	/**
	 * Seekable stream: http://stackoverflow.com/a/23046071/1789808
	 * @inheritdoc
	 */
	public function actionReadFile()
	{
        $target_path = $this->get['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
        Log::info('reading file "' . $target_fullpath . '"');

        if(is_dir($target_fullpath)) {
            $this->error(sprintf($this->lang('FORBIDDEN_ACTION_DIR')));
        }

        // check if the name is not in "excluded" list
        if(!$this->is_allowed_name($target_fullpath, false)) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

		$filesize = filesize($target_fullpath);
		$length = $filesize;
		$context = null;

		if(isset($_SERVER['HTTP_RANGE'])) {
			if(!preg_match('/bytes=(\d+)-(\d+)?/', $_SERVER['HTTP_RANGE'], $matches)) {
				header('HTTP/1.1 416 Requested Range Not Satisfiable');
				header('Content-Range: bytes */' . $filesize);
				exit;
			}

			$offset = intval($matches[1]);

			if(isset($matches[2])) {
				$end = intval($matches[2]);
				if($offset > $end) {
					header('HTTP/1.1 416 Requested Range Not Satisfiable');
					header('Content-Range: bytes */' . $filesize);
					exit;
				}
				$length = $end - $offset;
			} else {
				$length = $filesize - $offset;
			}

			$bytes_start = $offset;
			$bytes_end = $offset + $length - 1;
			$context = stream_context_create([
				's3' => [
					'seekable' => true,
					'Range' => "bytes={$bytes_start}-{$bytes_end}",
				]
			]);

			header('HTTP/1.1 206 Partial Content');
			// A full-length file will indeed be "bytes 0-x/x+1", think of 0-indexed array counts
			header('Content-Range: bytes ' . $bytes_start . '-' . $bytes_end . '/' . $filesize);
			// While playing media by direct link (not via FM) FireFox and IE doesn't allow seeking (rewind) it in player
			// This header can fix this behavior if to put it out of this condition, but it breaks PDF preview
			header('Accept-Ranges: bytes');
		}

		header('Content-Type: ' . $this->getMimeType($target_fullpath));
		header("Content-Transfer-Encoding: binary");
		header("Content-Length: " . $length);
		header('Content-Disposition: inline; filename="' . basename($target_fullpath) . '"');

		readfile($target_fullpath, null, $context);
		exit;
	}

	/**
	 * @inheritdoc
	 */
	public function actionGetImage($thumbnail)
	{
        $target_path = $this->get['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
		Log::info('loading image "' . $target_fullpath . '"');

        if(is_dir($target_fullpath)) {
            $this->error(sprintf($this->lang('FORBIDDEN_ACTION_DIR')));
        }

        // check if the name is not in "excluded" list
        if(!$this->is_allowed_name($target_fullpath, false)) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

		// if $thumbnail is set to true we return the thumbnail
		if($thumbnail === true && $this->config['images']['thumbnail']['enabled'] === true) {
			// get thumbnail (and create it if needed)
			$returned_path = $this->get_thumbnail($target_fullpath);
		} else {
			$returned_path = $target_fullpath;
		}

		header("Content-type: image/octet-stream");
		header("Content-Transfer-Encoding: binary");
		header("Content-length: " . filesize($returned_path));
		header('Content-Disposition: inline; filename="' . basename($returned_path) . '"');
		ob_clean();
		flush();
		readfile($returned_path);
		exit();
	}


	/**
	 * @inheritdoc
	 */
	public function actionDelete()
	{
        $target_path = $this->get['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
		Log::info('deleting "' . $target_fullpath . '"');

		if(!$this->hasPermission('delete')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($target_fullpath)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// check if the name is not in "excluded" list
        if(!$this->is_allowed_name($target_path, is_dir($target_fullpath))) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

        $item = $this->get_file_info($target_path);

		$isDeleted = $this->deleteObject($target_fullpath);
        if($isDeleted) {
            Log::info('deleted "' . $target_fullpath . '"');
        }

		return $item;
	}

	/**
	 * @inheritdoc
	 */
	public function actionDownload()
	{
        $target_path = $this->get['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
        $is_dir_target = is_dir($target_fullpath);
		Log::info('downloading "' . $target_fullpath . '"');

		if(!$this->hasPermission('download')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if($is_dir_target) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

        // check if the name is not in "excluded" list
        if(!$this->is_allowed_name($target_fullpath, $is_dir_target)) {
            $this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE')));
        }

        if($this->isAjaxRequest()) {
            return $this->get_file_info($target_path);
        } else {
            header('Content-Description: File Transfer');
            header('Content-Type: ' . $this->getMimeType($target_fullpath));
            header('Content-Disposition: attachment; filename="' . basename($target_fullpath) . '"');
            header('Content-Transfer-Encoding: binary');
            header('Content-Length: ' . filesize($target_fullpath));
            // handle caching
            header('Pragma: public');
            header('Expires: 0');
            header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

            readfile($target_fullpath);
            Log::info('downloaded "' . $target_fullpath . '"');
            exit;
        }
	}

	/**
	 * @inheritdoc
	 */
	public function actionSummarize()
	{
        $attributes = [
            'size' => 0,
            'files' => 0,
            'sizeLimit' => $this->config['options']['fileRootSizeLimit'],
        ];

		$path = rtrim($this->rootWrapperPath, '/') . '/';
		try {
			$this->getDirSummary($path, $attributes);
		} catch (Exception $e) {
			$this->error(sprintf($this->lang('ERROR_SERVER')));
		}

        return [
            'id' => '/',
            'type' => 'summary',
            'attributes' => $attributes,
        ];
	}


	/*******************************************************************************
	 * Utility
	 ******************************************************************************/

	/**
	 * Builds a full path to the S3 storage object
	 * @param string $path
	 * @param bool $verify If file or folder exists and valid
	 * @return mixed|string
	 */
	protected function getFullPath($path, $verify = false)
	{
		$full_path = $this->rootDirectory . rawurldecode($path);
		$full_path = $this->cleanPath(ltrim($full_path, '/'));
		$s3_path = $this->getS3WrapperPath($full_path);

		$isValid = $this->is_valid_path($s3_path);
		if($verify === true && $isValid) {
			$isValid = file_exists($s3_path) && $isValid;
		}
		if(!$isValid) {
			$langKey = $this->isDir($s3_path) ? 'DIRECTORY_NOT_EXIST' : 'FILE_DOES_NOT_EXIST';
			$this->error(sprintf($this->lang($langKey), $path));
		}

		return $s3_path;
	}

	/**
	 * Returns a path to S3 storage object without "rootDirectory" part
	 * @param string $path
	 * @param bool $strip_root_directory
	 * @return mixed
	 */
	protected function getDynamicPath($path, $strip_root_directory = true)
	{
		$prefix = 's3://' . $this->s3->bucket . '/';
		if($strip_root_directory) {
			$prefix .= rtrim($this->rootDirectory, '/');
		}
		$path = str_replace($prefix, '' , $path);
		return $this->cleanPath($path);
	}

	/**
	 * Returns full path to S3 object to use via PHP S3 wrapper stream
	 * @param string $path
	 * @return mixed
	 */
	protected function getS3WrapperPath($path)
	{
		return 's3://' . $this->s3->bucket . '/' . $path;
	}

	/**
	 * Returns full path to local storage, used to store image thumbs locally
	 * @param string $path
	 * @return mixed
	 */
	protected function getLocalPath($path)
	{
		$path = $this->doc_root . '/' . $this->config['s3']['localThumbsPath'] . '/' . $path;
		return $this->cleanPath($path);
	}

	/**
	 * Formats specified path as "folder"
	 * @param string $path
	 * @return string
	 */
	protected function pathToFolder($path)
	{
		return trim($path, '/ ') . '/';
	}

	/**
	 * Create array with file properties
	 * @param string $relative_path
	 * @return array
	 */
    protected function get_file_info($relative_path)
    {
        $fullpath = $this->getFullPath($relative_path);
        $pathInfo = pathinfo($fullpath);
        $filemtime = @filemtime($fullpath);

        if(is_dir($fullpath)) {
            $model = $this->folder_model;
        } else {
            $model = $this->file_model;
            $model['attributes']['size'] = filesize($fullpath);
            $model['attributes']['extension'] = isset($pathInfo['extension']) ? $pathInfo['extension'] : '';
        }

        $model['id'] = $relative_path;
        $model['attributes']['name'] = $pathInfo['basename'];
        $model['attributes']['path'] = $this->getDynamicPath($fullpath);
        $model['attributes']['readable'] = 1;
        $model['attributes']['writable'] = 1;
        $model['attributes']['timestamp'] = $filemtime;
        $model['attributes']['modified'] = $this->formatDate($filemtime);
        //$model['attributes']['created'] = $model['attributes']['modified']; // PHP cannot get create timestamp
        return $model;
    }

	/**
	 * Checks path for "dots" to avoid directory climbing and backtracking (traversal attack)
	 * Probably there is an ability to disable such "relative path" via S3 settings, research required
	 * @param $path
	 * @return bool
	 */
	protected function is_valid_path($path)
	{
		if(strpos($path, $this->rootWrapperPath) !== 0) {
			return false;
		}

		$needleList = ['..', './'];
		foreach($needleList as $needle) {
			if (strpos($path, $needle) !== false) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Check whether the folder is root
	 * @param string $path
	 * @return bool
	 */
	protected function is_root_folder($path)
	{
		return trim($this->rootWrapperPath, '/') === trim($path, '/');
	}

	/**
	 * Deletes S3 object
	 * @param string $path
	 * @return bool
	 */
	public function deleteObject($path)
	{
		if(is_dir($path)) {
			$key = $this->getDynamicPath($path, false);
			$this->s3->batchDelete($key);
			$isDeleted = !$this->isObjectExists($key);
		} else {
			$isDeleted = unlink($path);
		}
		$thumbnail_path = $this->get_thumbnail_path($path);
		$this->deleteThumbnail($thumbnail_path);
		return $isDeleted;
	}

	/**
	 * Get files list recursively
	 * @param string $dir
	 * @return array
	 */
	public function getFilesList($dir)
	{
		$list = [];
		$iterator = Aws\recursive_dir_iterator($dir);
		foreach ($iterator as $filename) {
			$list[] = $filename;
		}
		return $list;
	}

	/**
	 * Deletes thumbnail from S3 storage or locally
	 * @param string $path
	 */
	protected function deleteThumbnail($path)
	{
		if(file_exists($path)) {
			if(is_dir($path)) {
				if($this->config['s3']['localThumbsPath']) {
					$this->unlinkRecursive($path);
				} else {
					$key = $this->getDynamicPath($path, false);
					$this->s3->batchDelete($key);
				}
			} else {
				unlink($path);
			}
		}
	}

	/**
	 * S3 differs directory by slash (/) in the end of path. Could be used to check non-existent or cached object.
	 * @link http://stackoverflow.com/questions/22312833/how-can-you-tell-if-an-object-is-a-folder-on-aws-s3
	 * @param string $objectName
	 * @return boolean
	 */
	public function isDir($objectName)
	{
		return substr($objectName, -1) === '/';
	}

	/**
	 * Check whether S3 object exists. Could be used to check real state of cached object.
	 * @param string $path
	 * @return \Aws\ResultInterface|null
	 */
	protected function isObjectExists($path)
	{
		//$key = $this->getDynamicPath($path, false);
		return $this->s3->exist($path);
	}

	/**
	 * Retrieve metadata of an object
	 * @param string $dynamicPath
	 * @return array
	 */
	public function metadata($dynamicPath)
	{
		$head = $this->s3->head($dynamicPath, true);
		return $head ? $head['@metadata']['headers'] : $head;
	}

	/**
	 * Retrieve mime type of S3 object
	 * @param string $fullPath
	 * @return string
	 */
	public function getMimeType($fullPath)
	{
		$dynamicPath = $this->getDynamicPath($fullPath, false);
		$meta = $this->metadata($dynamicPath);
		$mime_type = $meta['content-type'];

		// try to define mime type based on file extension if default "octet-stream" is obtained
		if((end(explode('/', $mime_type)) === 'octet-stream')) {
			$mime_type = mime_type_by_extension($this->get['path']);
		}
		return $mime_type;
	}

	/**
	 * Returns summary info for specified folder
	 * @param string $dir
	 * @param array $result
	 * @return array
	 */
	public function getDirSummary($dir, &$result = ['size' => 0, 'files' => 0])
	{
		/**
		 * set empty delimiter to get recursive objects list
		 * @see \Aws\S3\StreamWrapper::dir_opendir()
		 */
		$context = stream_context_create([
			's3' => [
				'delimiter' => ''
			]
		]);

		$dir = rtrim($dir, '/') . '/';
		$handle = @opendir($dir, $context);

		while (false !== ($file = readdir($handle))) {
			$path = $dir . $file;

			if(is_file($path) && $this->is_allowed_name($file, false)) {
                $result['files']++;
                $result['size'] += filesize($path);
			} else {
				// stream wrapper opendir() lists only files
			}
		}
		closedir($handle);

		return $result;
	}

	/**
	 * Calculates total size of all files
	 * @return mixed
	 */
	public function getRootTotalSize()
	{
		$path = rtrim($this->rootWrapperPath, '/') . '/';
		$result = $this->getDirSummary($path);
		return $result['size'];
	}

	/**
	 * @inheritdoc
	 */
	protected function get_thumbnail_path($path)
	{
		$dynamic_path = $this->getDynamicPath($path);
		$thumbnail_path = $this->rootDirectory . '/' . $this->config['images']['thumbnail']['dir'] . '/' . $dynamic_path;
		$thumbnail_path = $this->cleanPath($thumbnail_path);

		if($this->config['s3']['localThumbsPath']) {
			return $this->getLocalPath($thumbnail_path);
		} else {
			return $this->getS3WrapperPath($thumbnail_path);
		}
	}

	/**
	 * @inheritdoc
	 */
	protected function get_thumbnail($path)
	{
		$thumbnail_fullpath = $this->get_thumbnail_path($path);

		// generate thumbnail if it doesn't exist or caching is disabled
		if(!file_exists($thumbnail_fullpath) || $this->config['images']['thumbnail']['cache'] === false) {
			$this->createThumbnail($path, $thumbnail_fullpath);
		}

		return $thumbnail_fullpath;
	}

	/**
	 * @inheritdoc
	 */
	protected function createThumbnail($imagePath, $thumbnailPath)
	{
		if($this->config['images']['thumbnail']['enabled'] === true) {
            Log::info('generating thumbnail "' . $thumbnailPath . '"');

			$this->initUploader([
                'upload_dir' => dirname($imagePath) . '/',
            ])->create_thumbnail_image($imagePath);
		}
	}
}