# ws-rpc: lightweight RPC support for the [ws](https://github.com/einaros/ws) WebSocket server

### Important

For increased reliability, it is suggested to use the WebSocket protocol over encrypted connections only. Some proxy servers intervene in the unencrypted form of the protocol in a way which prevents it from operation. This is being addressed by "masking" in newer versions of the protocol, however too many older versions are already in the wild. See the second code example on this page on how to configure HTTPS support in your Node.

### Server

Install dependencies:

	npm install express
	npm install ws
	npm install ws-rpc
	npm install ws-flash-client
	npm install policyfile

#### Example with Express, ws, and the Flash client shim support (see below for HTTPS):

Notes:

- `args` stands for multiple arguments, e.g. `arg1, arg2, arg3`
- messages with callbacks can only be used when messaging a single client

```js
var prod = process.env.NODE_ENV === 'production';
var app = require('express').createServer();
var ws = require('ws-rpc').extend(require('ws'));
var wss = new ws.Server({ server: app });
var wsflash = require('ws-flash-client');
require('policyfile').createServer().listen(prod ? 843 : 10843, app);

app.configure(function() {
	// configure other stuff like express globals, jade, stylus, etc.
	// ...
	
	// configure the ws-rpc middleware:
	app.use(wss.middleware(express));
	
	// configure the ws-flash-client middleware:
	app.use(wsflash.middleware(express));
	
	// static file handling must come afterwards:
	app.use(express.static(pub));
	
	// bind node to a port
	app.listen(prod ? 80 : 1234);
});

// create/get a named room (channel)
var myRoom = wss.room('myRoom');

// handle a new client connection
wss.on('connect', function(client) {

	// add client to a room
	myRoom.add(client);
	
	// message the client
	client.message('some message', args);
	
	// message the client with callback
	client.message('some message', args, function(err, args) {
		if(err)
			// ...
	});
	
	// Note:
	// you can hook your listener actions on every client separately, but if you 
	// have the same handler for every client, you should consider doing it the way
	// below, as with large number of clients, that will save you a lot of resources.
	
	// handle message from a client without a callback
	client.on('some message', function(args) {
		
		// ...
	});
	
	// handle message from a client with a callback
	client.on('some message', function(args, cb) {
		
		// ...

		// call the callback (should use node convention but not mandatory)
		cb(null, 'ok');
	});
	
});

// handle message from a client without a callback
wss.on('some message', function(client, args) {

	// ...
});

// handle message from a client with a callback
wss.on('some message', function(client, args, cb) {

	// ...
	
	// call the callback (should use node convention but not mandatory)
	cb(null, 'ok');
});

// handle client disconnection
wss.on('disconnect', function(client) {

	//myRoom.remove(client); <- not necessary, this is done automatically

	// example: broadcast to all client's rooms
	for(id in client.rooms)
		client.rooms[id].message('some message', args);
});

// message all clients connected to the server
wss.message('some message', args);

// message all clients in a room
myRoom.message('some message', args);

// and don't forget this if you don't want your Node to crash on an error:
// if the error comes from a client, the client is passed as second parameter
wss.on('error', function(e, client) {
	console.log(client ? 'client' : 'server', e);
});
```

Binary messages are not handled by the RPC extension, so you can handle them separately using the classic `ws` API.


#### The above example, but with HTTP + HTTPS support

For completeness, here's a guide on how to get a free 90-day SSL certificate:

1) Make a subdirectory in your project folder, e.g.: `mkdir https`

