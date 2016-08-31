<?php

class Logger {
    /**
     * @var string|null
     */
    public $file;
    /**
     * @var int
     */
    public $traceLevel = 1;
    /**
     * @var boolean
     */
    public $enabled = true;


    public function __construct()
    {
        $this->file = sys_get_temp_dir() . '/filemanager.log';
    }

    /**
     * Log message
     * @param string $message
     */
    public function log($message)
    {
        if ($this->enabled) {
            $entry = $this->formatMessage($message);
            $fp = fopen($this->file, "a");
            fwrite($fp, $entry . PHP_EOL);
            fclose($fp);
        }
    }

    /**
     * Formats a log message for display as a string.
     * @param string $message
     * @return string
     */
    protected function formatMessage($message)
    {
        $traces = array();
        foreach ($this->getBacktrace() as $trace) {
            $traces[] = "in {$trace['file']}:{$trace['line']}";
        }

        $str = "[" . date('Y-m-d H:i:s', time()) . "]#" .  $this->getUserIp() . "# - " . $message;
        $str .= (empty($traces) ? '' : "\n    " . implode("\n    ", $traces));
        return $str;
    }

    /**
     * Returns backtrace stack according to $traceLevel
     * @return array
     */
    protected function getBacktrace()
    {
        $traces = array();
        if ($this->traceLevel > 0) {
            $count = 0;
            $backtrace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS);
            array_pop($backtrace); // remove the last trace since it would be the entry script, not very useful
            foreach ($backtrace as $trace) {
                if (isset($trace['file'], $trace['line']) && strpos($trace['file'], FM_APP_PATH) !== 0) {
                    unset($trace['object'], $trace['args']);
                    $traces[] = $trace;
                    if (++$count >= $this->traceLevel) {
                        break;
                    }
                }
            }
        }
        return $traces;
    }

    /**
     * Return user IP address
     * @return mixed
     */
    protected function getUserIp()
    {
        $client  = @$_SERVER['HTTP_CLIENT_IP'];
        $forward = @$_SERVER['HTTP_X_FORWARDED_FOR'];
        $remote  = $_SERVER['REMOTE_ADDR'];

        if (filter_var($client, FILTER_VALIDATE_IP)) {
            $ip = $client;
        } elseif (filter_var($forward, FILTER_VALIDATE_IP)) {
            $ip = $forward;
        } else {
            $ip = $remote;
        }

        return $ip;
    }
}