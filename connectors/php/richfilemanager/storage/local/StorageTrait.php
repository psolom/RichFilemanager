<?php

namespace RFM\Storage\Local;

trait ModuleTrait
{
    private $name = 'local';

    /**
     * Get the Request instance.
     *
     * @return Request
     */
    public function getStorage()
    {
        app()->getStorage($this->name);
    }
}