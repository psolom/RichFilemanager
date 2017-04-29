<?php

namespace RFM\Api;

use RFM\Facade\Input;
use RFM\Facade\Log;
use RFM\Storage\S3\ItemModel;

class AwsS3Api implements ApiInterface
{
    /**
     * @var \RFM\Storage\S3\Storage
     */
    protected $storage;

    /**
     * Api constructor.
     */
    public function __construct()
    {
        $this->storage = app()->getStorage('s3');
    }

    /**
     * @inheritdoc
     */
    public function actionInitiate()
    {
        // config options that affect the client-side
        $shared_config = [
            'security' => [
                'readOnly' => $this->storage->config('security.readOnly'),
                'extensions' => [
                    'policy' => $this->storage->config('security.extensions.policy'),
                    'ignoreCase' => $this->storage->config('security.extensions.ignoreCase'),
                    'restrictions' => $this->storage->config('security.extensions.restrictions'),
                ],
            ],
            'upload' => [
                'fileSizeLimit' => $this->storage->config('upload.fileSizeLimit'),
            ],
        ];

        return [
            'id' => '/',
            'type' => 'initiate',
            'attributes' => [
                'config' => $shared_config,
            ],
        ];
    }

    /**
     * @inheritdoc
     */
    public function actionGetFolder()
    {
        $files_list = [];
        $response_data = [];
        $model = new ItemModel(Input::get('path'));
        Log::info('opening folder "' . $model->pathAbsolute . '"');

        $model->checkPath();
        $model->checkReadPermission();
        $model->checkRestrictions();

        if (!$model->isDir) {
            app()->error('DIRECTORY_NOT_EXIST', [$model->pathRelative]);
        }

        if (!$handle = @opendir($model->pathAbsolute)) {
            app()->error('UNABLE_TO_OPEN_DIRECTORY', [$model->pathRelative]);
        } else {
            while (false !== ($file = readdir($handle))) {
                array_push($files_list, $file);
            }
            closedir($handle);

            foreach ($files_list as $file) {
                $file_path = $model->pathRelative . $file;
                if (is_dir($model->pathAbsolute . $file)) {
                    $file_path .= '/';
                }

                $item = new ItemModel($file_path);
                if ($item->isUnrestricted()) {
                    $response_data[] = $item->getInfo();
                }
            }
        }

        return $response_data;
    }

    /**
     * @inheritdoc
     */
    public function actionGetFile()
    {
        $model = new ItemModel(Input::get('path'));
        Log::info('opening file "' . $model->pathAbsolute . '"');

        // NOTE: S3 doesn't provide a way to check if file doesn't exist or just has a permissions restriction,
        // therefore it is supposed the file is prohibited by default and the appropriate message is returned.
        // https://github.com/aws/aws-sdk-php/issues/969
        $model->checkPath();
        $model->checkReadPermission();
        $model->checkRestrictions();

        if ($model->isDir) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        return $model->getInfo();
    }

    /**
     * @inheritdoc
     */
    public function actionUpload()
    {
        $model = new ItemModel(Input::get('path'));
        Log::info('uploading to "' . $model->pathAbsolute . '"');

        $model->checkPath();
        $model->checkWritePermission();

        $content = $this->storage->initUploader($model)->post(false);

        $response_data = [];
        $files = isset($content['files']) ? $content['files'] : null;
        // there is only one file in the array as long as "singleFileUploads" is set to "true"
        if ($files && is_array($files) && is_object($files[0])) {
            $file = $files[0];
            if (isset($file->error)) {
                $error = is_array($file->error) ? $file->error : [$file->error];
                app()->error($error[0], isset($error[1]) ? $error[1] : []);
            } else {
                $uploadedPath = $this->storage->cleanPath('/' . $model->pathRelative . '/' . $file->name);
                $modelUploaded = new ItemModel($uploadedPath);
                $response_data[] = $modelUploaded->getInfo();
            }
        } else {
            app()->error('ERROR_UPLOADING_FILE');
        }

        return $response_data;
    }

    /**
     * @inheritdoc
     */
    public function actionAddFolder()
    {
        $targetPath = Input::get('path');
        $targetName = Input::get('name');

        $modelTarget = new ItemModel($targetPath);
        $modelTarget->checkPath();
        $modelTarget->checkWritePermission();

        $dirName = $this->storage->normalizeString(trim($targetName, '/')) . '/';
        $relativePath = $this->storage->cleanPath('/' . $targetPath . '/' . $dirName);

        $model = new ItemModel($relativePath);
        Log::info('adding folder "' . $model->pathAbsolute . '"');

        $model->checkRestrictions();

        if ($model->isExists && $model->isDir) {
            app()->error('DIRECTORY_ALREADY_EXISTS', [$targetName]);
        }

        if (!mkdir($model->pathAbsolute, 0755)) {
            app()->error('UNABLE_TO_CREATE_DIRECTORY', [$targetName]);
        }

        return $model->getInfo();
    }

