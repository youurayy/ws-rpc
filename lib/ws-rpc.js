
// @ypocat 2012, bsd lic

//var WebSocketServer = require('../../ws/lib/WebSocketServer');
//var WebSocket = require('../../ws/lib/WebSocket');


// caller to callee message flow:

// [1]caller.message(args, cbS)   --call-->     [2]callee.on('some message', client, args, cbC?)
// [4]caller.cbS()              <--response--   [3]callee.cbC()    // optional step



// extend the ws' WebSocket class on first sight
// (this is a workaround because the class is currently not exposed)

function extendClient(client) {

	if(typeof(client.message) === 'undefined') {
		
		
		// client.message: message the client
		
		client.constructor.prototype.message = function() {
			var last = arguments.length - 1;
			var cb, msg = {};

			if(typeof(arguments[last]) === 'function') {
				if(!this.__c) this.__c = {};
				do { msg.c = randomId(); } while(this.__c[msg.c]);
				this.__c[msg.c] = cb = arguments[last--];
			}
			msg.a = Array.prototype.slice.call(arguments, 0, last + 1);
			this.send(JSON.stringify(msg), {}, handle(this, cb)); //[1]
		};
	}
}


// module.extend: extend the ws server object

module.exports.extend = function(ws) {
	ws.rooms = new Object(null);


	// server.message: message all clients
	
	ws.constructor.prototype.message = function() {
		var msg = JSON.stringify({ a: Array.prototype.slice.call(arguments) });
		for(var i = 0, cl = this.clients, ln = cl.length; i < ln; i++)
			cl[i].send(msg, {}, handle(cl[i]));
	};


	// server.room: get a named room

	ws.constructor.prototype.room = function(id) {
		var r = this.rooms;
		if(!r[id]) r[id] = new Room(id);
		return r[id];
	};


	ws.on('connection', function(client) {
		extendClient(client);
		
		client.rooms = new Object(null);
		
		client.on('close', function() {
			for(var k in client.rooms)
				client.rooms[k].remove(client);
			ws.emit('disconnect', client);
		});

		client.on('error', function(e) {
			ws.emit('error', e, client);
		});
		
		client.on('message', function(data, flags) {
			try {
				if(flags.binary || flags.handled) return;
		
				try { var msg = JSON.parse(data); }
				catch(e) { throw new Error('invalid data received'); }
		
				if(msg.r) {
					var f = (client.__c || {})[msg.r];
					if(!f) throw new Error('missing callback[4]:' + msg.r);
					delete client.__c[msg.r];
					f.apply(null, msg.a); //[4]
					return;
				}

				if(msg.c)
					msg.a.push(function() {
						var rmsg = { r: msg.c, a: Array.prototype.slice.call(arguments) };

						if(rmsg.a.length && (e = a = rmsg.a[0]) instanceof Error) {
							rmsg.a[0] = { message: e.message, stack: e.stack };
							for(var p in e) a[p] = e[p];
						}

						client.send(JSON.stringify(rmsg), {}, handle(client)); //[3]
					});
				
				msg.a.splice(1, 0, client);
				ws.emit.apply(ws, msg.a); //[2]
			}
			catch(e) { client.emit('error', e); }
		});
		
		ws.emit('connect', client);
	});
	
	return module.exports;
};


// server.middleware: Connect middleware to serve the client.js file

module.exports.middleware = function(express) {
	return express.static(__dirname + '/../public');
};


// room: a channel

module.exports.Room = Room = function(id) {
	this.id = id;
	// TODO: replace with a Map when clients get IDs
	// https://github.com/einaros/ws/issues/26
	this.clients = [];
};


// room.add: add a client to this room

Room.prototype.add = function(client) {
	this.clients.push(client);
	client.rooms[this.id, this];
};


// room.remove: remove a client from this room

Room.prototype.remove = function(client) {
	var idx = this.clients.indexOf(client);
	if(idx != -1)
		this.clients.splice(idx, 1);
	delete client.rooms[this.id];
};


// room.message: message all clients in this room

Room.prototype.message = function() {
	var msg = JSON.stringify({ a: Array.prototype.slice.call(arguments) });
	for(var i = 0, cl = this.clients, ln = cl.length; i < ln; i++)
		cl[i].send(msg, {}, handle(cl[i]));
};


// randomId: generate cheap random keys to identify pending callbacks

function randomId() {
	for(var id = '', i = 0, f = Math.floor, r = Math.random; s = String.fromCharCode, i < 8; i++)
		id += s(f(r() * 26) + (f(r() * 2) ? 97 : 65)); // bool ? A-Z : a-z
	return id;
}


// handle: emit send() callback error onto the client
// TODO: perhaps suggest this to @einaros, as default behavior when cb is not supplied

function handle(client, cb) {
	return function(err) {
		if(err)
			if(cb)
				cb(err);
			else
				client.emit('error', err);
	}
}
