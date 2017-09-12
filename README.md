# rnssails

A [Sails](http://sailsjs.org) application by Kevin Turner - 2016.

This web socket server is used by RNS to push events from an IBMi data queue to rns-datapushlisteners
defined in the RML.

This server can run "as is" on the IBMi as long as node (4 and above) is installed.

It can also be run on a non-IBMi platform like Windows or Unix but in that case it needs 
an Apache instance running on the IBMi to service calls to XMLSERVICE.  An example
Apache config file can be found in config/apache/rnswss.config

For non-IBMi platforms you also have to include a config/local.js file based on
config/local.example which defines the locations of the toolkits locally 
(in api/os400) and also defines the connection criteria for Apache.

