//-- ***** BEGIN LICENCE BLOCK *****
// - Copyright (c) 2005-2016 CoralTree Systems Ltd.    
// - All Rights Reserved.                            
// - ***** END LICENCE BLOCK *****  

//------------------------------------------------------------ 
//--  File:         dashboard.js               
//--  Description:  This tiny node app will deal with dashboard updates. It is forked from the main process                  
//--  Author:       Kevin Turner                                      
//--  Date:         Sept 2015                          
//------------------------------------------------------------ 
// 
// Modification log
// ================
//  Inits  Date     Modification           
//  =====  ====     ============
//    KT 07/02/17   Started with silent=true so just use console.log etc and allow parent to deal with the data
// ===================================================================

var socketIds=[];
var remotes=[];
var remoteSockets=[];
var disconnectCount=0;

 
process.on('disconnect', function() {
	// Parent is exiting
	process.exit(0);
});

process.on('message', function(parms) {
	
	switch(parms.action) {
	case "*STOP":
		process.exit(0);
		break;
	case "*REGISTER":
		process.nextTick(function(){
			registerSocket(parms.socketId,parms.remoteAddress)
		});
		break;
	case "*DEREGISTER":
		process.nextTick(function(){
			deRegisterSocket(parms.socketId)
		});
		break;
	case "*BROADCAST":
		process.nextTick(function(){
			broadcast();
		})		
		break;
	}	
	
});


/**
 * Broadcast stats
 */
broadcast=function(){
	var broadcast={};
	broadcast.action="*BROADCAST";
	broadcast.data={};
	broadcast.data.totalRemotes=remotes.length;
	broadcast.data.totalSockets=socketIds.length;
	process.send(broadcast);	
}

/**
 * Register socket
 */
registerSocket=function(socketId,remoteAddress) {
	var remoteSockets;
	var i;
	if (socketIds.indexOf(socketId)<0) {
		socketIds.push(socketId);
	}
	
	// Is there a remote remote already registered for this IP address
	var rc=-1
	remotes.forEach(function(c,i){
		if (c.ip==remoteAddress) {
			rc=i;
			return false;
		}
	})
	if (rc>=0) {
		//process.send({action:"*LOG",data:remoteAddress + " already registered"});
		c=remotes[rc];
		if (c.sockets.indexOf(socketId)<0) {
			c.sockets.push(socketId);
		}	
	}
	else {
		//process.send({action:"*LOG",data:"Registering " + remoteAddress});
		var c={};
		c.ip=remoteAddress;
		c.sockets=[socketId];
		remotes.push(c)
	}
	
}

/**
 * De-Register socket
 */
deRegisterSocket=function(socketId) {
	//console.log("Disconnecting " + socketId );
	disconnectCount++;
	var i=socketIds.indexOf(socketId);
	if (i>=0) {
		
		// Remove from remote address register if need be
		var s=-1;
		remotes.forEach(function(remote,idx){
			r=remote.sockets.indexOf(socketId);
			if (r>=0) {
				remote.sockets.splice(r,1);
				// No more sockets?
				if (remote.sockets.length==0) {
					s=idx;
					process.send({action:"*LOG",data:remote.ip + " has disconnected"});
				}								
				return false; // Break out of loop
			}						
		})
		
		if (s>=0) {
			remotes.splice(s,1);		
		}
		
		socketIds.splice(i,1);
	}
	
	//process.send({action:"*LOG",data:socketId + " has disconnected"});
	console.log(socketId + " has disconnected");
	// Every 100 disconnects, force a dashboard broadcast
	var force=disconnectCount>=100;
	if (force) {
		disconnectCount=0;
		broadcast();
	}
	else {
		process.send({action:"*DASHBOARD",data:{}}); 
	}	
}