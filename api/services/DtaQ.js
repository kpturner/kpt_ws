/***** BEGIN LICENCE BLOCK ***************************/                  
/* The initial developer of the code is "CoralTree   */ 
/* Systems Ltd: http://www.coraltreesystems.com      */ 
/*                                                   */
/* Portions created by "CoralTree Systems Ltd" are   */
/* Copyright (c) 2005-2016 CoralTree Systems Ltd.    */
/* All Rights Reserved.                              */
/***** END LICENCE BLOCK *****************************/   

/**     
 *   @Class         service.DtaQ
 *   @Description   Renaissance Data Queue Services                 
 *   @Author        Kevin Turner                                            
 *   @Date          Feb 2017                                                         
 */
                                                                                    
/********************************************************************/           
/*                                                                                    
/*  Modification log                                                                  
/*  ================                                                                  
/*                                                                                    
/*  Inits  Date    Modification                                                       
/*  =====  ====    ============                                                       
/*                               
/********************************************************************/
 
/**
 * Module dependencies
 */


module.exports = { 

	/**
	 * Options
	 */
	options: {
		idataq: 		null,
		itoolkit:		null,
		dq:				null,
		xt: 			null,
		conn:			null,
		dtaq:			null,	
		retryTimes:		0,
		retryInterval:	100,
		timeoutMsg:		"Timeout!",
	},

	/**
	 * Initialise data queue connection
	 */
	initialise: function(idataq, itoolkit, cfg){
		if (!this.options.conn) {
			this.options.dq = require(idataq); 
			this.options.xt = require(itoolkit);
			this.augmentToolkit();

			this.options.conn = new this.options.xt.iConn(cfg.dbname,cfg.user,cfg.password,cfg.options);
			this.options.dtaq = new this.options.dq.iDataQueue(this.options.conn);

			this.options.retryTimes = Math.round(this.options.conn.timeout / this.options.retryInterval);
		}
	},

	/**
	 * Send to keyed data queue
	 */
	sendToKeyedDataQueue: function(name, lib, data, key){
		this.options.dtaq.sendToKeyedDataQueue(name, lib, data, key);
	},

	/**
	 * Receive from keyed data queue
	 */
	receiveFromKeyedDataQueue: function(name, lib, length, wait, keyOp, keyLen, key, cb){
		this.options.dtaq.receiveFromKeyedDataQueue(name, lib, length, wait, keyOp, keyLen, key, cb);
	},
    
	/**
	 * Augment toolkit
	 */
	augmentToolkit: function(){
		var me=this;
		//Add a new function to write to keyed data queues
		this.options.dq.iDataQueue.prototype.sendToKeyedDataQueue = function(name, lib, data, key) {
			var pgm = new me.options.xt.iPgm("QSNDDTAQ", {"lib":"QSYS"});
			pgm.addParam(name, "10A");
			pgm.addParam(lib == ""?"*CURLIB":lib, "10A");
			pgm.addParam(data.length, "5p0");
			pgm.addParam(data, data.length + "A");
			pgm.addParam(key.length, "3p0");
			pgm.addParam(key, key.length + "A");	

			me.options.conn.add(pgm.toXML());
			var rtValue;  // The returned value.
			var stop = 0;  // A flag indicating whether the process is finished.
			var retry = 0;  // How many times we have retried.
			function toJson(str) {  // Convert the XML output into JSON
				var output = me.options.xt.xmlToJson(str);
				if(output && output.length>0 && output[0].success)
					rtValue = true;
				else
					rtValue = str;
				stop = 1;
			}
			function waitForResult() {
				retry++;
				if(stop == 0)
					setTimeout(waitForResult, me.options.retryInterval);  // Check whether the result is retrieved
				else if(retry >= me.options.retryTimes)
					return me.options.timeoutMsg;
				else
					return rtValue;
			}
			me.options.conn.run(toJson);  // Post the input XML and get the response.
			return waitForResult();  // Run the user defined call back function against the returned value.
		}


		//Add a new function to read keyed data queues
		this.options.dq.iDataQueue.prototype.receiveFromKeyedDataQueue = function(name, lib, length, wait, keyOp, keyLen, key, cb) {
			var pgm = new me.options.xt.iPgm("QRCVDTAQ", {"lib":"QSYS"});
			pgm.addParam(name, "10A");
			pgm.addParam(lib == ""?"*CURLIB":lib, "10A");
			pgm.addParam(length, "5p0");
			pgm.addParam("", length + 1 + "A");
			pgm.addParam(wait, "5p0");
			pgm.addParam(keyOp, "2A");
			pgm.addParam(keyLen, "3p0");
			pgm.addParam(key, key.length + "A");
			pgm.addParam(0, "3p0");
			pgm.addParam("", "1A");

			

			me.options.conn.add(pgm.toXML());
			var async = cb && me.options.xt.getClass(cb) == "Function"; //If there is a callback function param, then it is in asynchronous mode.
			var rtValue;  // The returned value.
			var stop = 0;  // A flag indicating whether the process is finished.
			var retry = 0;  // How many times we have retried.
			function toJson(str) {  // Convert the XML output into JSON
				var output = me.options.xt.xmlToJson(str);
				if(output && output.length>0 && output[0].success)
					rtValue = output[0].data[3].value;
				else
					rtValue = str;
				if(async)	// If it is in asynchronous mode.
					cb(rtValue);  // Run the call back function against the returned value.
				stop = 1;
			}
			function waitForResult() {
				retry++;
				if(stop == 0)
					setTimeout(waitForResult, me.options.retryInterval);  // Check whether the result is retrieved
				else if(retry >= me.options.retryTimes)
					return me.options.timeoutMsg;
				else
					return rtValue;
			}
			me.options.conn.run(toJson);  // Post the input XML and get the response.
			if(!async)  // If it is in synchronized mode.
				return waitForResult();  // Run the user defined call back function against the returned value.
		}
	},
    
 
};