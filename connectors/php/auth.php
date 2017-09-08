<?php

// This valud is used to verify authenticity of requests, e.g. Only Office editor callbacks
// Use a unique random hash
define('RFM_SECRET', '123456');

// This function is called for every server connection. It must return true.
//
// Implement this function to authenticate the user, for example to check a
// password login, or restrict client IP address.
//
// This function only authorizes the user to connect and/or load the initial page.
// Authorization for individual files or dirs is provided by the two functions below.
//
// NOTE: If using session variables, the session must be started first (session_start()).
function fm_authenticate() {
	// Customize this code as desired.
	return true;

	// If this function returns false, the user will just see an error.
	// If this function returns an array with "redirect" key, the user will be redirected to the specified URL:
	// return ['redirect' => 'http://domain.my/login'];
}


// This function is called before any filesystem read operation, where
// $filepath is the file or directory being read. It must return true,
// otherwise the read operation will be denied.
//
// Implement this function to do custom individual-file permission checks, such as
// user/group authorization from a database, or session variables, or any other custom logic.
//
// Note that this is not the only permissions check that must pass. The read operation
// must also pass:
//   * Filesystem permissions (if any), e.g. POSIX `rwx` permissions on Linux
//   * The $filepath must be allowed according to config['patterns'] and config['extensions']
//
function fm_has_read_permission($filepath) {
	// Customize this code as desired.
	return true;
}


// This function is called before any filesystem write operation, where
// $filepath is the file or directory being written to. It must return true,
// otherwise the write operation will be denied.
//
// Implement this function to do custom individual-file permission checks, such as
// user/group authorization from a database, or session variables, or any other custom logic.
//
// Note that this is not the only permissions check that must pass. The write operation
// must also pass:
//   * Filesystem permissions (if any), e.g. POSIX `rwx` permissions on Linux
//   * The $filepath must be allowed according to config['patterns'] and config['extensions']
//   * config['read_only'] must be set to false, otherwise all writes are disabled
//
function fm_has_write_permission($filepath) {
	// Customize this code as desired.
	return true;
}

/**
 * Generate a URL encoded HMAC token for a mixed set of data
 *
 * @param mixed $data Data to tokenize
 *
 * @return string
 */
function fm_generate_hmac_token($data = null) {
	if (!is_string($data)) {
		$data = serialize($data);
	}

	$bytes = hash_hmac('sha256', $data, RFM_SECRET, true);

	$bytes = base64_encode($bytes);
	$bytes = rtrim($bytes, '=');

	return strtr($bytes, '+/', '-_');
}

/**
 * Validate HMAC token against a data set
 *
 * @param string $token Token to validate
 * @param mixed  $data  Data to tokenize
 *
 * @return bool
 */
function fm_validate_hmac_token($token, $data = null) {

	$expected_token = fm_generate_hmac_token($data);

	$str1 = $token;
	$str2 = $expected_token;

	// Compare strings in constant time
	// Based on password_verify in PasswordCompat
	// @author Anthony Ferrara <ircmaxell@php.net>
	// @license http://www.opensource.org/licenses/mit-license.html MIT License
	// @copyright 2012 The Authors

	$len1 = strlen($str1);
	$len2 = strlen($str2);
	if ($len1 !== $len2) {
		return false;
	}

	$status = 0;
	for ($i = 0; $i < $len1; $i++) {
		$status |= (ord($str1[$i]) ^ ord($str2[$i]));
	}

	return $status === 0;
}