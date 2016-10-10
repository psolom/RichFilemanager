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
     * Relative path to the Filemanager which is accessible via URL.
     * Define if url to Filemanager is different from its path. Some cases:
     * - use of custom rules for URL routing
     * - use of "dynamic" folders, like when "publishing" assets from secured location
     * - client-side is apart from server-side (different servers etc.)
     * @var string|null
     */
    "fmUrl" => null,
    /**
     * If set to "true" the server attempts to retrieve client-side configuration options
     * in order to override ones which are common in the current config file.
     * SECURITY NOTE: It's more convenient but may be less secure.
     */
    "extendConfigClient" => true,
    /**
     * Filemanager plugin to use.
     * Currently available plugins:
     *
     * "s3" - AWS S3 storage plugin (PHP SDK v.3)
     */
    "plugin" => null,
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
         * Default value "true". The application will search `fileRoot` folder under server root folder.
         * If `fileRoot` options is set to "false", `serverRoot` value is not interpreted by the FM - always "true".
         */
        "serverRoot" => true,
        /**
         * Default value "false". The application will determine the path itself based on $_SERVER['DOCUMENT_ROOT'].
         * Can be overwritten, to display a specific folder under server root or a folder not located under Server root directory.
         * If used with `serverRoot` set to "true", do not provide initial slash to `fileRoot` value.
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
         * By default all capabilities handled by the application are available:
         * ["select", "upload", "download", "rename", "move", "replace", "delete"].
         * You can restrict it by suppressing some of them.
         */
        "capabilities" => ["select", "upload", "download", "rename", "move", "replace", "delete"],
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
         * Default value is "true".
         * Sanitize file/folder name, replaces gaps and some other special chars.
         */
        "normalizeFilename" => true,
        /**
         * Default value "DISALLOW_ALL". Takes value "ALLOW_ALL" / "DISALLOW_ALL".
         * If is set to "DISALLOW_ALL", only files with extensions contained in `uploadRestrictions` array will be allowed.
         * If is set to "ALLOW_ALL", all files will be accepted for upload except for files with extensions contained in `uploadRestrictions`.
         */
        "uploadPolicy" => "DISALLOW_ALL",
        /**
         * Array of files extensions.
         * Fix restrictions on upload checking extension files.
         */
        "uploadRestrictions" => [
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
        ]
    ],
    /**
     * Files and folders restrictions
     */
    "exclude" => [
        /**
         * Array of files excluded from listing.
         */
        "unallowed_files" => [
            ".htaccess",
            "web.config",
        ],
        /**
         * Array of folders excluded from listing.
         */
        "unallowed_dirs" => [
            "_thumbs",
            ".CDN_ACCESS_LOGS",
            "cloudservers",
        ],
        /**
         * Files excluded from listing, using REGEX.
         */
        "unallowed_files_REGEXP" => "/^\\./",
        /**
         * Folders excluded from listing, using REGEX.
         */
        "unallowed_dirs_REGEXP" => "/^\\./",
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
    ],

    "outputFilter" => [
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
             * If you want to make it visible, just remove it from `unallowed_files` configuration option.
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
    /**
     * Files editor section
     */
    "edit" => [
        "enabled" => true,
        "editExt" => [
            "txt",
            "csv",
        ]
    ],
];

return $config;