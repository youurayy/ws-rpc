# ws-rpc: lightweight RPC support for the [ws](https://github.com/einaros/ws) WebSocket server

### Server

Install dependencies:

	npm install express
	npm install ws
	npm install ws-rpc
	npm install ws-flash-client
	npm install policyfile

##### Complete example with Express, ws, and the Flash client shim support:

Notes:

- `args` stands for multiple arguments, e.g. `arg1, arg2, arg3`
- messages with callbacks can only be used when messaging a single client

```js
var prod = process.env.NODE_ENV === 'production';
var app = require('express').createServer();
var wss = new (require('ws').Server)({ server: app });
var wsrpc = require('ws-rpc').extend(wss);
var wsflash = require('ws-flash-client');
require('policyfile').createServer().listen(prod ? 843 : 10843, app);

app.configure(function() {
	// configure other stuff like express globals, jade, stylus, etc.
	// ...
	
	// configure the ws-rpc middleware:
	app.use(wsrpc.middleware(express));
	
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
	
	//client.on(... <-- not here, see below
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

Also, if you want to intercept the raw string messages and do your own handling in some cases, you can leave out the `require('ws-rpc').extend(wss);` line above, and do the following:

```js
wss.on('connection', function(client) { // notice: "connection" vs "connect"
	client.on('message', function(data, flags) {
		if(is_my_message(data)) {
			// handle the raw message here
			// ...
			// notify the RPC extension that this message was already handled
			flags.handled = true;
		}
		// otherwise the message will be handled as RPC
	});
});

// only setup the RPC extension after the above
require('ws-rpc').extend(wss);
```

### Browser

In your HTML page ([JADE](http://jade-lang.com/) syntax shown):

```html
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
```

Complete example with the Flash client shim support (for full usage and options please see [ws-flash-client](https://github.com/ypocat/ws-flash-client)):

```js
$(function() {

	$.wsFlashClientInit({}, function(err) {
		if(err)
			return log('no websocket support');

		// create the client (will use WebSocket object on the background)
		// param1: url
		// param2 (optional): protocols, see http://dev.w3.org/html5/websockets/#websocket
		// param3 (optional): connection timeout in ms (default 4s), set to -1 to disable automatic reconnecting
		// param4 (optional): reconnection wait timeout (default 1s)
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
		ws.on('open', function(world) {
			log('connected');
			
			// access the WebSocket if needed:
			//ws.socket ... <- will be null when disconnected, and then a new one created
		});

		// disconnected event
		ws.on('close', function(world) {
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

var ws = new WebSocketRPC('ws://' + window.location.host + '/');

// ..and the same operations as above..

```

### License

New BSD License.
