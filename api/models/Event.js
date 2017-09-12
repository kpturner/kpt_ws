/**
* Event.js
*
* @description :: This table captures triggered event information and is used to feedback snapshot data to newly connected clients.
*                 The data is transient and only needs to exist for the time that the server is alive - hence sails-disk is perfectly
*                 adequate. 
* @docs        :: http://sailsjs.org/#!documentation/models
*/

module.exports = {

  // It is not necessary to define the connection at a model level unless
  // we aim to have different connections and/or databases for different
  // models, but we will here in case we want to add tables that will 
  // not be as transient as this one.  This table does not need
  // to be persisted over multiple server instances.
  connection: ((process.env.RNS_SSLMODE=="1")?'eventsSslConnection':'eventsConnection'),

  attributes: {
	  feedId: {
		  	type:		'string',
			required:	true  
	  },
	  data: {
		  	type:		'string',
		  	required:	true
	  }
	 
  }

};

