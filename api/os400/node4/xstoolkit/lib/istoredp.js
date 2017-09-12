// IBM_PROLOG_BEGIN_TAG 
// This is an automatically generated prolog. 
//  
// istoredp.js
//  
// Licensed Materials - Property of IBM 
//  
// (C) COPYRIGHT International Business Machines Corp. 2014,2014 
// All Rights Reserved 
//  
// US Government Users Restricted Rights - Use, duplication or 
// disclosure restricted by GSA ADP Schedule Contract with IBM Corp. 
//
// DB2 Stored Procedure interface for XML Service Toolkit
//
//
// IBM_PROLOG_END_TAG 
function __getClass(object) {
  return Object.prototype.toString.call(object).match(/^\[object\s(.*)\]$/)[1];
}

var db2Call = function(callback,xlib,xdatabase,xuser,xpassword,xipc,xctl,xml_input_script,xbuf,debug,sync) {
  var xmlOut = "NULL";
  var sql;
  var db;
  var async = true;
  var MajorVersion = process.version.slice(1,2); // The Major version of Node.js
  
  if(xbuf === undefined) 
    sql = "call " + xlib + ".iPLUG512K(?,?,?,?)";
  else {
    xbuf = Number(xbuf);
    if(xbuf <= 0)
      sql = "call " + xlib + ".iPLUG32K(?,?,?,?)";
    else if(xbuf <= 4096 )
      sql = "call " + xlib + ".iPLUG4K(?,?,?,?)";
    else if(xbuf <= 32768 )
      sql = "call " + xlib + ".iPLUG32K(?,?,?,?)";
    else if(xbuf <= 65536 )
      sql = "call " + xlib + ".iPLUG65K(?,?,?,?)";
    else if(xbuf <= 524288 )
      sql = "call " + xlib + ".iPLUG512K(?,?,?,?)";
    else if(xbuf <= 1048576 )
      sql = "call " + xlib + ".iPLUG1M(?,?,?,?)";
    else if(xbuf <= 5242880)
      sql = "call " + xlib + ".iPLUG5M(?,?,?,?)";
    else if(xbuf <= 10485760)
      sql = "call " + xlib + ".iPLUG10M(?,?,?,?)";
    else sql = "call " + xlib + ".iPLUG15M(?,?,?,?)";
  }
  
  try{
    if(MajorVersion == "0") { // For Node.js v0, use the old driver and run in sync.
      db = require('../../db2i/lib/db2');
      if(__getClass(debug) == "Boolean")
        db.debug(debug);
      db.init(function(){
        db.serverMode(true);
        db.setEnvAttr(db.SQL_ATTR_INCLUDE_NULL_IN_LEN, db.SQL_FALSE);
      });
      if(xuser && xuser.length > 0 && xpassword && xpassword.length > 0)
        db.conn(xdatabase, xuser, xpassword, function(){
          db.autoCommit(true);
          db.setConnAttr(db.SQL_ATTR_TXN_ISOLATION , db.SQL_TXN_READ_UNCOMMITTED);
          db.setConnAttr(db.SQL_ATTR_DBC_SYS_NAMING , db.SQL_FALSE);
        });
      else
        db.conn(xdatabase, function(){
          db.autoCommit(true);
          db.setConnAttr(db.SQL_ATTR_TXN_ISOLATION , db.SQL_TXN_READ_UNCOMMITTED);
          db.setConnAttr(db.SQL_ATTR_DBC_SYS_NAMING , db.SQL_FALSE);
        });
      db.prepare(sql);
      db.bindParam([
        [xipc, db.SQL_PARAM_INPUT, 1],
        [xctl, db.SQL_PARAM_INPUT, 1],
        [xml_input_script, db.SQL_PARAM_INPUT, 0],
        [xmlOut, db.SQL_PARAM_OUTPUT, 0],
      ]);
      db.execute(function(outArray) {  //out is an array of the output parameters.
        if(outArray.length == 1)
          callback(outArray[0]);  // For XML service, there is always only one return XML output. So handle it directly.
        else
          callback(outArray);  // For multiple return result, caller should handle it as an array.
      });
      db.close();
    }
    else {  // Node.js v4 and above.
      db = require('../../db2i/lib/db2a');
      var conn = new db.dbconn();
      conn.setConnAttr(db.SQL_ATTR_DBC_SYS_NAMING , db.SQL_FALSE);
      if(__getClass(debug) == "Boolean")
        conn.debug(debug);
      if(xuser && xuser.length > 0 && xpassword && xpassword.length > 0)
        conn.conn(xdatabase, xuser, xpassword);
      else
        conn.conn(xdatabase);
      
      var stmt = new db.dbstmt(conn);
      
      if(sync == true) {  // Sync Mode
        stmt.prepareSync(sql);
        stmt.bindParamSync([
          [xipc, db.SQL_PARAM_INPUT, 1],
          [xctl, db.SQL_PARAM_INPUT, 1],
          [xml_input_script, db.SQL_PARAM_INPUT, 0],
          [xmlOut, db.SQL_PARAM_OUTPUT, 0],
        ]);
        stmt.executeSync(function(outArray) {  //out is an array of the output parameters.
          if(outArray.length == 1)
            callback(outArray[0]);  // For XML service, there is always only one return XML output. So handle it directly.
          else
            callback(outArray);  // For multiple return result, caller should handle it as an array.
          delete stmt;
          conn.disconn();
          delete conn;
        });
      } else {  // Async Mode
        stmt.prepare(sql, function(){
          stmt.bindParam([
            [xipc, db.SQL_PARAM_INPUT, 1],
            [xctl, db.SQL_PARAM_INPUT, 1],
            [xml_input_script, db.SQL_PARAM_INPUT, 0],
            [xmlOut, db.SQL_PARAM_OUTPUT, 0],
          ], function(){
            stmt.execute(function(outArray) {  //out is an array of the output parameters.
              if(outArray.length == 1)
                callback(outArray[0]);  // For XML service, there is always only one return XML output. So handle it directly.
              else
                callback(outArray);  // For multiple return result, caller should handle it as an array.
              delete stmt;
              conn.disconn();
              delete conn;
            });
          });
        });
      }
    }
  } catch(e) {
    console.log(e);
  }
}

exports.db2Call = db2Call;