<?php

namespace filemanager;

require_once(__DIR__ . '/../plugins/s3/S3Filemanager.php');

/**
 *  Local class
 *  A wrapper designed to be used in frameworks which follow PSR standards
 *  and require that class must be under a namespace to resolve it path.
 *  Initially created for Yii2 that uses PSR-4 standard.
 *
 *	@license	MIT License
 *	@author		Pavel Solomienko <https://github.com/servocoder/>
 *	@copyright	Authors
 */
class S3 extends \S3Filemanager {
}