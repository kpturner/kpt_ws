//-- ***** BEGIN LICENCE BLOCK *****
// - Copyright (c) 2017 K P Turner Ltd   
// - All Rights Reserved.                            
// - ***** END LICENCE BLOCK *****  

//------------------------------------------------------------ 
//--  File:         logger.js               
//--  Description:  This tiny node app will perform logging for process that spawned (forked) it                  
//--  Author:       Kevin Turner                                      
//--  Date:         Sept 2017                
//------------------------------------------------------------ 
// 
// Modification log
// ================
//  Inits  Date     Modification           
//  =====  ====     ============
//
// ===================================================================

var sails;
var path = require('path');
var winston = require('winston');
var wlogger; 
var backlog = [];

function _initialise(parms) {
     
    wlogger=new winston.Logger({
	    transports: [
	                 new(winston.transports[process.env.logTransport])({
	                    level: process.env.logLevel,
	                 	filename: process.env.logFile
	                 }),
	             ],
	         })
    wlogger.log=wlogger.log; //https://github.com/balderdashy/sails/issues/2695
	
    // Override the grunt hook to do nothing and ensure we don't mess with the database
    var cfg={
        hooks: { 
            grunt:          false,
        },
        models: {
            migrate: 'safe'  
        },
        log: {
            colors: false,  // To get clean logs without prefixes or colour codings
            custom: wlogger,
        },		
    };    
     
        
    require('sails').load(cfg,function(err, sailsInstance) {
        
        if (err) {
            throw err
        }
        
        // Initialise the "sails" global
        sails=sailsInstance; 
        sails.log.debug("Logger ready");
        _.forEach(backlog,function(msg,m){
             _handleMessage(msg)	 
        }) 

    })      
    
} 


function _handleMessage(parms) {

     switch (parms.action) {
        
        // Load config
        case "initialise":
            _initialise(parms);            
            break;	
        
        // Stop server      
		case "stop":
            sails.log.debug("Logger shutting down")
			process.exit(0);			
            break;	
        
        // Log stuff      
		case "log":
            if (parms.error) {
                sails.log.error(parms.data);	
            }
            else {
                sails.log.debug(parms.data);	
            }		
            break;	
    }

}

// ----- Process events -----
  
process.on('disconnect', function() {
    // Parent is exiting
	process.exit(0);
});

 
process.on('message', function(msg) {
	 
	if (sails || (msg.action && msg.action=="initialise")) {
        _handleMessage(msg)	 
    } 
    else {
        backlog.push(msg)
    }
	 
	
}); 
 
process.on('uncaughtException', function (err) {
    try {
        // Not good practise to try anything fancy as we don't
        // know where the error happened
        var msg="app.js - uncaughtException at "+new Date().toString();
        msg+="\n"+err.message;
        msg+="\n"+err.stack; 
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