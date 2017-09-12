#!/bin/sh

# Start the server with a connection pool size of 65000

echo Starting sails server....                                                   

POOLSIZE=65000 node app.js
