 
module.exports = {
 
	rns:	{
		defaultDtaQ:	"EVT_RNSSOK",
		defaultDtaQLib:	"RNSROUTER",
		idataq:			process.env.idataq || '/QOpenSys/QIBM/ProdData/OPS/Node4/os400/xstoolkit/lib/idataq', 
		itoolkit: 		process.env.itoolkit || '/QOpenSys/QIBM/ProdData/OPS/Node4/os400/xstoolkit/lib/itoolkit',		
		// Alternatively, if not running on an IBMi, you can override this in local.js  
		//idataq: 			require("path").join("..","..","api","os400","node4","xstoolkit","lib","idataq"), 
		//itoolkit: 			require("path").join("..","..","api","os400","node4","xstoolkit","lib","itoolkit"), 
		dqwait:			30,  
		conn: {
			// IBMi toolkit connection criteria
			dbname:		"*LOCAL",   //NOTE:  This is only used if the client does not send an override for itoolkit
			user:		null,
			password:	null,
			options:	null,
			// Alternatively we can specify options that point to an Apache instance on the IBMi if we are running on a 
			// different platform
			//options:	{
			//	host:	"rnsdev",
			//	port:	8888,
			//	path:	"/cgi-bin/xmlcgi.pgm",
			//},			
		},

		logger:				false,	// Use a logger process for all logging otherwise leave it all to app.js
		broker:				false,	// Use a broker process to throttle event updates.  
		emitFrequency:		500,	// Milliseconds. If using a broker, listeners will only emit events on this interval, regardless of how fast they arrive
		queueBroadcasts:	false,  // Use queuing mechanism to avoid broadcasting instantly
		broadcastInterval:	1000,   // Milliseconds. How often to broadcast events on the queue
		broadcastMax:		100,	// Milliseconds. Maximum number to broadcast at a time
		snapshots:			true,	// Snapshots are available. If false, no snapshot data is stored or broadcast.
		listenerTTL:		false,	// If not false it must be set to a number of milliseconds. A listener will end itself after this period and get 
		                            // restarted (useful if we get a memory leak in the IBM data queue code)
	},

};
