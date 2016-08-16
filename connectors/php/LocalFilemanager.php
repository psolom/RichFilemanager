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
	protected $doc_root;
	protected $path_to_files;
	protected $dynamic_fileroot = 'userfiles';

	public function __construct($config = array())
    {
		parent::__construct($config);

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

		Log::info('$this->fm_path: "' . $this->fm_path . '"');
		Log::info('$this->path_to_files: "' . $this->path_to_files . '"');
		Log::info('$this->doc_root: "' . $this->doc_root . '"');
		Log::info('$this->dynamic_fileroot: "' . $this->dynamic_fileroot . '"');

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

		Log::info('opening folder "' . $current_path . '"');

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
						$array[$file_path . '/'] = $this->get_file_info($file_path . '/');
					}
				} else if (!in_array($file, $this->config['exclude']['unallowed_files']) && !preg_match($this->config['exclude']['unallowed_files_REGEXP'], $file)) {
					$item = $this->get_file_info($file_path);

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
		$current_path = $this->getFullPath($path, true);
		$filename = basename($current_path);

		Log::info('opening file "' . $current_path . '"');

		// check if file is readable
		if(!$this->has_system_permission($current_path, array('r'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		// check if file is allowed regarding the security Policy settings
		if(in_array($filename, $this->config['exclude']['unallowed_files']) || preg_match($this->config['exclude']['unallowed_files_REGEXP'], $filename)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		return $this->get_file_info($path);
	}

	/**
	 * @inheritdoc
	 */
	public function add()
	{
		$current_path = $this->getFullPath($this->post['currentpath'], true);

		Log::info('uploading to "' . $current_path . '"');

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

		Log::info('adding folder "' . $new_path . '"');

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

		Log::info('renaming "' . $old_file . '" to "' . $new_file . '"');

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

		$array = array(
			'Old Path' => $this->get['old'] . $suffix,
			'Old Name' => $filename,
			'New Path' => $newPath . '/' . $newName . $suffix,
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

		$oldPath = $this->getFullPath($this->get['old'], true);
		$newPath = $this->getFullPath($newPath, true);
		$newFullPath = $newPath . $filename . $suffix;
		$isDirOldPath = is_dir($oldPath);

		Log::info('moving "' . $oldPath . '" to "' . $newFullPath . '"');

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
			Log::info('moved "' . $oldPath . '" to "' . $newFullPath . '"');

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
			'Old Path' => $this->getRelativePath($oldPath),
			'Old Name' => $isDirOldPath ? '' : $filename,
			'New Path' => $this->getRelativePath($newPath),
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

		Log::info('replacing "' . $old_path . '"');

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
			Log::info('replacing "' . $old_path . '" with "' . $new_path . '"');

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

		Log::info('opening "' . $current_path . '"');

		// check if file is writable
		if(!$this->has_system_permission($current_path, array('w'))) {
			$this->error(sprintf($this->lang('NOT_ALLOWED_SYSTEM')));
		}

		if(!$this->has_permission('edit') || !$this->is_editable($current_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

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

		Log::info('saving "' . $current_path . '"');

		if(!$this->has_permission('edit') || !$this->is_editable($current_path)) {
			$this->error(sprintf($this->lang('NOT_ALLOWED')));
		}

		if(!$this->has_system_permission($current_path, array('w'))) {
			$this->error(sprintf($this->lang('ERROR_WRITING_PERM')));
		}

		$content =  htmlspecialchars_decode($this->post['content']);
		$r = file_put_contents($current_path, $content, LOCK_EX);

		if(!is_numeric($r)) {
			$this->error(sprintf($this->lang('ERROR_SAVING_FILE')));
		}

		Log::info('saved "' . $current_path . '"');

		$array = array(
			'Error' => "",
			'Code' => 0,
			'Path' => $this->post['path'],
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

		header('Content-Type: ' . mime_content_type($current_path));
		header("Content-Transfer-Encoding: binary");
		header("Content-Length: " . $length);
		header('Content-Disposition: inline; filename="' . basename($current_path) . '"');

		$fp = fopen($current_path, 'r');
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
	public function getimage($thumbnail)
	{
		$current_path = $this->getFullPath($this->get['path'], true);

		Log::info('loading image "' . $current_path . '"');

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

		Log::info('deleting "' . $current_path . '"');

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
			$this->unlinkRecursive($current_path);
			Log::info('deleted "' . $current_path . '"');

			// delete thumbnails if exists
			if(file_exists($thumbnail_path)) {
				$this->unlinkRecursive($thumbnail_path);
			}
		} else {
			unlink($current_path);
			Log::info('deleted "' . $current_path . '"');

			// delete thumbnails if exists
			if(file_exists($thumbnail_path)) {
				unlink($thumbnail_path);
			}
		}

		return array(
			'Path' => $this->get['path'],
			'Error' => "",
			'Code' => 0,
		);
	}

	/**
	 * @inheritdoc
	 */
	public function download($force)
    {
		$current_path = $this->getFullPath($this->get['path'], true);
		$filename = basename($current_path);

		Log::info('file downloading "' . $current_path . '"');

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

			$destination_path = sys_get_temp_dir().'/fm_'.uniqid().'.zip';

			// if Zip archive is created
			if($this->zipFile($current_path, $destination_path, true)) {
				$current_path = $destination_path;
			} else {
				$this->error($this->lang('ERROR_CREATING_ZIP'));
			}
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
		header('Content-Type: ' . mime_content_type($current_path));
		header('Content-Disposition: attachment; filename=' . basename($current_path));
		header('Content-Transfer-Encoding: binary');
		header('Content-Length: ' . $this->get_real_filesize($current_path));
		// handle caching
		header('Pragma: public');
		header('Expires: 0');
		header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

		readfile($current_path);
		Log::info('file downloaded "' . $current_path . '"');
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
			'Folders' => 0,
			'Error' => "",
			'Code' => 0,
		);

		$path = rtrim($this->path_to_files, '/') . '/';
		try {
			$this->getDirSummary($path, $result);
		} catch (Exception $e) {
			$this->error(sprintf($this->lang('ERROR_SERVER')));
		}

		return $result;
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
					$zip->addFromString($folder . $path, file_get_contents($file));
				}
			}
		} else if (is_file($source) === true) {
			$zip->addFromString($folder . basename($source), file_get_contents($source));
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
			if(!is_readable($filepath)) {
				Log::info('Not readable path "' . $filepath . '"');
				return false;
			};
		}
		if(in_array('w', $permissions)) {
			if(!is_writable($filepath)) {
				Log::info('Not writable path "' . $filepath . '"');
				return false;
			}
		}
		return true;
	}

	/**
	 * Create array with file properties
	 * @param string $relative_path
	 * @return array
	 */
	protected function get_file_info($relative_path)
    {
		$current_path = $this->getFullPath($relative_path);

		$item = $this->defaultInfo;
		$pathInfo = pathinfo($current_path);
		$filemtime = filemtime($current_path);

		// check if file is writable and readable
		$protected = $this->has_system_permission($current_path, array('w', 'r')) ? 0 : 1;

		if(is_dir($current_path)) {
			$fileType = self::FILE_TYPE_DIR;
		} else {
			$fileType = $pathInfo['extension'];
			$item['Properties']['Size'] = $this->get_real_filesize($current_path);

			if(in_array(strtolower($fileType), array_map('strtolower', $this->config['images']['imagesExt']))) {
				if($item['Properties']['Size']) {
					list($width, $height, $type, $attr) = getimagesize($current_path);
				} else {
					list($width, $height) = array(0, 0);
				}

				$item['Properties']['Height'] = $height;
				$item['Properties']['Width'] = $width;
			}
		}

		$item['Path'] = $relative_path;
		$item['Filename'] = $pathInfo['basename'];
		$item['File Type'] = $fileType;
		$item['Protected'] = $protected;
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
			if(extension_loaded('intl') === true && function_exists('transliterator_transliterate')) {
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
	public function getDirSummary($dir, &$result = array('Size'=>0, 'Files'=>0, 'Folders'=>0))
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
					$result['Folders']++;
					$this->getDirSummary($path . '/', $result);
				}
			} else if (
				!in_array($subPath, $this->config['exclude']['unallowed_files']) &&
				!preg_match($this->config['exclude']['unallowed_files_REGEXP'], $subPath)) {
				$result['Files']++;
				$result['Size'] += filesize($path);
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
		return $result['Size'];
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
		if($this->config['images']['thumbnail']['enabled'] === true) {
			Log::info('generating thumbnail "' . $thumbnailPath . '"');

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