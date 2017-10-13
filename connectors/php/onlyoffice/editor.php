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

$extension = pathinfo($absolute_path, PATHINFO_EXTENSION);
$filename = pathinfo($absolute_path, PATHINFO_BASENAME);
$mtime = filemtime($absolute_path);
$key = substr(sha1($filename . $mtime), 0, 20);

$types = [
	'text' => [
		'doc',
		'docx',
		'epub',
		'html',
		'mht',
		'odt',
		'pdf',
		'rtf',
		'txt',
		'xps'
	],
	'spreadsheet' => [
		'csv',
		'ods',
		'xls',
		'xlsx'
	],
	'presentation' => [
		'odp',
		'pps',
		'ppsx',
		'ppt',
		'pptx'
	],
];

foreach ($types as $type => $extensions) {
	if (in_array($extension, $extensions)) {
		$document_type = $type;
		break;
	}
}

$config = include __DIR__ . '/config.php';

if (!empty($config['viewer']['previewUrl'])) {
	$url = $config['viewer']['previewUrl'];
} else {
	$scheme = isset($_SERVER['HTTPS']) ? "https" : "http";
	$url = "{$scheme}://{$_SERVER['HTTP_HOST']}";
}

$url = rtrim($url, '/');

if (!empty($config['viewer']['onlyoffice']['downloadUrl'])) {
	$download_url = $config['viewer']['onlyoffice']['downloadUrl'];
} else {
	$download_url = "$url/connectors/php/onlyoffice/download.php";
}

if (!empty($config['viewer']['onlyoffice']['callbackUrl'])) {
	$callback_url = $config['viewer']['onlyoffice']['callbackUrl'];
} else {
	$callback_url = "$url/connectors/php/onlyoffice/callback.php";
}

$ts = time();
$query = [
	'path' => $path,
	'ts' => $ts,
];

$token = fm_generate_hmac_token($query);

$onlyoffice_config = [
	'document' => [
		'fileType' => $extension,
		'key' => $key,
		'title' => $filename,
		'url' => $download_url . '?path=' . urlencode($path),
	],
	'documentType' => $document_type ? : 'text',
	'editorConfig' => [
		'callbackUrl' => $callback_url . '?path=' . urlencode($path) . '&ts=' . $ts . '&token=' . $token,
		'mode' => fm_has_write_permission($path) ? 'edit' : 'view',
		'lang' => $config['language']['default'],
		'user' => [
			'id' => session_id(),
		],
	],
];
?>

<!DOCTYPE html>
<html>

<head>
    <meta http-equiv="content-type" content="text/html; charset=utf-8"/>
    <title><?= $filename ?></title>

    <style type="text/css">
        body > iframe {
            position: absolute;
            width: 95%;
            height: 95%;
            margin: auto;
        }
    </style>
</head>

<body>
<div id="onlyoffice-editor"></div>
<script type="text/javascript" src="<?= $config['viewer']['onlyoffice']['apiUrl'] ?>"></script>
<script>
    var docEditor = new DocsAPI.DocEditor("onlyoffice-editor", <?= json_encode($onlyoffice_config) ?>);
</script>
</body>
</html>
