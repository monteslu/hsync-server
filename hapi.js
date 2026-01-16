import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import Hapi from '@hapi/hapi';
import Inert from '@hapi/inert';
import Vision from '@hapi/vision';
import CookieAuth from '@hapi/cookie';
import HapiSwagger from 'hapi-swagger';
import { WebSocketServer, createWebSocketStream } from 'ws';
import Handlebars from 'handlebars';
import createDebug from 'debug';

import { launchAedes } from './aedes.js';
import sockets from './lib/socket-map.js';
import getRoutes from './lib/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const debug = createDebug('errors');
const debugHttp = createDebug('hsync:http');

async function startHapi(config) {
  const server = Hapi.server(config.http);
  debugHttp('hapi server created', config.http, config.httpExt);
  const plugins = [
    CookieAuth,
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: config.swaggerOptions,
    },
  ];

  if (config.httpExt && config.httpExt.plugins) {
    config.httpExt.plugins.forEach((plugin) => {
      plugins.push(plugin);
    });
  }

  try {
    await server.register(plugins);
  } catch (error) {
    debug(error);
    process.exit(1);
  }

  server.auth.strategy('auth', 'cookie', {
    cookie: config.cookies,
    validateFunc: async () => {
      return { valid: true };
    },
  });

  if (config.httpExt && config.httpExt.authStrategies) {
    config.httpExt.authStrategies.forEach((strategy) => {
      server.auth.strategy(strategy.name, strategy.scheme, strategy.options);
    });
  }

  server.views({
    engines: {
      html: Handlebars,
      hbs: Handlebars,
    },
    relativeTo: __dirname,
    path: 'templates',
    defaultExtension: 'hbs',
  });

  const routes = getRoutes(config);

  if (config.httpExt && config.httpExt.routes) {
    config.httpExt.routes.forEach((route) => {
      route.path = `/${config.hsyncBase}/x${route.path}`;
      routes.push(route);
      debugHttp('adding httpExt routes', route.path);
    });
  }
  server.route(routes);

  try {
    await server.start();
    debugHttp('hapi server running on port:', config.http.port);
  } catch (err) {
    debug(err);
    return err;
  }

  const aedes = await launchAedes(config);

  const wss = new WebSocketServer({ server: server.listener });
  wss.on('connection', (socket) => {
    aedes.handle(createWebSocketStream(socket));
  });

  function handleLocalHttpRequest(socket, data) {
    // console.log('hanlding local', data);
    // TODO would be a hell of a lot cooler if it could just pipe data instead of making a socket here.
    const mqTCPSocket = new net.Socket();
    mqTCPSocket.connect(config.http.port, '127.0.0.1', () => {
      debugHttp(
        `CONNECTED TO LOCAL ${socket.hsyncClient ? 'MQTT' : 'HTTP'} SERVER`,
        socket.socketId,
        socket.hostName
      );
    });

    mqTCPSocket.on('data', (d) => {
      // debugHttp(`← to MQTT CLIENT ${socket.socketId}`, socket.hostName, data.length);
      socket.write(d);
    });
    mqTCPSocket.on('close', () => {
      debugHttp(
        `LOCAL ${socket.hsyncClient ? 'MQTT' : 'HTTP'} CONNECTION CLOSED`,
        socket.socketId,
        socket.hostName
      );
      socket.end();
      delete sockets[socket.socketId];
    });
    socket.mqTCPSocket = mqTCPSocket;
    // debugHttp(`→ to MQTT SERVER ${socket.socketId}`, socket.hostName);
    socket.mqTCPSocket.write(data);
    return socket;
  }
  return {
    handleLocalHttpRequest,
    aedes,
    server,
  };
}

export default startHapi;
