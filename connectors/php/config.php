<?php
/**
 *  Filemanager server-side configuration file
 *
 *  @license     MIT License
 *  @author      Pavel Solomienko <https://github.com/servocoder/>
 *  @copyright   Authors
 */

$config = [
    /**
     * Path to the Filemanager folder.
     * Set path in case the PHP connector class was moved or extended.
     * If you use the default Filemanager files structure it will be defined automatically as ancestor of the PHP connector class.
     * @var string|null
     */
    "fmPath" => null,
    /**
     * Filemanager plugin to use.
     * Currently available plugins:
     *
     * "s3" - AWS S3 storage plugin (PHP SDK v.3)
     */
    "plugin" => null,
    /**
     * Overrides client-side configuration options (in json file) with the counterparts in the current file.
     * @see LocalFilemanager::actionInitiate() for the options map
     */
    "overrideClientConfig" => false,
    /**
     * Configure Logger class
     */
    "logger" => [
        "enabled" => true,
    ],
    /**
     * General options section
     */
    "options" => [
        /**
         * Set culture to display localized messages.
         * Available languages are listed in the languages folder
         * See https://github.com/servocoder/RichFilemanager/tree/master/scripts/languages
         */
        "culture" => "en",
        /**
         * Default value "true".
         * By default the application will search `fileRoot` folder under server root folder.
         * Set value to "false" in case the `fileRoot` folder located outside server root folder.
         * If `fileRoot` options is set to "false", `serverRoot` value is ignored - always "true".
         */
        "serverRoot" => true,
        /**
         * Default value "false". Path to the user storage folder.
         * By default the application will determine the path itself based on $_SERVER['DOCUMENT_ROOT'].
         * You can set specific path to user storage folder with the following rules:
         * - absolute path in case `serverRoot` set to "false", e.g. "/var/www/html/filemanager/userfiles/"
         * - relative path in case `serverRoot` set to "true", e.g. "/filemanager/userfiles/"
         */
        "fileRoot" => false,
        /**
         * Format of the date to display. See http://www.php.net/manual/en/function.date.php
         */
        "dateFormat" => "d M Y H:i",
        /**
         * The maximum allowed root folder total size (in Bytes). If set to "false", no size limitations applied.
         */
        "fileRootSizeLimit" => false,
        /**
         * Default value "false". Deny non-latin characters in file/folder names.
         * PHP requires INTL extension installed, otherwise all non-latin characters will be stripped.
         */
        "charsLatinOnly" => false,
        /**
         * Default value "false".
         * Means all capabilities handled by the application are available.
         * You can set only some ot them as array to restrict the allowed actions.
         * For the full list of capabilities @see BaseFilemanager::actions_list
         */
        "capabilities" => false,
    ],
    /**
     * Security section
     */
    "security" => [
        /**
         * Default value "false".
         * Allow users to download a Zip archive of a specific folder and contents (including subfolders).
         */
        "allowFolderDownload" => false,
        /**
         * Default value "false".
         * Allow users to change extension when renaming files.
         */
        "allowChangeExtensions" => false,
        /**
         * Default value "false".
         * If set to "true", allow users to upload file with no extension.
         */
        "allowNoExtension" => false,
        /**
         * Default value "true".
         * Sanitize file/folder name, replaces gaps and some other special chars.
         */
        "normalizeFilename" => true,
        /**
         * Array of file names excluded from listing.
         */
        "excluded_files" => [
            ".htaccess",
            "web.config",
        ],
        /**
         * Array of folder names excluded from listing.
         */
        "excluded_dirs" => [
            "_thumbs",
            ".CDN_ACCESS_LOGS",
        ],
        /**
         * Files excluded from listing, using REGEX.
         */
        "excluded_files_REGEXP" => "/^\\./",
        /**
         * Folders excluded from listing, using REGEX.
         */
        "excluded_dirs_REGEXP" => "/^\\./",
        /**
         * Array of files extensions permitted for editing.
         */
        "editRestrictions" => [
            "txt",
            "csv",
        ],
    ],
    /**
     * File types that are filtered out from the output list based on the type of filter ('getfolder' request)
     */
    "outputFilter" => [
        /**
         * File types to be filtered out for "images" filter
         */
        "images" => [
            "jpg",
            "jpe",
            "jpeg",
            "gif",
            "png",
            "svg",
            "bmp",
        ],
    ],
    /**
     * Upload section
     */
    "upload" => [
        /**
         * Default value "files".
         * The parameter name for the file form data (the request argument name).
         * See https://github.com/blueimp/jQuery-File-Upload/wiki/Options#paramname
         */
        "paramName" => "files",
        /**
         * Default value "files". By default files will be uploaded as a whole.
         * To upload large files in smaller chunks, set this option to a preferred chunk size (in Bytes).
         * See https://github.com/blueimp/jQuery-File-Upload/wiki/Options#maxchunksize
         */
        "chunkSize" => false,
        /**
         * Default value "16000000" (16 MB).
         * The maximum allowed file size (in Bytes). If set to "false", no size limitations applied.
         * See https://github.com/blueimp/jQuery-File-Upload/wiki/Options#maxfilesize.
         */
        "fileSizeLimit" => 16000000,
        /**
         * Default value "files".
         * If set to "true" files will be overwritten on uploads if they have same names, otherwise an index will be added.
         */
        "overwrite" => false,
        /**
         * Default value "false".
         * If set to "true", only images are accepted for upload.
         */
        "imagesOnly" => false,
        /**
         * Default value "DISALLOW_ALL". Takes value "ALLOW_ALL" / "DISALLOW_ALL".
         * If is set to "DISALLOW_ALL", only files with extensions contained in `restrictions` array will be allowed.
         * If is set to "ALLOW_ALL", all files will be accepted for upload except for files with extensions contained in `restrictions`.
         */
        "policy" => "DISALLOW_ALL",
        /**
         * Array of files extensions permitted for uploading/creating
         */
        "restrictions" => [
            "jpg",
            "jpe",
            "jpeg",
            "gif",
            "png",
            "svg",
            "txt",
            "pdf",
            "odp",
            "ods",
            "odt",
            "rtf",
            "doc",
            "docx",
            "xls",
            "xlsx",
            "ppt",
            "pptx",
            "csv",
            "ogv",
            "avi",
            "mkv",
            "mp4",
            "webm",
            "m4v",
            "ogg",
            "mp3",
            "wav",
            "zip",
            "rar",
        ],
    ],
    /**
     * Images section
     */
    "images" => [
        /**
         * Uploaded image settings.
         * To disable resize set both `maxWidth` and `maxHeight` to "false".
         */
        "main" => [
            /**
             * Default value "true".
             * Automatically rotate images based on EXIF meta data.
             */
            "autoOrient" => true,
            /**
             * Default value "1280".
             * Resize maximum width in pixels. Takes integer values or "false".
             */
            "maxWidth" => 1280,
            /**
             * Default value "1024".
             * Resize maximum height in pixels. Takes integer values or "false".
             */
            "maxHeight" => 1024,
        ],
        /**
         * Thumbnail creation settings of uploaded image.
         */
        "thumbnail" => [
            /**
             * Default value "true".
             * Generate thumbnails using PHP to increase performance on listing directory.
             */
            "enabled" => true,
            /**
             * Default value "true".
             * If set to "false", it will generate thumbnail each time the image is requested. Decreased performance.
             */
            "cache" => true,
            /**
             * Default value "_thumbs/".
             * Folder to store thumbnails, invisible via filemanager.
             * If you want to make it visible, just remove it from `excluded_dirs` configuration option.
             */
            "dir" => "_thumbs/",
            /**
             * Default value "true".
             * Crop thumbnails. Set dimensions below to create square thumbnails of a particular size.
             */
            "crop" => true,
            /**
             * Default value "64".
             * Maximum crop width in pixels.
             */
            "maxWidth" => 64,
            /**
             * Default value "64".
             * Maximum crop height in pixels.
             */
            "maxHeight" => 64,
        ]
    ],
];

return $config;