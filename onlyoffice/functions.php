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

require_once( dirname(__FILE__) . '/config.php' );
require_once( dirname(__FILE__) . '/common.php' );


function FileUri($file_name) {
    $uri = getVirtualPath() . $file_name;
	return $uri;
}

function GetExternalFileUri($local_uri) {
    $externalUri = '';

    try
    {
        $documentRevisionId = GenerateRevisionId($local_uri);

        if (($fileContents = file_get_contents(str_replace(" ","%20", $local_uri)))===FALSE){
            throw new Exception("Bad Request");
        } else {
            $contentType =  mime_content_type($local_uri);

            $urlToService = generateUrlToStorage('', '', '', '', $documentRevisionId);

            $opts = array('http' => array(
                    'method'  => 'POST',
                    'header'  => "User-Agent: " . $_SERVER['HTTP_USER_AGENT'] . "\r\n" .
                                    "Content-Type: " . $contentType . "\r\n" .
                                    "Content-Length: " . strlen($fileContents) . "\r\n",
                    'content' => $fileContents,
                    'timeout' => $GLOBALS['DOC_SERV_TIMEOUT'] 
                )
            );

            if (substr($urlToService, 0, strlen("https")) === "https") {
                $opts['ssl'] = array( 'verify_peer'   => FALSE );
            }
 

            $context  = stream_context_create($opts);

            if (($response_data = file_get_contents($urlToService, FALSE, $context))===FALSE){
                throw new Exception ("Could not get an answer");
            } else {
                sendlog("GetExternalUri response_data:" . PHP_EOL . $response_data, "logs/common.log");
                GetResponseUri($response_data, $externalUri);
            }

            sendlog("GetExternalFileUri. externalUri = " . $externalUri, "logs/common.log");
            return $externalUri . "";
        }
    }
    catch (Exception $e)
    {
        sendlog("GetExternalFileUri Exception: " . $e->getMessage(), "logs/common.log");
    }
    return $local_uri;
}


function DoUpload($fileUri) {
    $_fileName = GetCorrectName($fileUri);

    $ext = strtolower('.' . pathinfo($_fileName, PATHINFO_EXTENSION));
    if (!in_array($ext, getFileExts()))
    {
        throw new Exception("File type is not supported");
    }

    if(!@copy($fileUri, getStoragePath($_fileName)))
    {
        $errors= error_get_last();
        $err = "Copy file error: " . $errors['type'] . "<br />\n" . $errors['message'];
        throw new Exception($err);
    }

    return $_fileName;
}


function generateUrlToConverter($document_uri, $from_extension, $to_extension, $title, $document_revision_id, $is_async) {
    $urlToConverterParams = array(
                                "url" => $document_uri,
                                "outputtype" => trim($to_extension,'.'),
                                "filetype" => trim($from_extension, '.'),
                                "title" => $title,
                                "key" => $document_revision_id);

    $urlToConverter = $GLOBALS['DOC_SERV_CONVERTER_URL'] . "?" . http_build_query($urlToConverterParams);

    if ($is_async)
        $urlToConverter = $urlToConverter . "&async=true";

    return $urlToConverter;
}


function generateUrlToStorage($document_uri, $from_extension, $to_extension, $title, $document_revision_id) {

    return $GLOBALS['DOC_SERV_STORAGE_URL'] . "?" . http_build_query(
                            array(
                                "url" => $document_uri,
                                "outputtype" => trim($to_extension,'.'),
                                "filetype" => trim($from_extension, '.'),
                                "title" => $title,
                                "key" => $document_revision_id));
}


/**
* Generate an error code table
*
* @param string $errorCode   Error code
*
* @return null
*/
function ProcessConvServResponceError($errorCode) {
    $errorMessageTemplate = "Error occurred in the document service: ";
    $errorMessage = '';

    switch ($errorCode)
    {
        case -8:
            $errorMessage = $errorMessageTemplate . "Error document VKey";
            break;
        case -7:
            $errorMessage = $errorMessageTemplate . "Error document request";
            break;
        case -6:
            $errorMessage = $errorMessageTemplate . "Error database";
            break;
        case -5:
            $errorMessage = $errorMessageTemplate . "Error unexpected guid";
            break;
        case -4:
            $errorMessage = $errorMessageTemplate . "Error download error";
            break;
        case -3:
            $errorMessage = $errorMessageTemplate . "Error convertation error";
            break;
        case -2:
            $errorMessage = $errorMessageTemplate . "Error convertation timeout";
            break;
        case -1:
            $errorMessage = $errorMessageTemplate . "Error convertation unknown";
            break;
        case 0:
            break;
        default:
            $errorMessage = $errorMessageTemplate . "ErrorCode = " . $errorCode;
            break;
    }

    throw new Exception($errorMessage);
}


/**
* Translation key to a supported form.
*
* @param string $expected_key  Expected key
*
* @return Supported key
*/
function GenerateRevisionId($expected_key) {
    if (strlen($expected_key) > 20) $expected_key = crc32( $expected_key);
    $key = preg_replace("[^0-9-.a-zA-Z_=]", "_", $expected_key);
    $key = substr($key, 0, min(array(strlen($key), 20)));
    return $key;
}


