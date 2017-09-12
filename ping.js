//-- ***** BEGIN LICENCE BLOCK *****
// -
// - The Initial Developer of the Original Code is "CoralTree Systems Ltd: http://www.coraltree.co.uk".
// - Portions created by "CoralTree Systems Ltd" are Copyright (c) 2005-2016 CoralTree Systems Ltd.
// - All Rights Reserved.
// -
// - ***** END LICENCE BLOCK *****  

//------------------------------------------------------------ 
//--  File:         ping.js              
//--  Description:  Ping websocket server for responsiveness                                        
//--  Author:       Kevin Turner                                      
//--  Date:         Oct 2016                                
//------------------------------------------------------------ 
// 
// Modification log
// ================
//  Inits  Date     Modification           
//  =====  ====     ============
// ===================================================================
var socketIOClient = require('socket.io-client');
var sailsIOClient = require('sails.io.js');

// Ensure we're in the project directory, so relative paths work as expected
// no matter where we actually run from.
process.chdir(__dirname);
 
// Obtain the Url from the command line arguments
// An example might be node shutdown.js --port 8686 --host localhost --protocol http

var protocol="http";
var host="localhost";
var port="8686";

if (process.argv.length>=2) {
    // Find protocol
    var i=process.argv.indexOf("--protocol");
    if (i>=0) {
        protocol=process.argv[i+1]
    }
    // Find host 
    var i=process.argv.indexOf("--host");
    if (i>=0) {
        host=process.argv[i+1]
    }
    // Find port
    var i=process.argv.indexOf("--port");
    if (i>=0) {
        port=process.argv[i+1]
    }
}


// Instantiate the socket client (`io`)
// (for now, you must explicitly pass in the socket.io client when using this library from Node.js)
var io = sailsIOClient(socketIOClient);
io.sails.autoConnect=false;		
io.sails.transports=['websocket','polling'];


// Set the url
var url=protocol+"://"+host+":"+port;

var opts={};
opts.useCORSRouteToGetCookie=false;
opts.forceNew=true;
if (protocol=="https") {
    opts.secure=true;
    opts.rejectUnauthorized=false;
}

console.log("Connecting to "+url+"...");
io.sails.transports=['websocket','polling'];
var connector=io.sails.connect(url,opts);


connector.on('connect', function(){
    console.log("Connected successfully to "+url);
    // Send the request to shutdown
    // Post the shutdown
    connector.get('/ping', function serverResponded (body, JWR) {
        if (body.ok) {
            console.log("Server responded as expected");
            connector.on('disconnect', function(){
                console.log("Disconnected") 
                process.exit(0)
            }); 
            connector.disconnect(); 
        }
        else {
            console.log("Unexpected response");
            connector.on('disconnect', function(){
                console.log("Disconnected") 
                process.exit(1)
            }); 
            connector.disconnect(); 
        } 
    }); 		
});



// Give up after 10 seconds regardless
setTimeout(function(){process.exit(1);  },10000)

