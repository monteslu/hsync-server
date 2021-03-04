const net = require('net');
const Hapi = require('@hapi/hapi');
const Inert = require('@hapi/inert');
const Vision = require('@hapi/vision');
const CookieAuth = require('@hapi/cookie');
const HapiSwagger = require('hapi-swagger');
const WS = require('websocket-stream');
const Handlebars = require('handlebars');
const debug = require('debug')('errors');
const debugHttp = require('debug')('hsync:http');


const config = require('./config');
const { aedes } = require('./aedes');
const sockets = require('./lib/socket-map');
const Routes = require('./lib/routes');

const server = Hapi.server(config.http);

async function startHapi() {
  try {
    await server.register([
      CookieAuth,
      Inert,
      Vision,
      {
        plugin: HapiSwagger,
        // eslint-disable-next-line
        options: config.swaggerOptions
      },
    ]);
  } catch (error) {
    debug(error);
    process.exit(1);
  }

  server.auth.strategy('auth', 'cookie', {
    cookie: config.cookies,
    validateFunc: async (request, session) => {
      return { valid: true };
    }
  });

  server.views({
    engines: {
      html: Handlebars,
      hbs: Handlebars,
    },
    relativeTo: __dirname,
    path: 'templates',
    defaultExtension: 'hbs',
  });

  server.route(Routes);

  try {
    await server.start();
    debugHttp('hapi server running on port:', config.http.port);
  } catch (err) {
    debug(err);
    return err;
  }
}

WS.createServer({server: server.listener}, aedes.handle);


function handleLocalHttpRequest(socket, data) {
  // TODO would be a hell of a lot cooler if it could just pipe data instead of making a socket here.
  const mqTCPSocket = new net.Socket();
  mqTCPSocket.connect(config.http.port, '127.0.0.1', () => {
    debugHttp(`CONNECTED TO LOCAL ${socket.hsyncClient ? 'MQTT' : 'HTTP'} SERVER`, socket.socketId, socket.hostName);
  });

  mqTCPSocket.on('data', (data) => {
    //debugHttp(`← to MQTT CLIENT ${socket.socketId}`, socket.hostName, data.length);
    socket.write(data);
  });
  mqTCPSocket.on('close', () => {
    debugHttp(`LOCAL ${socket.hsyncClient ? 'MQTT' : 'HTTP'} CONNECTION CLOSED`, socket.socketId, socket.hostName);
    socket.end();
    delete sockets[socket.socketId];
  });
  socket.mqTCPSocket = mqTCPSocket;
  // debugHttp(`→ to MQTT SERVER ${socket.socketId}`, socket.hostName);
  socket.mqTCPSocket.write(data);
  return socket;
}

module.exports = {
  startHapi,
  server,
  handleLocalHttpRequest,
};
