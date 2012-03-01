
// @ypocat 2012, bsd lic

var util = require('util');
var events = require('events');


// module.extend: extend the ws server object
// *ws: the require('ws')

module.exports.extend = function(ws) {
	
	var WebSocketServer = ws.Server;
	var WebSocket = ws;


	// caller to callee message flow:

	// [1]caller.message(args, cbS)   --call-->     [2]callee.on('some message', client, args, cbC?)
	// [4]caller.cbS()              <--response--   [3]callee.cbC()    // optional step


	// socket.message: send an RPC message

	WebSocket.prototype.message = function() {
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


	// RPC WebSocket server

	var RPCWebSocketServer = function() {
	
		this.constructor.super_.apply(this, Array.prototype.slice.call(arguments));

		this.rooms = new Object(null);
		var server = this;

		function clientOnMessage(data, flags) {
			var client = this;
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
	
				client.emit.apply(client, msg.a);
				msg.a.splice(1, 0, client);
				server.emit.apply(server, msg.a); //[2]
			}
			catch(e) { client.emit('error', e); }
		};
	
		function clientOnError(e) {
			server.emit('error', e, this);
		}

		function clientOnClose() {
			for(var k in this.rooms)
				this.rooms[k].remove(this);
			server.emit('disconnect', this);
		};

		this.on('connection', function(client) {
			client.rooms = new Object(null);
			client.on('close', clientOnClose);
			client.on('error', clientOnError);
			client.on('message', clientOnMessage);
			server.emit('connect', client);
		});
	};


	util.inherits(RPCWebSocketServer, WebSocketServer);


	// server.message: message all clients

	RPCWebSocketServer.prototype.message = function() {
		var msg = JSON.stringify({ a: Array.prototype.slice.call(arguments) });
		for(var i = 0, cl = this.clients, ln = cl.length; i < ln; i++)
			cl[i].send(msg, {}, handle(cl[i]));
	};


	// server.room: get a named room

	RPCWebSocketServer.prototype.room = function(id) {
		var r = this.rooms;
		if(!r[id]) r[id] = new Room(id);
		return r[id];
	};


	// server.middleware: Connect middleware to serve the client.js file

	RPCWebSocketServer.prototype.middleware = function(express) {
		return express.static(__dirname + '/../public');
	};

	// exports

	module.exports = WebSocket;
	module.exports.Server = RPCWebSocketServer;
	module.exports.Room = Room;
	module.exports.RPCWebSocket = require('../public/ws-rpc-client')(WebSocket);
	module.exports.ServerHub = ServerHub;
	
	return module.exports;
};


// room: a channel

var Room = function(id) {
	this.id = id;
	// TODO: replace with a Map when clients get IDs
	// https://github.com/einaros/ws/issues/26
	this.clients = [];
};


// room.add: add a client to this room

Room.prototype.add = function(client) {
	this.clients.push(client);
	client.rooms[this.id] = this;
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


var ServerHub = function(servers) {
    var self = this;
    var events = [ 'upgrade', 'error' ];
    for(var s in servers) {
        for(var e in events) {
            (function(server, event) {
                server.on(event, function() {
                    var args = Array.prototype.slice.call(arguments);
                    args.unshift(event);
                    self.emit.apply(self, args);
                });
            })(servers[s], events[e]);
        }
    }
};
util.inherits(ServerHub, events.EventEmitter);


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
