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

    public function getInstance($customConfig = array())
    {
        $config = require_once(FM_ROOT_PATH . '/config.php');
        $config = FmHelper::mergeConfigs($config, $customConfig);

        if (isset($config['logger']) && $config['logger']['enabled'] == true ) {
            $this->logger->enabled = true;
        }

        if (isset($config['plugin']) && !empty($config['plugin'])) {
            $pluginName = $config['plugin'];
            $pluginPath = FM_ROOT_PATH . "/plugins/{$pluginName}/";
            $className = ucfirst($pluginName) . 'Filemanager';
            require_once($pluginPath . $className . '.php');
            $pluginConfig = require_once($pluginPath . 'config.php');
            $config = FmHelper::mergeConfigs($config, $pluginConfig);
            $fm = new $className($config);
        } else {
            require_once(FM_ROOT_PATH . '/LocalFilemanager.php');
            $fm = new LocalFilemanager($config);
        }

        if(!auth()) {
            $fm->error($fm->lang('AUTHORIZATION_REQUIRED'));
        }

        return $fm;
    }
}