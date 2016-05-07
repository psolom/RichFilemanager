<?php

if(!class_exists('Aws\S3\S3Client')) {
    $autoloader = __DIR__ . '/vendor/aws-autoloader.php';
    if(file_exists($autoloader)) {
        require_once($autoloader);
    } else {
        throw new Exception("AWS autoloader not found.");
    }
}

use Aws\S3\S3Client;
use GuzzleHttp\Psr7;
use Psr\Http\Message\StreamInterface;

/**
 * Class Storage
 * Based on https://github.com/frostealth/yii2-aws-s3
 *
 * PHP SDK not included, so you have to install it manually:
 * https://github.com/aws/aws-sdk-php
 * Remember to install all dependencies listed in
 * https://github.com/aws/aws-sdk-php/blob/master/composer.json
 */
class S3StorageHelper
{
    const ACL_PRIVATE = 'private';
    const ACL_PUBLIC_READ = 'public-read';
    const ACL_PUBLIC_READ_WRITE = 'public-read-write';
    const ACL_AUTHENTICATED_READ = 'authenticated-read';
    const ACL_BUCKET_OWNER_READ = 'bucket-owner-read';
    const ALC_BUCKET_OWNER_FULL_CONTROL = 'bucket-owner-full-control';

    /**
     * @var \Aws\Credentials\CredentialsInterface|array|callable
     */
    public $credentials;

    /**
     * @var string
     */
    public $region;

    /**
     * @var string
     */
    public $bucket;

    /**
     * @var string
     */
    public $cdnHostname;

    /**
     * @var string
     */
    public $defaultAcl;

    /**
     * @var bool|array
     */
    public $debug = false;

    /**
     * @var array
     */
    public $options = [];

    /**
     * @var S3Client
     */
    private $client;

    /**
     * @throws Exception
     */
    public function init()
    {
        if (empty($this->credentials)) {
            throw new Exception('S3 credentials isn\'t set.');
        }

        if (empty($this->region)) {
            throw new Exception('Region isn\'t set.');
        }

        if (empty($this->bucket)) {
            throw new Exception('You must set bucket name.');
        }

        if (!empty($this->cdnHostname)) {
            $this->cdnHostname = rtrim($this->cdnHostname, '/');
        }

        $args = $this->prepareArgs($this->options, [
            'version' => '2006-03-01',
            'region' => $this->region,
            'credentials' => $this->credentials,
            'debug' => $this->debug,
        ]);

        $this->client = new S3Client($args);

        // to use PHP functions like copy(), rename() etc.
        // https://docs.aws.amazon.com/aws-sdk-php/v3/guide/service/s3-stream-wrapper.html
        $this->client->registerStreamWrapper();
    }

    /**
     * @return S3Client
     */
    public function getClient()
    {
        return $this->client;
    }

    /**
     * @inheritDoc
     */
    public function put($key, $data, $acl = null, array $options = [])
    {
        $args = $this->prepareArgs($options, [
            'Bucket' => $this->bucket,
            'Key' => $key,
            'Body' => $data,
            'ACL' => !empty($acl) ? $acl : $this->defaultAcl,
        ]);

        return $this->execute('PutObject', $args);
    }

    /**
     * @inheritDoc
     */
    public function get($key, $saveAs = null)
    {
        $args = $this->prepareArgs([
            'Bucket' => $this->bucket,
            'Key' => $key,
            'SaveAs' => $saveAs,
        ]);

        return $this->execute('GetObject', $args);
    }

    /**
     * @inheritDoc
     */
    public function exist($key, array $options = [])
    {
        return $this->getClient()->doesObjectExist($this->bucket, $key, $options);
    }

    /**
     * @inheritDoc
     */
    public function delete($key)
    {
        return $this->execute('DeleteObject', [
            'Bucket' => $this->bucket,
            'Key' => $key,
        ]);
    }

    /**
     * @inheritDoc
     */
    public function getUrl($key)
    {
        return $this->getClient()->getObjectUrl($this->bucket, $key);
    }

    /**
     * @inheritDoc
     */
    public function getPresignedUrl($key, $expires)
    {
        $command = $this->getClient()->getCommand('GetObject', ['Bucket' => $this->bucket, 'Key' => $key]);
        $request = $this->getClient()->createPresignedRequest($command, $expires);

        return (string)$request->getUri();
    }

