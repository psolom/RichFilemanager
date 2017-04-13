<?php
/**
 *	Filemanager PHP class
 *
 *	Class for the filemanager connector
 *
 *	@license	MIT License
 *	@author		Riaan Los <mail (at) riaanlos (dot) nl>
 *	@author		Simon Georget <simon (at) linea21 (dot) com>
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

require_once('BaseFilemanager.php');
require_once('LocalUploadHandler.php');

class LocalFilemanager extends BaseFilemanager
{
	protected $doc_root;
	protected $path_to_files;
	protected $dynamic_fileroot;

	public function __construct($config = [])
    {
		parent::__construct($config);

		$fileRoot = $this->config['options']['fileRoot'];
		if ($fileRoot !== false) {
			// takes $_SERVER['DOCUMENT_ROOT'] as files root; "fileRoot" is a suffix
			if($this->config['options']['serverRoot'] === true) {
				$this->doc_root = $_SERVER['DOCUMENT_ROOT'];
				$this->path_to_files = $_SERVER['DOCUMENT_ROOT'] . '/' . $fileRoot;
			}
			// takes "fileRoot" as files root; "fileRoot" is a full server path
			else {
				$this->doc_root = $fileRoot;
				$this->path_to_files = $fileRoot;
			}
		} else {
			$this->doc_root = $_SERVER['DOCUMENT_ROOT'];
			$this->path_to_files = $this->fm_path . '/userfiles';
		}

		// normalize slashes in paths
        $this->doc_root = $this->cleanPath($this->doc_root);
		$this->path_to_files = $this->cleanPath($this->path_to_files);
        $this->dynamic_fileroot = $this->subtractPath($this->path_to_files, $this->doc_root);

		Log::info('$this->fm_path: "' . $this->fm_path . '"');
		Log::info('$this->path_to_files: "' . $this->path_to_files . '"');
		Log::info('$this->doc_root: "' . $this->doc_root . '"');
		Log::info('$this->dynamic_fileroot: "' . $this->dynamic_fileroot . '"');
	}

    /**
     * @inheritdoc
     */
	public function setFileRoot($path, $mkdir = false)
    {
		if($this->config['options']['serverRoot'] === true) {
			$this->dynamic_fileroot = $path;
			$this->path_to_files = $this->cleanPath($this->doc_root . '/' . $path);
		} else {
			$this->path_to_files = $this->cleanPath($path);
		}

		Log::info('Overwritten with setFileRoot() method:');
		Log::info('$this->path_to_files: "' . $this->path_to_files . '"');
		Log::info('$this->dynamic_fileroot: "' . $this->dynamic_fileroot . '"');

		if($mkdir && !file_exists($this->path_to_files)) {
			mkdir($this->path_to_files, 0755, true);
			Log::info('creating "' . $this->path_to_files . '" folder through mkdir()');
		}
	}

	/**
	 * @param array $settings
	 * @return LocalUploadHandler
	 */
	public function initUploader($settings = [])
	{
		$data = [
			'images_only' => $this->config['upload']['imagesOnly'] || (isset($this->refParams['type']) && strtolower($this->refParams['type'])=='images'),
		] + $settings;

		if(isset($data['upload_dir'])) {
			$data['thumbnails_dir'] = rtrim($this->get_thumbnail_path($data['upload_dir']), '/');
		}

		return new LocalUploadHandler([
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
        // config options that affect the client-side
        $shared_config = [
            'security' => [
                'read_only' => $this->config['security']['read_only'],
                'extensions' => [
                    'policy' => $this->config['security']['extensions']['policy'],
                    'ignorecase' => $this->config['security']['extensions']['ignorecase'],
                    'restrictions' => $this->config['security']['extensions']['restrictions'],
                ],
            ],
            'upload' => [
                'fileSizeLimit' => $this->config['upload']['fileSizeLimit'],
            ],
        ];

        return [
            'id' => '/',
            'type' => 'initiate',
            'attributes' => [
                'config' => $shared_config,
            ],
        ];
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

		$this->check_read_permission($target_fullpath);

		Log::info('opening folder "' . $target_fullpath . '"');

		if(!is_dir($target_fullpath)) {
			$this->error('DIRECTORY_NOT_EXIST', [$target_path]);
		}

		if(!$handle = @opendir($target_fullpath)) {
			$this->error('UNABLE_TO_OPEN_DIRECTORY', [$target_path]);
		} else {
			while (false !== ($file = readdir($handle))) {
				if($file != "." && $file != "..") {
					array_push($files_list, $file);
				}
			}
			closedir($handle);

			foreach($files_list as $file) {
				$file_path = $target_path . $file;
                if(is_dir($target_fullpath . $file)) {
                    $file_path .= '/';
                }

                if($this->has_read_permission($target_fullpath . $file)) {
                    $item = $this->get_file_info($file_path);
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

		$this->check_read_permission($target_fullpath);

		Log::info('opening file "' . $target_fullpath . '"');

        if(is_dir($target_fullpath)) {
            $this->error('FORBIDDEN_ACTION_DIR');
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

		$this->check_write_permission($target_fullpath);

		Log::info('uploading to "' . $target_fullpath . '"');

        $content = $this->initUploader([
			'upload_dir' => $target_fullpath,
		])->post(false);

        $response_data = [];
        $files = isset($content['files']) ? $content['files'] : null;
        // there is only one file in the array as long as "singleFileUploads" is set to "true"
        if ($files && is_array($files) && is_object($files[0])) {
            $file = $files[0];
            if(isset($file->error)) {
                $error = is_array($file->error) ? $file->error : [$file->error];
                $this->error($error[0], isset($error[1]) ? $error[1] : []);
            } else {
                $relative_path = $this->cleanPath('/' . $target_path . '/' . $file->name);
                $item = $this->get_file_info($relative_path);
                $response_data[] = $item;
            }
        } else {
            $this->error('ERROR_UPLOADING_FILE');
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
		$folder_name = $this->normalizeString(trim($target_name, '/'));
		$new_fullpath = $target_fullpath . '/'. $folder_name . '/';

		$this->check_write_permission($new_fullpath);

		Log::info('adding folder "' . $new_fullpath . '"');

        if(is_dir($new_fullpath)) {
            $this->error('DIRECTORY_ALREADY_EXISTS', [$target_name]);
        }

		if(!mkdir($new_fullpath, 0755)) {
			$this->error('UNABLE_TO_CREATE_DIRECTORY', [$target_name]);
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

		// FIXME: These string-parsing substr() lines of code should be replaced by a single
		// call to pathinfo().
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

		$this->check_write_permission($old_file);
		$this->check_write_permission($new_file);

		// This function will also move the thumbnail, if it exists. Check perms:
		$old_thumbnail = $this->get_thumbnail_path($old_file);
		$new_thumbnail = $this->get_thumbnail_path($new_file);
		if(file_exists($old_thumbnail)) {
			$this->check_write_permission($old_thumbnail);
			$this->check_write_permission($new_thumbnail);
		}

		Log::info('renaming "' . $old_file . '" to "' . $new_file . '"');

		// forbid to change path during rename
		// FIXME: Move/rename actions should be the same action, and without this arbitrary restriction
		if(strrpos($this->get['new'], '/') !== false) {
			$this->error('FORBIDDEN_CHAR_SLASH');
		}

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($old_file)) {
			$this->error('NOT_ALLOWED');
		}

		if(file_exists($new_file)) {
			if($suffix === '/' && is_dir($new_file)) {
				$this->error('DIRECTORY_ALREADY_EXISTS', [$new_name]);
			}
			if($suffix === '' && is_file($new_file)) {
				$this->error('FILE_ALREADY_EXISTS', [$new_name]);
			}
		}

		if(!rename($old_file, $new_file)) {
			if(is_dir($old_file)) {
				$this->error('ERROR_RENAMING_DIRECTORY', [$filename, $new_name]);
			} else {
				$this->error('ERROR_RENAMING_FILE', [$filename, $new_name]);
			}
		} else {
			Log::info('renamed "' . $old_file . '" to "' . $new_file . '"');

			// for image only - rename thumbnail if original image was successfully renamed
			if(!is_dir($new_file)) {
				$new_thumbnail = $this->get_thumbnail_path($new_file);
				$old_thumbnail = $this->get_thumbnail_path($old_file);
				if(file_exists($old_thumbnail)) {
					rename($old_thumbnail, $new_thumbnail);
				}
			}
		}

        return $this->get_file_info($new_relative_path);
	}

	/**
	 * @inheritdoc
	 */
	public function actionCopy()
	{
		// FIXME: These string-parsing substr() lines of code should be replaced by a single
		// call to pathinfo().
        $source_path = $this->get['source'];
        $suffix = (substr($source_path, -1, 1) == '/') ? '/' : '';
		$tmp = explode('/', trim($source_path, '/'));
		$filename = array_pop($tmp); // file name or new dir name

        $target_input = $this->get['target'];
        $target_path = $target_input . '/';
        $target_path = $this->expandPath($target_path, false);

		$source_fullpath = $this->getFullPath($source_path, true);
		// FIXME: The names $target_fullpath and $new_fullpath here are ambiguous
        $target_fullpath = $this->getFullPath($target_path, true);
		$new_fullpath = $target_fullpath . $filename . $suffix;

		$this->check_read_permission($source_fullpath);
		$this->check_write_permission($new_fullpath);

		// This function will also copy the thumbnail, if it exists, AND
		// the destination dir already has a thumbnail dir. Check perms:
		$old_thumbnail = $this->get_thumbnail_path($source_fullpath);
		$new_thumbnail = $this->get_thumbnail_path($new_fullpath);
		if(file_exists($old_thumbnail)) {
			$this->check_read_permission($old_thumbnail);
			if (file_exists(dirname($new_thumbnail))) {
				$this->check_write_permission($new_thumbnail);
			}
		}

		Log::info('copying "' . $source_fullpath . '" to "' . $new_fullpath . '"');

        if(!is_dir($target_fullpath)) {
            $this->error('DIRECTORY_NOT_EXIST', [$target_path]);
        }

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($source_fullpath)) {
			$this->error('NOT_ALLOWED');
		}

		// check if file already exists
		if (file_exists($new_fullpath)) {
            $item_name = rtrim($target_input, '/') . '/' . $filename;
			if(is_dir($new_fullpath)) {
				$this->error('DIRECTORY_ALREADY_EXISTS', [$item_name]);
			} else {
				$this->error('FILE_ALREADY_EXISTS', [$item_name]);
			}
		}

		// move file or folder
		if(!FmHelper::copyRecursive($source_fullpath, $new_fullpath)) {
			if(is_dir($source_fullpath)) {
				$this->error('ERROR_COPYING_DIRECTORY', [$filename, $target_input]);
			} else {
				$this->error('ERROR_COPYING_FILE', [$filename, $target_input]);
			}
		} else {
			Log::info('moved "' . $source_fullpath . '" to "' . $new_fullpath . '"');
            $old_thumbnail = $this->get_thumbnail_path($source_fullpath);

			// move thumbnail file or thumbnails folder if exists
			if(file_exists($old_thumbnail)) {
				$new_thumbnail = $this->get_thumbnail_path($new_fullpath);
				// delete old thumbnail(s) if destination folder does not exist
				if(file_exists(dirname($new_thumbnail))) {
                    FmHelper::copyRecursive($old_thumbnail, $new_thumbnail);
				}
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
		// FIXME: These string-parsing substr() lines of code should be replaced by a single
		// call to pathinfo().
        $source_path = $this->get['old'];
        $suffix = (substr($source_path, -1, 1) == '/') ? '/' : '';
		$tmp = explode('/', trim($source_path, '/'));
		$filename = array_pop($tmp); // file name or new dir name

        $target_input = $this->get['new'];
        $target_path = $target_input . '/';
        $target_path = $this->expandPath($target_path, false);

		$source_fullpath = $this->getFullPath($source_path, true);
        $target_fullpath = $this->getFullPath($target_path, true);
		// FIXME: The names $target_fullpath and $new_fullpath here are ambiguous
		$new_fullpath = $target_fullpath . $filename . $suffix;

		$this->check_write_permission($source_fullpath);
		$this->check_write_permission($new_fullpath);

		// This function will also move the thumbnail, if it exists, AND
		// the destination dir already has a thumbnail dir. If the destination
		// dir does not have a thumbnail dir, it just deletes the thumbnail.
		// Check perms:
		$old_thumbnail = $this->get_thumbnail_path($source_fullpath);
		$new_thumbnail = $this->get_thumbnail_path($new_fullpath);
		if(file_exists($old_thumbnail)) {
			$this->check_write_permission($old_thumbnail);
			if (file_exists(dirname($new_thumbnail))) {
				$this->check_write_permission($new_thumbnail);
			}
		}

		Log::info('moving "' . $source_fullpath . '" to "' . $new_fullpath . '"');

        if(!is_dir($target_fullpath)) {
            $this->error('DIRECTORY_NOT_EXIST', [$target_path]);
        }

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($source_fullpath)) {
			$this->error('NOT_ALLOWED');
		}

		// check if file already exists
		if (file_exists($new_fullpath)) {
            $item_name = rtrim($target_input, '/') . '/' . $filename;
			if(is_dir($new_fullpath)) {
				$this->error('DIRECTORY_ALREADY_EXISTS', [$item_name]);
			} else {
				$this->error('FILE_ALREADY_EXISTS', [$item_name]);
			}
		}

		// should be retrieved before rename operation
		$old_thumbnail = $this->get_thumbnail_path($source_fullpath);

		// move file or folder
		if(!rename($source_fullpath, $new_fullpath)) {
			if(is_dir($source_fullpath)) {
				$this->error('ERROR_MOVING_DIRECTORY', [$filename, $target_input]);
			} else {
				$this->error('ERROR_MOVING_FILE', [$filename, $target_input]);
			}
		} else {
			Log::info('moved "' . $source_fullpath . '" to "' . $new_fullpath . '"');

			// move thumbnail file or thumbnails folder if exists
			if(file_exists($old_thumbnail)) {
				$new_thumbnail = $this->get_thumbnail_path($new_fullpath);
				// delete old thumbnail(s) if destination folder does not exist
				if(file_exists(dirname($new_thumbnail))) {
					rename($old_thumbnail, $new_thumbnail);
				} else {
					is_dir($old_thumbnail) ? $this->unlinkRecursive($old_thumbnail) : unlink($old_thumbnail);
				}
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
        // FIXME: $source_path is an ambiguous name here. This var is 
        // actually the "target" file that will get replaced.
        $source_path = $this->post['path'];
        $source_fullpath = $this->getFullPath($source_path);

        // $target_fullpath is the directory holding the file to be replaced.
        $target_path = dirname($source_path) . '/';
        $target_fullpath = $this->getFullPath($target_path, true);

        $this->check_write_permission($source_fullpath);
        // Since the new replacement file is uploaded into the same dir as
        // the old file, we must check write perms on that dir as well.
        // FIXME: It would be safer to upload the file to the system temp
        // dir, and move it from there.
        $this->check_write_permission($target_fullpath);

        // This function will also delete the old thumbnail, if it exists. Check perms:
        $old_thumbnail = $this->get_thumbnail_path($source_fullpath);
        if(file_exists($old_thumbnail)) {
            $this->check_write_permission($old_thumbnail);
        }
        
        Log::info('replacing file "' . $source_fullpath . '"');
        Log::info('replacing target path "' . $target_fullpath . '"');

		if(is_dir($source_fullpath)) {
			$this->error('NOT_ALLOWED');
		}

        $content = $this->initUploader([
            'upload_dir' => $target_fullpath,
        ])->post(false);

        $response_data = [];
        $files = isset($content['files']) ? $content['files'] : null;
        // there is only one file in the array as long as "singleFileUploads" is set to "true"
        if ($files && is_array($files) && is_object($files[0])) {
            $file = $files[0];
            if(isset($file->error)) {
                $error = is_array($file->error) ? $file->error : [$file->error];
                $this->error($error[0], isset($error[1]) ? $error[1] : []);
            } else {
                $replacement_fullpath = $target_fullpath . $file->name;
                Log::info('replacing "' . $source_fullpath . '" with "' . $replacement_fullpath . '"');

                // Overwrite the existing $source_fullpath:
                rename($replacement_fullpath, $source_fullpath);

                // Delete the old thumbnail, as it is now invalid and incorrect:
                $old_thumbnail = $this->get_thumbnail_path($source_fullpath);
                if (file_exists($old_thumbnail)) {
                    unlink($old_thumbnail);
                }

                $relative_path = $this->cleanPath('/' . $source_path);
                $item = $this->get_file_info($relative_path);
                $response_data[] = $item;
            }
        } else {
            $this->error('ERROR_UPLOADING_FILE');
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

		$this->check_read_permission($target_fullpath);

		Log::info('opening "' . $target_fullpath . '"');

        $item = $this->get_file_info($target_path);

        if(is_dir($target_fullpath)) {
            $this->error('FORBIDDEN_ACTION_DIR');
        }

		$content = file_get_contents($target_fullpath);

		if($content === false) {
			$this->error('ERROR_OPENING_FILE');
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

		$this->check_write_permission($target_fullpath);

		Log::info('saving "' . $target_fullpath . '"');

        if(is_dir($target_fullpath)) {
            $this->error('FORBIDDEN_ACTION_DIR');
        }

		$result = file_put_contents($target_fullpath, $this->post['content'], LOCK_EX);

		if(!is_numeric($result)) {
			$this->error('ERROR_SAVING_FILE');
		}

		Log::info('saved "' . $target_fullpath . '"');

		// get updated file info after save
        clearstatcache();
        return $this->get_file_info($target_path);
	}

	/**
	 * Seekable stream: http://stackoverflow.com/a/23046071/1789808
	 * @inheritdoc
	 */
	public function actionReadFile()
	{
        $target_path = $this->get['path'];
		$target_fullpath = $this->getFullPath($target_path, true);

		$this->check_read_permission($target_fullpath);

        Log::info('reading file "' . $target_fullpath . '"');

        if(is_dir($target_fullpath)) {
            $this->error('FORBIDDEN_ACTION_DIR');
        }

		$filesize = filesize($target_fullpath);
		$length = $filesize;
		$offset = 0;

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

			header('HTTP/1.1 206 Partial Content');
			// A full-length file will indeed be "bytes 0-x/x+1", think of 0-indexed array counts
			header('Content-Range: bytes ' . $bytes_start . '-' . $bytes_end . '/' . $filesize);
			// While playing media by direct link (not via FM) FireFox and IE doesn't allow seeking (rewind) it in player
			// This header can fix this behavior if to put it out of this condition, but it breaks PDF preview
			header('Accept-Ranges: bytes');
		}

		header('Content-Type: ' . mime_content_type($target_fullpath));
		header("Content-Transfer-Encoding: binary");
		header("Content-Length: " . $length);
		header('Content-Disposition: inline; filename="' . basename($target_fullpath) . '"');

		$fp = fopen($target_fullpath, 'r');
		fseek($fp, $offset);
		$position = 0;

		while($position < $length) {
			$chunk = min($length - $position, 1024 * 8);

			echo fread($fp, $chunk);
			flush();
			ob_flush();

			$position += $chunk;
		}
		exit;
	}

	/**
	 * @inheritdoc
	 */
	public function actionGetImage($thumbnail)
	{
        $target_path = $this->get['path'];
		$target_fullpath = $this->getFullPath($target_path, true);
		
		// Thumbnail creation implies writing. Disable it if this the config says read_only:
		if ($this->config['read_only']) {
			$thumbnail = false;
		}

		$this->check_read_permission($target_fullpath);

        // This function will get the thumbnail, if thumbnails are enabled. Check perms:
		if($thumbnail === true && $this->config['images']['thumbnail']['enabled'] === true) {
			$returned_path = $this->get_thumbnail_path($target_fullpath);
			if (file_exists($returned_path)) {
				// Check read perms on the thumbnail:
				$this->check_read_permission($returned_path);
			} else {
				// The thumbnail will get created here, so check write perms of the thumbnail dir:
				$this->check_write_permission(dirname($returned_path));
			}
		}

		Log::info('loading image "' . $target_fullpath . '"');

        if(is_dir($target_fullpath)) {
            $this->error('FORBIDDEN_ACTION_DIR');
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
		header("Content-length: " . $this->get_real_filesize($returned_path));
		header('Content-Disposition: inline; filename="' . basename($returned_path) . '"');

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

		$this->check_write_permission($target_fullpath);

		Log::info('deleting "' . $target_fullpath . '"');

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($target_fullpath)) {
			$this->error('NOT_ALLOWED');
		}

        $item = $this->get_file_info($target_path);
        $thumbnail_path = $this->get_thumbnail_path($target_fullpath);

		if(is_dir($target_fullpath)) {
			$this->unlinkRecursive($target_fullpath);
			Log::info('deleted "' . $target_fullpath . '"');

			// delete thumbnails if exists
			if(file_exists($thumbnail_path)) {
				$this->unlinkRecursive($thumbnail_path);
			}
		} else {
			unlink($target_fullpath);
			Log::info('deleted "' . $target_fullpath . '"');

			// delete thumbnails if exists
			if(file_exists($thumbnail_path)) {
				unlink($thumbnail_path);
			}
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

		$this->check_read_permission($target_fullpath);

		Log::info('downloading "' . $target_fullpath . '"');

        $is_dir_target = is_dir($target_fullpath);
		if($is_dir_target) {
			// check if not requesting main FM userfiles folder
			// FIXME: This restriction seems arbitration, it could be useful for business clients
			if($this->is_root_folder($target_fullpath)) {
				$this->error('NOT_ALLOWED');
			}
		}

		if($this->isAjaxRequest()) {
            return $this->get_file_info($target_path);
        } else {
            if($is_dir_target) {
                $destination_path = sys_get_temp_dir().'/fm_'.uniqid().'.zip';

                // if Zip archive is created
                if($this->zipFile($target_fullpath, $destination_path, true)) {
                    $target_fullpath = $destination_path;
                } else {
                    $this->error('ERROR_CREATING_ZIP');
                }
            }
            $file_size = $this->get_real_filesize($target_fullpath);

            header('Content-Description: File Transfer');
            header('Content-Type: ' . mime_content_type($target_fullpath));
            header('Content-Disposition: attachment; filename="' . basename($target_fullpath) . '"');
            header('Content-Transfer-Encoding: binary');
            header('Content-Length: ' . $file_size);
            // handle caching
            header('Pragma: public');
            header('Expires: 0');
            header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

            // read file by chunks to handle large files
            // if you face an issue while downloading large files yet, try the following solution:
            // https://github.com/servocoder/RichFilemanager/issues/78

            $chunk_size = 5 * 1024 * 1024;
            if ($chunk_size && $file_size > $chunk_size) {
                $handle = fopen($target_fullpath, 'rb');
                while (!feof($handle)) {
                    echo fread($handle, $chunk_size);
                    @ob_flush();
                    @flush();
                }
                fclose($handle);
            } else {
                readfile($target_fullpath);
            }

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
            'folders' => 0,
            'sizeLimit' => $this->config['options']['fileRootSizeLimit'],
        ];

		$path = rtrim($this->path_to_files, '/') . '/';
		try {
			$this->getDirSummary($path, $attributes);
		} catch (Exception $e) {
			$this->error('ERROR_SERVER');
		}

        return [
            'id' => '/',
            'type' => 'summary',
            'attributes' => $attributes,
        ];
	}

    /**
     * @inheritdoc
     */
    public function actionExtract()
    {
        if (!extension_loaded('zip')) {
            $this->error('NOT_FOUND_SYSTEM_MODULE', ['zip']);
        }

        $source_path = $this->post['source'];
        $target_path = $this->post['target'];
        $source_fullpath = $this->getFullPath($source_path, true);
        $target_fullpath = $this->getFullPath($target_path, true);

		$this->check_read_permission($source_fullpath);
		$this->check_write_permission($target_fullpath);

        $zip = new ZipArchive();
        if ($zip->open($source_fullpath) !== true) {
            $this->error('ERROR_EXTRACTING_FILE');
        }

        $folders = [];
        $response_data = [];

        // make all the folders
        for($i = 0; $i < $zip->numFiles; $i++) {
            $file_stat = $zip->statIndex($i);

            if ($file_stat['name'][strlen($file_stat['name'])-1] === "/") {
                $dir_name = $target_fullpath . $file_stat['name'];
                $created = mkdir($dir_name, 0700, true);

                if ($created) {
                    $folders[] = $file_stat['name'];
                }
            }
        }

        // extract root-level folders from archive manually
        $root_folders = [];
        foreach($folders as $name) {
            $name = ltrim($name, '/');
            $root = substr($name, 0, strpos($name, '/') + 1);
            $root_folders[$root] = $root;
        }
        $root_level_items = array_values($root_folders);

        // unzip into the folders
        for($i = 0; $i < $zip->numFiles; $i++) {
            $file_name = $zip->getNameIndex($i);
            $file_stat = $zip->statIndex($i);

            if ($file_stat['name'][strlen($file_stat['name'])-1] !== "/") {
                $dir_name = $target_fullpath . $file_stat['name'];
                $copied = copy('zip://'. $source_fullpath .'#'. $file_name, $dir_name);

                if($copied && strpos($file_name, '/') === false) {
                    $root_level_items[] = $file_name;
                }
            }
        }

        $zip->close();

        foreach ($root_level_items as $file_name) {
            $relative_path = $this->cleanPath($target_path . '/' . $file_name);
            $item = $this->get_file_info($relative_path);
            $response_data[] = $item;
        }

        return $response_data;
    }

	/**
	 * Creates a zip file from source to destination
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

		$zip = new ZipArchive();
		if (!$zip->open($destination, ZIPARCHIVE::CREATE)) {
			return false;
		}

		$source = str_replace('\\', '/', realpath($source));
		$folder = $includeFolder ? basename($source) . '/' : '';

		if (is_dir($source) === true) {
			// add file to prevent empty archive error on download
			$zip->addFromString('fm.txt', "This archive has been generated by Rich Filemanager : https://github.com/servocoder/RichFilemanager/");

			$files = new RecursiveIteratorIterator(
				new RecursiveDirectoryIterator($source, RecursiveDirectoryIterator::SKIP_DOTS),
				RecursiveIteratorIterator::SELF_FIRST
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
	 * Create array with file properties
	 * @param string $relative_path
	 * @return array
	 */
	protected function get_file_info($relative_path)
    {
		$fullpath = $this->getFullPath($relative_path);
		$pathInfo = pathinfo($fullpath);
		$filemtime = filemtime($fullpath);

		// check if file is readable
		$is_readable = $this->has_read_permission($fullpath);

		// check if file is writable
		$is_writable = $this->has_write_permission($fullpath);

		if(is_dir($fullpath)) {
            $model = $this->folder_model;
		} else {
            $model = $this->file_model;
            $model['attributes']['extension'] = isset($pathInfo['extension']) ? $pathInfo['extension'] : '';
            
            if ($is_readable) {
                $model['attributes']['size'] = $this->get_real_filesize($fullpath);

			    if($this->is_image_file($fullpath)) {
				    if($model['attributes']['size']) {
					    list($width, $height, $type, $attr) = getimagesize($fullpath);
				    } else {
					    list($width, $height) = [0, 0];
				    }

                    $model['attributes']['width'] = $width;
                    $model['attributes']['height'] = $height;
			    }
			}
		}

        $model['id'] = $relative_path;
        $model['attributes']['name'] = $pathInfo['basename'];
        $model['attributes']['path'] = $this->getDynamicPath($fullpath);
        $model['attributes']['readable'] = (int) $is_readable;
        $model['attributes']['writable'] = (int) $is_writable;
        $model['attributes']['timestamp'] = $filemtime;
        $model['attributes']['modified'] = $this->formatDate($filemtime);
        //$model['attributes']['created'] = $model['attributes']['modified']; // PHP cannot get create timestamp
        return $model;
	}

    /**
     * Return full path to file
     * @param string $path
     * @param bool $verify If file or folder exists and valid
     * @return mixed|string
     */
	protected function getFullPath($path, $verify = false)
    {
		$full_path = $this->cleanPath($this->path_to_files . '/' . $path);

		if($verify === true) {
			if(!file_exists($full_path) || !$this->is_valid_path($full_path)) {
				$langKey = is_dir($full_path) ? 'DIRECTORY_NOT_EXIST' : 'FILE_DOES_NOT_EXIST';
				$this->error($langKey, [$path]);
			}
		}
		return $full_path;
	}

	/**
	 * Returns path without document root
	 * @param string $fullPath
	 * @return mixed
	 */
	protected function getDynamicPath($fullPath)
	{
	    // empty string makes FM to use connector path for preview instead of absolute path
        // COMMENTED: due to it prevents to build absolute URL when "serverRoot" is "false" and "fileRoot" is provided
        // as well as "previewUrl" value in the JSON configuration file is set to the correct URL
//        if(empty($this->dynamic_fileroot)) {
//            return '';
//        }
	    $path = $this->dynamic_fileroot . '/' . $this->getRelativePath($fullPath);
        return $this->cleanPath($path);
	}

	/**
	 * Returns path without "path_to_files"
	 * @param string $fullPath
     * @return mixed
	 */
    protected function getRelativePath($fullPath)
    {
		return $this->subtractPath($fullPath, $this->path_to_files);
	}

	/**
	 * Subtracts subpath from the fullpath
	 * @param string $fullPath
	 * @param string $subPath
     * @return string
	 */
    protected function subtractPath($fullPath, $subPath)
    {
		$position = strrpos($fullPath, $subPath);
        if($position === 0) {
            $path = substr($fullPath, strlen($subPath));
            return $path ? $this->cleanPath('/' . $path) : '';
        }
        return '';
	}

    /**
     * Check whether path is valid by comparing paths
     * @param string $path
     * @return bool
     */
	protected function is_valid_path($path)
    {
        $rp_substr = substr(realpath($path) . DIRECTORY_SEPARATOR, 0, strlen(realpath($this->path_to_files))) . DIRECTORY_SEPARATOR;
        $rp_files = realpath($this->path_to_files) . DIRECTORY_SEPARATOR;

		// handle better symlinks & network path - issue #448
		$pattern = ['/\\\\+/', '/\/+/'];
		$replacement = ['\\\\', '/'];
		$rp_substr = preg_replace($pattern, $replacement, $rp_substr);
		$rp_files = preg_replace($pattern, $replacement, $rp_files);
		$match = ($rp_substr === $rp_files);

		if(!$match) {
			Log::info('Invalid path "' . $path . '"');
			Log::info('real path: "' . $rp_substr . '"');
			Log::info('path to files: "' . $rp_files . '"');
		}
		return $match;
	}

    /**
     * Delete folder recursive
     * @param string $dir
     * @param bool $deleteRootToo
     */
    protected function unlinkRecursive($dir, $deleteRootToo = true)
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
	 * Clean path string to remove multiple slashes, etc.
	 * @param string $string
	 * @return $string
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
     * Check whether the folder is root
     * @param string $path
     * @return bool
     */
	protected function is_root_folder($path)
    {
		return rtrim($this->path_to_files, '/') == rtrim($path, '/');
	}

	/**
	 * Remove "../" from path
	 * @param string $path Path to be converted
	 * @param bool $clean If dir names should be cleaned
	 * @return string or false in case of error (as exception are not used here)
	 */
	public function expandPath($path, $clean = false)
	{
		$todo = explode('/', $path);
		$fullPath = [];

		foreach ($todo as $dir) {
			if ($dir == '..') {
				$element = array_pop($fullPath);
				if (is_null($element)) {
					return false;
				}
			} else {
				if ($clean) {
					$dir = $this->normalizeString($dir);
				}
				array_push($fullPath, $dir);
			}
		}
		return implode('/', $fullPath);
	}

	/**
	 * Format timestamp string
	 * @param string $timestamp
	 * @return string
	 */
	protected function formatDate($timestamp)
	{
		return date($this->config['options']['dateFormat'], $timestamp);
	}

	/**
	 * Returns summary info for specified folder
	 * @param string $dir
	 * @param array $result
	 * @return array
	 */
	public function getDirSummary($dir, &$result = ['size' => 0, 'files' => 0, 'folders' => 0])
	{
		// suppress permission denied and other errors
		$files = @scandir($dir);
		if($files === false) {
			return $result;
		}

		foreach($files as $file) {
			if($file == "." || $file == "..") {
				continue;
			}
			$path = $dir . $file;
            $is_dir = is_dir($path);

            if ($is_dir && $this->has_read_permission($path)) {
                $result['folders']++;
                $this->getDirSummary($path . '/', $result);
            }
            if (!$is_dir && $this->has_read_permission($path)) {
                $result['files']++;
                $result['size'] += filesize($path);
            }
		}

		return $result;
	}

	/**
	 * Calculates total size of all files
	 * @return mixed
	 */
	public function getRootTotalSize()
	{
		$path = rtrim($this->path_to_files, '/') . '/';
		$result = $this->getDirSummary($path);
		return $result['size'];
	}

	/**
	 * Return Thumbnail path from given path, works for both file and dir path
	 * @param string $path
	 * @return string
	 */
	protected function get_thumbnail_path($path)
	{
		$relative_path = $this->getRelativePath($path);
		$thumbnail_path = $this->path_to_files . '/' . $this->config['images']['thumbnail']['dir'] . '/';

		if(is_dir($path)) {
			$thumbnail_fullpath = $thumbnail_path . $relative_path . '/';
		} else {
			$thumbnail_fullpath = $thumbnail_path . dirname($relative_path) . '/' . basename($path);
		}

		return $this->cleanPath($thumbnail_fullpath);
	}

	/**
	 * Returns path to image file thumbnail, creates thumbnail if doesn't exist
	 * @param string $path
	 * @return string
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
	 * Creates thumbnail from the original image
	 * @param $imagePath
	 * @param $thumbnailPath
	 */
	protected function createThumbnail($imagePath, $thumbnailPath)
	{
		$this->check_read_permission($imagePath);

		if(!file_exists(dirname($thumbnailPath))) {
			// Check that the thumbnail sub-dir can be created, because it
			// does not yet exist. So we check the parent dir:
			$this->check_write_permission( dirname(dirname($thumbnailPath)) );
		} else {
			// Check that the thumbnail sub-dir, which exists, is writable:
			$this->check_write_permission(dirname($thumbnailPath));
		}

		if($this->config['images']['thumbnail']['enabled'] === true) {
			Log::info('generating thumbnail "' . $thumbnailPath . '"');

			// create folder if it does not exist
			if(!file_exists(dirname($thumbnailPath))) {
				mkdir(dirname($thumbnailPath), 0755, true);
			}

			$this->initUploader([
				'upload_dir' => dirname($imagePath) . '/',
			])->create_thumbnail_image($imagePath);
		}
	}

}
