const net = require('net');
const b64id = require('b64id');
const debug = require('debug')('hsync:info');

const { parseReqHeaders } = require('./lib/http-parse');
const sockets = require('./lib/socket-map');
const { forwardWebRequest, sendCloseRequest } = require('./aedes');
const { startHapi, handleLocalHttpRequest } = require('./hapi');
const config = require('./config');

const HSYNC_CONNECT_PATH = `/${config.hsyncBase}`;

const socketServer = net.createServer((socket) => {

  socket.socketId = b64id.generateId();
  sockets[socket.socketId] = socket;
  socket.parsingStarted = false;
  socket.parsingFinished = false;
  socket.hsyncClient = false;
  // debug('CONNECTION FROM EXTERNAL', socket.socketId);

  socket.on('data', async (data) => {
    if (!socket.hsyncClient) {
      debug(`→ EXTERNAL DATA ${socket.socketId}`, socket.hostName, data.length, 'parsingStarted', socket.parsingStarted, 'finished', socket.parsingFinished);
    }

    if (!socket.parsingStarted) {
      socket.parsingStarted = true;
      const startTime = Date.now();
      const parsed = await parseReqHeaders(data);
      socket.parsingFinished = true;
      debug('path', parsed.url, Date.now() - startTime);
      if(parsed.headersFinished) {
        socket.hostName = parsed.host;
        socket.originalUrl = parsed.url;
        if(parsed.url.startsWith(HSYNC_CONNECT_PATH) || (parsed.url === '/favicon.ico')) {
          debug('hsync path', parsed.url);
          if (parsed.headers['upgrade']) {
            socket.hsyncClient = true;
          }
          handleLocalHttpRequest(socket, data);
          if(socket.webQueue && socket.mqTCPSocket) {
            socket.webQueue.forEach((d) => {
              socket.mqTCPSocket.write(d);
            });
            socket.webQueue = null;
          }
          return;
        }
      } else {
        // come on, at least put the damn headers in the first packet, you animals
        socket.end();
        delete sockets[socket.socketId];
        return;
      }
      debug('regular request', socket.originalUrl);
      forwardWebRequest(socket, data, parsed);
      if(socket.webQueue) {
        socket.webQueue.forEach((d) => {
          forwardWebRequest(socket, d);
        });
        socket.webQueue = null;
      }
      return;

    } else if (socket.mqTCPSocket) {
      return socket.mqTCPSocket.write(data);
    } else if (socket.parsingStarted && !socket.parsingFinished) {
      debug('adding data to webqueue while parsing', socket.socketId, data.length);
      socket.webQueue = socket.webQueue || [];
      socket.webQueue.push(data);
      return;
    }
    debug('moar data on same con', socket.originalUrl);
    return forwardWebRequest(socket, data);
  });

  socket.on('close', () => {
    // debug('EXTERNAL CONNECTION CLOSED', socket.socketId, socket.hostName);
    if (socket.mqTCPSocket) {
      debug(`CLOSING ${socket.hsyncClient ? 'MQTT' : 'HTTP'} connection`, socket.socketId, socket.hostName);
      socket.mqTCPSocket.end();
      delete sockets[socket.socketId];
      return;
    }
    if (socket.hostName) {
      debug('SENDING CLOSE REQUEST', socket.socketId, socket.hostName);
      sendCloseRequest(socket.hostName, socket.socketId);
    }
    if (sockets[socket.socketId]) {
      delete sockets[socket.socketId];
    }
  });

  socket.on('error', (error) => {
    debug('socket error', socket.socketId, error);
    if (socket.mqTCPSocket) {
      debug('CLOSING MQTT/HTTP connection', socket.socketId);
      socket.mqTCPSocket.end();
    }
    if (sockets[socket.socketId]) {
      delete sockets[socket.socketId];
    }
  });

});

startHapi();
socketServer.listen(config.port);
debug('hsync server listening on port', config.port);
