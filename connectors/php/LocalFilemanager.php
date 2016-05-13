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
	protected $refParams = array();
	protected $languages = array();
	protected $allowed_actions = array();
	protected $doc_root = '';		// root folder known by JS : $this->config['options']['fileRoot'] (filepath or '/') or $_SERVER['DOCUMENT_ROOT'] - overwritten by setFileRoot() method
	protected $dynamic_fileroot = 'userfiles'; // second part of the path : '/Filemanager/assets/' ( doc_root - $_SERVER['DOCUMENT_ROOT'])
	protected $path_to_files = ''; // path to FM userfiles folder - automatically computed by the PHP class, something like '/var/www/Filemanager/userfiles'
	protected $connector_script_url = '/connectors/php/filemanager.php';

	public function __construct($extraConfig = array())
    {
		parent::__construct($extraConfig);

        if($this->config['options']['fileConnector']) {
            $this->connector_script_url = $this->config['options']['fileConnector'];
        }

		$fileRoot = $this->config['options']['fileRoot'];
		if ($fileRoot !== false) {
			// takes $_SERVER['DOCUMENT_ROOT'] as files root; "fileRoot" is a suffix
			if($this->config['options']['serverRoot'] === true) {
				$this->doc_root = $_SERVER['DOCUMENT_ROOT'];
				$this->dynamic_fileroot = $fileRoot;
				$this->path_to_files = $_SERVER['DOCUMENT_ROOT'] . '/' . $fileRoot;
			}
			// takes "fileRoot" as files root; "fileRoot" is a full server path
			else {
				$this->doc_root = $fileRoot;
				$this->dynamic_fileroot = '';
				$this->path_to_files = $fileRoot;
			}
		} else {
			$this->doc_root = $_SERVER['DOCUMENT_ROOT'];
			$this->path_to_files = $this->fm_path . '/' . $this->dynamic_fileroot;
		}
		$this->path_to_files = $this->cleanPath($this->path_to_files);

		$this->__log(__METHOD__ . ' $this->fm_path value ' . $this->fm_path);
		$this->__log(__METHOD__ . ' $this->path_to_files ' . $this->path_to_files);
		$this->__log(__METHOD__ . ' $this->doc_root value ' . $this->doc_root);
		$this->__log(__METHOD__ . ' $this->dynamic_fileroot value ' . $this->dynamic_fileroot);

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
		if($this->config['options']['serverRoot'] === true) {
			$this->dynamic_fileroot = $path;
			$this->path_to_files = $this->cleanPath($this->doc_root . '/' . $path);
		} else {
			$this->path_to_files = $this->cleanPath($path);
		}

		$this->__log(__METHOD__ . ' Overwritten with setFileRoot() method:');
		$this->__log(__METHOD__ . ' $this->path_to_files value ' . $this->path_to_files);
		$this->__log(__METHOD__ . ' $this->dynamic_fileroot value ' . $this->dynamic_fileroot);

		if($mkdir && !file_exists($this->path_to_files)) {
			mkdir($this->path_to_files, 0755, true);
			$this->__log(__METHOD__ . ' creating  ' . $this->path_to_files . ' folder through mkdir()');
		}
	}

	/**
	 * @param array $settings
	 * @return LocalUploadHandler
	 */
	public function initUploader($settings = array())
	{
		$data = array(
			'images_only' => $this->config['upload']['imagesOnly'] || (isset($this->refParams['type']) && strtolower($this->refParams['type'])=='images'),
		) + $settings;

		if(isset($data['upload_dir'])) {
			$data['thumbnails_dir'] = rtrim($this->get_thumbnail_path($data['upload_dir']), '/');
		}

		return new LocalUploadHandler(array(
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
					array_push($files_list, $file);
				}
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

					if(!isset($this->refParams['type']) || (isset($this->refParams['type']) && strtolower($this->refParams['type']) === 'images' && in_array(strtolower($item['filetype']), array_map('strtolower', $this->config['images']['imagesExt'])))) {
						if($this->config['upload']['imagesOnly']== false || ($this->config['upload']['imagesOnly'] === true && in_array(strtolower($item['filetype']), array_map('strtolower', $this->config['images']['imagesExt'])))) {
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
		$current_path = $this->getFullPath($path, true);
		$filename = basename($current_path);

		// check if file is readable
		if(!$this->has_system_permission($current_path, array('r'))) {
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

		// check if file is writable
		if(!$this->has_system_permission($current_path, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		if(!$this->has_permission('upload')) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		$this->initUploader(array(
			'upload_dir' => $current_path,
		))->post(true);

		// end application to prevent double response (uploader and filemanager)
		exit();
	}

	/**
	 * @inheritdoc
	 */
	public function addfolder()
	{
		$current_path = $this->getFullPath($this->get['path'], true);

		$new_dir = $this->normalizeString($this->get['name']);
		$new_path = $current_path . $new_dir;

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
			'Code' => 0
		);
		$this->__log(__METHOD__ . ' - adding folder ' . $new_dir);

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
			// for image only - rename thumbnail if original image was successfully renamed
			if(!is_dir($new_file)) {
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
			'Old Path' => $this->get['old'] . $suffix,
			'Old Name' => $filename,
			'New Path' => $newPath . '/' . $newName . $suffix,
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
		$suffix = (substr($this->get['old'], -1, 1) == '/') ? '/' : '';

		// old path
		$tmp = explode('/', trim($this->get['old'], '/'));
		$filename = array_pop($tmp); // file name or new dir name

		$oldPath = $this->getFullPath($this->get['old'], true);
		$newPath = $this->getFullPath($newPath, true);
		$newFullPath = $newPath . $filename . $suffix;
		$isDirOldPath = is_dir($oldPath);

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

		// should be retrieved before rename operation
		$old_thumbnail = $this->get_thumbnail_path($oldPath);

		// move file or folder
		if(!rename($oldPath, $newFullPath)) {
			if($isDirOldPath) {
				$this->error(sprintf($this->lang('ERROR_RENAMING_DIRECTORY'), $filename, $this->get['new']));
			} else {
				$this->error(sprintf($this->lang('ERROR_RENAMING_FILE'), $filename, $this->get['new']));
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
			'Old Path' => $this->getRelativePath($oldPath),
			'Old Name' => $isDirOldPath ? '' : $filename,
			'New Path' => $this->getRelativePath($newPath),
			'New Name' => $filename,
			'Type' => $isDirOldPath ? 'dir' : 'file',
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

		// check if file is writable
		if(!$this->has_system_permission($old_path, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		$result = $this->initUploader(array(
			'upload_dir' => $upload_dir,
		))->post(true);

		// success upload
		if(!property_exists($result['files'][0], 'error')) {
			$new_path = $upload_dir . $result['files'][0]->name;
			rename($new_path, $old_path);

			$new_thumbnail = $this->get_thumbnail_path($new_path);
			$old_thumbnail = $this->get_thumbnail_path($old_path);
			if(file_exists($new_thumbnail)) {
				rename($new_thumbnail, $old_thumbnail);
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
			'Content' => $content,
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
			'Path' => $this->post['path'],
		);

		return $array;
	}

	/**
	 * @inheritdoc
	 * Local connector is able to reach all files directly, so no need to implement readfile() method
	 * @see BaseFilemanager::readfile() to get purpose description
	 */
	public function readfile() {}

	/**
	 * @inheritdoc
	 */
	public function getimage($thumbnail)
	{
		$current_path = $this->getFullPath($this->get['path'], true);

		// if $thumbnail is set to true we return the thumbnail
		if($thumbnail === true && $this->config['images']['thumbnail']['enabled'] === true) {
			// get thumbnail (and create it if needed)
			$returned_path = $this->get_thumbnail($current_path);
		} else {
			$returned_path = $current_path;
		}

		header("Content-type: image/octet-stream");
		header("Content-Transfer-Encoding: binary");
		header("Content-length: " . $this->get_real_filesize($returned_path));
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
				$this->unlinkRecursive($thumbnail_path);
			}
		} else {
			$this->__log(__METHOD__ . ' - deleting file '. $current_path);
			unlink($current_path);

			// delete thumbnails if exists
			if(file_exists($thumbnail_path)) {
				unlink($thumbnail_path);
			}
		}

		return array(
			'Error' => "",
			'Code' => 0,
			'Path' => $this->get['path'],
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

		// check if file is writable
		if(!$this->has_system_permission($current_path, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		// we check if extension is allowed regarding the security Policy settings
		if(is_file($current_path)) {
			if(!$this->is_allowed_file_type($filename)) {
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
				'Path' => $this->get['path'],
			);
			return $array;
		}

		header('Content-Description: File Transfer');
		header('Content-Type: ' . mime_content_type($filename));
		header('Content-Disposition: attachment; filename=' . $filename);
		header('Content-Transfer-Encoding: binary');
		header('Content-Length: ' . $this->get_real_filesize($current_path));
		// handle caching
		header('Pragma: public');
		header('Expires: 0');
		header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

		$this->__log(__METHOD__ . ' - downloading '. $current_path);
		readfile($current_path);
		$this->__log(__METHOD__ . ' - downloaded '. $current_path);
		exit();
	}

	/**
	 * @inheritdoc
	 */
	public function summarize()
	{
		$result = array(
			'size' => 0,
			'files' => 0,
			'folders' => 0,
		);

		$path = rtrim($this->path_to_files, '/') . '/';
		$this->getDirSummary($path, $result);

		return $result;
	}

	/**
	 * Creates a zip file from source to destination
	 * @param  	string $source Source path for zip
	 * @param  	string $destination Destination path for zip
	 * @param  	string|boolean $flag OPTIONAL If true includes the folder also
	 * @return 	boolean
	 * @link	http://stackoverflow.com/questions/17584869/zip-main-folder-with-sub-folder-inside
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

			$files = new RecursiveIteratorIterator(
				new RecursiveDirectoryIterator($source),
				RecursiveIteratorIterator::SELF_FIRST
			);
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
		if($this->config['edit']['enabled']) {
			array_push($this->allowed_actions, 'edit');
		}
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
		$iconsFolder = $this->getFmUrl($this->config['icons']['path']);

		// check if file is writable and readable
		$protected = $this->has_system_permission($current_path, array('w', 'r')) ? 0 : 1;

		if(is_dir($current_path)) {
			$fileType = self::FILE_TYPE_DIR;
			$thumbPath = $iconsFolder . ($protected ? 'locked_' : '') . $this->config['icons']['directory'];
		} else {
			$fileType = $pathInfo['extension'];
			if($protected == 1) {
				$thumbPath = $iconsFolder . 'locked_' . $this->config['icons']['default'];
			} else {
				$thumbPath = $iconsFolder . $this->config['icons']['default'];
				$item['Properties']['Size'] = $this->get_real_filesize($current_path);

				if($this->config['options']['showThumbs'] && in_array(strtolower($fileType), array_map('strtolower', $this->config['images']['imagesExt']))) {
					// svg should not be previewed as raster formats images
					if($fileType === 'svg') {
						$thumbPath = $relative_path;
					} else {
						$thumbPath = $this->connector_script_url . '?mode=getimage&path=' . rawurlencode($relative_path) . '&time=' . time();
						if($thumbnail) $thumbPath .= '&thumbnail=true';
					}

					if($item['Properties']['Size']) {
						list($width, $height, $type, $attr) = getimagesize($current_path);
					} else {
						list($width, $height) = array(0, 0);
					}

					$item['Properties']['Height'] = $height;
					$item['Properties']['Width'] = $width;
				} else if(file_exists($this->fm_path . '/' . $this->config['icons']['path'] . strtolower($fileType) . '.png')) {
					$thumbPath = $iconsFolder . strtolower($fileType) . '.png';
				}
			}
		}

		$item['Path'] = $relative_path;
		$item['Filename'] = $pathInfo['basename'];
		$item['File Type'] = $fileType;
		$item['Protected'] = $protected;
		$item['Thumbnail'] = $thumbPath;
		// for preview mode only
		if($thumbnail === false) {
			$item['Preview'] = $this->getDynamicPath($current_path);
		}

		$item['Properties']['Date Modified'] = $this->formatDate($filemtime);
		//$item['Properties']['Date Created'] = $this->formatDate(filectime($current_path)); // PHP cannot get create timestamp
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
		$full_path = $this->cleanPath($this->path_to_files . '/' . $path);

		if($verify === true) {
			if(!file_exists($full_path) || !$this->is_valid_path($full_path)) {
				$langKey = is_dir($full_path) ? 'DIRECTORY_NOT_EXIST' : 'FILE_DOES_NOT_EXIST';
				$this->error(sprintf($this->lang($langKey), $path));
			}
		}
		return $full_path;
	}

	/**
	 * Returns path without document root but including "dynamic_fileroot"
	 * @param string $fullPath
	 * @return mixed
	 */
	protected function getDynamicPath($fullPath)
	{
		if(empty($this->dynamic_fileroot)) {
			return $fullPath;
		}
		$pos = strrpos($fullPath, $this->dynamic_fileroot);
		$dPath = '/' . substr($fullPath, $pos);
		return $this->cleanPath($dPath);
	}

	/**
	 * Returns path without document root
	 * @param string $fullPath
     * @return mixed
	 */
    protected function getRelativePath($fullPath)
    {
		if(empty($this->dynamic_fileroot)) {
			return $fullPath;
		}
		$pos = strrpos($fullPath, $this->dynamic_fileroot);
		$rPath = '/' . substr($fullPath, $pos + strlen($this->dynamic_fileroot));
		return $this->cleanPath($rPath);
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
	 * Clean path string to remove multiple slashes, etc.
	 * @param string $string
	 * @return $string
	 */
	public function cleanPath($string)
	{
		// remove multiple slashes
		return preg_replace('#/+#', '/', $string);
		//str_replace("//", "/", $string);
	}

	/**
	 * Clean string to retrieve correct file/folder name.
	 * @param string $string
	 * @param array $allowed
	 * @return array|mixed
	 */
	public function normalizeString($string, $allowed = array())
	{
		$allow = '';
		if(!empty($allowed)) {
			foreach ($allowed as $value) {
				$allow .= "\\$value";
			}
		}

		if($this->config['security']['normalizeFilename'] === true) {
			// Remove path information and dots around the filename, to prevent uploading
			// into different directories or replacing hidden system files.
			// Also remove control characters and spaces (\x00..\x20) around the filename:
			$string = trim(basename(stripslashes($string)), ".\x00..\x20");

			// Replace chars which are not related to any language
			$replacements = array(' '=>'_', '\''=>'_', '/'=>'', '\\'=>'');
			$string = strtr($string, $replacements);
		}

		if($this->config['options']['charsLatinOnly'] === true) {
			// transliterate if extension is loaded
			if(extension_loaded('intl') === true) {
				$options = 'Any-Latin; Latin-ASCII; NFD; [:Nonspacing Mark:] Remove; NFC;';
				$string = transliterator_transliterate($options, $string);
			}
			// clean up all non-latin chars
			$string = preg_replace("/[^{$allow}_a-zA-Z0-9]/u", '', $string);
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
     * Load using "langCode" var passed into URL if present and if exists
     * Otherwise use default configuration var.
     */
	protected function loadLanguageFile()
    {
		$lang = $this->config['options']['culture'];
		if(isset($this->refParams['langCode']) && in_array($this->refParams['langCode'], $this->languages)) {
			$lang = $this->refParams['langCode'];
		}

		if(file_exists($this->fm_path . '/scripts/languages/'.$lang.'.json')) {
			$stream =file_get_contents($this->fm_path . '/scripts/languages/'.$lang.'.json');
			$this->language = json_decode($stream, true);
		} else {
			$l = substr($lang,0,2); // we try with 2 chars language file
			if(file_exists($this->fm_path. '/scripts/languages/'.$l.'.json')) {
				$stream = file_get_contents($this->fm_path . '/scripts/languages/'.$l.'.json');
				$this->language = json_decode($stream, true);
			} else {
				// we include default language file
				$stream = file_get_contents($this->fm_path . '/scripts/languages/'.$this->config['options']['culture'].'.json');
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
					$dir = $this->normalizeString($dir);
				}
				array_push($fullPath, $dir);
			}
		}
		return implode('/', $fullPath);
	}

	/**
	 * Creates URL to asset based on it relative path
	 * @param $path
	 * @return string
	 */
	protected function getFmUrl($path)
	{
		if(isset($this->config['fmUrl']) && !empty($this->config['fmUrl']) && strpos($path, '/') !== 0) {
			$url = $this->config['fmUrl'] . '/' . $path;
			return $this->cleanPath($url);
		}
		return $path;
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
	 * @param $dir $path
	 * @param array $result
	 * @return int
	 */
	public function getDirSummary($dir, &$result = array('files'=>0, 'size'=>0, 'folders'=>0))
	{
		// suppress permission denied and other errors
		$files = @scandir($dir);
		if($files === false) {
			return $result;
		}

		foreach($files as $value) {
			if($value == "." || $value == "..") {
				continue;
			}
			$path = $dir . $value;
			$subPath = substr($path, strlen($dir));

			if (is_dir($path)) {
				if (!in_array($subPath, $this->config['exclude']['unallowed_dirs']) &&
					!preg_match($this->config['exclude']['unallowed_dirs_REGEXP'], $subPath)) {
					$result['folders']++;
					$this->getDirSummary($path . '/', $result);
				}
			} else if (
				!in_array($subPath, $this->config['exclude']['unallowed_files']) &&
				!preg_match($this->config['exclude']['unallowed_files_REGEXP'], $subPath)) {
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
			$this->__log(__METHOD__ . ' - generating thumbnail :  '. $thumbnail_fullpath);
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
		if($this->config['images']['thumbnail']['enabled'] === true) {
			$this->__log(__METHOD__ . ' - generating thumbnail:  '. $thumbnailPath);

			// create folder if it does not exist
			if(!file_exists(dirname($thumbnailPath))) {
				mkdir(dirname($thumbnailPath), 0755, true);
			}

			$this->initUploader(array(
				'upload_dir' => dirname($imagePath) . '/',
			))->create_thumbnail_image($imagePath);
		}
	}

}