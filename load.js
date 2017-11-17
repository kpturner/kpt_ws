//-- ***** BEGIN LICENCE BLOCK *****
// -
// - The Initial Developer of the Original Code is "CoralTree Systems Ltd: http://www.coraltree.co.uk".
// - Portions created by "CoralTree Systems Ltd" are Copyright (c) 2005-2016 CoralTree Systems Ltd.
// - All Rights Reserved.
// -
// - ***** END LICENCE BLOCK *****  

//------------------------------------------------------------ 
//--  File:         load.js                   
//--  Description:  When running this function will add a new connection to the server at a rate of 1 per 100ms                                        
//--  Author:       Kevin Turner                                      
//--  Date:         Sept 2017                           
//------------------------------------------------------------ 
// 
// Modification log
// ================
//  Inits  Date     Modification           
//  =====  ====     ============
//    KT  03/01/16  Make sure we disconnect nicely when ending 
// ===================================================================
var socketIOClient = require('socket.io-client');
var sailsIOClient = require('sails.io.js');
var io = sailsIOClient(socketIOClient);
var path = require('path');
var count = 0;
var conns = 0;
var total = 6000;
var sockets = [];

// Ensure we're in the project directory, so relative paths work as expected
// no matter where we actually run from.
process.chdir(__dirname);
 
// Obtain the Url from the command line arguments
// An example might be node load.js --port 8686 --host localhost --protocol http

var protocol="http";
var host="localhost";
var port="8686";
var conns=0;

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
    // Find connection count 
    var i=process.argv.indexOf("--total");
    if (i>=0) {
        total=process.argv[i+1]
    }
}

console.log("Starting "+total+" connections");
process.env.protocol=protocol;
process.env.host=host;
process.env.port=port;

launch();

function launch() {
    count++;
    if (count<total) {
        setTimeout(launch,100)
    }
   
    connectToServer();

}


function connectToServer() {
    // Obtain the Url from the command line arguments
    // An example might be node shutdown.js --port 8686 --host localhost --protocol http
    var protocol=process.env.protocol?process.env.protocol:"http";
    var host=process.env.host?process.env.host:"localhost";
    var port=process.env.port?process.env.port:"8686";

    // Instantiate the socket client (`io`)
    // (for now, you must explicitly pass in the socket.io client when using this library from Node.js)    
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

    console.log(count+" connecting to "+url+"...");
    var connector=io.sails.connect(url,opts);


    connector.on('connect', function(){
        sockets.push(connector);
        conns++;
        console.log(conns+" connected successfully to "+url);
      
        //if (conns==1) {
            connector.post('/listener/dummy/subscribe', function serverResponded (body, JWR) {
            
            }); 		
        //}
        
    });

    connector.on('disconnect', function(){        
        console.log("Socket disconnected successfully from "+url);
        sockets.splice(sockets.indexOf(connector),1);
        conns--;       
    });

 
}

process.on("SIGINT",function(){
    console.log("Terminating...");
    try {
    	sockets.forEach(function(connector){
            connector.disconnect();
        })
    }
    catch(e) {
    	// Meh!
    }
    process.exit(0);
})

process.on('uncaughtException', function (err) {
    try {
        // Not good practise to try anything fancy as we don't
        // know where the error happened
        var msg="app.js - uncaughtException at "+new Date().toString();
        msg+="</br>"+err.message;
        msg+="</br>"+err.stack; 
        //if (sails) {
        //    sails.log.error(msg);      
        //    Utility.shutdown();
        //}
        //else {
            console.log(msg);
            process.exit(1);  
        //}
    }
    catch(e) {
        //if (sails) {
        //    sails.log.error("Error handling uncaught exception");
        //    sails.log.error(e);            
        //}
        //else {
            console.log("Error handling uncaught exception");
            console.log(e);  
        //}
        process.exit(1);  
    }
})  