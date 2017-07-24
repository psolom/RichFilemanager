<?php
/**
 * Entry point for PHP connector, put your customizations here.
 *
 * @license     MIT License
 * @author      Pavel Solomienko <https://github.com/servocoder/>
 * @copyright   Authors
 */

// only for debug
// error_reporting(E_ERROR | E_WARNING | E_PARSE | E_NOTICE);
// ini_set('display_errors', '1');

require 'vendor/autoload.php';

// fix display non-latin chars correctly
// https://github.com/servocoder/RichFilemanager/issues/7
setlocale(LC_CTYPE, 'es_ES.UTF-8');

// fix for undefined timezone in php.ini
// https://github.com/servocoder/RichFilemanager/issues/43
if(!ini_get('date.timezone')) {
    date_default_timezone_set('GMT');
}


session_start();

// This function is called for every server connection. It must return true.
//
// Implement this function to authenticate the user, for example to check a
// password login, or restrict client IP address.
//
// This function only authorizes the user to connect and/or load the initial page.
// Authorization for individual files or dirs is provided by the two functions below.
//
// NOTE: If using session variables, the session must be started first (session_start()).

$token = null;
if($_GET['token'])
    $token = $_GET['token'];
else if ($_POST['token'])
    $token = $_POST['token'];

$folder = null;
if($_GET['folder'])
    $folder = $_GET['folder'];
else if ($_POST['folder'])
    $folder = $_POST['folder'];

function fm_authenticate()
{
    global $token;

    $urlServicioweb = "http://serviciosweb.seas.es/index/autorizacionficherocampus";


    $url = $urlServicioweb."/token/". $token;

    $file = fopen($url, "rb");
    $result = stream_get_contents($file);
    fclose($file);
    $bAutorizado = $result === "1";

    return true; //Comentar en producción.
    return $bAutorizado;
}


// This function is called before any filesystem read operation, where
// $filepath is the file or directory being read. It must return true,
// otherwise the read operation will be denied.
//
// Implement this function to do custom individual-file permission checks, such as
// user/group authorization from a database, or session variables, or any other custom logic.
//
// Note that this is not the only permissions check that must pass. The read operation
// must also pass:
//   * Filesystem permissions (if any), e.g. POSIX `rwx` permissions on Linux
//   * The $filepath must be allowed according to config['patterns'] and config['extensions']
//
function fm_has_read_permission($filepath)
{
    // Customize this code as desired.
    return true;
}


// This function is called before any filesystem write operation, where
// $filepath is the file or directory being written to. It must return true,
// otherwise the write operation will be denied.
//
// Implement this function to do custom individual-file permission checks, such as
// user/group authorization from a database, or session variables, or any other custom logic.
//
// Note that this is not the only permissions check that must pass. The write operation
// must also pass:
//   * Filesystem permissions (if any), e.g. POSIX `rwx` permissions on Linux
//   * The $filepath must be allowed according to config['patterns'] and config['extensions']
//   * config['read_only'] must be set to false, otherwise all writes are disabled
//
function fm_has_write_permission($filepath)
{
    // Customize this code as desired.
    return true;
}

// example to override the default config
$config = [
    'security' => [
        'readOnly' => false,
        'extensions' => [
            'policy' => 'ALLOW_LIST',
            'restrictions' => [
                "",
                "jpg",
                "jpe",
                "jpeg",
                "gif",
                "png",
                "svg",
                "ogv",
                "mp4",
                "wmv",
                "mov",
                "webm",
                "m4v",
                "ogg",
                "mp3",
                "wav",
                "htm",
                "html",
                "pdf",
                "odt",
                "odp",
                "ods",
                "doc",
                "docx",
                "xls",
                "xlsx",
                "ppt",
                "pptx",
                "ppsx",
                "txt",
                "csv",
                "rar",
                "zip",
                "md"
            ],
        ],
    ],
     "patterns" => [
        "policy" => "DISALLOW_LIST",
        "ignoreCase" => true,
        "restrictions" => [
            // files
            "*/.htaccess",
            "*/web.config",
            // folders
            "*/_thumbs/*",
            "*/.CDN_ACCESS_LOGS/*",
        ],
    ],
    "upload" => [
        /**
         * Default value "16000000" (16 MB).
         * The maximum allowed file size (in Bytes). If set to "false", no size limitations applied.
         * See https://github.com/blueimp/jQuery-File-Upload/wiki/Options#maxfilesize.
         */
        "fileSizeLimit" => 100000000,
        /**
         * Default value "false".
         * If set to "true" files will be overwritten on uploads if they have same names, otherwise an index will be added.
         */
        "overwrite" => false,
    ],
    /*'logger' => [
        'enabled' => true,
        'file' => '/home/iruiz/filemanager.log',
    ],*/
];

$app = new \RFM\Application();

$local = new \RFM\Repository\Local\Storage($config);

$rootFolder = "/home/iruiz/htdocs/Tests/files"; //Comment this on production
//$rootFolder = "/var/www/video/campusficheros/files/media"; //Uncomment this on production

$local->setRoot($rootFolder.$folder, true, false);

// example to setup files root folder
//$local->setRoot('userfiles', true);

$app->setStorage($local);

// set application API
$app->api = new RFM\Api\LocalApi();

$app->run();