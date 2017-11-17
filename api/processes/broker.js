//-- ***** BEGIN LICENCE BLOCK *****
// - Copyright (c) 2017 K P Turner Ltd   
// - All Rights Reserved.                            
// - ***** END LICENCE BLOCK *****  

//------------------------------------------------------------ 
//--  File:         broker.js               
//--  Description:  This tiny node app will broker transactions between the main server and the listener processes.
//--                The latter blocks the event loop while waiting for data on the data queue and so we need to 
//--                use a broker to throttle data wen it arrives to prevent the main server being overwhelmed. Without
//--                this the main server can get quite slow in responding to new connection requests during busy times                  
//--  Author:       Kevin Turner                                      
//--  Date:         Sept 2017                     
//------------------------------------------------------------ 
// 
// Modification log
// ================
//  Inits  Date     Modification           
//  =====  ====     ============
//   KT  07/02/17   Using silent option so stdout delegated back to parent
// ===================================================================

var path = require("path"); 
var emitterInterval;
var listener;
var listenerId;
var queue=[];
var emitterInterval;
var emitFrequency=500;
var dieTimer;

emitter = function(){
	// Pull one item from the queue and send it to the parent
	try {			
		if (queue.length>0) {
			var eventObj=queue.shift();
			process.send(eventObj);	
		}		
	}
	catch(e) {
		try {
			//process.send({listenerId:listenerId,data:"*LOG:Error sending event: "+e.message});
			console.error(e)
		}
		catch(e){
			//Meh!
		}							
	}
}


process.on('disconnect', function() {
	// Parent is exiting
	process.exit(0);
});

// Trap request to die
process.on("SIGINT",function(){
	//process.send({data:"*LOG:Broker received SIGINT"});
	if (emitterInterval) {
		clearInterval(emitterInterval);
	}
	if (listener) {
		process.send({data:"*LOG:Broker is shutting down listener for "+listenerId});
		listener.on("exit",function(){	
			process.send({data:"*LOG:Listener "+listenerId+ " has shutdown"});
			clearTimeout(dieTimer);
			process.exit(0)
		})
		listener.kill("SIGINT");	
		// Die anyway if we don't hear back
		dieTimer=setTimeout(function(){
			process.send({data:"*LOG:Shutting down broker for "+listenerId?listenerId:"null"});
			process.exit(0);
		},35000);
	}
	else {
		process.send({data:"*LOG:Shutting down broker for "+listenerId?listenerId:"null"});
		process.exit(0)
	}	
})


// When we get some data, start listening to the queue
process.on('message', function(parms) { 
		
	listenerId=parms.listenerId;
	
	if (parms.action=='*LISTEN') {

		if (parms.emitFrequency) {
			emitFrequency=parms.emitFrequency;
		}

		// Start the listener
		listener = require("child_process").fork(path.join(path.dirname(__dirname),"processes","listener"),{silent:true});			 

		// Add event traps for the listener
		listener.on("message",function(eventObj){
			// In most cases we will send the message back to the main server, unless it is an event to emit.
			// These we will throttle
			//if (typeof eventObj.data=="string" && eventObj.data.indexOf("*LOG:")==0) {
			//	process.send(eventObj);			
			//}
			if (typeof eventObj.data=="string" && eventObj.data.indexOf("*CHK:")==0) {
				process.send(eventObj);		
			}	
			else {
				// Queue up the transactions
				queue.push(eventObj);

				// Start the emitter if required
				if (!emitterInterval) {
					emitterInterval=setInterval(emitter,emitFrequency);
					process.send({data:"*LOG:Emitter started for "+listenerId});	
				}

			}
			
		})

		// Handle standard output
		listener.stdout.on('data', function(data){
			var d=(typeof data=="string")?data:data.toString();
			Utility.log(d);
		});
		listener.stdout.on('error', function(data){	
			var d=(data instanceof Error)?data:(typeof data=="string")?data:data.toString();		            
			Utility.log(d,true);
		});
		listener.stderr.on('error', function(data){
			var d=(data instanceof Error)?data:(typeof data=="string")?data:data.toString();	
			Utility.log(d,true);
		});
		listener.stdout.on('end', function(){
			//Utility.log("stdout ended for child");
		});
		// Detect it closing
		listener.on("close", function(code, signal){
			// The "exit" event will cater for this					 
		})
		
		// Detect it exiting
		listener.on("exit", function(code, signal){
			process.exit(0)
		})

	}
	
	// Delegate everything to the listener now
	listener.send(parms);
	 
	
});

