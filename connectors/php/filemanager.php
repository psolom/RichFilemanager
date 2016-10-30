<?php
/**
 *	Filemanager PHP connector
 *  Initial class, put your customizations here
 *
 *	@license	MIT License
 *	@author		Riaan Los <mail (at) riaanlos (dot) nl>
 *  @author		Simon Georget <simon (at) linea21 (dot) com>
 *  @author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */

// only for debug
// error_reporting(E_ERROR | E_WARNING | E_PARSE | E_NOTICE);
// ini_set('display_errors', '1');

require_once('application/Fm.php');
require_once('application/FmHelper.php');

function auth()
{
    // IMPORTANT : by default Read and Write access is granted to everyone.
    // You can insert your own code over here to check if the user is authorized.
    // If you use a session variable, you've got to start the session first (session_start())
    return true;
}

$config = array();

// example to override the default config
//$config = array(
//    'upload' => array(
//        'policy' => 'DISALLOW_ALL',
//        'restrictions' => array(
//            'pdf',
//        ),
//    ),
//);

$fm = Fm::app()->getInstance($config);

// example to setup files root folder
//$fm->setFileRoot('userfiles', true);

// example to set list of allowed actions
//$fm->setAllowedActions(["select", "move"]);

$fm->handleRequest();