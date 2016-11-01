<?php
/**
 *  Filemanager PHP S3 plugin configuration
 *
 *	This is a separate config file for the parameters needed for the S3 plugin
 *	You may override any parameters set by the default configuration file here
 *
 *	@license	MIT License
 *  @author     Pavel Solomienko <https://github.com/servocoder/>
 *  @copyright	Authors
 */

$s3_config = array();

/**
 * Whether to store images thumbnails locally (faster; save traffic and requests)
 * @var string|null
 */
$s3_config['s3']['localThumbsPath'] = 'userfilesS3';

/**
 * Whether to perform bulk operations on "folders" (rename/move/copy)
 * NOTE: S3 is not a filesystem, it operates with "objects" and it has no such thing as "folder".
 * When you are performing operation like delete/rename/move/copy on "directory" the plugin actually performs
 * multiple operations for each object prefixed with the "directory" name in the background. The more objects you have
 * in your "directory", the more requests will be sent to simulate the "recursive mode".
 * DELETE requests are not charged so they are not restricted with with option.
 *
 * Links with some explanations:
 * http://stackoverflow.com/a/12523414/1789808
 * http://stackoverflow.com/questions/33363254/aws-s3-rename-directory-object
 * http://stackoverflow.com/questions/33000329/cost-of-renaming-a-folder-in-aws-s3-bucket
 *
 * @var boolean
 */
$s3_config['s3']['allowBulk'] = true;


/*******************************************************************************
 * S3 SETTINGS
 * Check options description: https://github.com/frostealth/yii2-aws-s3
 ******************************************************************************/

$s3_config['s3']['settings'] = array(
    'region' => 'your region',
    'bucket' => 'your aws s3 bucket',
    'credentials' => array( // Aws\Credentials\CredentialsInterface|array|callable
        'key' => 'your aws s3 key',
        'secret' => 'your aws s3 secret',
    ),
    'defaultAcl' => '',
    //'cdnHostname' => 'http://example.cloudfront.net',
    'debug' => false, // bool|array
);

return $s3_config;