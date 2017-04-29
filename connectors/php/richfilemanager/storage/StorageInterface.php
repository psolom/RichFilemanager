<?php

namespace RFM\Storage;

interface StorageInterface
{
    /**
     * Return storage name string.
     *
     * @return string
     */
    public function getName();

    /**
     * Set configuration options for storage.
     * Merge config file options array with custom options array.
     *
     * @param array $options
     */
    public function setConfig($options);

    /**
     * Get configuration options specific for storage.
     *
     * @param array|string $key
     * @param null|mixed $default
     * @return mixed
     */
    public function config($key = null, $default = null);

    /**
     * Set user storage folder.
     *
     * @param string $path
     * @param bool $makeDir
     */
    public function setRoot($path, $makeDir);

    /**
     * Get user storage folder.
     *
     * @return string
     */
    public function getRoot();

    /**
     * Get user storage folder without document root
     *
     * @return string
     */
    public function getDynamicRoot();
}