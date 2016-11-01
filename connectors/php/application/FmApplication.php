<?php
require_once('Logger.php');
//require_once('Request.php');
require_once('FmHelper.php');

class FmApplication {
    /**
     * @var Logger
     */
    public $logger;
    /**
     * @var Request
     */
    public $request;

    public function __construct()
    {
        $this->logger = new Logger();
    }

    public function getInstance($custom_config = array())
    {
        $base_config = require_once(FM_ROOT_PATH . '/config.php');
        $configuration = FmHelper::mergeConfigs($base_config, $custom_config);

        if (isset($configuration['plugin']) && !empty($configuration['plugin'])) {
            $plugin_name = $configuration['plugin'];
            $plugin_path = FM_ROOT_PATH . "/plugins/{$plugin_name}/";
            $class_name = ucfirst($plugin_name) . 'Filemanager';
            require_once($plugin_path . $class_name . '.php');
            $plugin_config = require_once($plugin_path . 'config.php');
            $configuration = FmHelper::mergeConfigs($base_config, $plugin_config, $custom_config);
            $fm = new $class_name($configuration);
        } else {
            require_once(FM_ROOT_PATH . '/LocalFilemanager.php');
            $fm = new LocalFilemanager($configuration);
        }

        if (isset($configuration['logger']) && $configuration['logger']['enabled'] == true ) {
            $this->logger->enabled = true;
        }

        if(!auth()) {
            $fm->error($fm->lang('AUTHORIZATION_REQUIRED'));
        }

        return $fm;
    }
}