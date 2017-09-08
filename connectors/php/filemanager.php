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
setlocale(LC_CTYPE, 'en_US.UTF-8');

// fix for undefined timezone in php.ini
// https://github.com/servocoder/RichFilemanager/issues/43
if(!ini_get('date.timezone')) {
    date_default_timezone_set('GMT');
}

require_once __DIR__ . '/auth.php';

$config = [];

// example to override the default config
//$config = [
//    'security' => [
//        'readOnly' => true,
//        'extensions' => [
//            'policy' => 'ALLOW_LIST',
//            'restrictions' => [
//                'jpg',
//                'jpe',
//                'jpeg',
//                'gif',
//                'png',
//            ],
//        ],
//    ],
//];

$app = new \RFM\Application();

$local = new \RFM\Repository\Local\Storage($config);

// example to setup files root folder
//$local->setRoot('userfiles', true);

$app->setStorage($local);

// set application API
$app->api = new RFM\Api\LocalApi();

$app->run();