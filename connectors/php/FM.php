<?php

namespace filemanager;

require_once('filemanager.class.php');

/**
 *  FM class
 *  A wrapper designed to be used in frameworks which follow PSR standards
 *  and require that class must be under a namespace to resolve it path.
 *  Initially created for Yii2 framework that uses PSR-4 standard.
 *
 *	@license	MIT License
 *	@author		Riaan Los <mail (at) riaanlos (dot) nl>
 *	@author		Simon Georget <simon (at) linea21 (dot) com>
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */
class FM extends \Filemanager {
}