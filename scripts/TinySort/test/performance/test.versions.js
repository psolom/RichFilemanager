/*global test, iddqd, Benchmark, Promise*/
(function(test){
	'use strict';

	var loadScript = iddqd.pattern.callbackToPromise(iddqd.loadScript)
		,createElement = iddqd.createElement
		,aCompare = []
		,sTest = 'Difference with latest version'
		,wait = function(){
				return new Promise(function(fullfill){
					setTimeout(fullfill,40);
				});
			}
	;

	test.add(sTest,function(){
		aCompare.length = 0;
		wait()
			.then(loadScript('jquery.tinysort.1.5.4.js'))
			.then(versionLoaded.bind(null,true))
			.then(loadScript('../../src/tinysort.js'))
			.then(wait)
			.then(versionLoaded.bind(null,false))
			.then(startTest)
			.catch(function(){
				console.log('reject',arguments); // log
			})
		;
	});

	function versionLoaded(isJquery){
		console.log('versionLoaded',Date.now(),isJquery
			,'\n\t',isJquery?jQuery.tinysort.version:tinysort.version
			,'\n\t',!!(isJquery?jQuery.fn.tsort:tinysort)
		); // log
		aCompare.push({
			version: isJquery?jQuery.tinysort.version:tinysort.version
			,fn: isJquery?jQuery.fn.tsort:tinysort
			,isJquery: !!isJquery
		});
	}

	function getList(len){
		if (len===undefined) len = 100;
		var mUl = createElement('ul');
		while (len--) createElement('li',null,mUl,null,1E9*Math.random()<<0);
		return mUl;
	}

	function startTest(){
		test.log.clear();
		test.log('start:',sTest,"\n"); // log
		// prepare DOM
		var a100 = [], a1000 = [], i = 10;
		while (i--){
			a100.push(getList(100));
			a1000.push(getList(1000));
		}

		var suite = new Benchmark.Suite();

		// add tests
		aCompare.forEach(function(compare){
			console.log('compare',compare,{a:a1000[0]}); // log
			suite.add('TinySort '+compare.version, function(a){
				if (compare.isJquery)	compare.fn.call(jQuery(a1000[0]).find('li'));
				else					compare.fn(a1000[0].querySelectorAll('li'));
				a1000.unshift(a1000.pop());
			});
		});

		// add listeners
		suite
			.on('cycle',handleSuiteCycle)
			.on('complete',handleSuiteComplete)
			.run({ 'async': true });
	}

	function handleSuiteCycle(e) {
		console.log('handleSuiteCycle',e); // log
		test.log(String(e.target));
	}

	function handleSuiteComplete(e) {
		console.log('handleSuiteComplete',e); // log
		var oSuite = e.currentTarget;
		test.log('=');
		test.log('Fastest is ' + oSuite.filter('fastest').pluck('name'));
//		test.log('Fastest is ' + this.filter('fastest').pluck('name'));
//		console.log('t1/t2',t1.stats.mean/t2.stats.mean); // log
	}

})(test);
