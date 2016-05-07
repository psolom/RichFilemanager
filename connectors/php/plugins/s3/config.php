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

$config = array();

/**
 * Whether to store images thumbnails locally (faster; save traffic and requests)
 * @var string|null
 */
$config['s3']['localThumbsPath'] = 'userfilesS3';

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
$config['s3']['allowBulk'] = true;

/**
 * Image preview obtain/send mode.
 * NOTE: used only if thumbnails are stored at S3 server.
 *
 * @see S3Filemanager::RETRIEVE_MODE_BROWSER
 * 1) Your server generate URL to S3 object (send GET request to retrieve temporary URL for non-public S3 object);
 * 2) Browser makes GET request for the S3 object by generated URL - AWS sends image to browser.
 * (2 requests to S3; extra costs for Data Transfer "OUT From Amazon S3 To Internet")
 *
 * @see S3Filemanager::RETRIEVE_MODE_SERVER
 * 1) Your server makes GET request to obtain image stream and send it to browser directly.
 * There is no extra charge for data transfer if you use AWS EC2 server in the same region as your S3 bucket.
 * (1 request to S3; extra load to your server; no or lower costs for data transfer in comparison with "OUT From Amazon S3 To Internet")
 *
 * @link https://aws.amazon.com/s3/pricing/
 * @var string
 */
$config['s3']['thumbsRetrieveMode'] = S3Filemanager::RETRIEVE_MODE_SERVER;

/**
 * Presign url for non-public S3 objects.
 * Currently used only for thumbnails if "thumbsRetrieveMode" === S3Filemanager::RETRIEVE_MODE_BROWSER
 * @var boolean
 */
$config['s3']['presignUrl'] = true;


/*******************************************************************************
 * S3 SETTINGS
 * Check options description: https://github.com/frostealth/yii2-aws-s3
 ******************************************************************************/

$config['s3']['settings'] = array(
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

return $config;