    /**
     * @inheritdoc
     */
    public function actionRename()
    {
        $modelOld = new ItemModel(Input::get('old'));
        $suffix = $modelOld->isDir ? '/' : '';
        $filename = Input::get('new');

        // forbid to change path during rename
        if (strrpos($filename, '/') !== false) {
            app()->error('FORBIDDEN_CHAR_SLASH');
        }

        // check if not requesting root storage folder
        if ($modelOld->isDir && $modelOld->isRoot()) {
            app()->error('NOT_ALLOWED');
        }

        // forbid bulk operations on objects
        if ($modelOld->isDir && !$this->storage->config('allowBulk')) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        $modelNew = new ItemModel($modelOld->closest()->pathRelative . $filename . $suffix);
        Log::info('moving "' . $modelOld->pathAbsolute . '" to "' . $modelNew->pathAbsolute . '"');

        $modelOld->checkPath();
        $modelOld->checkWritePermission();
        $modelOld->checkRestrictions();
        $modelNew->checkRestrictions();

        // define thumbnails models
        $modelThumbOld = $modelOld->thumbnail();
        $modelThumbNew = $modelNew->thumbnail();

        // check thumbnail file or thumbnails folder permissions
        if ($modelThumbOld->isExists) {
            $modelThumbOld->checkWritePermission();
        }

        if ($modelNew->isExists) {
            if ($modelNew->isDir) {
                app()->error('DIRECTORY_ALREADY_EXISTS', [$modelNew->pathRelative]);
            } else {
                app()->error('FILE_ALREADY_EXISTS', [$modelNew->pathRelative]);
            }
        }

        if ($this->storage->renameRecursive($modelOld->pathAbsolute, $modelNew->pathAbsolute)) {
            Log::info('renamed "' . $modelOld->pathAbsolute . '" to "' . $modelNew->pathAbsolute . '"');

            if ($modelThumbOld->isExists) {
                if ($this->storage->config('images.thumbnail.useLocalStorage')) {
                    rename($modelThumbOld->pathAbsolute, $modelThumbNew->pathAbsolute);
                } else {
                    $this->storage->renameRecursive($modelThumbOld->pathAbsolute, $modelThumbNew->pathAbsolute);
                }
            }
        } else {
            if ($modelOld->isDir) {
                app()->error('ERROR_RENAMING_DIRECTORY', [$modelOld->pathRelative, $modelNew->pathRelative]);
            } else {
                app()->error('ERROR_RENAMING_FILE', [$modelOld->pathRelative, $modelNew->pathRelative]);
            }
        }

        return $modelNew->getInfo();
    }

    /**
     * @inheritdoc
     */
    public function actionCopy()
    {
        $modelSource = new ItemModel(Input::get('source'));
        $modelTarget = new ItemModel(Input::get('target'));

        $suffix = $modelSource->isDir ? '/' : '';
        $basename = basename($modelSource->pathAbsolute);
        $modelNew = new ItemModel($modelTarget->pathRelative . $basename . $suffix);
        Log::info('copying "' . $modelSource->pathAbsolute . '" to "' . $modelNew->pathAbsolute . '"');

        if (!$modelTarget->isDir) {
            app()->error('DIRECTORY_NOT_EXIST', [$modelTarget->pathRelative]);
        }

        // check if not requesting root storage folder
        if ($modelSource->isDir && $modelSource->isRoot()) {
            app()->error('NOT_ALLOWED');
        }

        // forbid bulk operations on objects
        if ($modelSource->isDir && !$this->storage->config('allowBulk')) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        // check items permissions
        $modelSource->checkPath();
        $modelSource->checkReadPermission();
        $modelSource->checkRestrictions();
        $modelTarget->checkPath();
        $modelTarget->checkWritePermission();
        $modelNew->checkRestrictions();

        // check if file already exists
        if ($modelNew->isExists) {
            if ($modelNew->isDir) {
                app()->error('DIRECTORY_ALREADY_EXISTS', [$modelNew->pathRelative]);
            } else {
                app()->error('FILE_ALREADY_EXISTS', [$modelNew->pathRelative]);
            }
        }

        // define thumbnails models
        $modelThumbOld = $modelSource->thumbnail();
        $modelThumbNew = $modelNew->thumbnail();

        // check thumbnail file or thumbnails folder permissions
        if ($modelThumbOld->isExists) {
            $modelThumbOld->checkReadPermission();
        }

        if ($this->storage->copyRecursive($modelSource->pathAbsolute, $modelNew->pathAbsolute)) {
            Log::info('copied "' . $modelSource->pathAbsolute . '" to "' . $modelNew->pathAbsolute . '"');

            if ($modelThumbOld->isExists) {
                if ($this->storage->config('images.thumbnail.useLocalStorage')) {
                    app()->getStorage('local')->copyRecursive($modelThumbOld->pathAbsolute, $modelThumbNew->pathAbsolute);
                } else {
                    $this->storage->copyRecursive($modelThumbOld->pathAbsolute, $modelThumbNew->pathAbsolute);
                }
            }
        } else {
            if ($modelSource->isDir) {
                app()->error('ERROR_COPYING_DIRECTORY', [$modelSource->pathRelative, $modelNew->pathRelative]);
            } else {
                app()->error('ERROR_COPYING_FILE', [$modelSource->pathRelative, $modelNew->pathRelative]);
            }
        }

        return $modelNew->getInfo();
    }

