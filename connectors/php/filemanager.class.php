<?php
/**
 *	Filemanager PHP class
 *
 *	filemanager.class.php
 *	Class for the filemanager.php connector
 *
 *	@license	MIT License
 *	@author		Riaan Los <mail (at) riaanlos (dot) nl>
 *	@author		Simon Georget <simon (at) linea21 (dot) com>
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

require_once('filemanager.base.php');

class Filemanager extends FilemanagerBase
{
	protected $refParams = array();
	protected $languages = array();
	protected $allowed_actions = array();
	protected $doc_root = '';		// root folder known by JS : $this->config['options']['fileRoot'] (filepath or '/') or $_SERVER['DOCUMENT_ROOT'] - overwritten by setFileRoot() method
	protected $dynamic_fileroot = ''; // Only set if setFileRoot() is called. Second part of the path : '/Filemanager/assets/' ( doc_root - $_SERVER['DOCUMENT_ROOT'])
	protected $path_to_files = ''; // path to FM userfiles folder - automatically computed by the PHP class, something like '/var/www/Filemanager/userfiles'
	protected $cachefolder = '_thumbs/';
	protected $thumbnail_width = 64;
	protected $thumbnail_height = 64;
	protected $separator = 'userfiles'; // @todo fix keep it or not?
	protected $connector_script_url = 'connectors/php/filemanager.php';

	public function __construct($extraConfig = array())
    {
		parent::__construct($extraConfig);

        if($this->config['options']['fileConnector']) {
            $this->connector_script_url = $this->config['options']['fileConnector'];
        }

		// if fileRoot is set manually, $this->doc_root takes fileRoot value
		// for security check in is_valid_path() method
		// else it takes $_SERVER['DOCUMENT_ROOT'] default value
		if ($this->config['options']['fileRoot'] !== false ) {
			if($this->config['options']['serverRoot'] === true) {
				$this->doc_root = $_SERVER['DOCUMENT_ROOT'];
				$this->separator = basename($this->config['options']['fileRoot']);
				$this->path_to_files = $_SERVER['DOCUMENT_ROOT'] . '/' . $this->config['options']['fileRoot'];
			} else {
				$this->doc_root = $this->config['options']['fileRoot'];
				$this->separator = basename($this->config['options']['fileRoot']);
				$this->path_to_files = $this->config['options']['fileRoot'];
			}
		} else {
			$this->doc_root = $_SERVER['DOCUMENT_ROOT'];
			$this->path_to_files = $this->fm_path . '/' . $this->separator . '/' ;
		}
		$this->cleanPath($this->path_to_files);

		$this->__log(__METHOD__ . ' $this->fm_path value ' . $this->fm_path);
		$this->__log(__METHOD__ . ' $this->path_to_files ' . $this->path_to_files);
		$this->__log(__METHOD__ . ' $this->doc_root value ' . $this->doc_root);
		$this->__log(__METHOD__ . ' $this->separator value ' . $this->separator);

		$this->setParams();
		$this->setPermissions();
		$this->availableLanguages();
		$this->loadLanguageFile();
	}

    /**
     * Allow Filemanager to be used with dynamic folders
     * @param string $path - i.e '/var/www/'
     * @param bool $mkdir
     */
	public function setFileRoot($path, $mkdir = false)
    {
		// Paths are bit complex to handle - kind of nightmare actually ....
		// 3 parts are availables
		// [1] $this->doc_root. The first part of the path : '/var/www'
		// [2] $this->dynamic_fileroot. The second part of the path : '/Filemanager/assets/' ( doc_root - $_SERVER['DOCUMENT_ROOT'])
		// [3] $this->path_to_files or $this->doc_root. The full path : '/var/www/Filemanager/assets/'

		if($this->config['options']['serverRoot'] === true) {
			$this->doc_root = $_SERVER['DOCUMENT_ROOT'] . '/' . $path . '/';
		} else {
			$this->doc_root = $path . '/';
		}
		$this->cleanPath($this->doc_root);

		// necessary for retrieving path when set dynamically with $fm->setFileRoot() method
		// https://github.com/simogeo/Filemanager/issues/258 @todo to explore deeper
		$this->dynamic_fileroot = str_replace($_SERVER['DOCUMENT_ROOT'], '', $this->doc_root);
		$this->path_to_files = $this->doc_root;
		$this->separator = basename($this->doc_root);

		// do we create folder ?
		if($mkdir && !file_exists($this->doc_root)) {
			mkdir($this->doc_root, 0755, true);
			$this->__log(__METHOD__ . ' creating  ' . $this->doc_root. ' folder through mkdir()');
		}

		$this->__log(__METHOD__ . ' $this->doc_root value overwritten : ' . $this->doc_root);
		$this->__log(__METHOD__ . ' $this->dynamic_fileroot value ' . $this->dynamic_fileroot);
		$this->__log(__METHOD__ . ' $this->path_to_files ' . $this->path_to_files);
		$this->__log(__METHOD__ . ' $this->separator value ' . $this->separator);
	}

    /**
     * @inheritdoc
     */
	public function getinfo()
    {
		$path = $this->get['path'];
		$current_path = $this->getFullPath($path, true);
		$filename = basename($current_path);

		// check if file is readable
		if(!$this->has_system_permission($current_path, array('r'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		// check if file is allowed regarding the security Policy settings
		if(in_array($filename, $this->config['exclude']['unallowed_files']) || preg_match( $this->config['exclude']['unallowed_files_REGEXP'], $filename)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		return $this->get_file_info($path, false);
	}

	/**
	 * @inheritdoc
	 */
	public function getfolder()
    {
		$array = array();
		$filesDir = array();
		$current_path = $this->getFullPath($this->get['path'], true);

		if(!is_dir($current_path)) {
			$this->error(sprintf($this->lang('DIRECTORY_NOT_EXIST'), $this->get['path']));
		}

		// check if file is readable
		if(!$this->has_system_permission($current_path, array('r'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		if(!$handle = @opendir($current_path)) {
			$this->error(sprintf($this->lang('UNABLE_TO_OPEN_DIRECTORY'), $this->get['path']));
		} else {
			while (false !== ($file = readdir($handle))) {
				if($file != "." && $file != "..") {
					array_push($filesDir, $file);
				}
			}
			closedir($handle);

			foreach($filesDir as $file) {
				$filepath = $this->get['path'] . $file;

				if(is_dir($current_path . $file)) {
					if(!in_array($file, $this->config['exclude']['unallowed_dirs']) && !preg_match( $this->config['exclude']['unallowed_dirs_REGEXP'], $file)) {
						$array[$filepath . '/'] = $this->get_file_info($filepath . '/', true);
					}
				} else if (!in_array($file, $this->config['exclude']['unallowed_files']) && !preg_match( $this->config['exclude']['unallowed_files_REGEXP'], $file)) {
					$item = $this->get_file_info($filepath, true);

					if(!isset($this->refParams['type']) || (isset($this->refParams['type']) && strtolower($this->refParams['type'])=='images' && in_array(strtolower($item['filetype']),array_map('strtolower', $this->config['images']['imagesExt'])))) {
						if($this->config['upload']['imagesOnly']== false || ($this->config['upload']['imagesOnly']== true && in_array(strtolower($item['filetype']),array_map('strtolower', $this->config['images']['imagesExt'])))) {
							$array[$filepath] = $item;
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
	public function editfile()
    {
		$current_path = $this->getFullPath($this->get['path'], true);

		// check if file is writable
		if(!$this->has_system_permission($current_path, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		if(!$this->has_permission('edit') || !$this->is_editable($current_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		$this->__log(__METHOD__ . ' - editing file '. $current_path);

		$content = file_get_contents($current_path);
		$content = htmlspecialchars($content);

		if($content === false) {
			$this->error(sprintf($this->lang('ERROR_OPENING_FILE')));
		}

		$array = array(
			'Error' => "",
			'Code' => 0,
			'Path' => $this->get['path'],
			'Content' => $this->formatPath($content)
		);

		return $array;
	}

	/**
	 * @inheritdoc
	 */
	public function savefile()
    {
		$current_path = $this->getFullPath($this->post['path'], true);

		if(!$this->has_permission('edit') || !$this->is_editable($current_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if(!$this->has_system_permission($current_path, array('w'))) {
			$this->error(sprintf($this->lang('ERROR_WRITING_PERM')));
		}

		$this->__log(__METHOD__ . ' - saving file '. $current_path);

		$content =  htmlspecialchars_decode($this->post['content']);
		$r = file_put_contents($current_path, $content, LOCK_EX);

		if(!is_numeric($r)) {
			$this->error(sprintf($this->lang('ERROR_SAVING_FILE')));
		}

		$array = array(
			'Error' => "",
			'Code' => 0,
			'Path' => $this->formatPath($this->post['path'])
		);

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
		$newName = $this->cleanString($this->get['new'], array('.', '-'));

		$old_file = $this->getFullPath($this->get['old'], true) . $suffix;
		$new_file = $this->getFullPath($newPath, true) . '/' . $newName . $suffix;

		if(!$this->has_permission('rename')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// forbid to change path during rename
		if(strrpos($this->get['new'], '/') !== false) {
			$this->error(sprintf($this->lang('FORBIDDEN_CHAR_SLASH')));
		}

		// check if file is writable
		if(!$this->has_system_permission($old_file, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($old_file)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// for file only - we check if the new given extension is allowed regarding the security Policy settings
		if(is_file($old_file) && $this->config['security']['allowChangeExtensions'] && !$this->is_allowed_file_type($new_file)) {
			$this->error(sprintf($this->lang('INVALID_FILE_TYPE')));
		}

		$this->__log(__METHOD__ . ' - renaming ' . $old_file . ' to ' . $new_file);

		if(file_exists($new_file)) {
			if($suffix == '/' && is_dir($new_file)) {
				$this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), $newName));
			}
			if($suffix == '' && is_file($new_file)) {
				$this->error(sprintf($this->lang('FILE_ALREADY_EXISTS'), $newName));
			}
		}

		if(!rename($old_file, $new_file)) {
			if(is_dir($old_file)) {
				$this->error(sprintf($this->lang('ERROR_RENAMING_DIRECTORY'), $filename, $newName));
			} else {
				$this->error(sprintf($this->lang('ERROR_RENAMING_FILE'), $filename, $newName));
			}
		} else {
			// For image only - rename thumbnail if original image was successfully renamed
			if(!is_dir($new_file) && $this->is_image($new_file)) {
				$new_thumbnail = $this->get_thumbnail_path($new_file);
				$old_thumbnail = $this->get_thumbnail_path($old_file);
				if(file_exists($old_thumbnail)) {
					rename($old_thumbnail, $new_thumbnail);
				}
			}
		}

		$array = array(
			'Error' => "",
			'Code' => 0,
			'Old Path' => $this->formatPath($this->get['old'] . $suffix),
			'Old Name' => $filename,
			'New Path' => $this->formatPath($newPath . '/' . $newName . $suffix),
			'New Name' => $newName
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

		// old path
		$tmp = explode('/', trim($this->get['old'], '/'));
		$fileName = array_pop($tmp); // file name or new dir name
		$path = '/' . implode('/', $tmp) . '/';
		$this->cleanPath($path);

		$oldPath = $this->getFullPath($this->get['old'], true);
		$newPath = $this->getFullPath($newPath, true);
		$newFullPath = $newPath . $fileName;

		// check if file is writable
		if(!$this->has_system_permission($oldPath, array('w')) || !$this->has_system_permission($newPath, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($oldPath)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if(!$this->has_permission('move')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// check if file already exists
		if (file_exists($newFullPath)) {
			if(is_dir($newFullPath)) {
				$this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), rtrim($this->get['new'], '/') . '/' . $fileName));
			} else {
				$this->error(sprintf($this->lang('FILE_ALREADY_EXISTS'), rtrim($this->get['new'], '/') . '/' . $fileName));
			}
		}

		// create dir if not exists
		if (!file_exists($newPath)) {
			if(!mkdir($newPath,0755, true)) {
				$this->error(sprintf($this->lang('UNABLE_TO_CREATE_DIRECTORY'), $newPath));
			}
		}

		// should be retrieved before rename operation
		$old_thumbnail = $this->get_thumbnail_path($oldPath);

		// move file or folder
		if(!rename($oldPath, $newFullPath)) {
			if(is_dir($oldPath)) {
				$this->error(sprintf($this->lang('ERROR_RENAMING_DIRECTORY'), $path, $this->get['new']));
			} else {
				$this->error(sprintf($this->lang('ERROR_RENAMING_FILE'), $path . $fileName, $this->get['new']));
			}
		} else {
			// move thumbnail file or thumbnails folder if exists
			if(file_exists($old_thumbnail)) {
				$new_thumbnail = $this->get_thumbnail_path($newFullPath);
				// delete old thumbnail(s) if destination folder does not exist
				if(file_exists(dirname($new_thumbnail))) {
					rename($old_thumbnail, $new_thumbnail);
				} else {
					is_dir($old_thumbnail) ? $this->unlinkRecursive($old_thumbnail) : unlink($old_thumbnail);
				}
			}
		}

		$array = array(
			'Error' => "",
			'Code' => 0,
			'Old Path' => $path,
			'Old Name' => $fileName,
			'New Path' => $this->formatPath($newPath),
			'New Name' => $fileName,
			'Type' => is_dir($oldPath) ? 'dir' : 'file',
		);
		return $array;
	}

	/**
	 * @inheritdoc
	 */
	public function delete()
    {
		$current_path = $this->getFullPath($this->get['path'], true);
		$thumbnail_path = $this->get_thumbnail_path($current_path);

		if(!$this->has_permission('delete')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// check if file is writable
		if(!$this->has_system_permission($current_path, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		// check if not requesting main FM userfiles folder
		if($this->is_root_folder($current_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if(is_dir($current_path)) {
			$this->__log(__METHOD__ . ' - deleting folder '. $current_path);
			$this->unlinkRecursive($current_path);

			// delete thumbnails if exists
			if(file_exists($thumbnail_path)) {
				$this->__log(__METHOD__ . ' - deleting thumbnails folder '. $thumbnail_path);
				$this->unlinkRecursive($thumbnail_path);
			}
		} else {
			$this->__log(__METHOD__ . ' - deleting file '. $current_path);
			unlink($current_path);

			// delete thumbnails if exists
			if(file_exists($thumbnail_path)) {
				$this->__log(__METHOD__ . ' - deleting thumbnail file '. $thumbnail_path);
				unlink($thumbnail_path);
			}
		}

		return array(
			'Error' => "",
			'Code' => 0,
			'Path' => $this->formatPath($this->get['path']),
		);
	}

	/**
	 * @inheritdoc
	 */
	public function replace()
    {
		$this->response_format = self::RESPONSE_TYPE_TEXT;

		$this->setParams();
		$this->validateUploadedFile('fileR');
		$current_path = $this->getFullPath($this->post['newfilepath']);

		// we check the given file has the same extension as the old one
		if(strtolower(pathinfo($_FILES['fileR']['name'], PATHINFO_EXTENSION)) != strtolower(pathinfo($this->post['newfilepath'], PATHINFO_EXTENSION))) {
			$this->error(sprintf($this->lang('ERROR_REPLACING_FILE') . ' '. pathinfo($this->post['newfilepath'], PATHINFO_EXTENSION)));
		}

		if(!$this->is_valid_path($current_path)) {
			$this->error(sprintf($this->lang('FILE_DOES_NOT_EXIST'), $this->post['newfilepath']));
		}

		// check if file is writable
		if(!$this->has_system_permission($current_path, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		if(!$this->has_permission('replace')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		move_uploaded_file($_FILES['fileR']['tmp_name'], $current_path);

		// we delete thumbnail if file is image and thumbnail already
		if($this->is_image($current_path) && file_exists($this->get_thumbnail($current_path))) {
			unlink($this->get_thumbnail($current_path));
		}

		// automatically resize image if it's too big
		$imagePath = $current_path;
		if($this->is_image($imagePath) && $this->config['images']['resize']['enabled']) {
			if ($size = @getimagesize($imagePath)){
				if ($size[0] > $this->config['images']['resize']['maxWidth'] || $size[1] > $this->config['images']['resize']['maxHeight']) {
					$this->resizeImage($imagePath, $this->config['images']['resize']['maxWidth'], $this->config['images']['resize']['maxHeight']);
					$this->__log(__METHOD__ . ' - resizing image : '. $current_path);
				}
			}
		}

		chmod($current_path, 0644);

		$response = array(
			'Path' => dirname($this->post['newfilepath']),
			'Name' => basename($this->post['newfilepath']),
			'Error' => "",
			'Code' => 0
		);

		$this->__log(__METHOD__ . ' - replacing file '. $current_path);

		echo '<textarea>' . json_encode($response) . '</textarea>';
		die();
	}

	/**
	 * @inheritdoc
	 */
	public function add()
    {
		$this->response_format = self::RESPONSE_TYPE_TEXT;

		$this->setParams();
		$this->validateUploadedFile('newfile');
		$_FILES['newfile']['name'] = $this->cleanString($_FILES['newfile']['name'], array('.', '-'));

		$current_path = $this->getFullPath($this->post['currentpath'], true);

		// unless we are in overwrite mode, we need a unique file name
		if(!$this->config['upload']['overwrite']) {
			$_FILES['newfile']['name'] = $this->checkFilename($current_path, $_FILES['newfile']['name']);
		}

		move_uploaded_file($_FILES['newfile']['tmp_name'], $current_path . $_FILES['newfile']['name']);

		// automatically resize image if it's too big
		$imagePath = $current_path . $_FILES['newfile']['name'];
		if($this->is_image($imagePath) && $this->config['images']['resize']['enabled']) {
			if ($size = @getimagesize($imagePath)){
				if ($size[0] > $this->config['images']['resize']['maxWidth'] || $size[1] > $this->config['images']['resize']['maxHeight']) {
					$this->resizeImage($imagePath, $this->config['images']['resize']['maxWidth'], $this->config['images']['resize']['maxHeight']);
					$this->__log(__METHOD__ . ' - resizing image : '. $_FILES['newfile']['name']. ' into '. $current_path);
				}
			}
		}

		chmod($current_path . $_FILES['newfile']['name'], 0644);

		$response = array(
			'Path' => $this->post['currentpath'],
			'Name' => $_FILES['newfile']['name'],
			'Error' => "",
			'Code' => 0
		);

		$this->__log(__METHOD__ . ' - adding file '. $_FILES['newfile']['name']. ' into '. $current_path);

		echo '<textarea>' . json_encode($response) . '</textarea>';
		die();
	}

	/**
	 * @inheritdoc
	 */
	public function addfolder()
    {
		$current_path = $this->getFullPath($this->get['path'], true);

		if(is_dir($current_path . $this->get['name'])) {
			$this->error(sprintf($this->lang('DIRECTORY_ALREADY_EXISTS'), $this->get['name']));
		}

		$newdir = $this->cleanString($this->get['name']);
		if(!mkdir($current_path . $newdir, 0755)) {
			$this->error(sprintf($this->lang('UNABLE_TO_CREATE_DIRECTORY'), $newdir));
		}
		$array = array(
			'Parent' => $this->get['path'],
			'Name' => $this->get['name'],
			'Error' => "",
			'Code' => 0
		);
		$this->__log(__METHOD__ . ' - adding folder '. $current_path . $newdir);

		return $array;
	}

	/**
	 * @inheritdoc
	 */
	public function download($force)
    {
		$current_path = $this->getFullPath($this->get['path'], true);

		if(!$this->has_permission('download')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		// check if file is writable
		if(!$this->has_system_permission($current_path, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		// we check if extension is allowed regarding the security Policy settings
		if(is_file($current_path)) {
			if(!$this->is_allowed_file_type(basename($current_path))) {
				$this->error(sprintf($this->lang('INVALID_FILE_TYPE')));
			}
		} else {
			// check if permission is granted
			if(is_dir($current_path) && $this->config['security']['allowFolderDownload'] == false ) {
				$this->error(sprintf($this->lang('NOT_ALLOWED')));
			}

			// check if not requesting main FM userfiles folder
			if($this->is_root_folder($current_path)) {
				$this->error(sprintf($this->lang('NOT_ALLOWED')));
			}

			$destination_path = sys_get_temp_dir().'/'.uniqid().'.zip';

			// if Zip archive is created
			if($this->zipFile($current_path, $destination_path, true)) {
				$current_path = $destination_path;
			} else {
				$this->error($this->lang('ERROR_CREATING_ZIP'));
			}
		}

		if(!$force) {
			$array = array(
				'Error' => "",
				'Code' => 0,
				'Path' => $this->formatPath($this->get['path']),
			);
			return $array;
		}

		header("Content-Type: application/force-download");
		header('Content-Disposition: inline; filename="' . basename($current_path) . '"');
		header("Content-Transfer-Encoding: binary");
		header("Content-Length: " . real_filesize($current_path));
		header('Content-Type: application/octet-stream');
		header('Content-Disposition: attachment; filename="' . basename($current_path) . '"');
		//handle caching
		header('Pragma: public');
		header('Expires: 0');
		header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
		header('Cache-Control: private', false);

		// download by chunks to avoid memory issues
		$chunkSize = 10 * (1024 * 1024); // 10 MB
		$handle = fopen($current_path, 'rb');
		$this->__log(__METHOD__ . ' - downloading '. $current_path);

		//read file chunks by chunk and send output to browser until end of file is not reached
		while(!feof($handle)) {
			echo fread($handle, $chunkSize);
			//send an application-initiated buffer
			ob_flush();
			//usually FastCGI has a socket buffer on its own so use flush() to send the current content.
			flush();
		}
		fclose($handle);

		$this->__log(__METHOD__ . ' - downloaded '. $current_path);
		exit();
	}

	/**
	 * @inheritdoc
	 */
	public function preview($thumbnail)
    {
		$current_path = $this->getFullPath($this->get['path'], true);

		// if $thumbnail is set to true we return the thumbnail
		if($this->config['options']['generateThumbnails'] == true && $thumbnail == true) {
			// get thumbnail (and create it if needed)
			$returned_path = $this->get_thumbnail($current_path);
		} else {
			$returned_path = $current_path;
		}

		header("Content-type: image/" . strtolower(pathinfo($returned_path, PATHINFO_EXTENSION)));
		header("Content-Transfer-Encoding: Binary");
		header("Content-length: " . real_filesize($returned_path));
		header('Content-Disposition: inline; filename="' . basename($returned_path) . '"');
		readfile($returned_path);

		exit();
	}

	/**
	 * Creates a zip file from source to destination
	 * @param  string $source Source path for zip
	 * @param  string $destination Destination path for zip
	 * @param  string|boolean $flag OPTIONAL If true includes the folder also
	 * @return boolean
	 * @link 	 http://stackoverflow.com/questions/17584869/zip-main-folder-with-sub-folder-inside
	 */
	public function zipFile($source, $destination, $flag = '')
	{
		if (!extension_loaded('zip') || !file_exists($source)) {
			return false;
		}

		$zip = new ZipArchive();
		if (!$zip->open($destination, ZIPARCHIVE::CREATE)) {
			return false;
		}

		$source = str_replace('\\', '/', realpath($source));
		if($flag)
		{
			$flag = basename($source) . '/';
			//$zip->addEmptyDir(basename($source) . '/');
		}

		if (is_dir($source) === true)
		{
			// add file to prevent empty archive error on download
			$zip->addFromString('fm', "This archive has been generated by simogeo's Filemanager : https://github.com/simogeo/Filemanager/");

			$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($source), RecursiveIteratorIterator::SELF_FIRST);
			foreach ($files as $file)
			{
				$file = str_replace('\\', '/', realpath($file));

				if (is_dir($file) === true)
				{
					$zip->addEmptyDir(str_replace($source . '/', '', $flag.$file . '/'));
				}
				else if (is_file($file) === true)
				{
					$zip->addFromString(str_replace($source . '/', '', $flag.$file), file_get_contents($file));
				}
			}
		}
		else if (is_file($source) === true)
		{
			$zip->addFromString($flag.basename($source), file_get_contents($source));
		}

		return $zip->close();
	}

	public function getMaxUploadFileSize()
    {
		$max_upload = (int) ini_get('upload_max_filesize');
		$max_post = (int) ini_get('post_max_size');
		$memory_limit = (int) ini_get('memory_limit');

		$upload_mb = min($max_upload, $max_post, $memory_limit);

		$this->__log(__METHOD__ . ' - max upload file size is '. $upload_mb. 'Mb');

		return $upload_mb;
	}

	protected function setParams()
    {
		$tmp = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '/';
		$tmp = explode('?',$tmp);
		$params = array();
		if(isset($tmp[1]) && $tmp[1]!='') {
			$params_tmp = explode('&',$tmp[1]);
			if(is_array($params_tmp)) {
				foreach($params_tmp as $value) {
					$tmp = explode('=',$value);
					if(isset($tmp[0]) && $tmp[0]!='' && isset($tmp[1]) && $tmp[1]!='') {
						$params[$tmp[0]] = $tmp[1];
					}
				}
			}
		}
		$this->refParams = $params;
	}

    protected function setPermissions()
    {
		$this->allowed_actions = $this->config['options']['capabilities'];

		if($this->config['edit']['enabled']) array_push($this->allowed_actions, 'edit');
	}

    /**
     * Check if system permission is granted
     * @param string $filepath
     * @param array $permissions
     * @return bool
     */
    protected function has_system_permission($filepath, $permissions)
    {
		if(in_array('r', $permissions)) {
			if(!is_readable($filepath)) return false;
		}
		if(in_array('w', $permissions)) {
			if(!is_writable($filepath)) return false;
		}

		return true;
	}

    /**
     * Create array with file properties
     * @param string $relative_path
     * @param bool $thumbnail
	 * @return array|void
     */
	protected function get_file_info($relative_path, $thumbnail = false)
    {
		$current_path = $this->getFullPath($relative_path);

		$item = $this->defaultInfo;
		$pathInfo = pathinfo($current_path);
		$filemtime = filemtime($current_path);
		$iconsFolder = $this->getUrl($this->config['icons']['path']);

		// check if file is writable and readable
		$protected = $this->has_system_permission($current_path, array('w', 'r')) ? 0 : 1;

		if(is_dir($current_path)) {
			$fileType = self::FILE_TYPE_DIR;
			$preview = $iconsFolder . ($protected ? 'locked_' : '') . $this->config['icons']['directory'];
		} else {
			$fileType = $pathInfo['extension'];
			if($protected == 1) {
				$preview = $iconsFolder . 'locked_' . $this->config['icons']['default'];
			} else {
				$preview = $iconsFolder . $this->config['icons']['default'];
				$item['Properties']['Size'] = real_filesize($current_path);

				if($this->config['options']['showThumbs'] && in_array(strtolower($fileType), array_map('strtolower', $this->config['images']['imagesExt']))) {
					// svg should not be previewed as raster formats images
					if($fileType == 'svg') {
						$preview = $relative_path;
					} else {
						$preview = $this->connector_script_url . '?mode=preview&path='. rawurlencode($relative_path).'&'. time();
						if($thumbnail) $preview .= '&thumbnail=true';
					}

					if($item['Properties']['Size']) {
						list($width, $height, $type, $attr) = getimagesize($current_path);
					} else {
						list($width, $height) = array(0, 0);
					}

					$item['Properties']['Height'] = $height;
					$item['Properties']['Width'] = $width;
				} else if(file_exists($this->fm_path . '/' . $this->config['icons']['path'] . strtolower($fileType) . '.png')) {
					$preview = $iconsFolder . strtolower($fileType) . '.png';
				}
			}
		}

		$item['Path'] = $this->formatPath($relative_path);
		$item['Filename'] = $pathInfo['basename'];
		$item['File Type'] = $fileType;
		$item['Protected'] = $protected;
		$item['Preview'] = $preview;

		$item['Properties']['Date Modified'] = date($this->config['options']['dateFormat'], $filemtime);
		//$item['properties']['Date Created'] = date($this->config['options']['dateFormat'], filectime($current_path); // PHP cannot get create timestamp
		$item['Properties']['filemtime'] = $filemtime;
		return $item;
	}

    /**
     * Return full path to file
     * @param string $path
     * @param bool $verify If file or folder exists and valid
     * @return mixed|string
     */
	protected function getFullPath($path, $verify = false)
    {
		if($this->config['options']['fileRoot'] !== false) {
			$full_path = $this->doc_root . rawurldecode(str_replace ( $this->doc_root , '' , $path));
			if($this->dynamic_fileroot != '') {
				$full_path = $this->doc_root . rawurldecode(str_replace($this->dynamic_fileroot, '', $path));
				// $dynPart = str_replace($_SERVER['DOCUMENT_ROOT'], '', $this->path_to_files); // instruction could replace the line above
				// $full_path = $this->path_to_files . rawurldecode(str_replace($dynPart, '' ,$path)); // instruction could replace the line above
			}
		} else {
			$full_path = $this->doc_root . rawurldecode($path);
		}
		$this->cleanPath($full_path);

		if($verify === true) {
			if(!file_exists($full_path) || !$this->is_valid_path($full_path)) {
				$langKey = is_dir($full_path) ? 'DIRECTORY_NOT_EXIST' : 'FILE_DOES_NOT_EXIST';
				$this->error(sprintf($this->lang($langKey), $path));
			}
		}

		return $full_path;
	}

	/**
	 * Format path regarding the initial configuration
	 * @param string $path
     * @return mixed
	 */
    protected function formatPath($path)
    {
		if($this->dynamic_fileroot != '') {
			$a = explode($this->separator, $path);
			return end($a);
		} else {
			return $path;
		}
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
		$pattern = array('/\\\\+/', '/\/+/');
		$replacement = array('\\\\', '/');
		$rp_substr = preg_replace($pattern, $replacement, $rp_substr);
		$rp_files = preg_replace($pattern, $replacement, $rp_files);

		$this->__log('substr path_to_files : ' . $rp_substr);
		$this->__log('path_to_files : ' . $rp_files);

		return $rp_substr == $rp_files;
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
	 * Check if extension is allowed regarding the security Policy / Restrictions settings
	 * @param string $file
     * @return bool
	 */
    protected function is_allowed_file_type($file)
    {
		$path_parts = pathinfo($file);

		// if there is no extension
		if (!isset($path_parts['extension'])) {
			// we check if no extension file are allowed
			return (bool)$this->config['security']['allowNoExtension'];
		}

		$exts = array_map('strtolower', $this->config['security']['uploadRestrictions']);

		if($this->config['security']['uploadPolicy'] == 'DISALLOW_ALL') {

			if(!in_array(strtolower($path_parts['extension']), $exts))
				return false;
		}
		if($this->config['security']['uploadPolicy'] == 'ALLOW_ALL') {

			if(in_array(strtolower($path_parts['extension']), $exts))
				return false;
		}

		return true;
	}

	/**
	 * Clean path string to remove multiple slashes, etc.
	 * @param string $string
	 */
	protected function cleanPath(&$string)
	{
		// remove multiple slashes
		$string = preg_replace('#/+#', '/', $string);
		//str_replace("//", "/", $string);
	}

    /**
     * Clean string to retrieve correct filename
     * @param string|array $string
     * @param array $allowed
     * @return array|mixed
     */
	protected function cleanString($string, $allowed = array())
    {
		$allow = null;
		if(!empty($allowed)) {
			foreach ($allowed as $value) {
				$allow .= "\\$value";
			}
		}

		if(is_array($string)) {
			$cleaned = array();
			foreach ($string as $key => $clean) {
				$cleaned[$key] = $this->normalizeString($clean, $allow);
			}
		} else {
			$cleaned = $this->normalizeString($string, $allow);
		}

		return $cleaned;
	}

    /**
     * Normalize and transliterate string to latin chars
     * @param string|array $string
     * @param array $allowed
     * @return mixed
     */
    protected function normalizeString($string, $allowed)
	{
		if($this->config['security']['normalizeFilename']) {
			// replace chars which are not related to any language
			$replacements = array(' '=>'_', '\''=>'_', '/'=>'', '\\'=>'');
			$string = strtr($string, $replacements);
		}

		if($this->config['options']['chars_only_latin'] === true) {
			// transliterate if extension is loaded
			if(extension_loaded('intl') === true) {
				$options = 'Any-Latin; Latin-ASCII; NFD; [:Nonspacing Mark:] Remove; NFC;';
				$string = transliterator_transliterate($options, $string);
			}
			// clean up all non-latin chars
			$string = preg_replace("/[^{$allowed}_a-zA-Z0-9]/u", '', $string);
		}

		// remove double underscore
		$string = preg_replace('/[_]+/', '_', $string);

		return $string;
	}

	/**
	 * Checking if permission is set or not for a given action
	 * @param string $action
	 * @return boolean
	 */
    protected function has_permission($action)
    {
		return in_array($action, $this->allowed_actions);
	}

	/**
	 * Return Thumbnail path from given path, works for both file and dir path
	 * @param string $path
     * @return string
	 */
	protected function get_thumbnail_path($path)
    {
		$pos = strrpos($path, $this->separator);
		$a[0] = substr($path,0,$pos);
		$a[1] = substr($path,$pos+strlen($this->separator));

		$path_parts = pathinfo($path);
		$thumbnail_path = $a[0] . $this->separator . '/' . $this->cachefolder . '/';

		if(is_dir($path)) {
			$thumbnail_fullpath = $thumbnail_path . end($a) . '/';
		} else {
			$thumbnail_name = $path_parts['filename'] . '_' . $this->thumbnail_width . 'x' . $this->thumbnail_height . 'px.' . $path_parts['extension'];
			$thumbnail_fullpath = $thumbnail_path . dirname(end($a)) . '/' . $thumbnail_name;
		}
		$this->cleanPath($thumbnail_fullpath);

		return $thumbnail_fullpath;
	}

	/**
	 * For debugging just call the direct URL:
	 * http://localhost/Filemanager/connectors/php/filemanager.php?mode=preview&path=%2FFilemanager%2Fuserfiles%2FMy%20folder3%2Fblanches_neiges.jPg&thumbnail=true
	 * @param string $path
     * @return string
	 */
	protected function get_thumbnail($path)
    {
		$thumbnail_fullpath = $this->get_thumbnail_path($path);

		// if thumbnail does not exist we generate it or cacheThumbnail is set to false
		if(!file_exists($thumbnail_fullpath) || $this->config['options']['cacheThumbnails'] == false) {

			// create folder if it does not exist
			if(!file_exists(dirname($thumbnail_fullpath))) {
				mkdir(dirname($thumbnail_fullpath), 0755, true);
			}
			$this->createThumbnail($path, $thumbnail_fullpath, $this->thumbnail_width, $this->thumbnail_height);
			$this->__log(__METHOD__ . ' - generating thumbnail :  '. $thumbnail_fullpath);
		}

		return $thumbnail_fullpath;
	}

    /**
     * Check whether filename is unique, otherwise build unique one
     * @param string $path
     * @param string $filename
     * @param string $i
     * @return mixed
     */
	protected function checkFilename($path, $filename, $i = '')
    {
		if(!file_exists($path . $filename)) {
			return $filename;
		} else {
			$_i = $i;
			$tmp = explode(/*$this->config['upload']['suffix'] . */$i . '.', $filename);
			if($i=='') {
				$i=1;
			} else {
				$i++;
			}
			$filename = str_replace($_i . '.' . $tmp[(sizeof($tmp)-1)],$i . '.' . $tmp[(sizeof($tmp)-1)], $filename);
			return $this->checkFilename($path, $filename, $i);
		}
	}

    /**
     * Load using "langCode" var passed into URL if present and if exists
     * Otherwise use default configuration var.
     */
	protected function loadLanguageFile()
    {
		$lang = $this->config['options']['culture'];
		if(isset($this->refParams['langCode']) && in_array($this->refParams['langCode'], $this->languages)) {
			$lang = $this->refParams['langCode'];
		}

		if(file_exists($this->fm_path . '/scripts/languages/'.$lang.'.js')) {
			$stream =file_get_contents($this->fm_path . '/scripts/languages/'.$lang.'.js');
			$this->language = json_decode($stream, true);
		} else {
			$l = substr($lang,0,2); // we try with 2 chars language file
			if(file_exists($this->fm_path. '/scripts/languages/'.$l.'.js')) {
				$stream = file_get_contents($this->fm_path . '/scripts/languages/'.$l.'.js');
				$this->language = json_decode($stream, true);
			} else {
				// we include default language file
				$stream = file_get_contents($this->fm_path . '/scripts/languages/'.$this->config['options']['culture'].'.js');
				$this->language = json_decode($stream, true);
			}
		}
	}

    /**
     * Prepare available languages
     */
	protected function availableLanguages()
    {
		if ($handle = opendir($this->fm_path . '/scripts/languages/')) {
			while (false !== ($file = readdir($handle))) {
				if ($file != "." && $file != "..") {
					array_push($this->languages, pathinfo($file, PATHINFO_FILENAME));
				}
			}
			closedir($handle);
		}
	}

    /**
     * Check whether the file is image
     * @param string $path
     * @return bool
     */
	protected function is_image($path)
    {
		if(!is_array($a = @getimagesize($path))) {
			return false;
		}
		$image_type = $a[2];

		return in_array($image_type , array(IMAGETYPE_GIF , IMAGETYPE_JPEG ,IMAGETYPE_PNG , IMAGETYPE_BMP));
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
     * Check whether the file could be edited regarding configuration setup
     * @param string $file
     * @return bool
     */
	protected function is_editable($file)
    {
		$path_parts = pathinfo($file);
		$exts = array_map('strtolower', $this->config['edit']['editExt']);

		return in_array($path_parts['extension'], $exts);
	}

	/**
	 * Remove "../" from path
	 * @param string $path Path to be converted
	 * @param bool $clean If dir names should be cleaned
	 * @return string or false in case of error (as exception are not used here)
	 */
	public function expandPath($path, $clean = false)
	{
		$todo  = explode('/', $path);
		$fullPath = array();

		foreach ($todo as $dir) {
			if ($dir == '..') {
				$element = array_pop($fullPath);
				if (is_null($element)) {
					return false;
				}
			} else {
				if ($clean) {
					$dir = $this->cleanString($dir);
				}
				array_push($fullPath, $dir);
			}
		}
		return implode('/', $fullPath);
	}

	/**
	 * Check whether file is uploaded and valid
	 * @param string $uploadName
	 */
	protected function validateUploadedFile($uploadName)
	{
		if(!isset($_FILES[$uploadName]) || !is_uploaded_file($_FILES[$uploadName]['tmp_name'])) {

			// if fileSize limit set by the user is greater than size allowed in php.ini file, we apply server restrictions
			// and log a warning into file
			if($this->config['upload']['fileSizeLimit'] > $this->getMaxUploadFileSize()) {
				$this->__log(__METHOD__ . ' [WARNING] : file size limit set by user is greater than size allowed in php.ini file : ' . $this->config['upload']['fileSizeLimit'] . $this->lang('mb') . ' > ' . $this->getMaxUploadFileSize() . $this->lang('mb') . '.');
				$this->config['upload']['fileSizeLimit'] = $this->getMaxUploadFileSize();
				$this->error(sprintf($this->lang('UPLOAD_FILES_SMALLER_THAN'),$this->config['upload']['fileSizeLimit'] . $this->lang('mb')));
			}

			$this->error(sprintf($this->lang('INVALID_FILE_UPLOAD') . ' '. sprintf($this->lang('UPLOAD_FILES_SMALLER_THAN'), $this->config['upload']['fileSizeLimit'] . $this->lang('mb'))));
		}

		// we determine max upload size if not set
		if($this->config['upload']['fileSizeLimit'] == 'auto') {
			$this->config['upload']['fileSizeLimit'] = $this->getMaxUploadFileSize();
		}

		if($_FILES[$uploadName]['size'] > ($this->config['upload']['fileSizeLimit'] * 1024 * 1024)) {
			$this->error(sprintf($this->lang('UPLOAD_FILES_SMALLER_THAN'),$this->config['upload']['fileSizeLimit'] . $this->lang('mb')));
		}

		// we check if extension is allowed regarding the security Policy settings
		if(!$this->is_allowed_file_type($_FILES[$uploadName]['name'])) {
			$this->error(sprintf($this->lang('INVALID_FILE_TYPE')));
		}

		// we check if only images are allowed
		if($this->config['upload']['imagesOnly'] || (isset($this->refParams['type']) && strtolower($this->refParams['type'])=='images')) {
			if(!($size = @getimagesize($_FILES[$uploadName]['tmp_name']))){
				$this->error(sprintf($this->lang('UPLOAD_IMAGES_ONLY')));
			}
			if(!in_array($size[2], array(1, 2, 3, 7, 8))) {
				$this->error(sprintf($this->lang('UPLOAD_IMAGES_TYPE_JPEG_GIF_PNG')));
			}
		}
	}

	/**
	 * Creates URL to asset based on it relative path
	 * @param $path
	 * @return string
	 */
	protected function getUrl($path)
	{
		if(isset($this->config['fmUrl']) && !empty($this->config['fmUrl']) && strpos($path, '/') !== 0) {
			$url = $this->config['fmUrl'] . '/' . $path;
			$this->cleanPath($url);
			return $url;
		}
		return $path;
	}

	/**
	 * Resizes original image to dimensions defined in the config file
	 * @param $imagePath
	 * @param $width
	 * @param $height
	 */
	protected function resizeImage($imagePath, $width, $height)
	{
		require_once('./inc/wideimage/lib/WideImage.php');

		$image = WideImage::load($imagePath);
		$resized = $image->resize($width, $height, 'inside');
		$resized->saveToFile($imagePath);
	}

	/**
	 * Creates thumbnail from the original image
	 * @param $imagePath
	 * @param $width
	 * @param $height
	 */
	protected function createThumbnail($imagePath, $thumbnailPath, $width, $height)
	{
		require_once('./inc/wideimage/lib/WideImage.php');

		$image = WideImage::load($imagePath);
		$resized = $image->resize($width, $height, 'outside')->crop('center', 'center', $width, $height);
		$resized->saveToFile($thumbnailPath);
	}

}