<?php

$root = dirname(dirname(dirname(dirname(__FILE__))));
$config_file = $root . '/config/filemanager.config.json';

if (!is_file($config_file) || !is_readable($config_file)) {
	throw new RuntimeException($config_file . ' is not readable');
}

$json = file_get_contents($config_file);

return json_decode($json, true);