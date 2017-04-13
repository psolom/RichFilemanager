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
     * Configure Logger class
     */
    "logger" => [
        "enabled" => false,
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
        /* Set `read_only` to true to disable all modifications to the filesystem, including thumbnail generation. */
        "read_only" => true,
        /**
         * Restrictions based on file name: "extensions", and "patterns" (glob matching, like shell wildcards).
         *
         * Files or directories that match these lists will be filtered from directory listing results, and 
         * will be restricted from all file operations (both read and write).
         *
         * Set 'policy' to "DISALLOW_LIST" to blacklist, or "ALLOW_LIST" to whitelist, the 'restrictions' array.
         */
        "extensions" => [
            /* Filename extensions from PATHINFO_EXTENSION are compared against this list, after the right-most dot '.'.
             * To disallow empty/no extensions like the old `allowNoExtension` option, add the empty string "" to this list. 
             */
            "policy" => "DISALLOW_LIST", 
            "ignorecase" => true, 
            "restrictions" => [
                "php",
                "asp",
                "pl",
                "py",
                "rb",
                "key",
                "conf",
            ],
        ],
        
        "patterns" => [
            /* These globs are compared against PATHINFO_BASENAME, so they will match in any directory. */
            "policy" => "DISALLOW_LIST", 
            "ignorecase" => true, 
            "restrictions" => [
                ".htaccess",
                "web.config",
                "*config",
                "*conf",
                "*cnf",
                "*passwd",
                "*pass",
                "*group",
                "*groups",
                "id_*",
                "*key",
                "*keys",
                "*pub",
                "magic",
                "*hosts",
                "_thumbs",  // FIXME: This breaks the current thumb permission code.
                ".CDN_ACCESS_LOGS",
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
         * Default value "files".
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
