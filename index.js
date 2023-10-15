const net = require('net');
const b64id = require('b64id');
const debug = require('debug')('hsync:info');
const debugError = require('debug')('error');

// const { parseReqHeaders } = require('./lib/http-parse');
const { createParser } = require('./lib/simple-parse');
const sockets = require('./lib/socket-map');
const { forwardWebRequest, sendCloseRequest } = require('./aedes');
const startHapi = require('./hapi');
const defaultConfig = require('./config');

async function run(conf = {}) {
  const config = { ...defaultConfig, ...conf };
  const HSYNC_CONNECT_PATH = `/${config.hsyncBase}`;
  let handleLocalHttpRequest;
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

      const headerParser = createParser(data);
      if (!socket.parsingStarted) {
        socket.parsingStarted = true;
        const startTime = Date.now();

        try {
          const parsed = await headerParser.parse();
          socket.parsingFinished = true;
          debug('path', parsed.url, Date.now() - startTime, socket.socketId);
          socket.hostName = parsed.host;
          socket.originalUrl = parsed.url;

          let toSend = data;
          if (socket.webQueue && socket.webQueue.length) {
            toSend = Buffer.concat([data, ...socket.webQueue]);
            debug('adding web queue to data', socket.socketId, socket.webQueue.length, toSend.length);
            socket.webQueue = [];
          }

          if (parsed.url.startsWith(HSYNC_CONNECT_PATH) || (parsed.url === '/favicon.ico')) {
            debug('hsync path', parsed.url);
            if (parsed.headers.upgrade) {
              socket.hsyncClient = true;
            }

            // console.log('send to handle local http request', toSend);
            handleLocalHttpRequest(socket, toSend);
            // console.log('localh handled');
            return;
          }

          debug('regular request', socket.originalUrl, socket.hostName, socket.socketId);
          forwardWebRequest(socket, toSend, parsed);
          return;
        } catch (e) {
          debugError('could not parse', socket.socketId, e);
          socket.end();
          delete sockets[socket.socketId];
        }
      } else if (socket.parsingStarted && !socket.parsingFinished) {
        debug('adding data to webqueue while parsing', socket.socketId, data.length);
        socket.webQueue = socket.webQueue || [];
        socket.webQueue.push(data);
        headerParser.addData(data);
      } else if (socket.parsingFinished && socket.mqTCPSocket) {
        return socket.mqTCPSocket.write(data);
      } else if (socket.parsingFinished) {
        debug('more data on same con', socket.originalUrl, socket.socketId);
        return forwardWebRequest(socket, data);
      }
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
      debugError('socket error', socket.socketId, error);
      if (socket.mqTCPSocket) {
        debug('CLOSING MQTT/HTTP connection', socket.socketId);
        socket.mqTCPSocket.end();
      }
      if (sockets[socket.socketId]) {
        delete sockets[socket.socketId];
      }
    });
  });

  const hapi = await startHapi(config);
  handleLocalHttpRequest = hapi.handleLocalHttpRequest;
  socketServer.listen(config.port);
  debug('hsync server listening on port', config.port);
}

module.exports = run;
