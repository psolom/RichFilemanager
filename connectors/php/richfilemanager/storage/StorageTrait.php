<?php

namespace RFM\Storage;

trait StorageTrait
{
    /**
     * Return storage name.
     *
     * @return string
     * @throws \Exception
     */
    public function getName()
    {
        if (empty($this->name)) {
            throw new \Exception("Storage name isn't set.");
        }

        return $this->name;
    }

    /**
     * Get the storage instance.
     *
     * @return \RFM\Storage\Local\Storage
     */
    public function storage()
    {
        return app()->getStorage($this->name);
    }

    /**
     * Get configuration options specific for storage.
     *
     * @param array|string $key
     * @param null|mixed $default
     * @return mixed
     */
    public function config($key = null, $default = null)
    {
        return config("storage.{$this->name}.{$key}", $default);
    }
}