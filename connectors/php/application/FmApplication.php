<?php
require_once('Logger.php');
//require_once('Request.php');

class FmApplication {
    /**
     * @var Logger
     */
    public $logger;
    /**
     * @var Request
     */
    public $request;

    public function __construct()
    {
        $this->logger = new Logger();
    }

    public function getInstance()
    {
        $serverConfig = require_once(FM_ROOT_PATH . '/config.php');

        if (isset($serverConfig['logger']) && $serverConfig['logger']['enabled'] == true ) {
            $this->logger->enabled = true;
        }

        if (isset($serverConfig['plugin']) && !empty($serverConfig['plugin'])) {
            $pluginName = $serverConfig['plugin'];
            $pluginPath = FM_ROOT_PATH . "/plugins/{$pluginName}/";
            $className = ucfirst($pluginName) . 'Filemanager';
            require_once($pluginPath . $className . '.php');
            $pluginConfig = require_once($pluginPath . 'config.php');
            $config = array_replace_recursive($serverConfig, $pluginConfig);
            $fm = new $className($config);
        } else {
            require_once(FM_ROOT_PATH . '/LocalFilemanager.php');
            $fm = new LocalFilemanager($serverConfig);
        }

        if(!auth()) {
            $fm->error($fm->lang('AUTHORIZATION_REQUIRED'));
        }

        return $fm;
    }

    /**
     * Invokes filemanager action based on request params and returns response
     * @param $fm BaseFilemanager
     */
    public function handleRequest($fm)
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

                    case 'getinfo':
                        if($this->getvar('path')) {
                            $response = $this->getinfo();
                        }
                        break;

                    case 'getfolder':
                        if($this->getvar('path')) {
                            $response = $this->getfolder();
                        }
                        break;

                    case 'rename':
                        if($this->getvar('old') && $this->getvar('new')) {
                            $response = $this->rename();
                        }
                        break;

                    case 'move':
                        if($this->getvar('old') && $this->getvar('new')) {
                            $response = $this->move();
                        }
                        break;

                    case 'editfile':
                        if($this->getvar('path')) {
                            $response = $this->editfile();
                        }
                        break;

                    case 'delete':
                        if($this->getvar('path')) {
                            $response = $this->delete();
                        }
                        break;

                    case 'addfolder':
                        if($this->getvar('path') && $this->getvar('name')) {
                            $response = $this->addfolder();
                        }
                        break;

                    case 'download':
                        if($this->getvar('path')) {
                            $force = isset($_GET['force']);
                            $response = $this->download($force);
                        }
                        break;

                    case 'getimage':
                        if($this->getvar('path')) {
                            $thumbnail = isset($_GET['thumbnail']);
                            $this->getimage($thumbnail);
                        }
                        break;

                    case 'readfile':
                        if($this->getvar('path')) {
                            $this->readfile();
                        }
                        break;

                    case 'summarize':
                        $response = $this->summarize();
                        break;
                }

            } else if(isset($_POST['mode']) && $_POST['mode']!='') {

                switch($_POST['mode']) {

                    default:
                        $this->error($this->lang('MODE_ERROR'));
                        break;

                    case 'add':
                        if($this->postvar('currentpath')) {
                            $this->add();
                        }
                        break;

                    case 'replace':
                        if($this->postvar('newfilepath')) {
                            $this->replace();
                        }
                        break;

                    case 'savefile':
                        if($this->postvar('content', false) && $this->postvar('path')) {
                            $response = $this->savefile();
                        }
                        break;
                }
            }
        }

        echo json_encode($response);
        die();
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

    public function get($name = null, $defaultValue = null)
    {
        return isset($params[$name]) ? $params[$name] : $defaultValue;


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
}