    /**
     * @inheritdoc
     */
    public function actionMove()
    {
        $modelSource = new ItemModel(Input::get('old'));
        $modelTarget = new ItemModel(Input::get('new'));

        $suffix = $modelSource->isDir ? '/' : '';
        $basename = basename($modelSource->pathAbsolute);
        $modelNew = new ItemModel($modelTarget->pathRelative . $basename . $suffix);
        Log::info('moving "' . $modelSource->pathAbsolute . '" to "' . $modelNew->pathAbsolute . '"');

        if (!$modelTarget->isDir) {
            app()->error('DIRECTORY_NOT_EXIST', [$modelTarget->pathRelative]);
        }

        // check if not requesting root storage folder
        if ($modelSource->isDir && $modelSource->isRoot()) {
            app()->error('NOT_ALLOWED');
        }

        // forbid bulk operations on objects
        if ($modelSource->isDir && !$this->storage->config('allowBulk')) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        // check items permissions
        $modelSource->checkPath();
        $modelSource->checkWritePermission();
        $modelSource->checkRestrictions();
        $modelTarget->checkPath();
        $modelTarget->checkWritePermission();
        $modelNew->checkRestrictions();

        // check if file already exists
        if ($modelNew->isExists) {
            if ($modelNew->isDir) {
                app()->error('DIRECTORY_ALREADY_EXISTS', [$modelNew->pathRelative]);
            } else {
                app()->error('FILE_ALREADY_EXISTS', [$modelNew->pathRelative]);
            }
        }

        // define thumbnails models
        $modelThumbOld = $modelSource->thumbnail();
        $modelThumbNew = $modelNew->thumbnail();

        // check thumbnail file or thumbnails folder permissions
        if ($modelThumbOld->isExists) {
            $modelThumbOld->checkWritePermission();
        }

        if ($this->storage->renameRecursive($modelSource->pathAbsolute, $modelNew->pathAbsolute)) {
            Log::info('moved "' . $modelSource->pathAbsolute . '" to "' . $modelNew->pathAbsolute . '"');

            if ($modelThumbOld->isExists) {
                if ($this->storage->config('images.thumbnail.useLocalStorage')) {
                    rename($modelThumbOld->pathAbsolute, $modelThumbNew->pathAbsolute);
                } else {
                    $this->storage->renameRecursive($modelThumbOld->pathAbsolute, $modelThumbNew->pathAbsolute);
                }
            }
        } else {
            if ($modelSource->isDir) {
                app()->error('ERROR_MOVING_DIRECTORY', [$modelSource->pathRelative, $modelNew->pathRelative]);
            } else {
                app()->error('ERROR_MOVING_FILE', [$modelSource->pathRelative, $modelNew->pathRelative]);
            }
        }

        return $modelNew->getInfo();
    }

    /**
     * @inheritdoc
     */
    public function actionEditFile()
    {
        $model = new ItemModel(Input::get('path'));
        Log::info('opening file "' . $model->pathAbsolute . '"');

        $model->checkPath();
        $model->checkReadPermission();
        $model->checkRestrictions();

        if($model->isDir) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        $content = file_get_contents($model->pathAbsolute);

        if($content === false) {
            app()->error('ERROR_OPENING_FILE');
        }

        $item = $model->getInfo();
        $item['attributes']['content'] = $content;
        return $item;
    }

