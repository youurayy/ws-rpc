$(function() {

	$.wsFlashClientInit({
		//forceFlash: true,
		//debug: true,
		//shimUrl: '/ws-flash-shim.js', // '/ws-flash-shim.min.js'
		chromeFrameFallback: true
		//swfLocation: 'none',
	},
	function(err) {
		if(err)
			return log('no websocket for old men');
	
		var WebSocketRPC = InitWebSocketRPC(WebSocket);
		
		var wsc = new WebSocketRPC('ws://' + window.location.host + '/');

		wsc.on('open', function() {
			log('connected');
		});

		wsc.on('close', function() {
			log('disconnected');
		});
		
		wsc.on('error', function(e) {
			log(e.stack || e.message || e);
			if(window.console)
				console.log(e.stack || e);
		});

		wsc.on('message 1', function(arg1, arg2, cb) {
			log('message 1: ' + arg1 + ', ' + arg2);
			cb(null, 'message1 response from client', 'arg2');
		});
		
		wsc.on('message 2', function(arg1, arg2, cb) {
			log('message 2: ' + arg1 + ', ' + arg2);
			cb(new Error('message2 ERROR response from client'));
		});
		
		wsc.on('message 3', function(arg1, arg2) {
			log('message 3: ' + arg1 + ', ' + arg2);
			
			wsc.message('client message 1', 'arg1', 'arg2', function(err, arg1, arg2) {
				log('response to client message 1: ' + err + ', ' + arg1 + ', ' + arg2);
				if(err) throw err;
				
				wsc.message('client message 2', 'arg1', 'arg2', function(err, arg1, arg2) {
					log('response to client message 2: ' + JSON.stringify(err) + ', ' + arg1 + ', ' + arg2);
					
					wsc.message('client message 3', 'arg1', 'arg2');
				});
			});
		});

		wsc.on('message room A', function(arg1, arg2) {
			log('message room A: ' + arg1 + ', ' + arg2);
		});

		wsc.on('message room B', function(arg1, arg2) {
			log('message room B: ' + arg1 + ', ' + arg2);
		});
		
		wsc.on('server message', function(arg1, arg2) {
			log('server message: ' + arg1 + ', ' + arg2);
		});

		wsc.on('message 4', function(arg1, arg2) {
			log('message 4: ' + arg1 + ', ' + arg2);
			//wsc.disconnect(true);
		});
	});

	function log(s) {
		var m = $('#msg');
		m.text(m.text()  + '\n' + s);
	}
});
