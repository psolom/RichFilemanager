<?php
require_once('application/facade/Log.php');

/**
 *	BaseFilemanager PHP class
 *
 *	Base abstract class created to define base methods
 *
 *	@license	MIT License
 *	@author		Riaan Los <mail (at) riaanlos (dot) nl>
 *	@author		Simon Georget <simon (at) linea21 (dot) com>
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

abstract class BaseFilemanager
{
    const TYPE_FILE = 'file';
    const TYPE_FOLDER = 'folder';

    public $config = [];
    protected $refParams = [];
    protected $language = [];
    protected $get = [];
    protected $post = [];
    protected $fm_path = '';
    protected $allowed_actions = [];

    /**
     * File item model template
     * @var array
     */
    protected $file_model = [
        "id"    => '',
        "type"  => self::TYPE_FILE,
        "attributes" => [
            'name'      => '',
            'extension' => '',
            'path'      => '',
            'readable'  => 1,
            'writable'  => 1,
            'created'   => '',
            'modified'  => '',
            'timestamp' => '',
            'height'    => 0,
            'width'     => 0,
            'size'      => 0,
        ]
    ];

    /**
     * Folder item model template
     * @var array
     */
    protected $folder_model = [
        "id"    => '',
        "type"  => self::TYPE_FOLDER,
        "attributes" => [
            'name'      => '',
            'path'      => '',
            'readable'  => 1,
            'writable'  => 1,
            'created'   => '',
            'modified'  => '',
            'timestamp' => '',
        ]
    ];

    /**
     * List of all possible actions
     * @var array
     */
    protected $actions_list = ["select", "upload", "download", "rename", "copy", "move", "replace", "delete", "edit"];

    /**
     * BaseFilemanager constructor.
     * @param array $config
     */
    public function __construct($config = [])
    {
        // fix display non-latin chars correctly
        // https://github.com/servocoder/RichFilemanager/issues/7
        setlocale(LC_CTYPE, 'en_US.UTF-8');

        // fix for undefined timezone in php.ini
        // https://github.com/servocoder/RichFilemanager/issues/43
        if(!ini_get('date.timezone')) {
            date_default_timezone_set('GMT');
        }

        $this->config = $config;
        $this->fm_path = $this->config['fmPath'] ? $this->config['fmPath'] : dirname(dirname(dirname($_SERVER['SCRIPT_FILENAME'])));

        $this->allowed_actions = $this->actions_list;
        if($this->config['options']['capabilities']) {
            $this->setAllowedActions($this->config['options']['capabilities']);
        }

        $this->setParams();
        $this->loadLanguageFile();
    }

    /**
     * Return server-side data to override on the client-side - filemanager action
     * @return array
     */
    abstract function actionInitiate();

    /**
     * Return file data - filemanager action
     * @return array
     */
    abstract function actionGetFile();

    /**
     * Open specified folder - filemanager action
     * @return array
     */
    abstract function actionGetFolder();

    /**
     * Open and edit file - filemanager action
     * @return array
     */
    abstract function actionEditFile();

    /**
     * Save data to file after editing - filemanager action
     */
    abstract function actionSaveFile();

    /**
     * Rename file or folder - filemanager action
     */
    abstract function actionRename();

    /**
     * Copy file or folder - filemanager action
     */
    abstract function actionCopy();

    /**
     * Move file or folder - filemanager action
     */
    abstract function actionMove();

    /**
     * Delete existed file or folder - filemanager action
     */
    abstract function actionDelete();

    /**
     * Replace existed file - filemanager action
     */
    abstract function actionReplace();

    /**
     * Upload new file - filemanager action
     */
    abstract function actionUpload();

    /**
     * Create new folder - filemanager action
     * @return array
     */
    abstract function actionAddFolder();

    /**
     * Download file - filemanager action
     */
    abstract function actionDownload();

    /**
     * Returns image file - filemanager action
     * @param bool $thumbnail Whether to generate image thumbnail
     */
    abstract function actionGetImage($thumbnail);

    /**
     * Read and output file contents data - filemanager action
     */
    abstract function actionReadFile();

    /**
     * Retrieves storage summarize info - filemanager action
     * @return array
     */
    abstract function actionSummarize();

    /**
     * Set userfiles root folder
     * @param string $path
     * @param bool $mkdir
     */
    abstract function setFileRoot($path, $mkdir);

    /**
     * Overrides list of allowed actions
     * @param array $actions
     */
    public function setAllowedActions($actions) {
        $diff = array_diff($actions, $this->actions_list);
        if($diff) {
            $this->error('The following actions are not exists: "' . implode('", "', $diff) . '"');
        }
        $this->allowed_actions = $actions;
    }

    /**
     * Invokes filemanager action based on request params and returns response
     */
    public function handleRequest()
    {
        $response = '';

        if(!isset($_GET)) {
            $this->error($this->lang('INVALID_ACTION'));
        } else {

            if(isset($_GET['mode']) && $_GET['mode']!='') {

                switch($_GET['mode']) {

                    default:
                        $this->error($this->lang('MODE_ERROR'));
                        break;

                    case 'initiate':
                        $response = $this->actionInitiate();
                        break;

                    case 'getfile':
                        if($this->getvar('path')) {
                            $response = $this->actionGetFile();
                        }
                        break;

                    case 'getfolder':
                        if($this->getvar('path')) {
                            $response = $this->actionGetFolder();
                        }
                        break;

                    case 'rename':
                        if($this->getvar('old') && $this->getvar('new')) {
                            $response = $this->actionRename();
                        }
                        break;

                    case 'copy':
                        if($this->getvar('source') && $this->getvar('target')) {
                            $response = $this->actionCopy();
                        }
                        break;

                    case 'move':
                        if($this->getvar('old') && $this->getvar('new')) {
                            $response = $this->actionMove();
                        }
                        break;

                    case 'editfile':
                        if($this->getvar('path')) {
                            $response = $this->actionEditFile();
                        }
                        break;

                    case 'delete':
                        if($this->getvar('path')) {
                            $response = $this->actionDelete();
                        }
                        break;

                    case 'addfolder':
                        if($this->getvar('path') && $this->getvar('name')) {
                            $response = $this->actionAddFolder();
                        }
                        break;

                    case 'download':
                        if($this->getvar('path')) {
                            $response = $this->actionDownload();
                        }
                        break;

                    case 'getimage':
                        if($this->getvar('path')) {
                            $thumbnail = isset($_GET['thumbnail']);
                            $this->actionGetImage($thumbnail);
                        }
                        break;

                    case 'readfile':
                        if($this->getvar('path')) {
                            $this->actionReadFile();
                        }
                        break;

                    case 'summarize':
                        $response = $this->actionSummarize();
                        break;
                }

            } else if(isset($_POST['mode']) && $_POST['mode']!='') {

                switch($_POST['mode']) {

                    default:
                        $this->error($this->lang('MODE_ERROR'));
                        break;

                    case 'upload':
                        if($this->postvar('path')) {
                            $response = $this->actionUpload();
                        }
                        break;

                    case 'replace':
                        if($this->postvar('path')) {
                            $response = $this->actionReplace();
                        }
                        break;

                    case 'savefile':
                        if($this->postvar('path') && $this->postvar('content', false)) {
                            $response = $this->actionSaveFile();
                        }
                        break;
                }
            }
        }

        echo json_encode([
            'data' => $response,
        ]);
        exit;
    }

    protected function setParams()
    {
        $tmp = isset($_SERVER['HTTP_REFERER']) ? $_SERVER['HTTP_REFERER'] : '/';
        $tmp = explode('?',$tmp);
        $params = [];
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

    /**
     * Load language file and retrieve all messages.
     * Defines language code based on "langCode" variable if exists otherwise uses configuration option.
     */
    protected function loadLanguageFile()
    {
        $lang = $this->config['options']['culture'];
        if(isset($this->refParams['langCode'])) {
            $lang = $this->refParams['langCode'];
        }

        $lang_path = dirname(dirname(dirname(__FILE__))) . "/languages/{$lang}.json";

        if (file_exists($lang_path)) {
            $stream = file_get_contents($lang_path);
            $this->language = json_decode($stream, true);
        }
    }

    /**
     * Checking if permission is set or not for a given action
     * @param string $action
     * @return boolean
     */
    protected function hasPermission($action)
    {
        return in_array($action, $this->allowed_actions);
    }

    /**
     * Echo error message and terminate the application
     * @param string $title
     */
    public function error($title)
    {
        Log::info('error message: "' . $title . '"');

        if($this->isAjaxRequest()) {
            $error_object = [
                'id' => 'server',
                'code' => '500',
                'title' => $title
            ];

            echo json_encode([
                'errors' => [$error_object],
            ]);
        } else {
            echo "<h2>Server error: {$title}</h2>";
        }

        exit;
    }

    /**
     * Setup language by code
     * @param $string
     * @return string
     */
    public function lang($string)
    {
        if(!empty($this->language[$string])) {
            return $this->language[$string];
        } else {
            return 'Language string error on ' . $string;
        }
    }

    /**
     * Retrieve data from $_GET global var
     * @param string $var
     * @param bool $sanitize
     * @return bool
     */
    public function getvar($var, $sanitize = true)
    {
        if(!isset($_GET[$var]) || $_GET[$var]=='') {
            $this->error(sprintf($this->lang('INVALID_VAR'),$var));
        } else {
            if($sanitize) {
                $this->get[$var] = $this->sanitize($_GET[$var]);
            } else {
                $this->get[$var] = $_GET[$var];
            }
            return true;
        }
    }

    /**
     * Retrieve data from $_POST global var
     * @param string $var
     * @param bool $sanitize
     * @return bool
     */
    public function postvar($var, $sanitize = true)
    {
        if(!isset($_POST[$var]) || ($var != 'content' && $_POST[$var]=='')) {
            $this->error(sprintf($this->lang('INVALID_VAR'),$var));
        } else {
            if($sanitize) {
                $this->post[$var] = $this->sanitize($_POST[$var]);
            } else {
                $this->post[$var] = $_POST[$var];
            }
            return true;
        }
    }

    /**
     * Retrieve data from $_SERVER global var
     * @param string $var
     * @param string|null $default
     * @return bool
     */
    public function get_server_var($var, $default = null)
    {
        return !isset($_SERVER[$var]) ? $default : $_SERVER[$var];
    }

    /**
     * Returns whether this is an AJAX (XMLHttpRequest) request.
     * Note that jQuery doesn't set the header in case of cross domain
     * requests: https://stackoverflow.com/questions/8163703/cross-domain-ajax-doesnt-send-x-requested-with-header
     * @return boolean whether this is an AJAX (XMLHttpRequest) request.
     */
    public function isAjaxRequest()
    {
        return isset($_SERVER['HTTP_X_REQUESTED_WITH']) && $_SERVER['HTTP_X_REQUESTED_WITH'] === 'XMLHttpRequest';
    }

    /**
     * Sanitize global vars: $_GET, $_POST
     * @param string $var
     * @return mixed|string
     */
    protected function sanitize($var)
    {
        $sanitized = strip_tags($var);
        $sanitized = str_replace('http://', '', $sanitized);
        $sanitized = str_replace('https://', '', $sanitized);
        $sanitized = str_replace('../', '', $sanitized);

        return $sanitized;
    }

    /**
     * Clean string to retrieve correct file/folder name.
     * @param string $string
     * @param array $allowed
     * @return array|mixed
     */
    public function normalizeString($string, $allowed = [])
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
            $replacements = [' '=>'_', '\''=>'_', '/'=>'', '\\'=>''];
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
     * Defines real size of file
     * Based on https://github.com/jkuchar/BigFileTools project by Jan Kuchar
     * @param string $path
     * @return int|string
     * @throws Exception
     */
    public static function get_real_filesize($path)
    {
        // This should work for large files on 64bit platforms and for small files everywhere
        $fp = fopen($path, "rb");
        if (!$fp) {
            throw new Exception("Cannot open specified file for reading.");
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

    /**
     * Check if file is allowed to upload regarding the configuration settings
     * @param string $file
     * @return bool
     */
    public function is_allowed_file_type($file)
    {
        $path_parts = pathinfo($file);

        // if there is no extension
        if (!isset($path_parts['extension'])) {
            // we check if no extension file are allowed
            return (bool)$this->config['security']['allowNoExtension'];
        }

        $extensions = array_map('strtolower', $this->config['upload']['restrictions']);

        if($this->config['upload']['policy'] == 'DISALLOW_ALL') {
            if(!in_array(strtolower($path_parts['extension']), $extensions)) {
                return false;
            }
        }
        if($this->config['upload']['policy'] == 'ALLOW_ALL') {
            if(in_array(strtolower($path_parts['extension']), $extensions)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check if file or folder name is not in "excluded" list
     * @param string $name
     * @param bool $is_dir
     * @return bool
     */
    public function is_allowed_name($name, $is_dir = false)
    {
        $name = basename($name);

        // check if folder name is allowed regarding the security Policy settings
        if ($is_dir && (
            in_array($name, $this->config['security']['excluded_dirs']) ||
            preg_match($this->config['security']['excluded_dirs_REGEXP'], $name))
        ) {
            return false;
        }

        // check if file name is allowed regarding the security Policy settings
        if (!$is_dir && (
            in_array($name, $this->config['security']['excluded_files']) ||
            preg_match($this->config['security']['excluded_files_REGEXP'], $name))
        ) {
            return false;
        }

        return true;
    }

    /**
     * Remove excluded and filtered items from output
     * @param array $item
     * @return bool
     */
    public function filter_output($item)
    {
        // filter out item if the name is not in "excluded" list
        if(!$this->is_allowed_name($item["attributes"]["name"], $item["type"] === self::TYPE_FOLDER)) {
            return false;
        }

        // filter out item if any filter is specified and item is matched
        $filter_name = isset($this->refParams['type']) ? $this->refParams['type'] : null;
        $allowed_types = isset($this->config['outputFilter'][$filter_name]) ? $this->config['outputFilter'][$filter_name] : null;
        if($filter_name && is_array($allowed_types) && $item["type"] === self::TYPE_FILE) {
            return (in_array(strtolower($item["attributes"]["extension"]), $allowed_types));
        }

        return true;
    }

    /**
     * Check whether file is image by its mime type
     * For S3 plugin it may cost extra request for each file
     * @param $file
     * @return bool
     */
    public function is_image_file($file)
    {
        $mime = mime_content_type($file);
        $imagesMime = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/bmp",
            "image/svg+xml",
        ];
        return in_array($mime, $imagesMime);
    }
}
