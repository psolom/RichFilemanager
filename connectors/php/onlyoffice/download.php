<?php

$root = dirname(dirname(dirname(dirname(__FILE__))));
require_once $root . '/connectors/php/auth.php';

$path = ltrim(urldecode($_REQUEST['path']), '/');

if (!fm_authenticate()) {
	throw new RuntimeException("You must be authenticated to view the file");
}

if (!fm_has_read_permission($path)) {
	throw new RuntimeException("You do not have sufficient permissions to view the file");
}

// Determine absolute file path on the disk
$absolute_path = dirname($root) . '/' . $path;
if (!is_file($absolute_path) || !is_readable($absolute_path)) {
	throw new RuntimeException("File $absolute_path is not readable");
}

$filename = pathinfo($absolute_path, PATHINFO_BASENAME);

header("Content-Disposition: attachment; filename=$filename");

echo file_get_contents($absolute_path);