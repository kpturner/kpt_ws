//-- ***** BEGIN LICENCE BLOCK *****
// - Copyright (c) 2005-2016 CoralTree Systems Ltd.    
// - All Rights Reserved.                            
// - ***** END LICENCE BLOCK *****  

//------------------------------------------------------------ 
//--  File:         EventController.js               
//--  Description:  Handles all activity for the "Event" model              
//--  Author:       Kevin Turner                                      
//--  Date:         Aug 2015                              
//------------------------------------------------------------ 
// 
// Modification log
// ================
//  Inits  Date     Modification           
//  =====  ====     ============
//    KT 12/10/16   Remove snapshot purge and then only cache one snapshot per event
//    KT 12/10/16   Start dashboard listener as soon as we have a socket connection
//    KT 10/11/16   Cater for database failure if backups lock the file
//    KT 27/12/16   Leave room(s) if disconnected 
//    KT 03/01/16   On disconnect try to avoid hanging CLOSE_WAIT sockets with req.socket.conn.close();
//    KT 31/01/17   Only use a broker if configured to do so 
//    KT 07/02/17   Try to get round IBM bug by specifying silent:true on child_process fork
//    KT 13/03/17   Add log to dashboard output
//    KT 25/04/17   Snapshots can be disabled
//    KT 26/04/17   Restart a listener if it shuts down after exceeding TTL
//    KT 13/08/17   Add update count to feed cache
// ===================================================================
        
