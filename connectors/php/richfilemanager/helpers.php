<?php

use Illuminate\Container\Container;

if (! function_exists('app')) {
    /**
     * Get the available container instance.
     *
     * @param  string  $make
     * @param  array   $parameters
     * @return mixed|RFM\Application
     */
    function app($make = null, $parameters = [])
    {
        if (is_null($make)) {
            return Container::getInstance();
        }

        return Container::getInstance()->make($make, $parameters);
    }
}

if (! function_exists('config')) {
    /**
     * Get / set the specified configuration value.
     *
     * If an array is passed as the key, we will assume you want to set an array of values.
     *
     * @param  array|string  $key
     * @param  mixed  $default
     * @return mixed
     */
    function config($key = null, $default = null)
    {
        if (is_null($key)) {
            return app('config');
        }

        if (is_array($key)) {
            return app('config')->set($key);
        }

        return app('config')->get($key, $default);
    }
}

if (! function_exists('request')) {
    /**
     * Return request singleton instance
     *
     * @return \Symfony\Component\HttpFoundation\Request;
     */
    function request()
    {
        return app('request');
    }
}

if (! function_exists('logger')) {
    /**
     * Return logger singleton instance
     *
     * @return \RFM\Logger
     */
    function logger()
    {
        return app('logger');
    }
}