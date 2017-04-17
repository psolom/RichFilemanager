<?php

namespace RFM\Storage;

interface StorageInterface
{
    /**
     * Set configuration options for storage.
     * Merge config file options array with custom options array.
     *
     * @param array $options
     */
    public function setConfig($options);

    /**
     * Set user storage folder.
     *
     * @param string $path
     * @param bool $mkdir
     */
    public function setRoot($path, $mkdir);

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