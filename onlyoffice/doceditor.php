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
    require_once( dirname(__FILE__) . '/functions.php' );

    $filename;
    $fileuri;

    $externalUrl = $_GET["fileUrl"];
    if (!empty($externalUrl))
    {
        $filename = DoUpload($externalUrl);
    }
    else
    {
        $filename = $_GET["fileID"];
    }
    $type = $_GET["type"];

    if (!empty($type))
    {
        $filename = tryGetDefaultByType($type);

        $new_url = "doceditor.php?fileID=" . $filename;
        header('Location: ' . $new_url, true);
        exit;
    }

    $fileuri = FileUri($filename);


    function tryGetDefaultByType($type) {
        $ext;
        switch ($type)
        {
            case "document":
                $ext = ".docx";
                break;
            case "spreadsheet":
                $ext = ".xlsx";
                break;
            case "presentation":
                $ext = ".pptx";
                break;
            default:
                return;
        }

        $demoName = "demo" . $ext;
        $demoFilename = GetCorrectName($demoName);

        if(!@copy(dirname(__FILE__) . DIRECTORY_SEPARATOR . "app_data" . DIRECTORY_SEPARATOR . $demoName, getStoragePath($demoFilename)))
        {
            sendlog("Copy file error to ". getStoragePath($demoFilename), "logs/common.log");
            //Copy error!!!
        }

        return $demoFilename;
    }

    function getDocEditorKey($fileUri) {
        return GenerateRevisionId(getCurUserHostAddress() . "/" . basename($fileUri));
    }

    function getCallbackUrl($fileName) {
        return serverPath() . '/'
                    . "webeditor-ajax.php"
                    . "?type=track&userAddress=" . getClientIp()
                    . "&fileName=" . urlencode($fileName);
    }

?>

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <link rel="icon" href="./favicon.ico" type="image/x-icon" />
    <title>ONLYOFFICE™</title>

    <style>
        html {
            height: 100%;
            width: 100%;
        }

        body {
            background: #fff;
            color: #333;
            font-family: Arial, Tahoma,sans-serif;
            font-size: 12px;
            font-weight: normal;
            height: 100%;
            margin: 0;
            overflow-y: hidden;
            padding: 0;
            text-decoration: none;
        }

        form {
            height: 100%;
        }

        div {
            margin: 0;
            padding: 0;
        }
    </style>

    <script type="text/javascript" src="<?php echo $GLOBALS["DOC_SERV_API_URL"] ?>"></script>

    <script type="text/javascript">

        var docEditor;
        var fileName = "<?php echo $filename ?>";
        var fileType = "<?php echo strtolower(pathinfo($filename, PATHINFO_EXTENSION)) ?>";

        var innerAlert = function (message) {
            if (console && console.log)
                console.log(message);
        };

        var onReady = function () {
            innerAlert("Document editor ready");
        };

        var onDocumentStateChange = function (event) {
            var title = document.title.replace(/\*$/g, "");
            document.title = title + (event.data ? "*" : "");
        };

        var onRequestEditRights = function () {
            location.href = location.href.replace(RegExp("action=view\&?", "i"), "");
        };

        var onError = function (event) {
            if (event)
                innerAlert(event.data);
        };

        var сonnectEditor = function () {

            docEditor = new DocsAPI.DocEditor("iframeEditor",
                {
                    width: "100%",
                    height: "100%",

                    type: "<?php echo ($_GET["action"] != "embedded" ?  "desktop" : "embedded") ?>",
                    documentType: "<?php echo getDocumentType($filename) ?>",
                    document: {
                        title: fileName,
                        url: "<?php echo $fileuri ?>",
                        fileType: fileType,
                        key: "<?php echo getDocEditorKey($fileuri) ?>",

                        info: {
                            author: "Me",
                            created: "<?php echo date('d.m.y') ?>",
                        },

                        permissions: {
                            edit: <?php echo (in_array(strtolower('.' . pathinfo($filename, PATHINFO_EXTENSION)), $GLOBALS['DOC_SERV_EDITED']) ? "true" : "false") ?>,
                            download: true,
                        }
                    },
                    editorConfig: {
                        mode: '<?php echo $GLOBALS['MODE'] != 'view' && in_array(strtolower('.' . pathinfo($filename, PATHINFO_EXTENSION)), $GLOBALS['DOC_SERV_EDITED']) && $_GET["action"] != "view" ? "edit" : "view"  ?>',

                        lang: "en",

                        callbackUrl: "<?php echo getCallbackUrl($filename) ?>",

                        user: {
                            id: "<?php echo getClientIp() ?>",
                            firstname: "John",
                            lastname: "Smith",
                        },

                        embedded: {
                            saveUrl: "<?php echo $fileuri ?>",
                            embedUrl: "<?php echo $fileuri ?>",
                            shareUrl: "<?php echo $fileuri ?>",
                            toolbarDocked: "top",
                        },

                        customization: {
                            about: true,
                            feedback: true,
                            goback: {
                                url: "<?php echo serverPath() ?>/index.php",
                            },
                        },
                    },
                    events: {
                        'onReady': onReady,
                        'onDocumentStateChange': onDocumentStateChange,
                        'onRequestEditRights': onRequestEditRights,
                        'onError': onError,
                    }
                });
        };

        if (window.addEventListener) {
            window.addEventListener("load", сonnectEditor);
        } else if (window.attachEvent) {
            window.attachEvent("load", сonnectEditor);
        }

        function getXmlHttp() {
            var xmlhttp;
            try {
                xmlhttp = new ActiveXObject("Msxml2.XMLHTTP");
            } catch (e) {
                try {
                    xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
                } catch (ex) {
                    xmlhttp = false;
                }
            }
            if (!xmlhttp && typeof XMLHttpRequest != 'undefined') {
                xmlhttp = new XMLHttpRequest();
            }
            return xmlhttp;
        }

    </script>
</head>
<body>
    <form id="form1">
        <div id="iframeEditor">
        </div>
    </form>
</body>
</html>