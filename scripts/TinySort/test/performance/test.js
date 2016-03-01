/*global iddqd,_*/
if (window.test===undefined) window.test = (function(){
	'use strict';
	var mBody = document.body
		,createElement = iddqd.createElement
		,mList = createElement('ul')
		,mOutput = createElement('pre')
		,sOutput = ''
		,oReturn = {
			add: add
			,log: log
		}
	;
	mBody.appendChild(mList);
	mBody.appendChild(mOutput);
	//
	function add(name,fn){
		console.log('add',name); // log
		var mLi = createElement('li');
		createElement('a',null,mLi,{href:'#'},name);
		mList.appendChild(mLi);
		mLi.addEventListener('click',fn);
	}
	function log(){
		_.each(arguments,function(s){
			sOutput += s+' ';
		});
		sOutput += "\n";
		mOutput.textContent = sOutput;
		console.log.apply(console,arguments);
	}
	log.clear = function(){
		sOutput = '';
		mOutput.textContent = sOutput;
	};
	return oReturn;
})();