<?php

namespace RFM\Storage\Local;

use RFM\Facade\Input;
use RFM\Storage\ApiInterface;
use RFM\Storage\StorageTrait;
use RFM\Facade\Log;

class Api implements ApiInterface
{
    use IdentityTrait;
    use StorageTrait;

    /**
     * @inheritdoc
     */
    public function actionInitiate()
    {
        // config options that affect the client-side
        $shared_config = [
            'security' => [
                'read_only' => $this->config('security.read_only'),
                'extensions' => [
                    'policy' => $this->config('security.extensions.policy'),
                    'ignorecase' => $this->config('security.extensions.ignorecase'),
                    'restrictions' => $this->config('security.extensions.restrictions'),
                ],
            ],
            'upload' => [
                'fileSizeLimit' => $this->config('upload.fileSizeLimit'),
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

        $model->check_path();
        $model->check_read_permission();
        $model->check_restrictions();

        if(!$model->isDir) {
            app()->error('DIRECTORY_NOT_EXIST', [$model->pathRelative]);
        }

        if(!$handle = @opendir($model->pathAbsolute)) {
            app()->error('UNABLE_TO_OPEN_DIRECTORY', [$model->pathRelative]);
        } else {
            while (false !== ($file = readdir($handle))) {
                if($file != "." && $file != "..") {
                    array_push($files_list, $file);
                }
            }
            closedir($handle);

            foreach($files_list as $file) {
                $file_path = $model->pathRelative . $file;
                if(is_dir($model->pathAbsolute . $file)) {
                    $file_path .= '/';
                }

                $item = new ItemModel($file_path);
                if($item->is_unrestricted()) {
                    $response_data[] = $item->get_file_info();
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

        $model->check_path();
        $model->check_read_permission();
        $model->check_restrictions();

        if($model->isDir) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        return $model->get_file_info();
    }

    /**
     * @inheritdoc
     */
    public function actionUpload()
    {
        $target_path = $this->post['path'];
        $target_fullpath = $this->getFullPath($target_path, true);

        $model = new ItemModel(Input::get('path'));
        Log::info('uploading to "' . $model->pathAbsolute . '"');

        $model->check_path();
        $this->check_write_permission($target_fullpath);
        $this->check_restrictions($target_path);

        $content = $this->storage()->initUploader([
            'upload_dir' => $target_fullpath,
            'upload_relative_path' => $target_path,
        ])->post(false);

        $response_data = [];
        $files = isset($content['files']) ? $content['files'] : null;
        // there is only one file in the array as long as "singleFileUploads" is set to "true"
        if ($files && is_array($files) && is_object($files[0])) {
            $file = $files[0];
            if(isset($file->error)) {
                $error = is_array($file->error) ? $file->error : [$file->error];
                app()->error($error[0], isset($error[1]) ? $error[1] : []);
            } else {
                $relative_path = $this->cleanPath('/' . $target_path . '/' . $file->name);
                $item = $this->get_file_info($relative_path);
                $response_data[] = $item;
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
        $target_path = $this->get['path'];
        $target_fullpath = $this->getFullPath($target_path, true);

        $target_name = $this->get['name'];
        $folder_name = $this->normalizeString(trim($target_name, '/')) . '/';
        $relative_path = $this->cleanPath('/' . $target_path . '/' . $folder_name);
        $new_fullpath = $target_fullpath . '/'. $folder_name;
        Log::info('adding folder "' . $new_fullpath . '"');

        $this->check_write_permission($new_fullpath);
        $this->check_restrictions($relative_path);

        if(is_dir($new_fullpath)) {
            app()->error('DIRECTORY_ALREADY_EXISTS', [$target_name]);
        }

        if(!mkdir($new_fullpath, 0755)) {
            app()->error('UNABLE_TO_CREATE_DIRECTORY', [$target_name]);
        }

        return $this->get_file_info($relative_path);
    }

    /**
     * @inheritdoc
     */
    public function actionRename()
    {
        $suffix = '';
        $old_relative_path = $this->get['old'];
        $old_trimmed_path = $old_relative_path;

        if(substr($old_trimmed_path, -1, 1) == '/') {
            $old_trimmed_path = substr($old_trimmed_path, 0, (strlen($old_trimmed_path)-1));
            $suffix = '/';
        }
        $tmp = explode('/', $old_trimmed_path);
        $filename = $tmp[(sizeof($tmp)-1)];

        $new_path = substr($old_trimmed_path, 0, strripos($old_trimmed_path, '/' . $filename));
        $new_name = $this->storage()->normalizeString($this->get['new'], ['.', '-']);
        $new_model = new ItemModel(Input::get('path'));
        $new_relative_path = $this->cleanPath('/' . $new_path . '/' . $new_name . $suffix);

        $old_file = $this->getFullPath($old_trimmed_path, true) . $suffix;
        $new_file = $this->getFullPath($new_path, true) . '/' . $new_name . $suffix;

        $this->check_write_permission($old_file);
        $this->check_write_permission($new_file);

        // This function will also move the thumbnail, if it exists. Check perms:
        $old_thumbnail = $this->get_thumbnail_path($old_file);
        $new_thumbnail = $this->get_thumbnail_path($new_file);
        if(file_exists($old_thumbnail)) {
            $this->check_write_permission($old_thumbnail);
            $this->check_write_permission($new_thumbnail);
        }

        Log::info('renaming "' . $old_file . '" to "' . $new_file . '"');

        // forbid to change path during rename
        // FIXME: Move/rename actions should be the same action, and without this arbitrary restriction
        if(strrpos($this->get['new'], '/') !== false) {
            app()->error('FORBIDDEN_CHAR_SLASH');
        }

        // check if not requesting main FM userfiles folder
        if($this->is_root_folder($old_file)) {
            app()->error('NOT_ALLOWED');
        }

        $this->check_restrictions($old_relative_path);
        $this->check_restrictions($new_relative_path);

        if(file_exists($new_file)) {
            if($suffix === '/' && is_dir($new_file)) {
                app()->error('DIRECTORY_ALREADY_EXISTS', [$new_name]);
            }
            if($suffix === '' && is_file($new_file)) {
                app()->error('FILE_ALREADY_EXISTS', [$new_name]);
            }
        }

        if(!rename($old_file, $new_file)) {
            if(is_dir($old_file)) {
                app()->error('ERROR_RENAMING_DIRECTORY', [$filename, $new_name]);
            } else {
                app()->error('ERROR_RENAMING_FILE', [$filename, $new_name]);
            }
        } else {
            Log::info('renamed "' . $old_file . '" to "' . $new_file . '"');

            // for image only - rename thumbnail if original image was successfully renamed
            if(!is_dir($new_file)) {
                $new_thumbnail = $this->get_thumbnail_path($new_file);
                $old_thumbnail = $this->get_thumbnail_path($old_file);
                if(file_exists($old_thumbnail)) {
                    rename($old_thumbnail, $new_thumbnail);
                }
            }
        }

        return $this->get_file_info($new_relative_path);
    }

    /**
     * @inheritdoc
     */
    public function actionCopy()
    {
        $source_path = $this->get['source'];
        $basename = basename($source_path);
        $suffix = (substr($source_path, -1, 1) == '/') ? '/' : '';

        $target_input = $this->get['target'];
        $target_path = $target_input . '/';
        $target_path = $this->expandPath($target_path, false);
        $target_relative_path = $this->cleanPath('/' . $target_path . '/' . $basename . $suffix);

        $source_fullpath = $this->getFullPath($source_path, true);
        $target_fullpath = $this->getFullPath($target_path, true);
        $new_fullpath = $target_fullpath . $basename . $suffix;

        $this->check_read_permission($source_fullpath);
        $this->check_write_permission($new_fullpath);

        // This function will also copy the thumbnail, if it exists, AND
        // the destination dir already has a thumbnail dir. Check perms:
        $old_thumbnail = $this->get_thumbnail_path($source_fullpath);
        $new_thumbnail = $this->get_thumbnail_path($new_fullpath);
        if(file_exists($old_thumbnail)) {
            $this->check_read_permission($old_thumbnail);
            if (file_exists(dirname($new_thumbnail))) {
                $this->check_write_permission($new_thumbnail);
            }
        }

        Log::info('copying "' . $source_fullpath . '" to "' . $new_fullpath . '"');

        if(!is_dir($target_fullpath)) {
            app()->error('DIRECTORY_NOT_EXIST', [$target_path]);
        }

        // check if not requesting main FM userfiles folder
        if($this->is_root_folder($source_fullpath)) {
            app()->error('NOT_ALLOWED');
        }

        $this->check_restrictions($source_path);
        $this->check_restrictions($target_relative_path);

        // check if file already exists
        if (file_exists($new_fullpath)) {
            $item_name = rtrim($target_input, '/') . '/' . $basename;
            if(is_dir($new_fullpath)) {
                app()->error('DIRECTORY_ALREADY_EXISTS', [$item_name]);
            } else {
                app()->error('FILE_ALREADY_EXISTS', [$item_name]);
            }
        }

        // move file or folder
        if(!Helper::copyRecursive($source_fullpath, $new_fullpath)) {
            if(is_dir($source_fullpath)) {
                app()->error('ERROR_COPYING_DIRECTORY', [$basename, $target_input]);
            } else {
                app()->error('ERROR_COPYING_FILE', [$basename, $target_input]);
            }
        } else {
            Log::info('moved "' . $source_fullpath . '" to "' . $new_fullpath . '"');
            $old_thumbnail = $this->get_thumbnail_path($source_fullpath);

            // move thumbnail file or thumbnails folder if exists
            if(file_exists($old_thumbnail)) {
                $new_thumbnail = $this->get_thumbnail_path($new_fullpath);
                // delete old thumbnail(s) if destination folder does not exist
                if(file_exists(dirname($new_thumbnail))) {
                    Helper::copyRecursive($old_thumbnail, $new_thumbnail);
                }
            }
        }

        return $this->get_file_info($target_relative_path);
    }


    /**
     * @inheritdoc
     */
    public function actionMove()
    {
        $source_path = $this->get['old'];
        $basename = basename($source_path);
        $suffix = (substr($source_path, -1, 1) == '/') ? '/' : '';

        $target_input = $this->get['new'];
        $target_path = $target_input . '/';
        $target_path = $this->expandPath($target_path, false);
        $target_relative_path = $this->cleanPath('/' . $target_path . '/' . $basename . $suffix);

        $source_fullpath = $this->getFullPath($source_path, true);
        $target_fullpath = $this->getFullPath($target_path, true);
        $new_fullpath = $target_fullpath . $basename . $suffix;

        $this->check_write_permission($source_fullpath);
        $this->check_write_permission($new_fullpath);

        // This function will also move the thumbnail, if it exists, AND
        // the destination dir already has a thumbnail dir. If the destination
        // dir does not have a thumbnail dir, it just deletes the thumbnail.
        // Check perms:
        $old_thumbnail = $this->get_thumbnail_path($source_fullpath);
        $new_thumbnail = $this->get_thumbnail_path($new_fullpath);
        if(file_exists($old_thumbnail)) {
            $this->check_write_permission($old_thumbnail);
            if (file_exists(dirname($new_thumbnail))) {
                $this->check_write_permission($new_thumbnail);
            }
        }

        Log::info('moving "' . $source_fullpath . '" to "' . $new_fullpath . '"');

        if(!is_dir($target_fullpath)) {
            app()->error('DIRECTORY_NOT_EXIST', [$target_path]);
        }

        // check if not requesting main FM userfiles folder
        if($this->is_root_folder($source_fullpath)) {
            app()->error('NOT_ALLOWED');
        }

        $this->check_restrictions($source_path);
        $this->check_restrictions($target_relative_path);

        // check if file already exists
        if (file_exists($new_fullpath)) {
            $item_name = rtrim($target_input, '/') . '/' . $basename;
            if(is_dir($new_fullpath)) {
                app()->error('DIRECTORY_ALREADY_EXISTS', [$item_name]);
            } else {
                app()->error('FILE_ALREADY_EXISTS', [$item_name]);
            }
        }

        // should be retrieved before rename operation
        $old_thumbnail = $this->get_thumbnail_path($source_fullpath);

        // move file or folder
        if(!rename($source_fullpath, $new_fullpath)) {
            if(is_dir($source_fullpath)) {
                app()->error('ERROR_MOVING_DIRECTORY', [$basename, $target_input]);
            } else {
                app()->error('ERROR_MOVING_FILE', [$basename, $target_input]);
            }
        } else {
            Log::info('moved "' . $source_fullpath . '" to "' . $new_fullpath . '"');

            // move thumbnail file or thumbnails folder if exists
            if(file_exists($old_thumbnail)) {
                $new_thumbnail = $this->get_thumbnail_path($new_fullpath);
                // delete old thumbnail(s) if destination folder does not exist
                if(file_exists(dirname($new_thumbnail))) {
                    rename($old_thumbnail, $new_thumbnail);
                } else {
                    is_dir($old_thumbnail) ? $this->unlinkRecursive($old_thumbnail) : unlink($old_thumbnail);
                }
            }
        }

        return $this->get_file_info($target_relative_path);
    }

    /**
     * @inheritdoc
     */
    public function actionReplace()
    {
        // FIXME: $source_path is an ambiguous name here. This var is
        // actually the "target" file that will get replaced.
        $source_path = $this->post['path'];
        $source_fullpath = $this->getFullPath($source_path);

        // $target_fullpath is the directory holding the file to be replaced.
        $target_path = dirname($source_path) . '/';
        $target_fullpath = $this->getFullPath($target_path, true);

        $this->check_write_permission($source_fullpath);
        // Since the new replacement file is uploaded into the same dir as
        // the old file, we must check write perms on that dir as well.
        // FIXME: It would be safer to upload the file to the system temp
        // dir, and move it from there.
        $this->check_write_permission($target_fullpath);

        // This function will also delete the old thumbnail, if it exists. Check perms:
        $old_thumbnail = $this->get_thumbnail_path($source_fullpath);
        if(file_exists($old_thumbnail)) {
            $this->check_write_permission($old_thumbnail);
        }

        Log::info('replacing file "' . $source_fullpath . '"');
        Log::info('replacing target path "' . $target_fullpath . '"');

        if(is_dir($source_fullpath)) {
            app()->error('NOT_ALLOWED');
        }

        $content = $this->storage()->initUploader([
            'upload_dir' => $target_fullpath,
        ])->post(false);

        $response_data = [];
        $files = isset($content['files']) ? $content['files'] : null;
        // there is only one file in the array as long as "singleFileUploads" is set to "true"
        if ($files && is_array($files) && is_object($files[0])) {
            $file = $files[0];
            if(isset($file->error)) {
                $error = is_array($file->error) ? $file->error : [$file->error];
                app()->error($error[0], isset($error[1]) ? $error[1] : []);
            } else {
                $replacement_fullpath = $target_fullpath . $file->name;
                Log::info('replacing "' . $source_fullpath . '" with "' . $replacement_fullpath . '"');

                // Overwrite the existing $source_fullpath:
                rename($replacement_fullpath, $source_fullpath);

                // Delete the old thumbnail, as it is now invalid and incorrect:
                $old_thumbnail = $this->get_thumbnail_path($source_fullpath);
                if (file_exists($old_thumbnail)) {
                    unlink($old_thumbnail);
                }

                $relative_path = $this->cleanPath('/' . $source_path);
                $item = $this->get_file_info($relative_path);
                $response_data[] = $item;
            }
        } else {
            app()->error('ERROR_UPLOADING_FILE');
        }

        return $response_data;
    }

    /**
     * @inheritdoc
     */
    public function actionEditFile()
    {
        $target_path = $this->get['path'];
        $target_fullpath = $this->getFullPath($target_path, true);
        Log::info('opening "' . $target_fullpath . '"');

        $this->check_read_permission($target_fullpath);
        $this->check_restrictions($target_path);

        if(is_dir($target_fullpath)) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        $content = file_get_contents($target_fullpath);

        if($content === false) {
            app()->error('ERROR_OPENING_FILE');
        }

        $item = $this->get_file_info($target_path);
        $item['attributes']['content'] = $content;
        return $item;
    }

    /**
     * @inheritdoc
     */
    public function actionSaveFile()
    {
        $target_path = $this->post['path'];
        $target_fullpath = $this->getFullPath($target_path, true);
        Log::info('saving "' . $target_fullpath . '"');

        $this->check_write_permission($target_fullpath);
        $this->check_restrictions($target_path);

        if(is_dir($target_fullpath)) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        $result = file_put_contents($target_fullpath, $this->post['content'], LOCK_EX);

        if(!is_numeric($result)) {
            app()->error('ERROR_SAVING_FILE');
        }

        Log::info('saved "' . $target_fullpath . '"');

        // get updated file info after save
        clearstatcache();
        return $this->get_file_info($target_path);
    }

    /**
     * Seekable stream: http://stackoverflow.com/a/23046071/1789808
     * @inheritdoc
     */
    public function actionReadFile()
    {
        $target_path = $this->get['path'];
        $target_fullpath = $this->getFullPath($target_path, true);
        Log::info('reading file "' . $target_fullpath . '"');

        $this->check_read_permission($target_fullpath);
        $this->check_restrictions($target_path);

        if(is_dir($target_fullpath)) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        $filesize = filesize($target_fullpath);
        $length = $filesize;
        $offset = 0;

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

            header('HTTP/1.1 206 Partial Content');
            // A full-length file will indeed be "bytes 0-x/x+1", think of 0-indexed array counts
            header('Content-Range: bytes ' . $bytes_start . '-' . $bytes_end . '/' . $filesize);
            // While playing media by direct link (not via FM) FireFox and IE doesn't allow seeking (rewind) it in player
            // This header can fix this behavior if to put it out of this condition, but it breaks PDF preview
            header('Accept-Ranges: bytes');
        }

        header('Content-Type: ' . mime_content_type($target_fullpath));
        header("Content-Transfer-Encoding: binary");
        header("Content-Length: " . $length);
        header('Content-Disposition: inline; filename="' . basename($target_fullpath) . '"');

        $fp = fopen($target_fullpath, 'r');
        fseek($fp, $offset);
        $position = 0;

        while($position < $length) {
            $chunk = min($length - $position, 1024 * 8);

            echo fread($fp, $chunk);
            flush();
            ob_flush();

            $position += $chunk;
        }
        exit;
    }

    /**
     * @inheritdoc
     */
    public function actionGetImage($thumbnail)
    {
        $modelImage = new ItemModel(Input::get('path'));
        Log::info('loading image "' . $modelImage->pathAbsolute . '"');

        if($modelImage->isDir) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        // if $thumbnail is set to true we return the thumbnail
        if($thumbnail === true && $this->config('images.thumbnail.enabled')) {
            // create thumbnail model
            $model = new ItemModel($modelImage->getThumbnailPath());

            // generate thumbnail if it doesn't exist or caching is disabled
            if (!$model->isExists || $this->config('images.thumbnail.cache') === false) {
                $this->storage()->createThumbnail($modelImage->pathAbsolute, $model->pathAbsolute);
            }
        } else {
            $model = $modelImage;
        }

        $model->check_read_permission();
        $model->check_restrictions();

        Log::info('loaded image "' . $model->pathAbsolute . '"');

        header("Content-type: image/octet-stream");
        header("Content-Transfer-Encoding: binary");
        header("Content-length: " . $this->storage()->get_real_filesize($model->pathAbsolute));
        header('Content-Disposition: inline; filename="' . basename($model->pathAbsolute) . '"');

        readfile($model->pathAbsolute);
        exit();
    }

    /**
     * @inheritdoc
     */
    public function actionDelete()
    {
        $target_path = $this->get['path'];
        $target_fullpath = $this->getFullPath($target_path, true);
        Log::info('deleting "' . $target_fullpath . '"');

        $this->check_write_permission($target_fullpath);
        $this->check_restrictions($target_path);

        // check if not requesting main FM userfiles folder
        if($this->is_root_folder($target_fullpath)) {
            app()->error('NOT_ALLOWED');
        }

        $item = $this->get_file_info($target_path);
        $thumbnail_path = $this->get_thumbnail_path($target_fullpath);

        if(is_dir($target_fullpath)) {
            $this->unlinkRecursive($target_fullpath);
            Log::info('deleted "' . $target_fullpath . '"');

            // delete thumbnails if exists
            if(file_exists($thumbnail_path)) {
                $this->unlinkRecursive($thumbnail_path);
            }
        } else {
            unlink($target_fullpath);
            Log::info('deleted "' . $target_fullpath . '"');

            // delete thumbnails if exists
            if(file_exists($thumbnail_path)) {
                unlink($thumbnail_path);
            }
        }

        return $item;
    }

    /**
     * @inheritdoc
     */
    public function actionDownload()
    {
        $target_path = $this->get['path'];
        $target_fullpath = $this->getFullPath($target_path, true);
        Log::info('downloading "' . $target_fullpath . '"');

        $this->check_read_permission($target_fullpath);
        $this->check_restrictions($target_path);

        $is_dir_target = is_dir($target_fullpath);
        if($is_dir_target) {
            // check if not requesting main FM userfiles folder
            // TODO: This restriction seems arbitration, it could be useful for business clients
            if($this->is_root_folder($target_fullpath)) {
                app()->error('NOT_ALLOWED');
            }
        }

        if(request()->isXmlHttpRequest()) {
            return $this->get_file_info($target_path);
        } else {
            if($is_dir_target) {
                $destination_path = sys_get_temp_dir().'/fm_'.uniqid().'.zip';

                // if Zip archive is created
                if($this->storage()->zipFile($target_fullpath, $destination_path, true)) {
                    $target_fullpath = $destination_path;
                } else {
                    app()->error('ERROR_CREATING_ZIP');
                }
            }
            $file_size = $this->storage()->get_real_filesize($target_fullpath);

            header('Content-Description: File Transfer');
            header('Content-Type: ' . mime_content_type($target_fullpath));
            header('Content-Disposition: attachment; filename="' . basename($target_fullpath) . '"');
            header('Content-Transfer-Encoding: binary');
            header('Content-Length: ' . $file_size);
            // handle caching
            header('Pragma: public');
            header('Expires: 0');
            header('Cache-Control: must-revalidate, post-check=0, pre-check=0');

            // read file by chunks to handle large files
            // if you face an issue while downloading large files yet, try the following solution:
            // https://github.com/servocoder/RichFilemanager/issues/78

            $chunk_size = 5 * 1024 * 1024;
            if ($chunk_size && $file_size > $chunk_size) {
                $handle = fopen($target_fullpath, 'rb');
                while (!feof($handle)) {
                    echo fread($handle, $chunk_size);
                    @ob_flush();
                    @flush();
                }
                fclose($handle);
            } else {
                readfile($target_fullpath);
            }

            Log::info('downloaded "' . $target_fullpath . '"');
            exit;
        }
    }

    /**
     * @inheritdoc
     */
    public function actionSummarize()
    {
        $attributes = [
            'size' => 0,
            'files' => 0,
            'folders' => 0,
            'sizeLimit' => $this->config('options.fileRootSizeLimit'),
        ];

        $path = rtrim($this->path_to_files, '/') . '/';
        try {
            $this->getDirSummary($path, $attributes);
        } catch (\Exception $e) {
            app()->error('ERROR_SERVER');
        }

        return [
            'id' => '/',
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

        $source_path = $this->post['source'];
        $target_path = $this->post['target'];
        $source_fullpath = $this->getFullPath($source_path, true);
        $target_fullpath = $this->getFullPath($target_path, true);

        $this->check_read_permission($source_fullpath);
        $this->check_write_permission($target_fullpath);
        $this->check_restrictions($source_path);

        if(is_dir($source_fullpath)) {
            app()->error('FORBIDDEN_ACTION_DIR');
        }

        $zip = new \ZipArchive();
        if ($zip->open($source_fullpath) !== true) {
            app()->error('ERROR_EXTRACTING_FILE');
        }

        $response_data = [];
        $root_level_items = [];

        // make all the folders
        for($i = 0; $i < $zip->numFiles; $i++) {
            $file_name = $zip->getNameIndex($i);
            $relative_path = $target_path . $file_name;

            if ($file_name[strlen($file_name)-1] === "/" && $this->is_unrestricted($relative_path)) {
                $dir_name = $target_fullpath . $file_name;
                $created = mkdir($dir_name, 0700, true);

                if ($created) {
                    // extract root-level folders from archive manually
                    $root = substr($file_name, 0, strpos($file_name, '/') + 1);
                    $root_level_items[$root] = $relative_path;
                }
            }
        }

        // unzip into the folders
        for($i = 0; $i < $zip->numFiles; $i++) {
            $file_name = $zip->getNameIndex($i);
            $file_stat = $zip->statIndex($i);
            $relative_path = $target_path . $file_name;

            if ($file_name[strlen($file_name)-1] !== "/" && $this->is_unrestricted($relative_path)) {
                $dir_name = $target_fullpath . $file_name;
                $copied = copy('zip://'. $source_fullpath .'#'. $file_name, $dir_name);

                if($copied && strpos($file_name, '/') === false) {
                    $root_level_items[] = $relative_path;
                }
            }
        }

        $zip->close();

        foreach ($root_level_items as $relative_path) {
            $item = $this->get_file_info($relative_path);
            $response_data[] = $item;
        }

        return $response_data;
    }
}