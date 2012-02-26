
// @ypocat 2012, bsd lic

(function() {

	function __initWebSocketRPC(WebSocket) {
	
		// caller to callee message flow:

		// [1]caller.message(args, cbS)   --call-->     [2]callee.on('some message', client, args, cbC?)
		// [4]caller.cbS()              <--response--   [3]callee.cbC()    // optional step


		// WebSocketRPC: create a new RPC websocket.
		// *url, *protocols: see: http://dev.w3.org/html5/websockets/#the-websocket-interface
		// *connTimeout: connection and data timeout in milliseconds (default: 4000, -1 to disable auto-reconnection)
	
		var WebSocketRPC = function(url, protocols, connTimeout, reconnDelay) {

			this.url = url;
			this.protocols = protocols;
			this.connTimeout = connTimeout || 4000;
			this.listeners = {};
			this.reconnDelay = reconnDelay || 1000;

			this.on('message', function(e) {
				try {
					try { var msg = JSON.parse(e.data); }
					catch(e) { throw new Error('invalid data received'); }
		
					if(msg.r) {
						var f = (this.__c || {})[msg.r];
						if(!f) throw new Error('missing callback[4]:' + msg.r);
						delete this.__c[msg.r];
						f.apply(null, msg.a); //[4]
						return;
					}

					if(msg.c) {
						var t = this;
						msg.a.push(function() {
							var rmsg = { r: msg.c, a: Array.prototype.slice.call(arguments) };
						
							if(rmsg.a.length && (e = a = rmsg.a[0]) instanceof Error) {
								rmsg.a[0] = { message: e.message, stack: e.stack };
								for(var p in e) a[p] = e[p];
							}
						
							t.socket.send(JSON.stringify(rmsg)); //[3]
						});
					}
				
					this.emit.apply(this, msg.a); //[2]
				}
				catch(e) { this.emit('error', e); }
			});
		
			this.on('open', function() {
				// clear the connect timeout, so that it won't disconnect us
				this.__clearConnectTimeout();
			});
			
			this.on('close', function() {
			
				if(this.socket) {
					for(var i = 0; i < wsEvents.length; i++) this.socket['on' + wsEvents[i]] = null;
					this.socket = null;
				}
			
				// clear the connect timeout (if any), as we are not in 'connecting' phase anymore
				this.__clearConnectTimeout();
				// the socket was closed, so let's wait and reconnect, unless reconnection was disabled
				if(this.connTimeout !== -1) {
					var t = this;
					setTimeout(function() {
						// during the wait the reconnection might have been disabled, so check it again
						if(this.connTimeout !== -1)
							t.connect();
					}, t.reconnDelay);
				}
			});
			
			// TEMPORARY FIX for https://github.com/einaros/ws/issues/31

			this.on('error', function(e) {
				if(typeof(module) !== 'undefined' && e.message && e.message.indexOf('ECONNREFUSED') != -1)
					this.emit('close');
			});

			this.connect();
		};


		// initiate the connection; this is called automatically from the constructor
	
		WebSocketRPC.prototype.connect = function() {
			var t = this;
			if(this.socket)
				if(this.connTimeout !== -1)
					// auto-reconnect is on, so connect() will be called from 'close'
					return this.disconnect();
				else
					// no auto-reconnect, let's continue with connecting here
					this.disconnect();
		
			// setup the establish-connection timeout
			if(this.connTimeout !== -1) {
				this.connTimer = setTimeout(function() {
					if(t.socket.readyState !== WebSocket.OPEN) {
						t.__clearConnectTimeout();
						t.disconnect();
					}
				}, this.connTimeout);
			}
		
			this.socket = new WebSocket(this.url, this.protocols);
			for(var i = 0; i < wsEvents.length; i++)
				this.socket['on' + wsEvents[i]] = 
					function(event) {
						return function() { t.__dispatch(event, arguments); };
					}(wsEvents[i]);
		};
	

		// disconnect from the server
		// *noreconnect: disable the automatic reconnection
	
		WebSocketRPC.prototype.disconnect = function(noreconnect) {
			if(!this.socket) return;
			if(noreconnect) this.connTimeout = -1;
			//if(this.socket.readyState !== WebSocket.CLOSED)
			try { this.socket.close(); } catch(e) { this.emit('error', e); }
		};
	

		// message: send a message to the server
	
		WebSocketRPC.prototype.message = function() {
			var last = arguments.length - 1;
			var msg = {};

			if(typeof(arguments[last]) === 'function') {
				if(!this.__c) this.__c = {};
				do { msg.c = randomId(); } while(this.__c[msg.c]);
				this.__c[msg.c] = arguments[last--];
			}
			msg.a = Array.prototype.slice.call(arguments, 0, last + 1);
			this.socket.send(JSON.stringify(msg)); //[1]
		};

	
		// on: register a listener
	
		WebSocketRPC.prototype.on = function(event, listener) {
			this.listeners[event] = this.listeners[event] || [];
			this.listeners[event].push(listener);
		};


		// removeListener: remove a listener
	
		WebSocketRPC.prototype.removeListener = function(event, listener) {
			if(event in this.listeners === false) return;
			this.listeners[event].splice(this.listeners[event].indexOf(fct), 1);
		};
	
	
		// emit: emit an event
	
		WebSocketRPC.prototype.emit = function(event) {
			if(event in this.listeners === false) return;
			for(var i = 0, l = this.listeners[event], ln = l.length; i < ln; i++)
				l[i].apply(this, Array.prototype.slice.call(arguments, 1));
		};


		// clear the connection timer
	
		WebSocketRPC.prototype.__clearConnectTimeout = function() {
			if(this.connTimer) {
				clearTimeout(this.connTimer);
				delete this.connTimer;
			}
		};
	
	
		// dispatch a WebSocket event onto WebSocketRPC
	
		WebSocketRPC.prototype.__dispatch = function(event, args) {
			var arr = Array.prototype.slice.call(args);
			arr.unshift(event);
			this.emit.apply(this, arr);
		};


		// randomId: generate cheap random keys to identify pending callbacks

		function randomId() {
			for(var id = '', i = 0, f = Math.floor, r = Math.random; s = String.fromCharCode, i < 8; i++)
				id += s(f(r() * 26) + (f(r() * 2) ? 97 : 65)); // bool ? A-Z : a-z
			return id;
		}


		// WebSocket API events

		var wsEvents = [ 'open', 'error', 'close', 'message' ];
	

		return WebSocketRPC;
	};


	if(typeof(module) !== 'undefined')
		// expose the main object in Node.js
		module.exports = __initWebSocketRPC;
	else
		// expose the main object in browser
		window.WebSocketRPC = __initWebSocketRPC(window.WebSocket);

})();
