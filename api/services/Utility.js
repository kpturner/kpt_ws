/***** BEGIN LICENCE BLOCK ***************************/                  
/* The initial developer of the code is "CoralTree   */ 
/* Systems Ltd: http://www.coraltreesystems.com      */ 
/*                                                   */
/* Portions created by "CoralTree Systems Ltd" are   */
/* Copyright (c) 2005-2016 CoralTree Systems Ltd.    */
/* All Rights Reserved.                              */
/***** END LICENCE BLOCK *****************************/   

/**     
 *   @Class         service.Utility 
 *   @Description   Renaissance Utilities                  
 *   @Author        Kevin Turner                                            
 *   @Date          Jan 2016                                                         
 */
                                                                                    
/********************************************************************/           
/*                                                                                    
/*  Modification log                                                                  
/*  ================                                                                  
/*                                                                                    
/*  Inits  Date    Modification                                                       
/*  =====  ====    ============                                                       
/*    KT 09/08/17  Only use default queue if nothing on listener data                           
/********************************************************************/
 
/**
 * Module dependencies
 */


module.exports = { 


    /**
     * @name        Utility.shutdown
     * @method
     * @description Shutdown server
     */
    shutdown: function() {
    	
    	var timer;  
    	        
        // Shut down listeners	
    	async.each(sails.controllers.event.listeners,function(listener,next){
    		if (typeof listener=="object" && listener.listenerId && listener.listenerId!="dashboard") { 
    			Utility.endListener(listener,next)
            } 	
    		else {
    			//Utility.log("What is this: "+listener+"??");
    			next();
    		}
    	}
    	,function(err){    		
			// Shutdown dashboard
			if (sails.controllers.event.dashboardMonitor) {
				try {
					Utility.log("Shutting down dashboard monitor");
				}
				catch(e) {
					console.log("Shutting down dashboard monitor");
				}  
				sails.controllers.event.dashboardMonitor.on("exit",function(){
					Utility.log("Dashboard monitor shutdown complete"); 
					try {
						// Clear timer if the object hasn't vanished
						clearTimeout(sails.controllers.event.dashboardMonitor._stopTimer);			
					}
    				catch(e) {
						// Meh!
					}	
				})  	
				sails.controllers.event.dashboardMonitor.send({action:"*STOP"});
				// Force it to die in 5 seconds if it doesn't by itself
				sails.controllers.event.dashboardMonitor._stopTimer=setTimeout(_.bind(function(){
					this.kill("SIGINT");
				},sails.controllers.event.dashboardMonitor)
				,5000)
			}
			// Shut down logger and exit
            if (sails.controllers.event.logger) {
            	console.log("Shutting down logger");
            	sails.controllers.event.logger.on("exit",function(){
            		console.log("Logger shutdown complete");
            		clearTimeout(timer);
            		process.exit(0);
            	})
                sails.controllers.event.logger.send({action:"stop",data:null});                        					
            }	
            else {
            	clearTimeout(timer);
            	process.exit(0);
            }
    	})     
        
    	// Exit anyway (abnormally) if we get nowhere  
    	timer=setTimeout(function(){
    		console.log("Shutdown failed. Ending abnormally")
    		process.exit(1);
    	},30000)
    	
    },
    
	/**
	 * End listener
	 */
	endListener: function(listener,next){

		try {
			// Set up toolkit for data queue access
			DtaQ.initialise(sails.config.rns.idataq,sails.config.rns.itoolkit,sails.config.rns.conn);

			if (!listener._exitListener) {
				listener._exitListener=true; // Stop multiple exit listeners
				listener.on("exit",function(){
					Utility.log("Listener shutdown for "+listener.listenerId+" complete ");
					try {
						// Clear timers if the object hasn't vanished
						clearTimeout(listener._stopTimer);
						clearTimeout(listener._dieTimer);
						sails.controllers.event.listenerEnded(listener);
					}
					catch(e) {
						// Meh!
					}
					if (next) next();
				})
			}
			
			// Try the data queue method using the configured queue options
			// Pad key to 60
			var key=listener.listenerId;
			while (key.length<60)
				key+=" "
			DtaQ.sendToKeyedDataQueue(
				listener.data_from_socket.dtaq || sails.config.rns.defaultDtaQ,
				listener.data_from_socket.dtaqlib || sails.config.rns.defaultDtaQLib,
				"*STOP",
				key
			)
			listener._stopping=true;
			// Try SIGINT if it doesn't recognise the data queue option to STOP
			listener._stopTimer=setTimeout(_.bind(function(){
				try {
					this.listener.kill("SIGINT");
				}
				catch(e){
					// Oh!
					if (this.next) this.next(e);
				}					
			},{
				listener:	listener,
				next:		next
			}),5000)                
			// Die anyway if we don't hear back
			listener._dieTimer=setTimeout(_.bind(function(){
				Utility.log("Listener didn't die for "+this.listener.listenerId+". Moving on.");
				if (this.next) this.next();
			},{
				listener:	listener,
				next:		next
			})
			,10000);
		}
		catch(e) {
			sails.log.error(e)
			if (next) next();
		}		
	}, 

	/**
	 * Handle stdout etc
	 */
	handleStdout:function(child) {
		child.stdout.on('data', function(data){
			var d=(typeof data=="string")?data:data.toString();
			Utility.log(d);
		});
		child.stdout.on('error', function(data){	
			var d=(data instanceof Error)?data:(typeof data=="string")?data:data.toString();		            
			Utility.log(d,true);
		});
		child.stderr.on('error', function(data){
			var d=(data instanceof Error)?data:(typeof data=="string")?data:data.toString();	
			Utility.log(d,true);
		});
		child.stdout.on('end', function(){
			//Utility.log("stdout ended for child");
		});
	},

	/** 
	 * Handle logging requests
	 */
	log: function(data, error) {
		if (!sails.controllers.event.shuttingDown && sails.config.rns.logger) {
			if (!sails.controllers.event.logger) {
				sails.controllers.event.logger = require("child_process").fork(path.join(path.dirname(__dirname),"processes","logger"),{
					execArgv: process.execArgv,
					env: {						
						logLevel:       process.env.RNS_LOGLEVEL || 'debug',	
						logTransport:	process.env.RNS_LOGTRANSPORT || "Console",
						logFile:		process.env.RNS_LOGFILE || require("path").join(".","logs","rns-sails-service.log")					
					},
					/////silent:true   Screws up logging
				});
				// Detect it exiting
				sails.controllers.event.logger.on("exit", function(code, signal){
					Utility.log("Logger process exiting with code/signal "+code+"/"+signal )
					// If it has crashed we will have to try to restart it
					if (code=="1" && !sails.controllers.event.shuttingDown) {
						setTimeout(function(){
							sails.log.error("Restarting logger");
							sails.controllers.event.logger=null;	
						},10000)			
					} 
				})
				sails.controllers.event.logger.send({action:"initialise",data:null});
			}
			try {
				sails.controllers.event.logger.send({action:"log",data:data,error:error});
			}
			catch(e){}	
		}
		else {
			if (error) {
				sails.log.error(data)
			}
			else {
				sails.log.debug(data);
			}			
		}					
	}, 		
 
};