    /**
     * @inheritDoc
     */
    public function getCdnUrl($key)
    {
        return $this->cdnHostname . '/' . $key;
    }

    /**
     * @inheritDoc
     */
    public function getList($prefix = null, array $options = [])
    {
        $args = $this->prepareArgs($options, [
            'Bucket' => $this->bucket,
            'Prefix' => $prefix,
        ]);

        return $this->execute('ListObjects', $args);
    }

    /**
     * @inheritDoc
     */
    public function upload($key, $source, $acl = null, array $options = [])
    {
        return $this->getClient()->upload(
            $this->bucket,
            $key,
            $this->toStream($source),
            !empty($acl) ? $acl : $this->defaultAcl,
            $options
        );
    }

    /**
     * @inheritDoc
     */
    public function uploadAsync(
        $key,
        $source,
        $concurrency = null,
        $partSize = null,
        $acl = null,
        array $options = []
    ) {
        $args = $this->prepareArgs($options, [
            'concurrency' => $concurrency,
            'part_size' => $partSize,
        ]);

        return $this->getClient()->uploadAsync(
            $this->bucket,
            $key,
            $this->toStream($source),
            !empty($acl) ? $acl : $this->defaultAcl,
            $args
        );
    }

    /**
     * @param string $name
     * @param array  $args
     * @return \Aws\ResultInterface
     */
    protected function execute($name, array $args)
    {
        $command = $this->getClient()->getCommand($name, $args);
        return $this->getClient()->execute($command);
    }

    /**
     * @param array $a
     * @return array
     */
    protected function prepareArgs(array $a)
    {
        $result = [];
        $args = func_get_args();

        foreach ($args as $item) {
            $item = array_filter($item);
            $result = array_replace($result, $item);
        }

        return $result;
    }

    /**
     * Create a new stream based on the input type.
     * @param resource|string|StreamInterface $source path to a local file, resource or stream
     * @return StreamInterface
     */
    protected function toStream($source)
    {
        if (is_string($source)) {
            $source = Psr7\try_fopen($source, 'r+');
        }

        return Psr7\stream_for($source);
    }

    /**
     * @param $key
     * @param bool $handle - returns FALSE if object doesn't exists or access is denied
     * @return \Aws\ResultInterface|bool
     */
    public function head($key, $handle = false)
    {
        $args = [
            'Bucket' => $this->bucket,
            'Key' => $key,
        ];

        if(!$handle) {
            return $this->execute('HeadObject', $args);
        } else {
            $command = $this->getClient()->getCommand('HeadObject', $args);

            /* @see \Aws\S3\S3Client::checkExistenceWithCommand(), moved here to avoid extra request */
            try {
                return $this->getClient()->execute($command);
            } catch (\Aws\S3\Exception\S3Exception $e) {
                if ($e->getStatusCode() >= 500) {
                    throw $e;
                }
                return false;
            }
        }
    }

    /**
     * @param $key
     * @param $destination
     * @param $acl
     * @param $options
     * @return \Aws\ResultInterface|bool
     */
    public function copy($key, $destination, $acl = null, array $options = [])
    {
        return $this->getClient()->copy(
            $this->bucket,
            $key,
            $this->bucket,
            $destination,
            !empty($acl) ? $acl : $this->defaultAcl,
            $options
        );
    }

    /**
     * @param $key
     */
    public function batchDelete($key)
    {
        $this->getClient()->deleteMatchingObjects($this->bucket, $key);
    }

    /**
     * @param $key
     * @param $destination
     * @return bool
     */
    public function rename($key, $destination)
    {
        $bucket = $this->bucket;
        $isDir = is_dir("s3://{$bucket}/{$key}");

        if($isDir) {
            $result = $this->getList($key);

            if(!isset($result['Contents'])) {
                return false;
            }

            foreach ($result['Contents'] as $object) {
                $newPath = str_replace($key, $destination, $object['Key']);
                rename("s3://{$bucket}/{$object['Key']}", "s3://{$bucket}/{$newPath}");
            }
        } else {
            rename("s3://{$bucket}/{$key}", "s3://{$bucket}/{$destination}");
        }

        return true;
    }
}
