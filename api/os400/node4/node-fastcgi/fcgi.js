#!/QOpenSys/QIBM/ProdData/Node/bin/node

// This is a FastCGI code template to handle requests from HTTP server.
var fcgi = require('/QOpenSys/QIBM/ProdData/Node/os400/node-fastcgi');

var fcgiServer = fcgi.createServer(function(req, res) {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('GET: ' + req.url);
  } else {
    res.writeHead(501);
    res.end();
  }
});
// Native Mode -- Start the HTTP server and it will run the FastCGI server(this program) automatically.
// In this mode, set a valide 'CommandLine=' parameter in the fastcgi.conf file.
fcgiServer.listen();

// Remote Mode -- Run this program first. Then start the HTTP server. The HTTP server communicates with the FastCGI server remotely.
// In this mode, set the 'Binding=' parameter to the IP/port that the FastCGI server listens to in the fastcgi.conf file.
// fcgiServer.listen(8080);