/**
 *
 * @description :: Server-side logic for managing events
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

var path = require("path"); 
var fs	= require("fs");

module.exports = {
		
		queue: [],
		broadcastInterval: sails.config.rns.broadcastInterval || 6000,
		broadcastMax: sails.config.rns.broadcastMax || 100,
		emitFrequency: sails.config.rns.emitFrequency || 500,
		broadcastInt: 0,
		sockets: {}, 
		listeners: {},
		logger: 0,		
		dashboardTimer: 0, 
		lastDashboardUpdate: new Date().getTime(),
		totalUpdates: 0,
		updatesPerSecond: 0,
		updateMonitorCount: -1,
		shuttingDown: false,
				
		
		/**
		 * Handle dashboard
		 *   Here a user has simply gone to the homepage to view dashboard information about the websocket activity		 *   
		 */
		handleDashboard:function(req,res) {
			if(req.isSocket && !sails.controllers.event.shuttingDown){ 
			
				//console.log( req.socket.id + " dashboard connection request" );	
				Utility.log( req.socket.id + " dashboard connection request" );					
								
				// Return data so far
				//console.log("Getting dashboard locally")
				return sails.controllers.event.getDashboard(req,res);
				
			}
			
		},
			
		
		/**
		 * Get dashboard data
		 */
		getDashboard:function(req,res) {
			if (req.isSocket && !sails.controllers.event.shuttingDown) {
				//console.log("Getting dashboard") 	 

				// Start update monitor if not yet started
				sails.controllers.event.updateMonitor();

				// Start dashboard process if not already started
				sails.controllers.event.startDashboard();				 
				
				// Join
				sails.controllers.event.join(req.socket.id, "dashboard");	
				
				// Get an instant update
				sails.controllers.event.dashboard(true);	
				
				// Handle the socket disconnecting
				if (!req.socket._disconnectListenerAdded) {
					//console.log("disconnect event added")
					req.socket._disconnectListenerAdded=true;
					req.socket.on("disconnect",function(){
						process.nextTick(_.bind(function(){
							sails.controllers.event.disconnectSocket(this.socketId);
						},{socketId:req.socket.id}))	
						req.socket.conn.close();					
					})				
				}				

				// Register socket 
				if (sails.controllers.event.dashboardMonitor) {
					sails.controllers.event.dashboardMonitor.send({
						action:"*REGISTER",
						socketId:req.socket.id,
						remoteAddress:req.socket.conn.remoteAddress
					});
					
					// Broadcast the dashboard info
					sails.controllers.event.dashboard();	
				}						
			}			
		},
		

		/**
		 * Join a room
		 */
		join: function(socketId,room){
			sails.sockets.join(socketId, room);			 
		},

		/**
		 * Leave a room
		 */
		leave: function(socketId,room){
			sails.sockets.leave(socketId, room);	
		},

		/**
		 * Emit 
		 */
		emit: function(socketId,feedId,eventObj){
			try {
				//sails.sockets.emit(socketId,feedId,eventObj);
				sails.sockets.broadcast(socketId,feedId,eventObj);				
  			}
  			catch(e) {
  				sails.log.error("Error emitting snapshot to socket "+socketId);
  				sails.log.error(e);
  			}			
		},
		
		/**
		 * Broadcast
		 */
		broadcast: function(roomName,eventName,data){
			try { 
				sails.sockets.broadcast(roomName,eventName,data);	
			}
			catch(e) {
				sails.log.error("Error broadcasting to "+roomName);
  				sails.log.error(e);
			}
		},
		
		/**
		 * Start the dashboard monitoring process
		 */
		startDashboard: function(){
			if (!sails.controllers.event.dashboardMonitor && !sails.controllers.event.shuttingDown) {
				sails.controllers.event.dashboardMonitor = require("child_process").fork(path.join(path.dirname(__dirname),"processes","dashboard"),{silent:true});
				// Register dashboard listener
				sails.controllers.event.dashboardMonitor.listenerId="dashboard";
				sails.controllers.event.listeners.dashboard=sails.controllers.event.dashboardMonitor;				
				// Detect it exiting
				sails.controllers.event.dashboardMonitor.on("exit", function(code, signal){
					Utility.log("Dashboard process exiting with code/signal "+code+"/"+signal );
					sails.controllers.event.dashboardMonitor=null;
				})
				Utility.log( "Dashboard process started" );
				// Process the dashboard event
				sails.controllers.event.dashboardMonitor.on("message", function(parms) {
					switch(parms.action) {
					//case "*LOG":						
					//	Utility.log(parms.data);
					//	break;
					case "*DASHBOARD": 
						sails.controllers.event.dashboard();
						break;
					case "*BROADCAST":
						var broadcast=parms.data;
						// Add an array of subscriptions 
						//broadcast.subs=sails.sockets.rooms();
						broadcast.feeds=[];
						broadcast.queueSize=sails.controllers.event.queue.length;
						_.forEach(sails.controllers.event.listeners,function(listener,index){
							if (typeof listener=="object" && listener.listenerId) {
								// Build a string with the listener id and update count
								var feedTxt=listener.listenerId;
								if (listener.listenerId=="dashboard") {
									if (!listener._updates) {
										listener._updates=1;
									}
									else {
										listener._updates++
									}
								}
								if (listener._updates) {
									feedTxt+=" ("+listener._updates.toString()+")";
								}
								broadcast.feeds.push(feedTxt);
							}
						});
						// Total updates
						broadcast.totalUpdates=sails.controllers.event.totalUpdates;
						// Updates per second
						broadcast.updatesPerSecond=sails.controllers.event.updatesPerSecond;
						//Utility.log("Dashboard broadcast");
						Utility.log(broadcast);
						 // Broadcast dashboard info
						sails.controllers.event.totalUpdates++;		
						// Add log information to broadcast
						broadcast.log=[];
						var logfile=process.env.RNS_LOGFILE || path.join("logs","rns-sails-service.log");
						fs.readFile(logfile, function (err, source) {
							if (err) {
								//sails.log.error(err)
								// This is almost definitely because we are running interactively and
								// outputting to the console rather than the log file
								broadcast.log.push("Not available. Server running interactively and logging to console")
							}
							else {
								try {
									_.forEach(source.toString().split("\n"),function(l){
										if(l) {
											try {
												broadcast.log.push(JSON.parse(l))
											}
											catch(e) {
												// Meh!
											}
										}
									})
								} catch (e) {
									sails.log.error(e)
								}
							}
							sails.controllers.event.broadcast("dashboard","dashboard",broadcast);			
						});						
						
						break;
					}
				});

				// Handle the dashboard standard output etc
				Utility.handleStdout(sails.controllers.event.dashboardMonitor);

			}
		}, 
		
		/**
		 * Handle listener
		 */
		handleListener:function(req,res) {


			// Start the broadcast interval if required
			if (!sails.controllers.event.broadcastInt && !sails.controllers.event.shuttingDown && sails.config.rns.queueBroadcasts) {
				sails.controllers.event.broadcastInt=setInterval(sails.controllers.event.processEventQueue,sails.controllers.event.broadcastInterval);
			}
			 
			if(req.isSocket && !sails.controllers.event.shuttingDown){ 
				process.nextTick(_.bind(function(){
					// Start update monitor if not yet started
					sails.controllers.event.updateMonitor();

					// Start dashboard process if not already started
					sails.controllers.event.startDashboard();
					
					// Register socket
					if (sails.controllers.event.dashboardMonitor) {
						sails.controllers.event.dashboardMonitor.send({
							action:"*REGISTER",
							socketId:req.socket.id,
							remoteAddress:req.socket.conn.remoteAddress
						});		
					}					
					
					// Handle the socket disconnecting
					//console.log(req.socket._disconnectListenerAdded)
					if (!req.socket._disconnectListenerAdded) {
						//console.log("disconnect event added")
						req.socket._disconnectListenerAdded=true;
						req.socket.on("disconnect",function(){
							process.nextTick(_.bind(function(){
								sails.controllers.event.disconnectSocket(this.socketId);
							},{socketId:req.socket.id}))	
							req.socket.conn.close();
						})
					}			
				
					var data_from_socket=req.params.all();
					var feedId=req.param('feedid');
					var action=req.param('action');				 

					switch(action) {
					
					case "subscribe":
						// Join a room named after the feed id 
						sails.controllers.event.join(req.socket.id, feedId);						
						var eventObj={};
						eventObj.type="data"; // As opposed to snapshot
						eventObj.data="*SUBSCRIBED";
						sails.controllers.event.emit(req.socket.id,feedId,eventObj);
						Utility.log( req.socket.id + " subscribed to " + feedId );
						// Cache the feed
						sails.controllers.event.cache(req.socket.id,feedId);					
						// Trigger dashboard update
						sails.controllers.event.dashboard();	
						break;					

					case "unsubscribe":
						// Leave a room named after the feed id 
						sails.controllers.event.leave(req.socket.id, feedId);						
						var eventObj={};
						eventObj.type="data"; // As opposed to snapshot
						eventObj.data="*UNSUBSCRIBED";
						sails.controllers.event.emit(req.socket.id,feedId,eventObj);
						Utility.log( req.socket.id + " unsubscribed from " + feedId );
						sails.controllers.event.deCache(req.socket.id, feedId);						
						// Trigger dashboard update
						sails.controllers.event.dashboard();	
						break;
						
					case "listen":

						Utility.log("PROCESSING "+feedId+" for "+ req.socket.id);

						// If we haven't been given any other essential info (like the data queue)
						// then abandon ship
						if (!data_from_socket.dtaq) {
							sails.log.error("Listen request for "+feedId+" abandoned. No data queue information provided" );						
						} 
						else {
							// Get snapshot data and emit to the socket if required
							if (!data_from_socket.ignoreSnapshot && sails.config.rns.snapshots) {
								if (data_from_socket.snapshotLength>0) {									 
									// Obtain snapshot data and then process the listener
									// Any database interaction could fail (example backups lock the file) 
									try {
										Event.find({
											where:	{
														feedId:feedId 
													}, 
											sort: 	"id DESC",
											limit:	req.param("snapshotLength")
											})								
										.exec(
											function(err, events){
												if (!err) {									 
													if (events) {
														// Send them in reverse
														for (var i=events.length-1;i>=0;i--) {
															var eventObj=events[i];
															var emit={};
															emit.type="snapshot";
															emit.data=eventObj.data;
															sails.controllers.event.emit(req.socket.id,feedId,emit);									  			
														}									  		
													}
												}
												else {
													sails.log.error("Error retrieving snapshot data")
													sails.log.error(err)
												}
												sails.controllers.event.startListenerIfRequired(data_from_socket,feedId);
												return;  
											}
										)
									}
									catch(e) {
										sails.log.error("Database interaction failed: "+e.message);
										sails.controllers.event.startListenerIfRequired(data_from_socket,feedId);
									}
									 
								}
								else {
									sails.controllers.event.startListenerIfRequired(data_from_socket,feedId);
								}
							}
							else {
								sails.controllers.event.startListenerIfRequired(data_from_socket,feedId);
							}
						} 
											
						break;						
						
					}
				},req))
			}			
			
		},

		/**
		 * Start listener if required
		 */
		startListenerIfRequired: function(data_from_socket,feedId) {
			
			if (!sails.controllers.event.shuttingDown) {
				// First of all, do we have a consolidated feed requirement?
				// If the feedid contains "::" then we only want a listener for the
				// part of the feed id prior to the "::"
				var listenerId=feedId.split("::")[0]; 
				
				// Do we have a listener for this feed?
				var existing=sails.controllers.event.listeners[listenerId];
				
				if (!existing) {
					var listener=sails.controllers.event.startListener(data_from_socket,listenerId);
					sails.controllers.event.listeners[listenerId]=listener;
					sails.controllers.event.dashboard();

					// TEST
					//DtaQ.initialise(sails.config.rns.idataq,sails.config.rns.itoolkit,sails.config.rns.conn);
					//setTimeout(_.bind(function(){
					//	this.on("exit",function(){
					//		sails.log.debug(this.listenerId+ "ended")
					//	})
					//	var key=this.listenerId;
					//	while (key.length<60)
					//		key+=" "
					//	sails.log.debug("Sending data queue entry for "+this.listenerId)	
					//	DtaQ.sendToKeyedDataQueue(
					//		sails.config.rns.defaultDtaQ,
					//		sails.config.rns.defaultDtaQLib,
					//		"*STOP",
					//		key
					//	)
					//},listener),5000)				
					///////////////////////////////
				}
			}			
		},

		/**
		 * Start listener
		 */
		startListener: function(data_from_socket,listenerId) { 

			// Start broker or listener 			
			var p=(sails.config.rns.broker)?'broker':'listener';			 
			var listener = require("child_process").fork(path.join(path.dirname(__dirname),"processes",p),{silent:true});

			listener.listenerId=listenerId;
			listener.data_from_socket=data_from_socket;				
			

			// Process the data queue message every time we get one
			listener.on("message", function(eventObj) {
				//if (typeof eventObj.data=="string" && eventObj.data.indexOf("*LOG:")==0) {
				//	process.nextTick(_.bind(function(){
				//		Utility.log(this.data.substr(5))
				//	},eventObj))					
				//}
				if (typeof eventObj.data=="string" && eventObj.data.indexOf("*CHK:")==0) {
					// If there are no subscribers left, kill the listener
					process.nextTick(_.bind(function(){
						sails.controllers.event.checkSubs(this);
					},listener))		
				}	
				else {
					// Is the response actually an error XML string from the toolkit?
					if (typeof eventObj.data=="string" && eventObj.data.indexOf("<errnoxml>")>0) {
						// Something is wrong
						broadcast.data="*UNSUBSCRIBE";									
						listener.kill("SIGINT");
						sails.controllers.event.totalUpdates++;
						sails.controllers.event.broadcast(eventObj.feedId,eventObj.feedId,broadcast);						
						sails.controllers.event.dashboard();	 
					}
					else {
						// Queue up the event for broadcast	or do it immediately
						if (sails.config.rns.queueBroadcasts) {
							sails.controllers.event.queue.push(eventObj);
						}	
						else {
							sails.controllers.event.broadcastEvent(eventObj);
						}						
					}								
				}				  	
			});
			
			// Handle the dashboard standard output etc
			Utility.handleStdout(listener);

			// Detect it closing
			listener.on("close", function(code, signal){
				// The "exit" event will cater for this
				//sails.controllers.event.listenerEnded(listener);							 
			})
			
			// Detect it exiting
			listener.on("exit", function(code, signal){
				Utility.log("Listener "+listener.listenerId+" process exiting with code/signal "+code+"/"+signal )
				sails.controllers.event.listenerEnded(listener);
				// Check subscribers for listener.  If the listener has crashed we will have to try to restart it
				if (!sails.controllers.event.shuttingDown && !listener._stopping) {
					if (code=="1") {
						sails.log.error(listener.listenerId+" crashed. Restarting in 30 seconds");
						setTimeout(_.bind(function(){
							sails.controllers.event.checkSubs(listener);
						},listener),30000)
					} 
					else {
						// It shut down gracefully.  It could just be that the TTL expired and as we are 
						// not shutting down, check for subscribers and restart if required
						sails.controllers.event.checkSubs(listener);
					}
				}
			})

			// Send listener process the details of the data queue
			var parms=data_from_socket;
			parms.emitFrequency=sails.controllers.event.emitFrequency;
			parms.idataq=sails.config.rns.idataq;
			parms.itoolkit=sails.config.rns.itoolkit;
			parms.conn=sails.config.rns.conn;
			parms.wait=sails.config.rns.dqwait;
			parms.ttl=sails.config.rns.listenerTTL;
			
			// If we are in SSL mode, overwrite the queue name
			if (sails.config.sslmode) {
				parms.dtaq=parms.dtaq.replace("EVT_","SSL_")
				parms.ssl=true;
			}
			else {
				parms.ssl=false;
			}						
			parms.listenerId=listenerId;
			parms.action="*LISTEN";

			listener.send(parms);			
			
			return listener;
			
			 
		},

		/**
		 * Listener ended
		 */
		listenerEnded: function(listener) { 
		
			delete sails.controllers.event.listeners[listener.listenerId];		
					
			// Resend dashboard
			sails.controllers.event.dashboard();	
		},

		/**
		 * Cache the feed
		 */
		cache: function(socketId,feedId) {
			// Cache socket feed
			if (sails.controllers.event.sockets[socketId]) {
				if (sails.controllers.event.sockets[socketId].indexOf(feedId)<0) {
					sails.controllers.event.sockets[socketId].push(feedId);
				}				
			}
			else {
				sails.controllers.event.sockets[socketId]=[feedId]
			}
		},

		/**
		 * Decache socket feed
		 */
		deCache: function(socketId,feedId) {
			// Remove the socket feed from the cache			
			if (sails.controllers.event.sockets[socketId]) {
				if (!feedId) {
					delete sails.controllers.event.sockets[socketId];
				}
				else {				
					var i=sails.controllers.event.sockets[socketId].indexOf(feedId);
					if (i>=0) {
						sails.controllers.event.sockets[socketId].splice(i,1);
					}
					if (sails.controllers.event.sockets[socketId].length==0) {
						delete sails.controllers.event.sockets[socketId];
					}
				}				
			}
		},

		/**
		 * Process event queue
		 */
		processEventQueue: function(){
			// Walk through the queue and broadcast
			if (!sails.controllers.event.shuttingDown) {
				// Get the queue length now. Stuff could be added while we do this!
				var length=sails.controllers.event.queue.length;
				length=length>sails.controllers.event.broadcastMax?sails.controllers.event.broadcastMax:length;
				if (length>0) {
					// Clone the queue with the existing length
					var clone=sails.controllers.event.queue.slice(0,length);
					// Remove the data we have cloned
					sails.controllers.event.queue.splice(0,length);
					// Process the clone
					_.forEach(clone,function(eventObj){
						sails.controllers.event.broadcastEvent(eventObj);
					})
				}
			}	

		},

		/**
		 * Broadcast event
		 */
		broadcastEvent: function(eventObj){
			var broadcast={};
			broadcast.type="data"; // As opposed to snapshot
			
			// Persist the event data for snapshots.
			broadcast.data=(typeof eventObj.data=="string")?eventObj.data:JSON.stringify(eventObj.data);
			
			//if (!sails.config.sslmode) {
				// For performance reasons on cache one snapshot record
				// per event
				// Database interaction might fail if the file gets locked for backups etc
				if (sails.config.rns.snapshots) {
					try {
						Event.destroy({
							where:	{
										feedId:eventObj.feedId 
									}
							})								
						.exec(function(err){
							if (err) {
								sails.log.error(err);
							}
							else {
								// Create snapshot
								var rcd={};
								rcd.feedId=eventObj.feedId;
								rcd.data=broadcast.data;
								// Database interaction might fail if the file gets locked by backups
								try {
									Event.create(rcd).exec(function(err,eventData){
										// Snapshot created
										if (err) {
											sails.log.error("Error creating snapshot data")
											sails.log.error(err)
										}
										return;
									})			
								}
								catch(e) {
									sails.log.error("Database interaction failed: "+e.message);
								}										
							}
							
						})
					}
					catch(e) {
						sails.log.error("Database interaction failed: "+e.message);
					}
				}
				
			//}
			 
			sails.controllers.event.totalUpdates++;	
			// Keep update count for listener
			var listenerId=eventObj.feedId.split("::")[0]; 
			var listener=sails.controllers.event.listeners[listenerId];	
			if (listener) {
				if (!listener._updates) {
					listener._updates=1;
				}
				else {
					listener._updates++;
				}
			}	
			sails.controllers.event.broadcast(eventObj.feedId,eventObj.feedId,broadcast);						
			sails.controllers.event.dashboard();	
		},
	 
		/**
		 * Handle shutdown		   
		 */
		handleShutdown:function(req,res) {
			if(req.isSocket){ 
				sails.controllers.event.shuttingDown=true; 
				Utility.log( req.socket.id + " is requesting a shutdown" );	
				Utility.shutdown();
				return res.json({ok:true}); 
			}
			
		},

		/**
		 * Handle ping		   
		 */
		handlePing:function(req,res) {
			if(req.isSocket){  
				Utility.log( req.socket.id + " is pinging me" );	
				// Respond
				return res.json({ok:true}); 
			}
			
		},
				
		
		/**
		 * Update monitor
		 */
		updateMonitor:function(){
			// Start update monitor if not yet started
			if (sails.controllers.event.updateMonitorCount==-1) {
				sails.controllers.event.updateMonitorCount=0;
				sails.controllers.event.dashboardInterval=setInterval(function(){
					// How many have we done in the last second?
					sails.controllers.event.updateMonitorCount++;
					sails.controllers.event.updatesPerSecond=sails.controllers.event.totalUpdates/sails.controllers.event.updateMonitorCount;
				},1000)
			}
		},
		
		/**
		 * Disconnect socket
		 */
		disconnectSocket:function(socketId) {
			//console.log("Disconnecting " + socketId );

			// Leave feeds
			_.forEach(sails.controllers.event.sockets[socketId],function(feedId){
				sails.controllers.event.leave(socketId, feedId);
			})
		 
			// Remove the socket from the array
			if (sails.controllers.event.dashboardMonitor) {
				sails.controllers.event.dashboardMonitor.send({
					action:"*DEREGISTER",
					socketId:socketId
				});	
			}
			sails.controllers.event.deCache(socketId);					
		},
		
		/**
		 * Check the subscribers for a listener.  If there are none, kill the feed listener.
		 */
		checkSubs:function(listener) {
			if (!sails.controllers.event.shuttingDown) {
				//var subs=sails.sockets.subscribers(feedId);  // DEPRECATED
				//Utility.log("Checking subs for "+feedId);
				var feeds=0;
				var feedExample;
				
				_.forEach(sails.controllers.event.sockets,function(socketFeeds){
					_.forEach(socketFeeds,function(feedId){
						var lFeedId=feedId.split("::")[0];
						if (lFeedId==listener.listenerId) {
							feedExample=feedId;
							feeds++;
							return false; // Exits loop
						}
					})
					if (feeds>0) {
						return false; // Exit loop
					}
				})	
				// No feeds?
				if (feeds==0) {
					// Terminate listener
					////listener.kill("SIGINT");
					Utility.endListener(listener);				
				}
				else {
					// If there are feeds alive, is there a listener?
					sails.controllers.event.startListenerIfRequired(listener.data_from_socket,feedExample);
				}			
			}
			else {
				Utility.endListener(listener);	
			}
		},
		
		/**
		 * Tell the dashboard process to broadcast its data
		 */
		dashboard:function(force) {

			if (!sails.controllers.event.dashboardMonitor) {
				sails.controllers.event.startDashboard();
			}

			if (force) {
				sails.controllers.event.broadcastDashboard();	
			}
			else {
				if (!sails.controllers.event.dashboardTimer) {
					sails.controllers.event.dashboardTimer=setInterval(sails.controllers.event.broadcastDashboard,10000)	
				}
			} 

		},
		
		/**
		 * Broadcast dashboard data
		 */
		broadcastDashboard: function(){
			if (sails.controllers.event.dashboardMonitor) {
				try {
					sails.controllers.event.dashboardMonitor.send({
						action:"*BROADCAST"
					});	
				}
				catch(e) {
					// Meh!
				}
			}			
		}
		
};