2) Create a text file in that directory, e.g.: `www.yourdomain.com.txt`, with the following contents (C= is the [ISO 3166-1 Alpha-2 code](http://en.wikipedia.org/wiki/ISO_3166-1#Current_codes) of your country)

	[ req ]
	distinguished_name=req_distinguished_name
	prompt=no

	[ req_distinguished_name ]
	C=US
	ST=State or County or Shire
	L=City
	O=Company Name
	CN=yourdomain.com
	emailAddress=support@yourdomain.com
	
3) Execute the following commands (the second command is to remove password from your secret-key file):

	openssl genrsa -des3 -out www.yourdomain.com.key.sec 2048
	openssl rsa -in www.yourdomain.com.key.sec -out www.yourdomain.com.key
	rm www.yourdomain.com.key.sec
	openssl req -new -config www.yourdomain.com.txt -key www.yourdomain.com.key -out www.yourdomain.com.csr

4) Use the CSR file to request a certificate from a recognized issuer. (You can get a free 90-day free certificate [from here](http://www.instantssl.com/). I'm not affiliated in any way with that site, but it worked for me.)

5) After verification through your domain's contact email address, you will obtain a CRT file from the issuer.  Place it along with the KEY file you generated above in the `https` directory.

Then configure your server as follows:

```js
var prod = process.env.NODE_ENV === 'production';
var app = require('express').createServer();
var ws = require('ws-rpc').extend(require('ws'));
var wsflash = require('ws-flash-client');
require('policyfile').createServer().listen(prod ? 843 : 10843, app);

var httpsOptions = {
	key: fs.readFileSync('https/www.yourdomain.com.key'),
	cert: fs.readFileSync('https/www.yourdomain.com.crt')
};

var httpServer = http.createServer(app.handle.bind(app)).listen(port);
var httpsServer = https.createServer(httpsOptions, app.handle.bind(app))
    .listen(httpsPort);

var wss = new ws.Server({ server: new ws.ServerHub([ httpServer, httpsServer ]) });

app.configure(function() {
	// continue as in the above example
	// ...
```

### Browser

In your HTML page ([JADE](http://jade-lang.com/) syntax shown):

	!!! 5
	html
		head
			meta(http-equiv='X-UA-Compatible', content='IE=Edge,chrome=1')
			//if lt IE 8
				script(src='http://cdnjs.cloudflare.com/ajax/libs/json2/20110223/json2.min.js')
			script(src='http://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js')
			script(src='/ws-rpc-client.min.js')
			script(src='/ws-flash.min.js')
			script(src='/myclientcode.js')
		body
			#msg

Complete example with the Flash client shim support (for full usage and options please see [ws-flash-client](https://github.com/ypocat/ws-flash-client)):

```js
$(function() {

	$.wsFlashClientInit({}, function(err) {
		if(err)
			return log('no websocket support');
			
		var WebSocketRPC = InitWebSocketRPC(WebSocket);

		// create the client (will use WebSocket object on the background)
		// param1: url
		// param2 (optional): protocols, see http://dev.w3.org/html5/websockets/#websocket
		// param3 (optional): connection timeout in ms (default 4s), use -1 to disable auto-reconnect
		// param4 (optional): reconnection wait timeout in ms (default 1s)
		var ws = new WebSocketRPC('ws://' + window.location.host + '/');
		
		// handle a message from the server
		ws.on('some message', function(args) {
			
			// ...
		});

		// handle a message from the server with a callback
		ws.on('some message', function(args, cb) {

			// ...
			
			cb(null, 'hello from client');
			
			// or, in the case of an error:
			
			cb(new Error('some problem'));
		});
		
		// message the server
		ws.message('some message', args);
		
		// message the server with a callback
		ws.message('some message', args, function(err, args) {
			if(err)
				// ...
		});
		
		// disconnect from the server
		// param1 (optional): disable automatic reconnection
		ws.disconnect(true);

		// connected event
		ws.on('open', function() {
			log('connected');
			
			// access the WebSocket if needed:
			//ws.socket ... <- will be null when disconnected, and then a new one created
		});

		// disconnected event
		ws.on('close', function() {
			log('disconnected');
		});
		
		// error event
		ws.on('error', function(e) {
			log(e.stack || e);
		});
	});

	// just an example
	function log(s) {
		var m = $('#msg');
		m.text(m.text()  + '\n' + s);
	}
});
```

Usage without `ws-flash-client`:

```js

var WebSocketRPC = InitWebSocketRPC(WebSocket);
var ws = new WebSocketRPC('ws://' + window.location.host + '/');

// ..and the same operations as above..

```

### Using the WebSocket client from Node.js

```js
var ws = require('ws-rpc').extend(require('ws'));
var wsc = new ws.RPCWebSocket('ws://127.0.0.1:1144/');

wsc.on('message 1', function(arg1, arg2, cb) {
	log('message 1: ' + arg1 + ', ' + arg2);
	cb(null, 'message1 response from client', 'arg2');
});

// etc.
```

### Example

Find the [example app here](https://github.com/ypocat/ws-rpc/tree/master/example), or installed in `node_modules/ws-rpc/example`.

	cd example
	npm install
	node testws
	
Then load http://localhost:1144/ in your browsers, and/or open another console and

	cd example
	node testws-server-client

### Tested with

	├─┬ express@2.5.8 
	│ ├─┬ connect@1.8.5 
	│ │ └── formidable@1.0.9 
	│ ├── mime@1.2.4 
	│ ├── mkdirp@0.3.0 
	│ └── qs@0.4.2 
	├─┬ jade@0.20.3 
	│ ├── commander@0.5.2 
	│ └── mkdirp@0.3.0 
	├── nib@0.3.2 
	├── policyfile@0.0.5 
	├─┬ stylus@0.24.0 
	│ ├── cssom@0.2.2 
	│ ├── debug@0.5.0 
	│ ├── growl@1.4.1 
	│ └── mkdirp@0.3.0 
	├─┬ ws@0.4.7 
	│ ├── commander@0.5.0 
	│ └── options@0.0.2 
	├── ws-flash-client@0.0.2
	└── ws-rpc@0.0.2

### Tested on

* Google Chrome 17 Mac, 16, 17 Win
* Firefox 7 Mac, 10 Win
* Internet Explorer 6, 7, 8, 9 on Win XP and Win 7 (Flash)
* Safari 5.1 Win, 5 Mac
* Opera 9.8 Win (Flash)
* Chrome Beta on Android 4.0, Galaxy Nexus
* Mobile Safari on iOS 5.0.1, iPhone 3GS


### License

New BSD License.
