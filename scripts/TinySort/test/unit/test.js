/*global QUnit, Promise, zen*/
(function(){
	'use strict';

	var loadScriptPromised = callbackToPromise(loadScript)
		,loadPromise;

	// config qUnit
	QUnit.config.hidepassed = true;
	QUnit.config.autostart = false;

	// global test methods
	window.zenLi = function zenLi(){
		return zen.apply(zen,arguments).pop().querySelectorAll('li');
	};

	window.eachElement = function eachElement(nodeList,fn){
		var s = '';
		if (fn===undefined) fn = function(elm){ return elm.textContent; };
		nodeList.forEach(function(elm){ s += fn(elm); });
		return s;
	};

	// load test scripts
	[
		'../../src/tinysort.js'
		,'../../src/tinysort.charorder.js'
		,'../../vendor/requirejs/require.js'
		,'test-api.js'
		,'test-regression.js'
		,'test-charorder.js'
		,'test-jquerywrapper.js'
	].forEach(function(script){
		loadPromise = loadPromise?loadPromise.then(loadScriptPromised.bind(null,script,null)):loadScriptPromised(script);
	});
	loadPromise&&loadPromise.then(function(){
		QUnit.start();
	});

	/**
	 * Load javascript file
	 * @name loadScript
	 * @method
	 * @param {String} src The source location of the file.
	 * @param {Function} [loadCallback=null] A callback function for when the file is loaded.
	 */
	function loadScript(src,loadCallback,errorCallback) {
		var mScript = document.createElement('script');
		mScript.src = src;
		if (loadCallback) mScript.addEventListener('load',loadCallback);
		if (errorCallback) mScript.addEventListener('error',errorCallback);
		(document.head||document.getElementsByTagName('head')[0]).appendChild(mScript);
	}

	/**
	 * Turn a regular callback method into a promise.
	 * The method must be of type function(param1,param2,...,successCallback,errorCallback)
	 * @param {Function} fn The function to convert
	 * @param {number} [success=1] The position of the callback argument
	 * @param {number} [error=2] The position of the error argument
	 * @returns {Function}
	 */
	function callbackToPromise(fn,success,error){
		if (success===undefined) success = 1;
		if (error===undefined) error = 2;
		return function(){
			var arg = Array.prototype.slice.call(arguments,0);
			return new Promise(function(resolve,reject){
				if (!arg[success]) arg[success] = resolve;
				if (!arg[error]) arg[error] = reject;
				fn.apply(fn,arg);
			});
		};
	}

})();