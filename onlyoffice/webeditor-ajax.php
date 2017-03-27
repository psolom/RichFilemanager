<?php
/*
 *
 * (c) Copyright Ascensio System Limited 2010-2016
 *
 * This program is freeware. You can redistribute it and/or modify it under the terms of the GNU 
 * General Public License (GPL) version 3 as published by the Free Software Foundation (https://www.gnu.org/copyleft/gpl.html). 
 * In accordance with Section 7(a) of the GNU GPL its Section 15 shall be amended to the effect that 
 * Ascensio System SIA expressly excludes the warranty of non-infringement of any third-party rights.
 *
 * THIS PROGRAM IS DISTRIBUTED WITHOUT ANY WARRANTY; WITHOUT EVEN THE IMPLIED WARRANTY OF MERCHANTABILITY OR
 * FITNESS FOR A PARTICULAR PURPOSE. For more details, see GNU GPL at https://www.gnu.org/copyleft/gpl.html
 *
 * You can contact Ascensio System SIA by email at sales@onlyoffice.com
 *
 * The interactive user interfaces in modified source and object code versions of ONLYOFFICE must display 
 * Appropriate Legal Notices, as required under Section 5 of the GNU GPL version 3.
 *
 * Pursuant to Section 7 § 3(b) of the GNU GPL you must retain the original ONLYOFFICE logo which contains 
 * relevant author attributions when distributing the software. If the display of the logo in its graphic 
 * form is not reasonably feasible for technical reasons, you must include the words "Powered by ONLYOFFICE" 
 * in every copy of the program you distribute. 
 * Pursuant to Section 7 § 3(e) we decline to grant you any rights under trademark law for use of our trademarks.
 *
*/
?>

<?php
/**
 * WebEditor AJAX Process Execution.
 */
require_once( dirname(__FILE__) . '/config.php' );
require_once( dirname(__FILE__) . '/ajax.php' );
require_once( dirname(__FILE__) . '/common.php' );
require_once( dirname(__FILE__) . '/functions.php' );

$_trackerStatus = array(
    0 => 'NotFound',
    1 => 'Editing',
    2 => 'MustSave',
    3 => 'Corrupted',
    4 => 'Closed'
);


if (isset($_GET["type"]) && !empty($_GET["type"])) { //Checks if type value exists
    $response_array;
    @header( 'Content-Type: application/json; charset==utf-8');
    @header( 'X-Robots-Tag: noindex' );
    @header( 'X-Content-Type-Options: nosniff' );

    nocache_headers();

    sendlog(serialize($_GET),"logs/webedior-ajax.log");

    $type = $_GET["type"];

    switch($type) { //Switch case for value of type
        case "upload":
            $response_array = upload();
            $response_array['status'] = $response_array['error'] != NULL ? 'error' : 'success';
            die (json_encode($response_array));
        case "convert":
            $response_array = convert();
            $response_array['status'] = 'success';
            die (json_encode($response_array));
        case "track":
            $response_array = track();
            $response_array['status'] = 'success';
            die (json_encode($response_array));
        default:
            $response_array['status'] = 'error';
            $response_array['error'] = '404 Method not found';
            die(json_encode($response_array));
    }
}

function upload() {
    $result; $filename;

    if ($_FILES['files']['error'] > 0) {
        $result["error"] = 'Error ' . json_encode($_FILES['files']['error']);
        return $result;
    }

    if(empty($_FILES['files']['tmp_name'])) {
        $result["error"] = 'No file sent';
        return $result;
    }

    $tmp = $_FILES['files']['tmp_name'];

    if (is_uploaded_file($tmp))
    {
        $filesize = $_FILES['files']['size'];
        $ext = strtolower('.' . pathinfo($_FILES['files']['name'], PATHINFO_EXTENSION));

        if ($filesize <= 0 || $filesize > $GLOBALS['FILE_SIZE_MAX']) {
            $result["error"] = 'File size is incorrect';
            return $result;
        }

        if (!in_array($ext, getFileExts())) {
            $result["error"] = 'File type is not supported';
            return $result;
        }

        $filename = GetCorrectName($_FILES['files']['name']);
        if( !move_uploaded_file($tmp,  getStoragePath($filename)) ) {
            $result["error"] = 'Upload failed';
            return $result;
        }

    } else {
        $result["error"] = 'Upload failed';
        return $result;
    }

    $result["filename"] = $filename;
    return $result;
}

function track() {
    sendlog("Track START", "logs/webedior-ajax.log");
    sendlog("_GET params: " . serialize( $_GET ), "logs/webedior-ajax.log");

    global $_trackerStatus;
    $data;
    $result["error"] = 0;

    if (($body_stream = file_get_contents('php://input'))===FALSE){
        $result["error"] = "Bad Request";
        return $result;
    }

    $data = json_decode($body_stream, TRUE); //json_decode - PHP 5 >= 5.2.0

    if ($data === NULL){
        $result["error"] = "Bad Response";
        return $result;
    }

    sendlog("InputStream data: " . serialize($data), "logs/webedior-ajax.log");

    $status = $_trackerStatus[$data["status"]];

    switch ($status){
        case "MustSave":
        case "Corrupted":

            $userAddress = $_GET["userAddress"];
            $fileName = $_GET["fileName"];
            $storagePath = getStoragePath($fileName, $userAddress);

            $downloadUri = $data["url"];
            $saved = 1;

            if (($new_data = file_get_contents($downloadUri))===FALSE){
                $saved = 0;
            } else {
                file_put_contents($storagePath, $new_data, LOCK_EX);
            }

            $result["c"] = "saved";
            $result["status"] = $saved;
            break;
    }

    sendlog("track result: " . serialize($result), "logs/webedior-ajax.log");
    return $result;
}

function convert() {
    $fileName = $_GET["filename"];
    $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    $internalExtension = trim(getInternalExtension($fileName),'.');

    if (in_array("." + $extension, $GLOBALS['DOC_SERV_CONVERT']) && $internalExtension != "") {

        $fileUri = $_GET["fileUri"];
        if ($fileUri == "") {
            $fileUri = FileUri($fileName);
        }
        $key = GenerateRevisionId($fileUri);

        $newFileUri;
        $result;
        $percent;

        try {
            $percent = GetConvertedUri($fileUri, $extension, $internalExtension, $key, TRUE, $newFileUri);
        }
        catch (Exception $e) {
            $result["error"] = "error: " . $e->getMessage();
            return $result;
        }

        if ($percent != 100)
        {
            $result["step"] = $percent;
            $result["filename"] = $fileName;
            $result["fileUri"] = $fileUri;
            return $result;
        }

        $baseNameWithoutExt = substr($fileName, 0, strlen($fileName) - strlen($extension) - 1);

        $newFileName = GetCorrectName($baseNameWithoutExt . "." . $internalExtension);

        if (($data = file_get_contents(str_replace(" ","%20",$newFileUri)))===FALSE){
            $result["error"] = 'Bad Request';
            return $result;
        } else {
            file_put_contents(getStoragePath($newFileName), $data, LOCK_EX);
        }

        unlink(getStoragePath($fileName));

        $fileName = $newFileName;
    }

    $result["filename"] = $fileName;
    return $result;
}

?>