    /**
     * @inheritdoc
     */
    public function actionSaveFile()
    {
        $model = new ItemModel(Input::get('path'));
        Log::info('saving file "' . $model->pathAbsolute . '"');

        $model->checkPath();
        $model->checkWritePermission();
        $model->checkRestrictions();

        if($model->isDir) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        $result = file_put_contents($model->pathAbsolute, Input::get('content'));

        if(!is_numeric($result)) {
            app()->error('ERROR_SAVING_FILE');
        }

        Log::info('saved "' . $model->pathAbsolute . '"');

        // get updated file info after save
        clearstatcache();
        return $model->getInfo();
    }

    /**
     * Seekable stream: http://stackoverflow.com/a/23046071/1789808
     * @inheritdoc
     */
    public function actionReadFile()
    {
        $model = new ItemModel(Input::get('path'));
        Log::info('reading file "' . $model->pathAbsolute . '"');

        $model->checkPath();
        $model->checkReadPermission();
        $model->checkRestrictions();

        if($model->isDir) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        $filesize = filesize($model->pathAbsolute);
        $length = $filesize;
        $context = null;

        if(isset($_SERVER['HTTP_RANGE'])) {
            if(!preg_match('/bytes=(\d+)-(\d+)?/', $_SERVER['HTTP_RANGE'], $matches)) {
                header('HTTP/1.1 416 Requested Range Not Satisfiable');
                header('Content-Range: bytes */' . $filesize);
                exit;
            }

            $offset = intval($matches[1]);

            if(isset($matches[2])) {
                $end = intval($matches[2]);
                if($offset > $end) {
                    header('HTTP/1.1 416 Requested Range Not Satisfiable');
                    header('Content-Range: bytes */' . $filesize);
                    exit;
                }
                $length = $end - $offset;
            } else {
                $length = $filesize - $offset;
            }

            $bytes_start = $offset;
            $bytes_end = $offset + $length - 1;
            $context = stream_context_create([
                's3' => [
                    'seekable' => true,
                    'Range' => "bytes={$bytes_start}-{$bytes_end}",
                ]
            ]);

            header('HTTP/1.1 206 Partial Content');
            // A full-length file will indeed be "bytes 0-x/x+1", think of 0-indexed array counts
            header('Content-Range: bytes ' . $bytes_start . '-' . $bytes_end . '/' . $filesize);
            // While playing media by direct link (not via FM) FireFox and IE doesn't allow seeking (rewind) it in player
            // This header can fix this behavior if to put it out of this condition, but it breaks PDF preview
            header('Accept-Ranges: bytes');
        }

        header('Content-Type: ' . $model->getMimeType());
        header("Content-Transfer-Encoding: binary");
        header("Content-Length: " . $length);
        header('Content-Disposition: inline; filename="' . basename($model->pathAbsolute) . '"');

        readfile($model->pathAbsolute, null, $context);
        exit;
    }

    /**
     * @inheritdoc
     */
    public function actionGetImage($thumbnail)
    {
        $modelImage = new ItemModel(Input::get('path'));
        Log::info('loading image "' . $modelImage->pathAbsolute . '"');

        if ($modelImage->isDir) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        // if $thumbnail is set to true we return the thumbnail
        if ($thumbnail === true && $this->storage->config('images.thumbnail.enabled')) {
            // create thumbnail model
            $model = $modelImage->thumbnail();

            // generate thumbnail if it doesn't exist or caching is disabled
            if (!$model->isExists || $this->storage->config('images.thumbnail.cache') === false) {
                $modelImage->createThumbnail();
            }
        } else {
            $model = $modelImage;
        }

        $model->checkReadPermission();
        $model->checkRestrictions();

        Log::info('loaded image "' . $model->pathAbsolute . '"');

        header("Content-Type: image/octet-stream");
        header("Content-Transfer-Encoding: binary");
        header("Content-Length: " . filesize($model->pathAbsolute), true);
        header('Content-Disposition: inline; filename="' . basename($model->pathAbsolute) . '"');

        readfile($model->pathAbsolute);
        exit;
    }

    /**
     * @inheritdoc
     */
    public function actionDelete()
    {
        $model = new ItemModel(Input::get('path'));
        Log::info('deleting "' . $model->pathAbsolute . '"');

        $model->checkPath();
        $model->checkWritePermission();
        $model->checkRestrictions();

        // check if not requesting root storage folder
        if ($model->isDir && $model->isRoot()) {
            app()->error('NOT_ALLOWED');
        }

        $info = $model->getInfo();
        $modelThumb = $model->thumbnail();

        // check thumbnail file or thumbnails folder permissions
        if ($modelThumb->isExists) {
            $modelThumb->checkWritePermission();
        }

        if ($model->remove()) {
            Log::info('deleted "' . $model->pathAbsolute . '"');

            if ($modelThumb->isExists) {
                $modelThumb->remove();
            }
        }

        return $info;
    }

