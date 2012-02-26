
var express = require('express');
var stylus = require('stylus');
var nib = require('nib');

var wsflash = require('ws-flash-client');
var app = express.createServer();

var ws = require('ws-rpc').extend(require('ws'));
var wss = new ws.Server({ server: app });

require('policyfile').createServer().listen(
	process.env.NODE_ENV === 'production' ? 843 : 10843, app);


app.configure(function() {

	app.set('view engine', 'jade');
	app.set('view options', { layout: false });
	app.use(app.router);

	app.use(stylus.middleware({
		src: __dirname + '/views',
		dest: __dirname + '/public',
		compile: function(str, path) {
			return stylus(str)
				.set('filename', path)
				.set('compress', true)
				.use(nib())
				.import('nib');
		}
	}));
	
	app.use(wss.middleware(express));
	app.use(wsflash.middleware(express));
	
	app.use(express.static(__dirname + '/public'));
	app.use(express.errorHandler({ dump: true, stack: true }));

	app.get('/', function(req, res) {
		res.render('index', {
		});
	});

	app.listen(1144);
	
	wss.on('connect', function(client) {
		client.message('message 1', 'arg1', 'arg2', function(err, arg1, arg2) {
			console.log('reply to message 1', arguments);
			
			client.message('message 2', 'arg1', 'arg2', function(err, arg1, arg2) {
				console.log('reply to message 2', arguments);
				if(!err) throw new Error('fail');
				
				client.message('message 3', 'arg1', 'arg2');
			});
		});
	});
	
	wss.on('disconnect', function(client) {
		console.log('client disconnected');
	});
	
	wss.on('client message 1', function(client, arg1, arg2, cb) {
		console.log('client message 1', arg1, arg2);
		cb(null, 'arg1', 'arg2');
	});

	wss.on('client message 2', function(client, arg1, arg2, cb) {
		console.log('client message 2', arg1, arg2);
		cb(new Error('test error'));
	});
	
	var roomA = wss.room('A');
	var roomB = wss.room('B');

	wss.on('client message 3', function(client, arg1, arg2) {
		console.log('client message 3', arg1, arg2);
		
		roomA.add(client);
		roomB.add(client);
		
		roomA.message('message room A', 'arg1', 'arg2');
		roomB.message('message room B', 'arg1', 'arg2');
		
		roomA.remove(client);
		roomB.remove(client);

		roomA.message('message room A', 'arg1', 'arg2');
		roomB.message('message room B', 'arg1', 'arg2');
		
		wss.message('server message', 'arg1', 'arg2');
		
		client.message('message 4');
	});
	
	wss.on('error', function(e, client) {
		console.log(client ? 'client' : 'server', e.stack);
	});
});
