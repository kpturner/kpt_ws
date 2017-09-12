//-- ***** BEGIN LICENCE BLOCK *****
// -
// - The Initial Developer of the Original Code is "CoralTree Systems Ltd: http://www.coraltree.co.uk".
// - Portions created by "CoralTree Systems Ltd" are Copyright (c) 2005-2016 CoralTree Systems Ltd.
// - All Rights Reserved.
// -
// - ***** END LICENCE BLOCK *****  

//------------------------------------------------------------ 
//--  File:         app.js       
//--  Description:  RNS RML services                                        
//--  Author:       Kevin Turner                                      
//--  Date:         2015                          
//------------------------------------------------------------ 
// 
// Modification log
// ================
//  Inits  Date     Modification           
//  =====  ====     ============
// ===================================================================
// * Use `app.js` to run your app without `sails lift`.
// * To start the server, run: `node app.js`.
// *
// * This is handy in situations where the sails CLI is not relevant or useful.
// *
// * For example:
// *   => `node app.js`
// *   => `forever start app.js`
// *   => `node debug app.js`
// *   => `modulus deploy`
// *   => `heroku scale`
// *
// *
// * The same command-line arguments are supported, e.g.:
// * `node app.js --silent --port=80 --prod`


// Ensure we're in the project directory, so relative paths work as expected
// no matter where we actually lift from.
process.chdir(__dirname);
var sails; 
var path=require("path");
var crashed;

// Ensure a "sails" can be located:
(function() {  
  try {
    sails = require('sails');
  } catch (e) {
    console.error('To run an app using `node app.js`, you usually need to have a version of `sails` installed in the same directory as your app.');
    console.error('To do that, run `npm install sails`');
    console.error('');
    console.error('Alternatively, if you have sails installed globally (i.e. you did `npm install -g sails`), you can use `sails lift`.');
    console.error('When you run `sails lift`, your app will still use a local `./node_modules/sails` dependency if it exists,');
    console.error('but if it doesn\'t, the app will run with the global sails instead!');
    return;
  }

  // Try to get `rc` dependency
  var rc;
  try {
    rc = require('rc');
  } catch (e0) {
    try {
      rc = require('sails/node_modules/rc');
    } catch (e1) {
      console.error('Could not find dependency: `rc`.');
      console.error('Your `.sailsrc` file(s) will be ignored.');
      console.error('To resolve this, run:');
      console.error('npm install rc --save');
      rc = function () { return {}; };
    }
  }

  // Start server
  sails.lift(rc('sails'));
})();

process.on("SIGINT",function(){
  if (sails) {
    sails.log.debug("Detected shutdown request via SIGINT");
    Utility.shutdown();
  }
  else {	
	  console.log("Detected shutdown request via SIGINT");  
    process.exit(0);
  }
})


process.on('uncaughtException', function (err) {
    if (crashed) {
      process.exit(1);
    }
    else {
      crashed=true;
    }
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