    /**
     * @inheritdoc
     */
    public function actionDownload()
    {
        $model = new ItemModel(Input::get('path'));
        Log::info('downloading "' . $model->pathAbsolute . '"');

        $model->checkPath();
        $model->checkReadPermission();
        $model->checkRestrictions();

        // no direct way to download S3 folders
        if($model->isDir) {
            app()->error('NOT_ALLOWED');
        }

        if (request()->isXmlHttpRequest()) {
            return $model->getInfo();
        } else {
            $targetPath = $model->pathAbsolute;
            header('Content-Description: File Transfer');
            header('Content-Type: ' . $model->getMimeType());
            header('Content-Disposition: attachment; filename="' . basename($targetPath) . '"');
            header('Content-Transfer-Encoding: binary');
            header('Content-Length: ' . filesize($targetPath));
            // handle caching
            header('Pragma: public');
            header('Expires: 0');
            header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

            readfile($targetPath);
            Log::info('downloaded "' . $targetPath . '"');
            exit;
        }
    }

    /**
     * @inheritdoc
     */
    public function actionSummarize()
    {
        $path = '/';
        $attributes = [
            'size' => 0,
            'files' => 0,
            'sizeLimit' => $this->storage->config('options.fileRootSizeLimit'),
        ];

        try {
            $this->storage->getDirSummary($path, $attributes);
        } catch (\Exception $e) {
            app()->error('ERROR_SERVER');
        }

        return [
            'id' => $path,
            'type' => 'summary',
            'attributes' => $attributes,
        ];
    }

    /**
     * @inheritdoc
     */
    public function actionExtract()
    {
        if (!extension_loaded('zip')) {
            app()->error('NOT_FOUND_SYSTEM_MODULE', ['zip']);
        }

        $modelSource = new ItemModel(Input::get('source'));
        $modelTarget = new ItemModel(Input::get('target'));
        Log::info('extracting "' . $modelSource->pathAbsolute . '" to "' . $modelTarget->pathAbsolute . '"');

        $modelSource->checkPath();
        $modelTarget->checkPath();
        $modelSource->checkReadPermission();
        $modelTarget->checkWritePermission();
        $modelSource->checkRestrictions();
        $modelTarget->checkRestrictions();

        if ($modelSource->isDir) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        // copy archive from S3 storage to local system temporary folder
        $pathTemp = sys_get_temp_dir() . '/' . uniqid();
        if (!copy($modelSource->pathAbsolute, $pathTemp)) {
            app()->error('ERROR_COPYING_FILE', [$modelSource->pathRelative, $pathTemp]);
            app()->error('ERROR_SERVER');
        }

        $zip = new \ZipArchive();
        if ($zip->open($pathTemp) !== true) {
            app()->error('ERROR_EXTRACTING_FILE');
        }

        /**
         * @var $rootLevelItems ItemModel[]
         */
        $rootLevelItems = [];
        $responseData = [];

        // make all the folders
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            $model = new ItemModel($modelTarget->pathRelative . $filename);

            if ($filename[strlen($filename) - 1] === "/" && $model->isUnrestricted()) {
                $created = mkdir($model->pathAbsolute, 0700, true);

                if ($created) {
                    // extract root-level folders from archive manually
                    $rootName = substr($filename, 0, strpos($filename, '/') + 1);
                    if (!array_key_exists($rootName, $rootLevelItems)) {
                        $rootModel = ($rootName === $filename) ? $model : new ItemModel($modelTarget->pathRelative . $rootName);
                        $rootLevelItems[$rootName] = $rootModel;
                    }
                }
            }
        }

        // unzip into the folders
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $filename = $zip->getNameIndex($i);
            $model = new ItemModel($modelTarget->pathRelative . $filename);

            if ($filename[strlen($filename) - 1] !== "/" && $model->isUnrestricted()) {
                $copied = copy('zip://' . $pathTemp . '#' . $filename, $model->pathAbsolute);

                if ($copied && strpos($filename, '/') === false) {
                    $rootLevelItems[] = $model;
                }
            }
        }

        $zip->close();

        foreach ($rootLevelItems as $model) {
            $responseData[] = $model->getInfo();
        }

        unlink($pathTemp);

        return $responseData;
    }
}