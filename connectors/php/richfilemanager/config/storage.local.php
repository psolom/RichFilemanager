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
     * Configure Logger class
     */
    "logger" => [
        "enabled" => true,
        /**
         * Default value "null".
         * Full path to log file, e.g. "/var/log/filemanager/logfile".
         * By default the application writes logs to "filemanager.log" file that located at sys_get_temp_dir()
         */
        "file" => null,
    ],
    /**
     * General options section
     */
    "options" => [
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
    ],
    /**
     * Security section
     */
    "security" => [
        /**
         * Default value "false". Allow write operations.
         * Set value to "true" to disable all modifications to the filesystem, including thumbnail generation.
         */
        "readOnly" => false,
        /**
         * Filename extensions are compared against this list, after the right-most dot '.'
         * Matched files will be filtered from listing results, and will be restricted from all file operations (both read and write).
         */
        "extensions" => [
            /**
             * Default value "ALLOW_LIST". Takes value "ALLOW_LIST" / "DISALLOW_LIST".
             * If is set to "ALLOW_LIST", only files with extensions that match `restrictions` list will be allowed, all other files are forbidden.
             * If is set to "DISALLOW_LIST", all files are allowed except of files with extensions that match `restrictions` list.
             */
            "policy" => "ALLOW_LIST",
            /**
             * Default value "true".
             * Whether extension comparison should be case sensitive.
             */
            "ignoreCase" => true,
            /**
             * List of allowed / disallowed extensions, depending on the `policy` value.
             * To allow / disallow files without extension, add / remove the empty string "" to / from this list.
             */
            "restrictions" => [
                "",
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
                "md",
            ],
        ],
        /**
         * Files and folders paths relative to the user storage folder (see `fileRoot`) are compared against this list.
         * Matched items will be filtered from listing results, and will be restricted from all file operations (both read and write).
         */
        "patterns" => [
            /**
             * Default value "ALLOW_LIST". Takes value "ALLOW_LIST" / "DISALLOW_LIST".
             * If is set to "ALLOW_LIST", only files and folders that match `restrictions` list will be allowed, all other files are forbidden.
             * If is set to "DISALLOW_LIST", all files and folders are allowed except of ones that match `restrictions` list.
             */
            "policy" => "DISALLOW_LIST",
            /**
             * Default value "true".
             * Whether patterns comparison should be case sensitive.
             */
            "ignoreCase" => true,
            /**
             * List of allowed / disallowed patterns, depending on the `policy` value.
             */
            "restrictions" => [
                // files
                "*/.htaccess",
                "*/web.config",
                // folders
                "*/_thumbs/*",
                "*/.CDN_ACCESS_LOGS/*",
            ],
        ],
        /**
         * Default value "true".
         * Sanitize file/folder name, replaces gaps and some other special chars.
         */
        "normalizeFilename" => true,
    ],
    /**
     * Upload section
     */
    "upload" => [
        /**
         * Default value "16000000" (16 MB).
         * The maximum allowed file size (in Bytes). If set to "false", no size limitations applied.
         * See https://github.com/blueimp/jQuery-File-Upload/wiki/Options#maxfilesize.
         */
        "fileSizeLimit" => 16000000,
        /**
         * Default value "false".
         * If set to "true" files will be overwritten on uploads if they have same names, otherwise an index will be added.
         */
        "overwrite" => false,
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