/**
* Request for conversion to a service
*
* @param string $document_uri            Uri for the document to convert
* @param string $from_extension          Document extension
* @param string $to_extension            Extension to which to convert
* @param string $document_revision_id    Key for caching on service
* @param bool   $is_async                Perform conversions asynchronously
*
* @return Xml document request result of conversion
*/
function SendRequestToConvertService($document_uri, $from_extension, $to_extension, $document_revision_id, $is_async) {
    if (empty($from_extension))
    {
        $path_parts = pathinfo($document_uri);
        $from_extension = $path_parts['extension'];
    }

    $title = basename($document_uri);
    if (empty($title)) {
        $title = guid();
    }

    if (empty($document_revision_id)) {
        $document_revision_id = $document_uri;
    }

    $document_revision_id = GenerateRevisionId($document_revision_id);

    $urlToConverter = generateUrlToConverter($document_uri, $from_extension, $to_extension, $title, $document_revision_id, $is_async);

    $response_xml_data;
    $countTry = 0;

    $opts = array('http' => array(
            'method'  => 'GET',
            'timeout' => $GLOBALS['DOC_SERV_TIMEOUT'] 
        )
    );

    if (substr($urlToConverter, 0, strlen("https")) === "https") {
        $opts['ssl'] = array( 'verify_peer'   => FALSE );
    }
 
    $context  = stream_context_create($opts);
    while ($countTry < ServiceConverterMaxTry)
    {
        $countTry = $countTry + 1;
        $response_xml_data = file_get_contents($urlToConverter, FALSE, $context);
        if ($response_xml_data !== false){ break; }
    }

    if ($countTry == ServiceConverterMaxTry)
    {
        throw new Exception ("Bad Request or timeout error");
    }

    libxml_use_internal_errors(true);
    $data = simplexml_load_string($response_xml_data);
    if (!$data) {
        $exc = "Bad Response. Errors: ";
        foreach(libxml_get_errors() as $error) {
            $exc = $exc . "\t" . $error->message;
        }
        throw new Exception ($exc);
    }

    return $data;
}


/**
* The method is to convert the file to the required format
*
* Example:
* string convertedDocumentUri;
* GetConvertedUri("http://helpcenter.onlyoffice.com/content/GettingStarted.pdf", ".pdf", ".docx", "http://helpcenter.onlyoffice.com/content/GettingStarted.pdf", false, out convertedDocumentUri);
* 
* @param string $document_uri            Uri for the document to convert
* @param string $from_extension          Document extension
* @param string $to_extension            Extension to which to convert
* @param string $document_revision_id    Key for caching on service
* @param bool   $is_async                Perform conversions asynchronously
* @param string $converted_document_uri  Uri to the converted document
*
* @return The percentage of completion of conversion
*/
function GetConvertedUri($document_uri, $from_extension, $to_extension, $document_revision_id, $is_async, &$converted_document_uri) {
    $converted_document_uri = "";
    $responceFromConvertService = SendRequestToConvertService($document_uri, $from_extension, $to_extension, $document_revision_id, $is_async);

    $errorElement = $responceFromConvertService->Error;
    if ($errorElement != NULL && $errorElement != "") ProcessConvServResponceError($errorElement);

    $isEndConvert = $responceFromConvertService->EndConvert;
    $percent = $responceFromConvertService->Percent . "";

    if ($isEndConvert != NULL && strtolower($isEndConvert) == "true")
    {
        $converted_document_uri = $responceFromConvertService->FileUrl;
        $percent = 100;
    }
    else if ($percent >= 100)
        $percent = 99;

    return $percent;
}


/**
* Processing document received from the editing service.
*
* @param string $x_document_response   The resulting xml from editing service
* @param string $response_uri          Uri to the converted document
*
* @return The percentage of completion of conversion
*/
function GetResponseUri($x_document_response, &$response_uri) {
    $response_uri = "";
    $resultPercent = 0;

    libxml_use_internal_errors(true);
    $data = simplexml_load_string($x_document_response);

    if (!$data) {
        $errs = "Invalid answer format. Errors: ";
        foreach(libxml_get_errors() as $error) {
           $errs = $errs . '\t' . $error->message;
        }

        throw new Exception ($errs);
    }

    $errorElement = $data->Error;
    if ($errorElement != NULL && $errorElement != "") ProcessConvServResponceError($data->Error);

    $endConvert = $data->EndConvert;
    if ($endConvert != NULL && $endConvert == "") throw new Exception("Invalid answer format");

    if ($endConvert != NULL && strtolower($endConvert) == true)
    {
        $fileUrl = $data->FileUrl;
        if ($fileUrl == NULL || $fileUrl == "") throw new Exception("Invalid answer format");

        $response_uri = $fileUrl;
        $resultPercent = 100;
    }
    else
    {
        $percent = $data->Percent;

        if ($percent != NULL && $percent != "")
            $resultPercent = $percent;
        if ($resultPercent >= 100)
            $resultPercent = 99;
    }

    return $resultPercent;
}

?>