(function($,test){
	'use strict';
	var sTestName = 'Differently sized lists';
	$(function(){
		test.add(sTestName,testr);
	});
	function testr(e){
		e.preventDefault();

		test.log.clear();
		test.log('start:',sTestName,"\n"); // log

		// prepare DOM
		var aTenten = [], i, j;
		for (j=0;j<5;j++) {
			var a = []
				,len = Math.pow(10,j+1);
			for (i=0;i<10;i++) a.push(getList(len));
			aTenten.push(a);
		}

		var suite = new Benchmark.Suite();

		// add tests
		$.each(aTenten,function(i,list){
			suite.add('TinySort list length '+$(list[0]).find('li').length, function() {
				$(list[0]).tsort();
				list.unshift(list.pop());
			});
		});

		// add listeners
		suite
			.on('cycle', function(event) {
			  test.log(String(event.target));
			})
			.on('complete', function(e) {
				test.log('=');
				var suite = e.currentTarget
					,sort = [];
				for (var k=0,l=suite.length;k<l;k++) {
					var thisBench = suite[k]
						,thisName = thisBench.name
						,num = parseInt(thisName.match(/\d+/g).pop(),10);
					sort.push({
						name: thisName
						,hz: thisBench.hz*num
					});
				}
				sort.sort(function(a,b){
					return a.hz>b.hz?-1:(a.hz<b.hz?1:0);
				});
				_.each(sort,function(bench){
					test.log(bench.name,bench.hz);
				});
			})
			.run({ 'async': true });

		function getList(len){
			if (len===undefined) len = 100;
			var mUl = document.createElement('ul');
			while (len--) {
				var mLi = document.createElement('li');
				mLi.appendChild(document.createTextNode(1E9*Math.random()<<0));
				mUl.appendChild(mLi);
			}
			return mUl;
		}
	}
})(jQuery,test);
