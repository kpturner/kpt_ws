// IBM_PROLOG_BEGIN_TAG 
// This is an automatically generated prolog. 
//  
// idataq.js
//  
// Licensed Materials - Property of IBM 
//  
// (C) COPYRIGHT International Business Machines Corp. 2014,2014 
// All Rights Reserved 
//  
// US Government Users Restricted Rights - Use, duplication or 
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp. 
//
// Data Queue interface for XML Service Toolkit
//
//
// IBM_PROLOG_END_TAG 

var xt = require('./itoolkit');
var timeoutMsg = "Timeout!";
var retryInterval = 100;  // wait 0.1 second to retry to get result in sync mode.
var retryTimes = Math.round(xt.timeout / retryInterval); 

function iDataQueue(conn) {
	this.conn = conn;  //Pass in the connection object.
	this.errno = [
		[0, "10i0"],
		[0, "10i0", {"setlen":"rec2"}],
		["", "7A"],
		["", "1A"]
	];
}

iDataQueue.prototype.sendToDataQueue = function(name, lib, data, cb) {
	var pgm = new xt.iPgm("QSNDDTAQ", {"lib":"QSYS"});
	pgm.addParam(name, "10A");
	pgm.addParam(lib == ""?"*CURLIB":lib, "10A");
	pgm.addParam(data.length, "5p0");
	pgm.addParam(data, data.length + "A");

	this.conn.add(pgm.toXML());
	var async = cb && xt.getClass(cb) == "Function"; //If there is a callback function param, then it is in asynchronized mode.
	var rtValue;  // The returned value.
	var stop = 0;  // A flag indicating whether the process is finished.
	var retry = 0;  // How many times we have retried.
	function toJson(str) {  // Convert the XML output into JSON
		var output = xt.xmlToJson(str);
		if(output[0].hasOwnProperty("success") && output[0].success == true)
			rtValue = true;
		else
			rtValue = str;
		if(async)	// If it is in asynchronized mode.
			cb(rtValue);  // Run the call back function against the returned value.
		stop = 1;
	}
	function waitForResult() {
		retry++;
		if(stop == 0)
			setTimeout(waitForResult, retryInterval);  // Check whether the result is retrieved
		else if(retry >= retryTimes)
			return timeoutMsg;
		else
			return rtValue;
	}
	this.conn.run(toJson, !async);  // Post the input XML and get the response.
	if(!async)  // If it is in synchronized mode.
		return waitForResult();  // Run the user defined call back function against the returned value.
}

iDataQueue.prototype.receiveFromDataQueue = function(name, lib, length, cb) {
	var pgm = new xt.iPgm("QRCVDTAQ", {"lib":"QSYS"});
	pgm.addParam(name, "10A");
	pgm.addParam(lib == ""?"*CURLIB":lib, "10A");
	pgm.addParam(length, "5p0");
	pgm.addParam("", length + 1 + "A");
	pgm.addParam(0, "5p0");

	this.conn.add(pgm.toXML());
	var async = cb && xt.getClass(cb) == "Function"; //If there is a callback function param, then it is in asynchronized mode.
	var rtValue;  // The returned value.
	var stop = 0;  // A flag indicating whether the process is finished.
	var retry = 0;  // How many times we have retried.
	function toJson(str) {  // Convert the XML output into JSON
		var output = xt.xmlToJson(str);
		if(output[0].hasOwnProperty("success") && output[0].success == true)
			rtValue = output[0].data[3].value;
		else
			rtValue = str;
		if(async)	// If it is in asynchronized mode.
			cb(rtValue);  // Run the call back function against the returned value.
		stop = 1;
	}
	function waitForResult() {
		retry++;
		if(stop == 0)
			setTimeout(waitForResult, retryInterval);  // Check whether the result is retrieved
		else if(retry >= retryTimes)
			return timeoutMsg;
		else
			return rtValue;
	}
	this.conn.run(toJson, !async);  // Post the input XML and get the response.
	if(!async)  // If it is in synchronized mode.
		return waitForResult();  // Run the user defined call back function against the returned value.
}

iDataQueue.prototype.clearDataQueue= function(name, lib, cb) {
	var pgm = new xt.iPgm("QCLRDTAQ", {"lib":"QSYS"});
	pgm.addParam(name, "10A");
	pgm.addParam(lib == ""?"*CURLIB":lib, "10A");
	
	this.conn.add(pgm.toXML());
	var async = cb && xt.getClass(cb) == "Function"; //If there is a callback function param, then it is in asynchronized mode.
	var rtValue;  // The returned value.
	var stop = 0;  // A flag indicating whether the process is finished.
	var retry = 0;  // How many times we have retried.
	function toJson(str) {  // Convert the XML output into JSON
		var output = xt.xmlToJson(str);
		if(output[0].hasOwnProperty("success") && output[0].success == true)
			rtValue = true;
		else
			rtValue = str;
    if(async)	// If it is in asynchronized mode.
			cb(rtValue);  // Run the call back function against the returned value.
		stop = 1;
	}
	function waitForResult() {
		retry++;
		if(stop == 0)
			setTimeout(waitForResult, retryInterval);  // Check whether the result is retrieved
		else if(retry >= retryTimes)
			return timeoutMsg;
		else
			return rtValue;
	}
	this.conn.run(toJson, !async);  // Post the input XML and get the response.
	if(!async)  // If it is in synchronized mode.
		return waitForResult();  // Run the user defined call back function against the returned value.
}

exports.iDataQueue = iDataQueue;