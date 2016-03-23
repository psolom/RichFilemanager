<?php
/**
 *	FmHelper PHP class
 *
 *	@license	MIT License
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

class FmHelper
{
    public static function getInstance()
    {
        $baseConfig = require_once('filemanager.config.php');

        if (isset($baseConfig['plugin']) && !empty($baseConfig['plugin'])) {
            $pluginName = $baseConfig['plugin'];
            $pluginPath = 'plugins' . DIRECTORY_SEPARATOR . $pluginName . DIRECTORY_SEPARATOR;
            require_once($pluginPath . 'filemanager.' . $pluginName . '.class.php');
            $pluginConfig = require_once($pluginPath . 'filemanager.' . $pluginName . '.config.php');
            $config = array_replace_recursive($baseConfig, $pluginConfig);
            $className = 'Filemanager' . strtoupper($pluginName);
            $fm = new $className($config);
        } else {
            require_once('filemanager.class.php');
            $fm = new Filemanager($baseConfig);
        }

        if(!auth()) {
            $fm->error($fm->lang('AUTHORIZATION_REQUIRED'));
        }

        return $fm;
    }
}

// for php 5.2 compatibility
if (!function_exists('array_replace_recursive')) {
    function array_replace_recursive($array, $array1) {
        function recurse($array, $array1) {
            foreach($array1 as $key => $value) {
                // create new key in $array, if it is empty or not an array
                if (!isset($array[$key]) || (isset($array[$key]) && !is_array($array[$key]))) {
                    $array[$key] = array();
                }

                // overwrite the value in the base array
                if (is_array($value)) {
                    $value = recurse($array[$key], $value);
                }
                $array[$key] = $value;
            }
            return $array;
        }

        // handle the arguments, merge one by one
        $args = func_get_args();
        $array = $args[0];
        if (!is_array($array)) {
            return $array;
        }
        for ($i = 1; $i < count($args); $i++) {
            if (is_array($args[$i])) {
                $array = recurse($array, $args[$i]);
            }
        }
        return $array;

    }
}

/**
 * Defines real size of file
 * Based on https://github.com/jkuchar/BigFileTools project by Jan Kuchar
 * @param string $path
 * @return int|string
 * @throws Exception
 */
function real_filesize($path)
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