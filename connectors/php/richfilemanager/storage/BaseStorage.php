<?php

namespace RFM\Storage;

/**
 *    BaseStorage PHP class
 *
 *    Base class created to define base methods
 *
 *    @license    MIT License
 *    @author        Pavel Solomienko <https://github.com/servocoder/>
 *    @copyright    Authors
 */

class BaseStorage
{
    /**
     * Storage name string.
     *
     * @var string
     */
    private $storageName;

    /**
     * Set unique name for storage.
     *
     * @param string $name
     */
    protected function setName($name)
    {
        $this->storageName = $name;
    }

    /**
     * @inheritdoc
     */
    public function getName()
    {
        return $this->storageName;
    }

    /**
     * @inheritdoc
     */
    public function setConfig($config)
    {
        app()->configure($this->getName(), $config);
    }

    /**
     * @inheritdoc
     */
    public function config($key = null, $default = null)
    {
        return config($this->getName() . ".{$key}", $default);
    }

    /**
     * Format timestamp string.
     *
     * @param integer $timestamp
     * @return string
     */
    public function formatDate($timestamp)
    {
        return date($this->config('options.dateFormat'), $timestamp);
    }

    /**
     * Clean string to retrieve correct file/folder name.
     * @param string $string
     * @param array $allowed
     * @return array|mixed
     */
    public function normalizeString($string, $allowed = [])
    {
        $allow = '';
        if(!empty($allowed)) {
            foreach ($allowed as $value) {
                $allow .= "\\$value";
            }
        }

        if($this->config('security.normalizeFilename') === true) {
            // Remove path information and dots around the filename, to prevent uploading
            // into different directories or replacing hidden system files.
            // Also remove control characters and spaces (\x00..\x20) around the filename:
            $string = trim(basename(stripslashes($string)), ".\x00..\x20");

            // Replace chars which are not related to any language
            $replacements = [' '=>'_', '\''=>'_', '/'=>'', '\\'=>''];
            $string = strtr($string, $replacements);
        }

        if($this->config('options.charsLatinOnly') === true) {
            // transliterate if extension is loaded
            if(extension_loaded('intl') === true && function_exists('transliterator_transliterate')) {
                $options = 'Any-Latin; Latin-ASCII; NFD; [:Nonspacing Mark:] Remove; NFC;';
                $string = transliterator_transliterate($options, $string);
            }
            // clean up all non-latin chars
            $string = preg_replace("/[^{$allow}_a-zA-Z0-9]/u", '', $string);
        }

        // remove double underscore
        $string = preg_replace('/[_]+/', '_', $string);

        return $string;
    }

    /**
     * Check whether given mime type is image.
     *
     * @param string $mime
     * @return bool
     */
    public function isImageMimeType($mime)
    {
        $imagesMime = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/bmp",
            "image/svg+xml",
        ];
        return in_array($mime, $imagesMime);
    }
}
