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

