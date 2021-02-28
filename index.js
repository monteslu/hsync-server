const net = require('net');
const http = require('http');
const ws = require('websocket-stream');
const b64id = require('b64id');

const { parseReqHeaders } = require('./http-parse');
const sockets = require('./socket-map');
const { aedes, forwardWebRequest, handleMQTTSocket, sendCloseRequest } = require('./aedes');
const {
  PORT,
  INTERNAL_SOCKET_PORT,
  HSYNC_BASE,
} = require('./config');

const HSYNC_CONNECT_PATH = `/${HSYNC_BASE}`;

console.log({PORT, INTERNAL_SOCKET_PORT, HSYNC_BASE});

net.createServer(aedes.handle);
const httpServer = http.createServer();
ws.createServer({ server: httpServer }, aedes.handle)

httpServer.listen(INTERNAL_SOCKET_PORT, () => {
  console.log('internal Aedes MQTT-WS listening');
});

const socketServer = net.createServer((socket) => {

  socket.socketId = b64id.generateId();
  sockets[socket.socketId] = socket;
  socket.parsingStarted = false;
  socket.parsingFinished = false;
  socket.hsyncClient = false;
  // console.log('CONNECTION FROM EXTERNAL', socket.socketId);

  socket.on('data', async (data) => {
    if (!socket.hsyncClient) {
      console.log(`→ EXTERNAL DATA ${socket.socketId}`, socket.hostName, data.length, 'parsingStarted', socket.parsingStarted, 'finished', socket.parsingFinished);
    }

    if (!socket.parsingStarted) {
      socket.parsingStarted = true;
      
      const parsed = await parseReqHeaders(data);
      // console.log('parsed', JSON.stringify(parsed));
      socket.parsingFinished = true;
      if(parsed.headersFinished) {
        socket.hostName = parsed.host;
        if(parsed.headers['upgrade'] && parsed.url.startsWith(HSYNC_CONNECT_PATH)) {
          socket.hsyncClient = true;
          return handleMQTTSocket(socket, data);
        }
      } else {
        // come on, at least put the damn headers in the first packet, you animals
        socket.end();
        delete sockets[socket.socketId];
        return;
      }
      
      forwardWebRequest(socket, data, parsed);
      if(socket.webQueue) {
        socket.webQueue.forEach((d) => {
          forwardWebRequest(socket, d);
        });
        socket.webQueue = null;
      }
      return;

    } else if (socket.hsyncClient) {
      return socket.mqTCPSocket.write(data);
    } else if (socket.parsingStarted && !socket.parsingFinished) {
      console.log('adding data to webqueue while parsing', socket.socketId, data.length);
      socket.webQueue = socket.webQueue || [];
      socket.webQueue.push(data);
      return;
    }
    return forwardWebRequest(socket, data);
  });

  socket.on('close', () => {
    // console.log('EXTERNAL CONNECTION CLOSED', socket.socketId, socket.hostName);
    if (socket.mqTCPSocket) {
      console.log('CLOSING MQTT/HTTP connection', socket.socketId, socket.hostName);
      socket.mqTCPSocket.end();
      return;
    }
    if (socket.hostName) {
      sendCloseRequest(socket.hostName, socket.socketId);
    }
    if (sockets[socket.socketId]) {
      delete sockets[socket.socketId];
    }
  });

  socket.on('error', (error) => {
    console.log('socket error', socket.socketId, error);
    if (socket.mqTCPSocket) {
      console.log('CLOSING MQTT/HTTP connection', socket.socketId);
      socket.mqTCPSocket.end();
    }
    if (sockets[socket.socketId]) {
      delete sockets[socket.socketId];
    }
  });

});

socketServer.listen(PORT);
console.log('hsync server listening on port', PORT);
