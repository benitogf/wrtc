var express =  require('express'),
    app = express(),
    fs = require('fs'),
    compileSass = require('express-compile-sass'),
    clients = [];

app.engine('jade', require('jade').__express);

var conf = fs.readFile('conf.json', function(err, data){
  if (err) throw err;
  var conf = JSON.parse(data);
  var root = __dirname + '/static';
  var server = require('http').createServer(app);
  
  app.use(compileSass({
     root: root,
     sourceMap: true,
     sourceComments: true,
     watchFiles: true,
     logToConsole: false
  }));

  app.use(express.static(root));

  app.get('/', function(req, res, next){
    res.render('index.jade', conf, function(err, html){
      if (err) {
        res.status(err.status).end();
      } else {
        res.send(html);
        //console.log(Date.now());
      }
    })
  })

  var io = require('socket.io')(server);
  
  io.on('connection', function(socket){
    var client = {
      name: 'p'+socket.conn.id,
      id: socket.conn.id,
      socket: socket
    };
    clients.push(client);
    socket.on('answer', function(data){
      clients.forEach(function(client, i){
        if (client.id === data.callerId) {
           clients[i].socket.emit('answer', data.data);
        }
      });
    });
    socket.on('getNames', function(data){
      var nclients = [];
      clients.forEach(function(client, i){
        if ((client.id === socket.conn.id)&&(data !== undefined)) {
           clients[i].signal = data;
        } else {
          if ((client.signal !== undefined)&&(client.id !== socket.conn.id)){
             var clientData = {
               id: client.id,
               name: client.name,
               signal: client.signal
             };
             nclients.push(clientData);
             }
        }
      });
      socket.emit('getNames', nclients);
      if (data !== undefined) {
          socket.broadcast.emit('rel')
       }
    });
    socket.on('setName', function(data){
      clients.forEach(function(client, i){
        if (client.id === socket.conn.id) {
           clients[i].name = data.name;
        }
      });
    });
    socket.on('disconnect', function(){
      var idk = -1;
      clients.forEach(function(client, i){
        if (client.id === socket.conn.id) {
           idk = i;
        }
      });
      if (idk !== -1) {
         clients.splice(idk, 1);
      }
      console.log('client disconect');
    });
  });
  
  server.listen(conf.port);
  console.log('app listening on port '+conf.port);
})
