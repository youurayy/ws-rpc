
var ws = require('ws-rpc').extend(require('ws'));
var wsc = new ws.RPCWebSocket('ws://127.0.0.1:3000/');

var log = console.log;

wsc.on('open', function() {
	log('connected');
});

wsc.on('close', function() {
	log('disconnected');
});

wsc.on('error', function(e) {
	console.log('error:', e.stack || e);
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

