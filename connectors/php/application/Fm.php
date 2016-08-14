<?php
require_once('FmApplication.php');

defined('FM_APP_PATH') or define('FM_APP_PATH', dirname(__FILE__));

defined('FM_ROOT_PATH') or define('FM_ROOT_PATH', dirname(dirname(__FILE__)));

/**
 * Class Fm
 * Base helper class for the filemanager
 */
class Fm
{
    /**
     * @var self Filemanager application instance
     */
    private static $instance;

    /**
     * Application instance
     * @return FmApplication
     */
    private static function getInstance()
    {
        if (!(self::$instance instanceof FmApplication)) {
            self::$instance = new FmApplication();
        }
        return self::$instance;
    }

    /**
     * Application instance alias
     * @return FmApplication
     */
    public static function app()
    {
        return self::getInstance();
    }

    /**
     * Constructor is closed
     */
    private function __construct() {}

    /**
     * Cloning is forbidden
     */
    private function __clone() {}

    /**
     * Serialization is forbidden
     */
    private function __sleep() {}

    /**
     * Deserialization is forbidden
     */
    private function __wakeup() {}
}