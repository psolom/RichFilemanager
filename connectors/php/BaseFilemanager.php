<?php
require_once('application/facade/Log.php');

/**
 *    BaseFilemanager PHP class
 *
 *    Base abstract class created to define base methods
 *
 *    @license    MIT License
 *    @author        Riaan Los <mail (at) riaanlos (dot) nl>
 *    @author        Simon Georget <simon (at) linea21 (dot) com>
 *    @author        Pavel Solomienko <https://github.com/servocoder/>
 *    @copyright    Authors
 */

abstract class BaseFilemanager
{
    const TYPE_FILE = 'file';
    const TYPE_FOLDER = 'folder';

    public $config = [];
    protected $refParams = [];
    protected $get = [];
    protected $post = [];
    protected $fm_path = '';

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

        $this->setParams();
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
     * Extracts files and folders from archive - filemanager action
     * @return array
     */
    abstract function actionExtract();

    /**
     * Set userfiles root folder
     * @param string $path
     * @param bool $mkdir
     */
    abstract function setFileRoot($path, $mkdir);

    /**
     * Invokes filemanager action based on request params and returns response
     */
    public function handleRequest()
    {
        $response = '';

        if(!isset($_GET)) {
            $this->error('INVALID_ACTION');
        } else {

            if(isset($_GET['mode']) && $_GET['mode']!='') {

                switch($_GET['mode']) {

                    default:
                        $this->error('MODE_ERROR');
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
                        $this->error('MODE_ERROR');
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

                    case 'extract':
                        if($this->postvar('source') && $this->postvar('target')) {
                            $response = $this->actionExtract();
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
     * Echo error message and terminate the application
     * @param string $label
     * @param array $arguments
     */
    public function error($label, $arguments = [])
    {
        $log_message = 'Error code: ' . $label;
        if ($arguments) {
            $log_message .= ', arguments: ' . json_encode($arguments);
        }
        Log::info($log_message);

        if($this->isAjaxRequest()) {
            $error_object = [
                'id' => 'server',
                'code' => '500',
                'message' => $label,
                'arguments' => $arguments
            ];

            echo json_encode([
                'errors' => [$error_object],
            ]);
        } else {
            echo "<h2>Server error: {$label}</h2>";
        }

        exit;
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
            $this->error('INVALID_VAR', [$var]);
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
            $this->error('INVALID_VAR', [$var]);
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
     * Check the global blacklists for this file path
     * @param string $filepath
     * @return bool
     */
    public function is_unrestricted($filepath) {
    
        // First, check the extension:
        $extension = pathinfo($filepath, PATHINFO_EXTENSION);
        $extension_restrictions = $this->config['security']['extensions']['restrictions'];
        
        if ($this->config['security']['extensions']['ignorecase']) {
            $extension = strtolower($extension);
            $extension_restrictions = array_map('strtolower', $extension_restrictions);
        }
        
        if($this->config['security']['extensions']['policy'] == 'ALLOW_LIST') {
            if(!in_array($extension, $extension_restrictions)) {
                // Not in the allowed list, so it's restricted.
                return false;
            }
        }
        else if($this->config['security']['extensions']['policy'] == 'DISALLOW_LIST') {
            if(in_array($extension, $extension_restrictions)) {
                // It's in the disallowed list, so it's restricted.
                return false;
            }
        }
        else {
            // Invalid config option for 'policy'. Deny everything for safety.
            return false;
        }
        
        // Next, check the filename against the glob patterns:
        $basename = pathinfo($filepath, PATHINFO_BASENAME);
        $basename_restrictions = $this->config['security']['patterns']['restrictions'];
        
        if ($this->config['security']['patterns']['ignorecase']) {
            $basename = strtolower($basename);
            $basename_restrictions = array_map('strtolower', $basename_restrictions);
        }
        
        // (check for a match before applying the restriction logic)
        $match_was_found = false;
        foreach ($basename_restrictions as $pattern) {
            if (fnmatch($pattern, $basename)) {
                $match_was_found = true;
                break;  // Done.
            }
        }

        if($this->config['security']['patterns']['policy'] == 'ALLOW_LIST') {
            if(!$match_was_found) {
                // The $basename did not match the allowed pattern list, so it's restricted:
                return false;
            }
        }
        else if($this->config['security']['patterns']['policy'] == 'DISALLOW_LIST') {
            if($match_was_found) {
                // The $basename matched the disallowed pattern list, so it's restricted:
                return false;
            }
        }
        else {
            // Invalid config option for 'policy'. Deny everything for safety.
            return false;
        }

        return true;  // Nothing restricted this $filepath, so it is allowed.
    }
    

    /**
     * Check that this file has read permission
     * @param string $filepath
     * @return void -- exits with error response if the permission is not allowed
     */
    public function check_read_permission($filepath)
    {   
        // Check system permission (O.S./filesystem/NAS)
        if ($this->has_system_read_permission($filepath) == false) { 
            return $this->error('NOT_ALLOWED_SYSTEM');
        }
        
        // Check the global blacklists:
        if ($this->is_unrestricted($filepath) == false) { 
            //return $this->error('FORBIDDEN_NAME', [$filepath]); // FIXME
            return $this->error($filepath);
        }

        // Check the user's Auth API callback:
        if (fm_has_read_permission($filepath) == false) {
            return $this->error('NOT_ALLOWED');
        }

        // Nothing is restricting access to this file or dir, so it is readable.
        return;  // Return without calling exit().
    }

    /**
     * Query if this file has read permission, without exiting if not
     * @param string $filepath
     * @return bool
     */
    public function has_read_permission($filepath)
    {   
        // Check system permission (O.S./filesystem/NAS)
        if ($this->has_system_read_permission($filepath) == false) { 
            return false;
        }
        
        // Check the global blacklists:
        if ($this->is_unrestricted($filepath) == false) { 
            return false;
        }

        // Check the user's Auth API callback:
        if (fm_has_read_permission($filepath) == false) {
            return false;
        }

        // Nothing is restricting access to this file or dir, so it is readable.
        return true;
    }

    /**
     * Check that this filepath can be written to.
     * If the filepath does not exist, this assumes we want to CREATE a new
     * dir entry at $filepath (a new file or new subdir), and thus it checks the
     * parent dir for write permissions.
     *
     * @param string $filepath
     * @return void -- exits with error response if the permission is not allowed
     */
    public function check_write_permission($filepath)
    {
        // Does the path already exist?
        if (!file_exists($filepath)) {
            // It does not exist (yet). Check to see if we could write to this
            // path, by seeing if we can write new entries into its parent dir.
            $parent_dir = pathinfo($filepath, PATHINFO_DIRNAME);
            return $this->check_write_permission($parent_dir);
        }
        
        //
        // The filepath (file or dir) does exist, so check its permissions:
        //
        
        // Check system permission (O.S./filesystem/NAS)
        if ($this->has_system_write_permission($filepath) == false) { 
            return $this->error('NOT_ALLOWED_SYSTEM');
        }
        
        // Check the global blacklists:
        if ($this->is_unrestricted($filepath) == false) { 
            return $this->error('FORBIDDEN_NAME', [$filepath]);
        }

        // Check the global read_only config flag:
        if ($this->config['security']['read_only'] != false) {
            return $this->error('NOT_ALLOWED');
        }

        // Check the user's Auth API callback:
        if (fm_has_write_permission($filepath) == false) {
            return $this->error('NOT_ALLOWED');
        }

        // Nothing is restricting access to this file, so it is writable:
        return;  // Return without calling exit().
    }

    /**
     * Query if this file has write permission, without exiting if not
     * @param string $filepath
     * @return bool
     */
    public function has_write_permission($filepath)
    {
        // Does the path already exist?
        if (!file_exists($filepath)) {
            // It does not exist (yet). Check to see if we could write to this
            // path, by seeing if we can write new entries into its parent dir.
            $parent_dir = pathinfo($filepath, PATHINFO_DIRNAME);
            return $this->has_write_permission($parent_dir);
        }

        //
        // The filepath (file or dir) does exist, so check its permissions:
        //

        // Check system permission (O.S./filesystem/NAS)
        if ($this->has_system_write_permission($filepath) == false) { 
            return false;
        }
        
        // Check the global blacklists:
        if ($this->is_unrestricted($filepath) == false) { 
            return false;
        }
        // Check the global read_only config flag:
        if ($this->config['security']['read_only'] != false) {
            return false;
        }

        // Check the user's Auth API callback:
        if (fm_has_write_permission($filepath) == false) {
            return false;
        }

        // Nothing is restricting access to this file, so it is writable:
        return true;  // Return true.
    }

    /**
     * Check if system permission is granted
     * @param string $filepath
     * @param array $permissions
     * @return bool
     */
    protected function has_system_read_permission($filepath)
    {
        return is_readable($filepath); 
    }

    /**
     * Check if this is running under PHP for Windows.
     * @return bool
     */
    public function php_os_is_windows() {
        return strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
    }

    protected function has_system_write_permission($filepath)
    {
        // In order to create an entry in a POSIX dir, it must have
        // both `-w-` write and `--x` execute permissions.
        //
        // NOTE: Windows PHP doesn't support standard POSIX permissions.
        if (is_dir($filepath) && !($this->php_os_is_windows())) {
            return (is_writable($filepath) && is_executable($filepath));
        }
        return is_writable($filepath);
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
