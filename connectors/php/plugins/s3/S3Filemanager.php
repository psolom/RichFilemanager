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
	public function __construct($config = array())
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
	 * Set root folder
	 * @param $path
	 * @param bool $mkdir
	 */
	public function setFileRoot($path, $mkdir = false)
	{
		$this->rootDirectory = $this->pathToFolder($path);
		$this->rootWrapperPath = $this->getS3WrapperPath($this->rootDirectory);

		if($mkdir === true && !is_dir($this->rootWrapperPath)) {
			mkdir($this->rootWrapperPath, 0755, true);
		}
	}

	/**
	 * @param array $settings
	 * @return S3UploadHandler
	 */
	public function initUploader($settings = array())
	{
		$data = array(
			'images_only' => $this->config['upload']['imagesOnly'] || (isset($this->refParams['type']) && strtolower($this->refParams['type'])=='images'),
		) + $settings;

		if(isset($data['upload_dir'])) {
			$data['thumbnails_dir'] = rtrim($this->get_thumbnail_path($data['upload_dir']), '/');
		}

		return new S3UploadHandler(array(
			'fm' => array(
				'instance' => $this,
				'data' => $data,
			),
		));
	}

	/**
	 * @inheritdoc
	 */
	public function getfolder()
	{
		$array = array();
		$files_list = array();
		$current_path = $this->getFullPath($this->get['path'], true);

		if (!is_dir($current_path)) {
			$this->error(sprintf($this->lang('DIRECTORY_NOT_EXIST'), $this->get['path']));
		}

		if(!$handle = @opendir($current_path)) {
			$this->error(sprintf($this->lang('UNABLE_TO_OPEN_DIRECTORY'), $this->get['path']));
		} else {
			while (false !== ($file = readdir($handle))) {
				array_push($files_list, $file);
			}
			closedir($handle);

			foreach($files_list as $file) {
				$file_path = $this->get['path'] . $file;

				if(is_dir($current_path . $file)) {
					if(!in_array($file, $this->config['exclude']['unallowed_dirs']) && !preg_match($this->config['exclude']['unallowed_dirs_REGEXP'], $file)) {
						$array[$file_path . '/'] = $this->get_file_info($file_path . '/', true);
					}
				} else if (!in_array($file, $this->config['exclude']['unallowed_files']) && !preg_match($this->config['exclude']['unallowed_files_REGEXP'], $file)) {
					$item = $this->get_file_info($file_path, true);

					if(!isset($this->refParams['type']) || (isset($this->refParams['type']) && strtolower($this->refParams['type']) === 'images' && in_array(strtolower($item['File Type']), array_map('strtolower', $this->config['images']['imagesExt'])))) {
						if($this->config['upload']['imagesOnly']== false || ($this->config['upload']['imagesOnly'] === true && in_array(strtolower($item['File Type']), array_map('strtolower', $this->config['images']['imagesExt'])))) {
							$array[$file_path] = $item;
						}
					}
				}
			}
		}

		return $array;
	}

	/**
	 * @inheritdoc
	 */
	public function getinfo()
	{
		$path = $this->get['path'];
		$current_path = $this->getFullPath($path);
		$filename = basename($current_path);

		// NOTE: S3 doesn't provide a way to check if file doesn't exist or just has a permissions restriction,
		// therefore it is supposed the file is prohibited by default and the appropriate message is returned.
		// https://github.com/aws/aws-sdk-php/issues/969
		if(!file_exists($current_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		// check if file is allowed regarding the security Policy settings
		if(in_array($filename, $this->config['exclude']['unallowed_files']) || preg_match($this->config['exclude']['unallowed_files_REGEXP'], $filename)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		return $this->get_file_info($path, false);
	}

	/**
	 * @inheritdoc
	 */
	public function add()
	{
		$current_path = $this->getFullPath($this->post['currentpath'], true);

		if(!$this->has_permission('upload')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		$result = $this->initUploader(array(
			'upload_dir' => $current_path,
		))->post(true);

		if (!$result) {
			$this->error(sprintf($this->lang('INVALID_FILE_UPLOAD')));
		}

		// end application to prevent double response (uploader and filemanager)
		exit;
	}

	/**
	 * @inheritdoc
	 */
	public function addfolder()
	{
		$current_path = $this->getFullPath($this->get['path'], true);

		$new_dir = $this->normalizeString($this->get['name']);
		$new_path = $current_path . $this->pathToFolder($new_dir);

		if(is_dir($new_path)) {
			$this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), $this->get['name']));
		}

		if(!mkdir($new_path, 0755)) {
			$this->error(sprintf($this->lang('UNABLE_TO_CREATE_DIRECTORY'), $new_dir));
		}

		$array = array(
			'Parent' => $this->get['path'],
			'Name' => $this->get['name'],
			'Error' => "",
			'Code' => 0,
		);
		Log::info(__METHOD__ . ' - adding folder ' . $new_dir);

		return $array;
	}

	/**
	 * @inheritdoc
	 */
	public function rename()
	{
		$suffix = '';

		if(substr($this->get['old'], -1, 1) == '/') {
			$this->get['old'] = substr($this->get['old'], 0, (strlen($this->get['old'])-1));
			$suffix = '/';
		}
		$tmp = explode('/', $this->get['old']);
		$filename = $tmp[(sizeof($tmp)-1)];

		$newPath = substr($this->get['old'], 0, strripos($this->get['old'], '/' . $filename));
		$newName = $this->normalizeString($this->get['new'], array('.', '-'));

		$old_file = $this->getFullPath($this->get['old'], true) . $suffix;
		$new_dir = $this->getFullPath($newPath, true);
		$new_file = rtrim($new_dir, '/') . '/' . $newName . $suffix;

		if(!$this->has_permission('rename')) {
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

		// for file only - we check if the new given extension is allowed regarding the security Policy settings
		if(is_file($old_file) && $this->config['security']['allowChangeExtensions'] && !$this->is_allowed_file_type($new_file)) {
			$this->error(sprintf($this->lang('INVALID_FILE_TYPE')));
		}

		if(file_exists($new_file)) {
			if($suffix == '/' && is_dir($new_file)) {
				$this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), $newName));
			}
			if($suffix == '' && is_file($new_file)) {
				$this->error(sprintf($this->lang('FILE_ALREADY_EXISTS'), $newName));
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
			$thumbnail_path = $this->get_thumbnail_path($old_file);
			$this->deleteThumbnail($thumbnail_path);
		} else {
			if(is_dir($old_file)) {
				$this->error(sprintf($this->lang('ERROR_RENAMING_DIRECTORY'), $filename, $newName));
			} else {
				$this->error(sprintf($this->lang('ERROR_RENAMING_FILE'), $filename, $newName));
			}
		}

		$array = array(
			'Old Path' => $this->getDynamicPath($old_file),
			'Old Name' => $filename,
			'New Path' => $this->getDynamicPath($new_file),
			'New Name' => $newName,
			'Error' => "",
			'Code' => 0,
		);
		return $array;
	}

	/**
	 * @inheritdoc
	 */
	public function move()
	{
		$newPath = $this->get['new'] . '/';
		$newPath = $this->expandPath($newPath, true);
		$suffix = (substr($this->get['old'], -1, 1) == '/') ? '/' : '';

		// old path
		$tmp = explode('/', trim($this->get['old'], '/'));
		$filename = array_pop($tmp); // file name or new dir name
		$path = '/' . implode('/', $tmp) . '/';
		$path = $this->cleanPath($path);

		$oldPath = $this->getFullPath($this->get['old'], true);
		$newPath = $this->getFullPath($newPath, true);
		$newFullPath = $newPath . $filename . $suffix;
		$isDirOldPath = is_dir($oldPath);

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($oldPath)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if(!$this->has_permission('move')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// forbid bulk rename of objects
		if($isDirOldPath && !$this->config['s3']['allowBulk']) {
			$this->error(sprintf($this->lang('FORBIDDEN_ACTION_DIR')));
		}

		// check if file already exists
		if (file_exists($newFullPath)) {
			if(is_dir($newFullPath)) {
				$this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), rtrim($this->get['new'], '/') . '/' . $filename));
			} else {
				$this->error(sprintf($this->lang('FILE_ALREADY_EXISTS'), rtrim($this->get['new'], '/') . '/' . $filename));
			}
		}

		// create dir if not exists
		if (!file_exists($newPath)) {
			if(!mkdir($newPath, 0755, true)) {
				$this->error(sprintf($this->lang('UNABLE_TO_CREATE_DIRECTORY'), $newPath));
			}
		}

		$moved = array();
		if($isDirOldPath) {
			$files = $this->getFilesList(rtrim($oldPath, '/'));
			$files = array_reverse($files);
			foreach($files as $k => $path) {
				if(is_dir($path)) {
					$path .= '/';
				};
				$new_path = str_replace($oldPath, $newFullPath, $path);
				if(@rename($path, $new_path)) {
					$moved[] = array(
						'old' => $path,
						'new' => $new_path,
					);
				}
			}
		}

		if(@rename($oldPath, $newFullPath)) {
			$moved[] = array(
				'old' => $oldPath,
				'new' => $newFullPath,
			);
		}

		if(sizeof($moved) > 0) {
			// try to move thumbs instead of get original images from S3 to create new thumbs
			$new_thumbnail = $this->get_thumbnail_path($newFullPath);
			$old_thumbnail = $this->get_thumbnail_path($oldPath);

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
				foreach($moved as $thumb) {
					if(file_exists($thumb['old'])) {
						@rename($this->get_thumbnail_path($thumb['old']), $this->get_thumbnail_path($thumb['new']));
					}
				}
//				$files = $this->getFilesList(rtrim($old_thumbnail, '/'));
//				foreach($files as $path) {
//					$new_path = str_replace($old_thumbnail, $new_thumbnail, $path);
//					$valid = rename($path, $new_path);
//				}
			}
		} else {
			if($isDirOldPath) {
				$this->error(sprintf($this->lang('ERROR_RENAMING_DIRECTORY'), $path, $this->get['new']));
			} else {
				$this->error(sprintf($this->lang('ERROR_RENAMING_FILE'), $path . $filename, $this->get['new']));
			}
		}

		$array = array(
			'Old Path' => $path,
			'Old Name' => $filename,
			'New Path' => $this->getDynamicPath($newPath),
			'New Name' => $filename,
			'Error' => "",
			'Code' => 0,
		);
		return $array;
	}

	/**
	 * @inheritdoc
	 */
	public function replace()
	{
		$old_path = $this->getFullPath($this->post['newfilepath']);
		$upload_dir = dirname($old_path) . '/';

		if(!$this->has_permission('replace') || !$this->has_permission('upload')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if(is_dir($old_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// we check the given file has the same extension as the old one
		if(strtolower(pathinfo($_FILES[$this->config['upload']['paramName']]['name'], PATHINFO_EXTENSION)) != strtolower(pathinfo($this->post['newfilepath'], PATHINFO_EXTENSION))) {
			$this->error(sprintf($this->lang('ERROR_REPLACING_FILE') . ' ' . pathinfo($this->post['newfilepath'], PATHINFO_EXTENSION)));
		}

		$result = $this->initUploader(array(
			'upload_dir' => $upload_dir,
		))->post(true);

		// success upload
		if(!property_exists($result['files'][0], 'error')) {
			$new_path = $upload_dir . $result['files'][0]->name;
			if(@rename($new_path, $old_path)) {
				// try to move thumbs instead of get original images from S3 to create new thumbs
				$new_thumbnail = $this->get_thumbnail_path($new_path);
				$old_thumbnail = $this->get_thumbnail_path($old_path);

				if(file_exists($new_thumbnail)) {
					@rename($new_thumbnail, $old_thumbnail);
				}
			}
		}

		// end application to prevent double response (uploader and filemanager)
		exit();
	}

	/**
	 * @inheritdoc
	 */
	public function editfile()
	{
		$current_path = $this->getFullPath($this->get['path'], true);

		if(!$this->has_permission('edit')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		Log::info(__METHOD__ . ' - editing file '. $current_path);

		$content = file_get_contents($current_path);
		$content = htmlspecialchars($content);

		if($content === false) {
			$this->error(sprintf($this->lang('ERROR_OPENING_FILE')));
		}

		$array = array(
			'Path' => $this->get['path'],
			'Content' => $content,
			'Error' => "",
			'Code' => 0,
		);

		return $array;
	}

	/**
	 * @inheritdoc
	 */
	public function savefile()
	{
		$current_path = $this->getFullPath($this->post['path'], true);

		if(!$this->has_permission('edit')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		Log::info(__METHOD__ . ' - saving file '. $current_path);

		$content =  htmlspecialchars_decode($this->post['content']);
		$r = file_put_contents($current_path, $content);

		if(!is_numeric($r)) {
			$this->error(sprintf($this->lang('ERROR_SAVING_FILE')));
		}

		$array = array(
			'Path' => $this->post['path'],
			'Error' => "",
			'Code' => 0,
		);

		return $array;
	}

	/**
	 * Seekable stream: http://stackoverflow.com/a/23046071/1789808
	 * @inheritdoc
	 */
	public function readfile()
	{
		$current_path = $this->getFullPath($this->get['path'], true);
		$filesize = filesize($current_path);
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
			$context = stream_context_create(array(
				's3' => array(
					'seekable' => true,
					'Range' => "bytes={$bytes_start}-{$bytes_end}",
				)
			));

			header('HTTP/1.1 206 Partial Content');
			// A full-length file will indeed be "bytes 0-x/x+1", think of 0-indexed array counts
			header('Content-Range: bytes ' . $bytes_start . '-' . $bytes_end . '/' . $filesize);
			// While playing media by direct link (not via FM) FireFox and IE doesn't allow seeking (rewind) it in player
			// This header can fix this behavior if to put it out of this condition, but it breaks PDF preview
			header('Accept-Ranges: bytes');
		}

		header('Content-Type: ' . $this->getMimeType($current_path));
		header("Content-Transfer-Encoding: binary");
		header("Content-Length: " . $length);
		header('Content-Disposition: inline; filename="' . basename($current_path) . '"');

		readfile($current_path, null, $context);
		exit;
	}

	/**
	 * @inheritdoc
	 */
	public function getimage($thumbnail)
	{
		$current_path = $this->getFullPath($this->get['path']);

		// check comment in "getinfo()" method
		if(!file_exists($current_path)) {
			$iconsFolder = $this->fm_path . '/' . $this->config['icons']['path'];
			$iconType = $this->isDir($current_path) ? 'directory' : 'default';
			$returned_path = $this->cleanPath($iconsFolder . '/' . 'locked_' . $this->config['icons'][$iconType]);
		} else {
			// if $thumbnail is set to true we return the thumbnail
			if($thumbnail === true && $this->config['images']['thumbnail']['enabled'] === true) {
				// get thumbnail (and create it if needed)
				$returned_path = $this->get_thumbnail($current_path);
			} else {
				$returned_path = $current_path;
			}
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
	public function delete()
	{
		$current_path = $this->getFullPath($this->get['path'], true);

		if(!$this->has_permission('delete')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($current_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		$isDeleted = $this->deleteObject($current_path);

		return array(
			'Path' => $this->getDynamicPath($current_path),
			'Error' => $isDeleted ? "" : $this->lang('INVALID_DIRECTORY_OR_FILE'),
			'Code' => $isDeleted ? 0 : -1,
		);
	}

	/**
	 * @inheritdoc
	 */
	public function download($force)
	{
		$current_path = $this->getFullPath($this->get['path'], true);
		$filename = basename($current_path);

		if(!$this->has_permission('download')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if(is_dir($current_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if(!$this->is_allowed_file_type($filename)) {
			$this->error(sprintf($this->lang('INVALID_FILE_TYPE')));
		}

		if(!$force) {
			$array = array(
				'Path' => $this->get['path'],
				'Error' => "",
				'Code' => 0,
			);
			return $array;
		}

		header('Content-Description: File Transfer');
		header('Content-Type: ' . $this->getMimeType($current_path));
		header('Content-Disposition: attachment; filename=' . $filename);
		header('Content-Transfer-Encoding: binary');
		header('Content-Length: ' . filesize($current_path));
		// handle caching
		header('Pragma: public');
		header('Expires: 0');
		header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

		Log::info(__METHOD__ . ' - downloading '. $current_path);
		readfile($current_path);
		Log::info(__METHOD__ . ' - downloaded '. $current_path);
		exit();
	}

	/**
	 * @inheritdoc
	 */
	public function summarize()
	{
		$result = array(
			'Size' => 0,
			'Files' => 0,
			'Error' => "",
			'Code' => 0,
		);

		$path = rtrim($this->rootWrapperPath, '/') . '/';
		try {
			$this->getDirSummary($path, $result);
		} catch (Exception $e) {
			$this->error(sprintf($this->lang('ERROR_SERVER')));
		}

		return $result;
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
	 * @param boolean $thumbnail
	 * @return array
	 */
	protected function get_file_info($relative_path, $thumbnail = false)
	{
		$current_path = $this->getFullPath($relative_path);

		$item = $this->defaultInfo;
		$pathInfo = pathinfo($current_path);
		$filemtime = @filemtime($current_path);

		if(is_dir($current_path)) {
			$fileType = self::FILE_TYPE_DIR;
		} else {
			$fileType = $pathInfo['extension'];
			$item['Properties']['Size'] = filesize($current_path);
		}

		$item['Path'] = $this->getDynamicPath($current_path);
		$item['Filename'] = $pathInfo['basename'];
		$item['File Type'] = $fileType;
		$item['Protected'] = 0; // check comment in "getinfo()" method
		$item['Properties']['Date Modified'] = $this->formatDate($filemtime);
		//$item['Properties']['Date Created'] = $this->formatDate(filectime($current_path)); // PHP cannot get create timestamp
		$item['Properties']['filemtime'] = $filemtime;
		return $item;
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

		$needleList = array('..', './');
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
		$list = array();
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
	 * @return int
	 */
	public function getDirSummary($dir, &$result = array('Size'=>0, 'Files'=>0))
	{
		/**
		 * set empty delimiter to get recursive objects list
		 * @see \Aws\S3\StreamWrapper::dir_opendir()
		 */
		$context = stream_context_create(array(
			's3' => array(
				'delimiter' => ''
			)
		));

		$dir = rtrim($dir, '/') . '/';
		$handle = @opendir($dir, $context);

		while (false !== ($filename = readdir($handle))) {
			$path = $dir . $filename;

			if(is_file($path)) {
				$result['Files']++;
				$result['Size'] += filesize($path);
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
		return $result['Size'];
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
			Log::info(__METHOD__ . ' - generating thumbnail:  '. $thumbnailPath);

			$this->initUploader(array(
				'upload_dir' => dirname($imagePath) . '/',
			))->create_thumbnail_image($imagePath);
		}
	}
}