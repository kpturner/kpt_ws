//-- ***** BEGIN LICENCE BLOCK *****
// - Copyright (c) 2017 K P Turner Ltd   
// - All Rights Reserved.                            
// - ***** END LICENCE BLOCK *****  

//------------------------------------------------------------ 
//--  File:         listener.js               
//--  Description:  This tiny node app will listen for entries on a queue and pass them to the process that spawned (forked) it                  
//--  Author:       Kevin Turner                                      
//--  Date:         Sept 2017                      
//------------------------------------------------------------ 
// 
// Modification log
// ================
//  Inits  Date     Modification           
//  =====  ====     ============
//    KT 17/10/16   Cater for the fact that we may get a JSON in the data that contains the real feed id and data 
//                  in the case of a consolidated feed being used 
//    KT 28/12/16   Softcoded location for IBM toolkits
//    KT 30/12/16   Can now run from any platform
//    KT 02/02/17   Use DtaQ service for data queue activity
//    KT 07/02/17   Started with silent=true so just use console.log etc and allow parent to deal with the data
//    KT 26/04/17   The listener may have to respect a TTL in milliseconds and end at that point (it gets automatically restarted - useful if the IBM code leaks memory)
// ===================================================================

var DtaQ=require(require("path").join("..","services","DtaQ"));    
var listenerId, logger;
var sslServerRunning=false;
var processing=false;
var startedTS; 


process.on('disconnect', function() {
	// Parent is exiting
	process.exit(0);
});

// When we get some data, start listening to the queue
process.on('message', function(parms) { 
		
		 
	switch(parms.action) {
	case "*LISTEN":

		if (!parms.dtaq) {
			//process.send({listenerId:parms.listenerId,data:"*LOG: ERROR - INVALID PARMS parms: '"+JSON.stringify(parms)+"'"});
			console.error("ERROR - INVALID PARMS parms: '"+JSON.stringify(parms)+"'")
			return
		}
		
		// Set up toolkit for data queue access
		var cfg=parms.conn;
		if (parms.dbname) {
			cfg.dbname=parms.dbname;
		} 
		DtaQ.initialise(parms.idataq,parms.itoolkit,cfg)
		
		listenerId=parms.listenerId;
		
		var ttl=parms.ttl;    
		var ssl = parms.ssl;
		var dtaqN = parms.dtaq;
		var lib = parms.dtaqlib;	
		var wait=parms.wait;
		var lastLog=null;
		var omitFlush=parms.omitflush;	
		var key=listenerId;
		// Pad key to 60
		while (key.length<60)
			key+=" "
		
		console.log("Listening to queue "+lib+"/"+dtaqN+"...");


		// Flush the queue before we start listening. We don't want to get influenced by old information
    	// The browser may tell us not to do this if it is retrying a failed or timed out listener.
    	if (!omitFlush) { 
    		// Flush the queue
    		//process.send({listenerId:listenerId,data:"*LOG:Flushing "+listenerId+" data...."});
			console.log("Flushing "+listenerId+" data....");
			DtaQ.receiveFromKeyedDataQueue(dtaqN, lib, 64512, 0, 'EQ', key.length, key, flushcb);			
    	}		 
		
		// Initialise time we started
		startedTS=new Date().getTime();

		// Listen for data to kick the loop off
		DtaQ.receiveFromKeyedDataQueue(dtaqN, lib, 64512, wait, 'EQ', key.length, key, processData);	
		
		break;
	
		
	}

	/**
	 * Flush the queue
	 */
	function flushcb(str){
		if (str && str.length>0) {
			if (str.indexOf("<errnoxml>")<0) {
				//process.send({listenerId:listenerId,data:"*LOG:Flushed '"+str+"' from "+listenerId});
				console.log("Flushed '"+str+"' from "+listenerId);
				DtaQ.receiveFromKeyedDataQueue(dtaqN, lib, 64512, 0, 'EQ', key.length, key, flushcb);  
			}
			else {
				//process.send({listenerId:listenerId,data:"*LOG:Error '"+str+"'"});
				console.error(listenerId+" Error '"+str+"'");
			}
		}
		else {
			//process.send({listenerId:listenerId,data:"*LOG:Queue flushed for "+listenerId});
			console.log("Queue flushed for "+listenerId);
		}
	}
	
	/**
	 * Process data from data queue
	 */
	function processData(str) {
		processing=true;
				 
		try {
			if (str) {
				// Pass results back to parent process
				//process.send({listenerId:listenerId,data:"*LOG:"+listenerId+" received '"+str+"'"});
				//console.log(listenerId+" received '"+str+"'");
				if (str=="*STOP") {
					//process.send({listenerId:listenerId,data:"*LOG:"+listenerId+" stopping after receiving "+str}); 
					console.log(listenerId+" stopping after receiving "+str);
					process.exit(0);
				}
				if (str.indexOf("<errnoxml>")>0) { 
					process.exit(1);
				}

				// It is possible that we could have a consolidated feed entry on the queue. In this case
				// it will be a JSON with two properties: "key" and "data"
				var eventObj={};
				try {
					var consolidated=JSON.parse(str);
					if (consolidated.key && consolidated.data) {
						eventObj.data=consolidated.data.replace(RegExp('&#34;','g'),'"');
						eventObj.feedId=consolidated.key;
					}
					else {
						// Not a consolidated feed
						eventObj.data=str;
						eventObj.feedId=listenerId;
					}
				}
				catch(e) {
					// Not a consolidated feed
					eventObj.data=str;
					eventObj.feedId=listenerId;
				}				
				
				// Send the event
				process.send(eventObj);	
				
				// If we are not the SSL server, and there is one running, queue the message up for the SSL server
				// to pick up also
				// No longer necessary as the SSL queue is fed directly from LS_TriggerEvent
				//if (!ssl && sslServerRunning) {
				//	//console.log("Sending to SSL...");
				//	sslQueue.push(eventObj)					
				//}
			}	
			else {
				// Didn't receive anything.  Check if we need to stop (no more listeners)
				process.send({listenerId:listenerId,data:"*CHK:"});
			}
		}
		catch(e) { 
			process.send({listenerId:listenerId,data:e});
		}
		processing=false;

		// Calculate age if listener if we have a TTL
		if (ttl && !isNaN(ttl)) {
			if (new Date().getTime()-startedTS > ttl) {
				console.log("Listener "+listenerId+" shutting down after exceeding TTL of "+ttl);
				process.exit();
			}
		}

		// Listen for data
		if (!lastLog || (new Date().getTime()-lastLog>(parms.wait*5000))) {
			//process.send({listenerId:listenerId,data:"*LOG:Listening for "+listenerId+" data...."});
			console.log("Listening for "+listenerId+" data....");	
			lastLog=new Date().getTime();
		}				
			
		DtaQ.receiveFromKeyedDataQueue(dtaqN, lib, 64512, wait, 'EQ', key.length, key, processData);


	} 
	
	
});

