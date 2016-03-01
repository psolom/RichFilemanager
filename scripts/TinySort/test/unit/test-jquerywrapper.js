/* global QUnit, zenLi */
(function(){
	'use strict';

	var test = QUnit.test
		,module = QUnit.module
		,ok = QUnit.ok
		,assert = QUnit.assert
		,async = assert.async
		,aList = ['eek-','oif-','myr-','aar-','oac-','eax-']
		,sJoin = aList.slice(0).sort().join('')
	;

	module('jquery plugin wrapper');

	test('jquery plugin wrapper', function() {
		var done = async();
		/*global requirejs*/
		require.config({
			baseUrl: '../../src/'
			,paths: {
				"jquery": "../vendor/jquery/dist/jquery.min"
			}
		});
		requirejs(['jquery','tinysort','jquery.tinysort'],function($,tinysort){
			ok(!!$.fn.tinysort,'$.fn.tinysort exists');
			ok(!!$.fn.tsort,'tsort alias exists');
			ok((function(){
				var aNodeList = zenLi('ul>li{a$}*6',{a:aList})
					,$NodeList = $(aNodeList);
				return !!$NodeList.tsort;
			})(),'tsort exists on selection');
			ok( (function(){
				var aNodeList = zenLi('ul>li{a$}*6',{a:aList})
					,$NodeList = $(aNodeList)
					,aSorted = $NodeList.tsort()
					,sSorted = '';
				aSorted.each(function(i,elm){
					sSorted += elm.textContent;
				});
				return sSorted===sJoin;
			})(),'basic sort');
			done();
		});
	});
})();