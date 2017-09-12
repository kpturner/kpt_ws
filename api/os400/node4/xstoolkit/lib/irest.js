// IBM_PROLOG_BEGIN_TAG 
// This is an automatically generated prolog. 
//  
// istoredp.js
//  
// Licensed Materials - Property of IBM 
//  
// (C) COPYRIGHT International Business Machines Corp. 2014,2014 
// All Rights Reserved 
//  
// US Government Users Restricted Rights - Use, duplication or 
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp. 
//
// RESTful interface for XML Service Toolkit
//
//
// IBM_PROLOG_END_TAG 

var http = require('http');
var iRestHttp = function(callback,xhost,xport,xpath,xdatabase,xuser,xpassword,xipc,xctl,xml_input_script,xml_output_max_size) {
  var xml_out = "";
  var xml_enc = encodeURI("db2=" + xdatabase
        + "&uid=" + xuser
        + "&pwd=" + xpassword
        + "&ipc=" + xipc
        + "&ctl=" + xctl
        + "&xmlin=" + xml_input_script
        + "&xmlout=" + xml_output_max_size);
  // myibmi/cgi-bin/xmlcgi.pgm?xml
  var options = {
    host: xhost,
	port: xport,
    path: xpath + '?' + xml_enc
  };
  var httpCallback = function(response) {
    var str = '';
    //another chunk of data has been received, so append it to `str`
    response.on('data', function (chunk) {
      str += chunk;
    });
    //the whole response has been received, so return
    response.on('end', function () {
      callback(str);
    });
  }
  // make the call
  var req = http.request(options, httpCallback).end();
}

exports.iRestHttp = iRestHttp;