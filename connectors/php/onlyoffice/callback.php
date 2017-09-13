<?php

try {
	$root = dirname(dirname(dirname(dirname(__FILE__))));
	require_once $root . '/connectors/php/auth.php';

	$token = $_REQUEST['token'];
	$ts = (int) $_REQUEST['ts'];
	$path = urldecode($_REQUEST['path']);

	$query = [
		'path' => $path,
		'ts' => $ts,
	];

	if (!fm_validate_hmac_token($token, $query)) {
		throw new RuntimeException("Invalid token");
	}

	// Determine absolute file path on the disk
	$path = ltrim(urldecode($_REQUEST['path']), '/');
	$absolute_path = dirname($root) . '/' . $path;
	if (!is_file($absolute_path) || !is_readable($absolute_path)) {
		throw new RuntimeException("File $absolute_path is not readable");
	}

	$body_stream = file_get_contents('php://input');
	if (!$body_stream) {
		throw new RuntimeException('Bad Request');
	}

	$data = json_decode($body_stream, true);

	if (!$data) {
		throw new RuntimeException('Bad Payload');
	}

	if ($data['status'] == 2) {
		// replace file contents

		$url = $data['url'];

		$handle = fopen($absolute_path, "w+b");
		fwrite($handle, file_get_contents($url));
		fclose($handle);
	}

	header("HTTP/1.1 200 OK");
	header("Content-Type: application/json");
	echo json_encode([
		'status' => 'success',
		'error' => false,
	]);
} catch (Exception $ex) {
	header("HTTP/1.1 500 Internal Server Error");
	header("Content-Type: application/json");
	echo json_encode([
		'status' => 'error',
		'error' => $ex->getMessage(),
	]);
}