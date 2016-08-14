<?php
require_once(FM_APP_PATH . '/Logger.php');

class Log
{
    /**
     * Logs an informational message to the log.
     * @param string $message
     */
    public static function info($message)
    {
        Fm::app()->logger->log($message);
    }
}