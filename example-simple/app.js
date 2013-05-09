
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path');

var app = express();
var server = http.createServer(app)
var ws = require('ws-rpc').extend(require('ws'));
var wss = new ws.Server({ server: server });

// all environments
app.set('port', process.env.PORT || 3000);
app.use(express.favicon());
app.use(express.logger('dev'));

app.use(wss.middleware(express));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}





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







server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
