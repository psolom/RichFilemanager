<?php
/**
 *	Filemanager PHP S3 plugin class
 *
 *	filemanager.s3.class.php
 *	Class for the filemanager.php connector which utilizes the AWS S3 storage API
 *	instead of the local filesystem. Initially created for PHP SDK v.3
 *
 *	@license	MIT License
 *  @author     Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

require_once(__DIR__ . '/../../filemanager.class.php');
require_once('storage.helper.php');

use Aws\S3\Exception\S3Exception;

class FilemanagerS3 extends Filemanager
{
	/*******************************************************************************
	 * Constants
	 ******************************************************************************/
	const MSG_OBJECT_EXISTS     = 'object (%s) not created as it already exists.';
	const MSG_DEBUG_UPLOAD_INI  = 'post_max_size: %s, upload_max_filesize: %s, max_input_time: %s';

	const RETRIEVE_MODE_BROWSER = 'S3_To_Internet';
	const RETRIEVE_MODE_SERVER = 'S3_To_AWS';

	/**
	 * Root directory
	 * @var string
	 */
	protected $rootDirectory = '';

	/**
	 * S3 client wrapper class
	 * @var \Aws\S3\S3Client
	 */
	public $s3 = null;

	/**
	 * FilemanagerS3 constructor.
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

		if($mkdir === true) {
			$this->createObject($this->rootDirectory);
		}
	}

	/**
	 * Upload new file - filemanager action
	 */
	public function add()
	{
		$this->setParams();
		$this->validateUploadedFile('newfile');

		$current_path = $this->getFullPath($this->post['currentpath']);
		$_FILES['newfile']['name'] = $this->cleanString($_FILES['newfile']['name'], array('.', '-'));

		if(!$this->is_valid_path($current_path)) {
			$this->error("No way.");
		}

		// unless we are in overwrite mode, we need a unique file name
		if (!$this->config['upload']['overwrite']) {
			$this->uniqueFile($current_path, $_FILES['newfile']['name']);
		}

		$newFile = $current_path . '/' . $_FILES['newfile']['name'];
		$this->cleanPath($newFile);

		// write new file to s3
		$response = $this->s3->upload($newFile, $_FILES['newfile']['tmp_name']);

		if (!$response) {
			$this->error(sprintf($this->lang('INVALID_FILE_UPLOAD')), true);
		}

		$return = array(
			'Path'  => $this->getFullPath(),
			'Name'  => $_FILES['newfile']['name'],
			'Error' => '',
			'Code'  => 0
		);
		exit(sprintf('<textarea>%s</textarea>', json_encode($return)));
	}

	public function replace() {

		$debugInfo[] = ini_get('post_max_size');
		$debugInfo[] = ini_get('upload_max_filesize');
		$debugInfo[] = ini_get('max_input_time');
		$debugInput  = vsprintf(self::MSG_DEBUG_UPLOAD_INI, $debugInfo);

		if(!isset($_FILES['fileR']) || !is_uploaded_file($_FILES['fileR']['tmp_name'])) {
			$this->error(sprintf($this->lang('INVALID_FILE_UPLOAD')), true);
		}
		if(!$this->isUploadValidSize('fileR')) {
			$this->error(sprintf($this->lang('UPLOAD_FILES_SMALLER_THAN'), $this->uploadMaxMb . 'Mb'), true);
		}
		if (!$this->isUploadValidType($_FILES['fileR']['tmp_name'])) {
			$this->error(sprintf($this->lang('UPLOAD_IMAGES_TYPE_JPEG_GIF_PNG')), true);
		}

		// write new file to s3
		$newFile  = $this->post['newfilepath'];

		//delete
		$this->s3->deleteObject([
			'Bucket' => $this->bucket,
			'Key' => $newFile
		]);

		$response = $this->s3->putObject(array(
			'Bucket' => $this->bucket,
			'Key' => $newFile ,
			'SourceFile' => $_FILES['fileR']['tmp_name'],
			'ACL'        => CannedAcl::PUBLIC_READ,
			'ContentType' =>  $_FILES['fileR']['type']
		));

		if (!$response) {
			$this->error(sprintf($this->lang('INVALID_FILE_UPLOAD')), true);
		}
		$return = array(
			'Path'  => $this->post['newfilepath'],
			'Name'  => $this->post['newfilepath'],
			'Error' => '',
			'Code'  => 0
		);
		exit(sprintf('<textarea>%s</textarea>', json_encode($return)));
	}

	/**
	 * Create a new folder in the current directory
	 * @return array
	 */
	public function addfolder() {

		$current_path = $this->getFullPath();

		$new_dir = $this->cleanString($this->get['name']);
		$new_dir = $current_path . $this->pathToFolder($new_dir);

		if(!$this->is_valid_path($new_dir)) {
			$this->error("No way.");
		}

		if(!$this->isDir($new_dir)) {
			$this->error($this->lang('INVALID_DIRECTORY_OR_FILE'));
		}

		$this->createObject($new_dir);

		$array = array(
			'Parent' => $this->get['path'],
			'Name' => $this->get['name'],
			'Error' => "",
			'Code' => 0
		);
		$this->__log(__METHOD__ . ' - adding folder ' . $current_path . $new_dir);

		return $array;
	}

	/**
	 * Delete existed file or folder - filemanager action
	 */
	public function delete()
	{
		$current_path = $this->getFullPath();

		if(!$this->is_valid_path($current_path)) {
			$this->error("No way.");
		}

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($current_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		$isDeleted = $this->deleteObject($current_path);

		return array(
			'Error' => !$isDeleted ? '' : $this->lang('INVALID_DIRECTORY_OR_FILE'),
			'Code' => !$isDeleted ? 0 : -1,
			'Path' => $this->getDynamicPath($current_path),
		);
	}

	/**
	 * Download file - filemanager action
	 */
	public function download()
	{
		$current_path = $this->getFullPath();

		if($this->isDir($current_path)) {
			$this->error(sprintf($this->lang('INVALID_FILE_TYPE')),true);
		}

		$response = $this->s3->get($this->getFullPath());
		$metadata = $response['@metadata']['headers'];
		$content = $response['Body']->getContents();


//		$fileInfo = $this->get_file_info($this->getFullPath());
//		$url      = 'http:'.$fileInfo['Preview'];
//		$fileName = basename($fileInfo['Filename']);
//		$fileSize = $fileInfo['Size'];
//		header('Content-Description: File Transfer');
//		header('Content-Type: application/octet-stream');
//		header("Content-Disposition: attachment; filename={$fileName}");
//		header('Content-Transfer-Encoding: binary');
//		header('Expires: 0');
//		header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
//		header('Pragma: public');
//		header("Content-Length: {$fileSize}");
//		ob_clean();
//		flush();
//		readfile($url);

		header('Content-Description: File Transfer');
		header('Content-Type: application/octet-stream');
		header('Content-Disposition: attachment; filename=' . basename($current_path));
		header('Content-Transfer-Encoding: binary');
		header('Content-Length: ' . $metadata['content-length']);
		header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
		header('Pragma: public');
		header('Expires: 0');

		echo($content);
		exit();
	}

	/**
	 * Preview file - filemanager action
	 * @param bool $thumbnail Whether to generate image thumbnail
	 */
	public function preview($thumbnail)
	{
		$current_path = $this->getFullPath();

		if(!$this->is_valid_path($current_path)) {
			$this->error("No way.");
		}

		if(isset($this->get['path'])) {

			// if $thumbnail is set to true we return the thumbnail
			if($this->config['options']['generateThumbnails'] == true && $thumbnail == true) {
				// get thumbnail (and create it if needed)
				$returned_path = $this->get_thumbnail($current_path);
			} else {
				$returned_path = $current_path;
			}

			// get preview from local storage
			if($this->config['s3']['localThumbsPath'] && $thumbnail) {
				$local_path = $this->getLocalPath($returned_path);

				if(file_exists($local_path)) {
					header("Content-type: image/" . strtolower(pathinfo($local_path, PATHINFO_EXTENSION)));
					header("Content-Transfer-Encoding: Binary");
					header("Content-length: ".filesize($local_path));
					header('Content-Disposition: inline; filename="' . basename($local_path) . '"');
					readfile($local_path);
					exit();
				}
			// get preview from S3 storage
			} else {
				$response = $this->s3->get($returned_path);
				$metadata = $response['@metadata']['headers'];
				$content = $response['Body']->getContents();

				header("Content-type: " . $metadata['content-type']);
				header("Content-Transfer-Encoding: Binary");
				header("Content-length: " . $metadata['content-length']);
				echo($content);
				exit();
			}
		}

		$this->error(sprintf($this->lang('FILE_DOES_NOT_EXIST'), $current_path));
	}

	/**
	 * @inheritdoc
	 */
	protected function get_thumbnail($path)
	{
		$thumbnail_fullpath = $this->get_thumbnail_path($path);

		// generate thumbnail if it does not exist or cacheThumbnail is set to false
		if(!$this->isThumbnailExists($thumbnail_fullpath) || $this->config['options']['cacheThumbnails'] == false) {
			$this->createThumbnail($path, $thumbnail_fullpath, $this->thumbnail_width, $this->thumbnail_height);
			$this->__log(__METHOD__ . ' - generating thumbnail :  '. $thumbnail_fullpath);
		}
		return $thumbnail_fullpath;
	}

	/**
	 * @inheritdoc
	 */
	protected function get_thumbnail_path($path)
	{
		$pathInfo = pathinfo($this->getDynamicPath($path));
		// handle cases as: 'file.ext' (filename only) and '/file.ext' (filename with leading slash)
		$dirName = in_array($pathInfo['dirname'], ['.', '/', '\\']) ? '' : $pathInfo['dirname'] . '/';
		$thumbnail_path = $this->rootDirectory . $this->cachefolder . $dirName;

		if($this->isDir($path)) {
			$thumbnail_fullpath = $thumbnail_path;
		} else {
			$thumbnail_name = $pathInfo['filename'] . '_' . 64 . 'x' . 64 . 'px.' . $pathInfo['extension'];
			$thumbnail_fullpath = $thumbnail_path . $thumbnail_name;
		}
		$this->cleanPath($thumbnail_fullpath);

		return $thumbnail_fullpath;
	}

	/**
	 * Retrieve contents of the given directory (indicated by a “path” parameter).
	 * @return  array {FILE_PATH => [FILE_INFO_1..FILE_INFO_N]}
	 * @todo   need to respect files that are not public by scrubbing them from the list
	 */
	public function getfolder()
	{
		$current_path = $this->getFullPath();

		if(!$this->is_valid_path($current_path)) {
			$this->error("No way.");
		}

		// bail-out if the requested directory does not exist
		if (!$this->isDir($current_path)) {
			$error = sprintf($this->lang('DIRECTORY_NOT_EXIST'), $current_path);
			$this->error($error);
		}

		// request a list of objects filtered by prefix
		$objects = $this->s3->getList($current_path);

		// filter out the root path object (root path is referred to as prefix here)
		$objects = array_filter($objects['Contents'], function($filePath) use($current_path){
			return trim($current_path, '/ ') !== trim($filePath['Key'], '/ ');
		});

		$_this = $this;
		$objects = array_filter($objects, function($filePath) use($_this, $current_path){
			$filePath = preg_replace("@^{$current_path}@", '', $filePath['Key']);
			$fileInfo = explode('/', $filePath);
			return !isset($fileInfo[1]) || $fileInfo[1] === '';
		});

		// build the list of files
		$fileList = array();
		foreach ($objects as $filePath) {
			// make each $filePath a key; value is a hash containing the file metadata
			$fileList[$filePath['Key']] = $this->get_file_info($filePath, true);
		}
		return $fileList;
	}

	/**
	 * Returns file info - filemanager action
	 * @return array
	 */
	public function getinfo()
	{
		$current_path = $this->getFullPath();

		if(!$this->is_valid_path($current_path)) {
			$this->error("No way.");
		}

		$fileInfo = $this->get_file_info($current_path);
		return $fileInfo;
	}

	/**
	 * Rename file or folder - filemanager action
	 * @return array
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

		$newPath = str_replace('/' . $filename, '', $this->get['old']);
		$newName = $this->cleanString($this->get['new'], array('.', '-'));

		$old_file = $this->getFullPath($this->get['old']) . $suffix;
		$new_file = $this->getFullPath($newPath . '/' . $newName). $suffix;

		if(!$this->has_permission('rename') || !$this->is_valid_path($old_file)) {
			$this->error("No way.");
		}

		// forbid bulk rename of objects
		if($suffix == '/' && !$this->config['s3']['allowBulk']) {
			$this->error(sprintf($this->lang('FORBIDDEN_ACTION_DIR')));
		}

		// forbid to change path during rename
		if(strrpos($this->get['new'], '/') !== false) {
			$this->error(sprintf($this->lang('FORBIDDEN_CHAR_SLASH')));
		}

		// for file only - we check if the new given extension is allowed regarding the security Policy settings
		if(is_file($old_file) && $this->config['security']['allowChangeExtensions'] && !$this->is_allowed_file_type($new_file)) {
			$this->error(sprintf($this->lang('INVALID_FILE_TYPE')));
		}

		if($this->s3->exist($new_file)) {
			if($suffix == '/') {
				$this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), $newName));
			} else {
				$this->error(sprintf($this->lang('FILE_ALREADY_EXISTS'), $newName));
			}
		}

		if(!$this->s3->rename($old_file, $new_file)) {
			$this->error(sprintf($this->lang('INVALID_DIRECTORY_OR_FILE'), $newName));
		}
		$this->deleteThumbnail($old_file);

		// check if the object was successfully renamed
		if(!$this->s3->exist($new_file)) {
			if($suffix == '/') {
				$this->error(sprintf($this->lang('ERROR_RENAMING_DIRECTORY'), $filename, $newName));
			} else {
				$this->error(sprintf($this->lang('ERROR_RENAMING_FILE'), $filename, $newName));
			}
		}

		$array = array(
			'Error' => "",
			'Code' => 0,
			'Old Path' => $this->getDynamicPath($old_file),
			'Old Name' => $filename,
			'New Path' => $this->getDynamicPath($new_file),
			'New Name' => $newName
		);
		return $array;
	}


	/*******************************************************************************
	 * Utility
	 ******************************************************************************/

	/**
	 * Builds a full path to the S3 storage object
	 * @param string $path
	 * @return mixed|string
	 */
	protected function getFullPath($path = '')
	{
		if($path == '') {
			if(isset($this->get['path'])) $path = $this->get['path'];
		}

		$fullPath = $this->rootDirectory . rawurldecode($path);
		$fullPath = ltrim($fullPath, '/');
		$this->cleanPath($fullPath);

		return $fullPath;
	}

	/**
	 * Returns a path to S3 storage object without "rootDirectory" part
	 * @param string $path
	 * @return mixed
	 */
	protected function getDynamicPath($path)
	{
		$path = str_replace(rtrim($this->rootDirectory, '/'), '' , $path);
		$this->cleanPath($path);
		return $path;
	}

	/**
	 * Returns full path to local storage, used to store image thumbs locally
	 * @param string $path
	 * @return mixed
	 */
	protected function getLocalPath($path)
	{
		$path = $this->path_to_files . '/' . $this->config['s3']['localThumbsPath'] . '/' . $path;
		$this->cleanPath($path);
		return $path;
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
	 * write a message to the configured error log
	 * see: ini_get('error_log')
	 * @param   string  $message
	 * @return  boolean
	 */
	protected function debug($message) {
		// write to the configured error log only if we are in debug mode
		return $this->debug ? error_log($message, 0) : null;
	}

	/**
	 * Build a hash from the file's information
	 * @param string|object $filePath
	 * @param boolean $thumbnail
	 * @return array
	 */
	protected function get_file_info($filePath, $thumbnail = false)
	{
		if(is_array($filePath)) {
			$current_path = $filePath['Key'];
			$metadata = array(
				'date' => (string)$filePath['LastModified'],
				'last-modified' => (string)$filePath['LastModified'],
				'content-length' => $filePath['Size'],
			);
		} else {
			$current_path = $filePath;
			$metadata = $this->metadata($current_path);
		}

		$dynamic_path = $this->getDynamicPath($current_path);
		$pathInfo = pathinfo($dynamic_path);
		// obtain a copy of the defaults
		$fileInfo = $this->defaultInfo;
		$iconsFolder = $this->getUrl($this->config['icons']['path']);

		if($this->isDir($dynamic_path)) {
			$fileType = self::FILE_TYPE_DIR;
			$preview = $iconsFolder . $this->config['icons']['directory'];
		} else {
			$fileType = $pathInfo['extension'];
			$preview = $iconsFolder . $this->config['icons']['default'];

			if($this->config['options']['showThumbs'] && in_array(strtolower($fileType), array_map('strtolower', $this->config['images']['imagesExt']))) {
				// svg should not be previewed as raster formats images
				$is_svg = ($fileType === 'svg');

				if($this->config['s3']['thumbsRetrieveMode'] === self::RETRIEVE_MODE_BROWSER || $is_svg) {
					$preview = $this->getS3Url($current_path, $thumbnail && !$is_svg);
				} else {
					$preview = $this->connector_script_url . '?mode=preview&path=' . rawurlencode($dynamic_path) . '&' . time();
					if($thumbnail) $preview .= '&thumbnail=true';
				}
			} elseif(file_exists($this->root_path . '/' . $this->config['icons']['path'] . strtolower($fileType) . '.png')) {
				$preview = $iconsFolder . strtolower($fileType) . '.png';
			}
		}

		// attributes (general)
		$fileInfo['Path']       = $dynamic_path;
		$fileInfo['Filename']   = $pathInfo['basename'];
		$fileInfo['File Type']  = $fileType;
		$fileInfo['Protected']  = 0;
		$fileInfo['Preview']    = $preview;
		// attributes (properties)
		$fileInfo['Properties']['Date Created']  = $this->formatDate($metadata['date']);
		$fileInfo['Properties']['Date Modified'] = $this->formatDate($metadata['last-modified']);
		$fileInfo['Properties']['Size'] = $metadata['content-length'];
		return $fileInfo;
	}

	/**
	 * Creates url to S3 object
	 * @param string $filePath
	 * @param boolean $thumbnail
	 * @return mixed
	 */
	protected function getS3Url($filePath, $thumbnail)
	{
		$path = $thumbnail ? $this->get_thumbnail($filePath) : $filePath;

		if($this->config['s3']['presignUrl']) {
			return $this->s3->getPresignedUrl($path, '+10 minutes');
		} else {
			// TODO: is non-presigned url might be created in place, without extra request ?
			//sprintf('//%s/%s', $this->domain, $this->bucket.'/'.$path)
			return $this->s3->getUrl($path);
		}
	}

	/**
	 * Checks path for "dots" to avoid directory climbing and backtracking (traversal attack)
	 * Probably there is an ability to disable such "relative path" via S3 settings, research required
	 * @param $path
	 * @return bool
	 */
	protected function is_valid_path($path)
	{
		$needleList = array('..', './');
		foreach($needleList as $needle) {
			if (strpos($path, $needle) !== false) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Format date string
	 * @param string $date
	 * @return string
	 */
	protected function formatDate($date)
	{
		$timestamp = strtotime($date);
		return date($this->config['options']['dateFormat'], $timestamp);
	}

	/**
	 * S3 differs directory by slash (/) in the end of path.
	 * @link http://stackoverflow.com/questions/22312833/how-can-you-tell-if-an-object-is-a-folder-on-aws-s3
	 * @param string $objectName
	 * @param boolean $verify
	 * @return  boolean
	 */
	protected function isDir($objectName, $verify = false)
	{
		if($verify === true) {
			return is_dir("s3://{$this->s3->bucket}/{$objectName}");
		} else {
			return substr($objectName, -1) == '/';
		}
	}

	/**
	 * Check whether the folder is root
	 * @param string $path
	 * @return bool
	 */
	protected function is_root_folder($path)
	{
		return trim($this->rootDirectory, '/') === trim($path, '/');
	}

	/**
	 * Creates S3 object
	 * @param string $path
	 * @param string|resource $data
	 * @param null $acl
	 * @param array $options
	 * @return \Aws\ResultInterface|null
	 */
	protected function createObject($path, $data = '', $acl = null, $options = array())
	{
		if ($this->isObjectExists($path)) {
			$this->__log(sprintf(self::MSG_OBJECT_EXISTS, $path));
			return null;
		}

		/* @see \Aws\S3\S3Client::checkExistenceWithCommand() */
		try {
			$response = $this->s3->put($path, $data, $acl, $options);
		} catch (S3Exception $e) {
			if ($e->getAwsErrorCode() == 'AccessDenied') {
				$this->error('PUT' . $path . '<br>' . $this->lang('NOT_ALLOWED'));
			}
			if ($e->getStatusCode() >= 500) {
				$this->error('PUT' . $path . '<br>' . $this->lang('INVALID_ACTION'));
			}
			$this->error(sprintf($this->lang('UNABLE_TO_CREATE_DIRECTORY'), $path));
		}

		$valid = $this->validateUploadedObject($response, $path);

		if(!$valid) {
			$this->s3->delete($path);
			$this->error(sprintf($this->lang('UNABLE_TO_CREATE_DIRECTORY'), $path));
		}

		return $response;
	}

	/**
	 * Compare path specified in request with the one is received in response
	 * @param \Aws\Result $response
	 * @param string $path
	 * @return bool
	 */
	protected function validateUploadedObject($response, $path)
	{
		$bucket = $this->s3->bucket . '/';
		$realPath = substr($response['ObjectURL'], stripos($response['ObjectURL'], $bucket) + strlen($bucket));

		return $realPath === $path;
	}

	/**
	 * Deletes S3 object
	 * @param $key string
	 * @return bool
	 */
	public function deleteObject($key)
	{
		if($this->isDir($key)) {
			$this->s3->batchDelete($key);
			$isDeleted = !$this->isObjectExists($key, true);
		} else {
			$isDeleted = unlink("s3://bucket/{$key}");
		}
		$this->deleteThumbnail($key);
		return $isDeleted;
	}

	/**
	 * Deletes thumbnail from S3 storage or locally
	 * @param string $key
	 */
	protected function deleteThumbnail($key)
	{
		$thumbnail_path = $this->get_thumbnail_path($key);
		$localPath = $this->getLocalPath($thumbnail_path);

		if($this->isDir($key)) {
			if(!$this->config['s3']['localThumbsPath']) {
				$this->s3->batchDelete($thumbnail_path);
			} elseif(file_exists($localPath)) {
				$this->unlinkRecursive($localPath);
			}
		} else {
			if(!$this->config['s3']['localThumbsPath']) {
				$this->s3->delete($thumbnail_path);
			} elseif(file_exists($localPath)) {
				unlink($localPath);
			}
		}
	}

	/**
	 * Check whether S3 object exists
	 * @param string $path
	 * @param bool $forceRequest
	 * @return \Aws\ResultInterface|null
	 */
	protected function isObjectExists($path, $forceRequest = false)
	{
		return ($this->config['s3']['checkExistence'] || $forceRequest) ? $this->s3->exist($path) : false;
	}

	/**
	 * Check whether image thumbnail exists
	 * @param string $path
	 * @return bool
	 */
	protected function isThumbnailExists($path)
	{
		if($this->config['s3']['localThumbsPath']) {
			$local_path = $this->getLocalPath($path);
			return file_exists($local_path);
		} else {
			return $this->isObjectExists($path, true);
		}
	}

	/**
	 * Retrieve metadata of an object
	 * @param string $filePath
	 * @return array
	 */
	protected function metadata($filePath)
	{
		$head = $this->s3->head($filePath, true);
		return $head ? $head['@metadata']['headers'] : $head;
	}

	/**
	 * Apply common filters, etc. to a file path
	 * @param string $filePath
	 * @return string
	 */
	protected function sanitizePath($filePath)
	{
		return trim(rawurldecode($filePath), '/');
	}

	/**
	 * Ensure that an uploaded file is unique
	 * @param string  $prefix
	 * @param string  $fileName
	 */
	protected function uniqueFile($prefix, $fileName)
	{
		// request a list of objects filtered by prefix
		$objects = $this->s3->getList($prefix);

//        $objects = $this->s3->listObjects([
//            'Bucket' => $this->bucket,
//            'Prefix' => $prefix,
//        ]);

		$list = array();
		foreach($objects['Contents'] as $object){
			$list[] = $object['Key'];
		}

		$path = join('/', array($prefix, $fileName));
		$this->cleanPath($path);

		$i = 0;
		while (in_array($path, $list)) {
			$i++;
			$parts   = explode('.', $fileName);
			$ext     = array_pop($parts);
			$parts   = array_diff($parts, array("copy{$i}", "copy".($i-1)));
			$parts[] = "copy{$i}";
			$parts[] = $ext;
			$path    = join('/', array($prefix, implode('.', $parts)));
		}
		if (isset($parts)) {
			$_FILES['newfile']['name'] = implode('.', $parts);
		}
	}
	/**
	 * the maximum file upload size in bytes
	 *
	 * @return  integer
	 */
	protected function uploadMaxBytes() {
		return (int) ($this->uploadMaxMb * 1024 * 1024);
	}

	protected function createThumbnail($imagePath, $thumbnailPath, $width, $height)
	{
		$response = $this->s3->get($imagePath);
		$metadata = $response['@metadata']['headers'];
		$content = $response['Body']->getContents();

		require_once(__DIR__ . '/../../inc/wideimage/lib/WideImage.php');

		$image = WideImage::load($content)
			->resize($width, $height, 'outside')
			->crop('center', 'center', $width, $height);

		// store thumbnails locally
		if($this->config['s3']['localThumbsPath']) {
			$local_path = $this->getLocalPath($thumbnailPath);
			// create folder if it does not exist
			if(!file_exists(dirname($local_path))) {
				mkdir(dirname($local_path), 0755, true);
			}
			//$image->save($local_path);
			$image->saveToFile($local_path);
			// use S3 storage
		} else {
			$this->createObject($thumbnailPath, $image->asString(pathinfo($thumbnailPath, PATHINFO_EXTENSION)), null, [
				'ContentType' => $metadata['content-type'],
			]);
		}
	}
}