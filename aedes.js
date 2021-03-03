const net = require('net');
const Aedes = require('aedes');
const b64id = require('b64id');
const rawr = require('rawr');
const boom = require('@hapi/boom');

const EventEmitter = require('events').EventEmitter;
const debug = require('debug')('hsync:mqtt');
const sockets = require('./lib/socket-map');
const BAD_GATEWAY = require('./lib/bad-gateway');
const auth = require('./lib/auth');

const rpcRequests = {};

const aedes = Aedes({

  authenticate: async (client, username, password, callback) => {

    let authed = await auth(username, password?.toString());
    
    if(authed) {
      // const hostName = client.req.headers.host.split(':')[0];
      client.hostName = username;
      const topic = `web/${username}/#`;
      // debug('mq username', username);
      client.subscribe({topic, qos: 0}, (err) => {
        if (err) {
          debug('Error subscribing', topic, err);
        }
      });
      const msgTopic = `msg/${username}/#`;
      client.subscribe({topic: msgTopic , qos: 0}, (err) => {
        if (err) {
          debug('Error subscribing', msgTopic, err);
        }
      });
    }
    callback(null, authed);
  },
  authorizePublish: (client, packet, callback) => {
    debug('authorizePublish',  packet.topic, !!packet.payload);
    
    if (packet.topic) {
      const topicSegments = packet.topic.split('/');
      const [name, host, socketId] = topicSegments;
      if (name === 'reply') {
        if (socketId) {
          const socket = sockets[socketId];
          if (socket) {
            socket.write(packet.payload);
          }
        }
      } else if (name === 'close') {
        if (socketId) {
          // debug('CLOSE FOUND', host, socketId);
          const socket = sockets[socketId];
          if (socket) {
            socket.end();
            delete sockets[socketId];
          }
        }
      } else if (name === 'msg') {
        const msgTo = host;
        const senderName = socketId;
        if (msgTo === client.hostName) {
          debug('cant message self', msgTo, client.hostName, senderName);
          callback(new Error('cant send message to self'));
          return;
        } else if (senderName !== client.hostName) {
          debug('must specify own name as 3rd segment', msgTo, client.hostName, senderName);
          callback(new Error('must specify own name on 3rd topic segment'));
          return;
        }

      } else if (name === 'ssrpc') {
        const msgFrom = host;
        const requestId = socketId;
        if (msgFrom !== client.hostName) {
          debug('cant rpc to server for someone else', msgFrom, client.hostName, requestId);
          callback(new Error('cant rpc to server for someone else'));
          return;
        } else if (rpcRequests[requestId]) {
          rpcRequests[requestId].transport.receiveData(packet.payload);
          return;
        }

      }
    }

    callback(null);
  },

  authorizeSubscribe: (client, sub, callback) => {
    // debug('authorizeSubscribe', client.id, sub.topic);
    callback(null, sub);
  }
});

function sendCloseRequest(hostName, socketId) {
  const closedTopic = `web/${hostName}/${socketId}/close`;
  publish(closedTopic, 'close');
}


function forwardWebRequest(socket, data, info) {

  const topic = `web/${socket.hostName}/${socket.socketId}`;

  if (!socket.hostName) {
    debug('PARSING FAILED, why no host?', topic, info ? 'first' : '');
    socket.end();
    return;
  }

  // TODO this wont work if mqtt is external, or servers are clustered
  if (!Object.keys(aedes.clients).length) {
    debug('NO MQ Client for:', socket.hostName);
    socket.write(BAD_GATEWAY);  
    socket.end();
    delete sockets[socket.socketId];
    return;
  }


  debug('↓ WEB REQUEST', topic, data.length, info ? 'first' : '');

  if (info) { //first packet on socket
    const { headers } = info;
    const size = info.contentLengthHeader;
    const connection = headers.connection;
    // sometimes we have to wait for more data even tho a request says to close.
    // debug('size', size, 'connect', headers.connection, 'bodylength', info.bodyLength);  
    if((connection === 'close') && size && (size > info.bodyLength)) {
      socket.httpWaiting = { data, size, currentBodySize: size };
      socket.httpWaiting.timeoutId = setTimeout(() => {
        debug('waited long enough, just send what we have.', topic, socket.httpWaiting.data.legth)
        publish(topic, socket.httpWaiting.data);
        socket.httpWaiting = null;
      }, 3000); // TODO make configurable
      return;
    }

    return publish(topic, data);

  } else if (socket.httpWaiting) {
    const { httpWaiting } = socket;
    const newSize = httpWaiting.currentBodySize + data.length;
    debug('waiting current:', httpWaiting.currentBodySize, 'new', data.length, 'new_total', newSize, 'total_needed', httpWaiting.size);
    httpWaiting.data = Buffer.concat([httpWaiting.data, data]);
    httpWaiting.currentBodySize = newSize;

    if(newSize >= httpWaiting.size) {
      clearTimeout(httpWaiting.timeoutId);
      publish(topic, httpWaiting.data);
      socket.httpWaiting = null;
      return;
    }
    return;
  }
  
  return publish(topic, data);
}

function createRawrTransport(hostName, requestId) {
  const transport = new EventEmitter();
  transport.send = (msg) => {
    if(typeof msg === 'object') {
      msg = JSON.stringify(msg);
    }
    const topic = `msg/${hostName}/${requestId}/ssrpc`;
    // debug('sending', topic, msg);
    publish(topic, Buffer.from(msg));
  };
  transport.receiveData = (msg) => {
    if(msg) {
      msg = JSON.parse(msg);
    }
    transport.emit('rpc', msg);
  };
  return transport;
}

function getRPCPeer(hostName, timeout = 5000) {
  const requestId = b64id.generateId();
  const peer = rawr({transport: createRawrTransport(hostName, requestId), timeout});
  peer.requestId = requestId;
  rpcRequests[requestId] = peer;
  return peer;
}

function publish(topic, payload) {
  aedes.publish({ topic, payload, qos: 0, retain: false }, (err) => {
    if (err) {
      debug('error publishing', topic, payload.length, err);
    }
  });
}

async function rpcToClient(hostName, methodName, ...rest) {
  const peer = getRPCPeer(hostName);
  try {
    const result = await peer.methods[methodName](...rest);
    delete rpcRequests[peer.requestId];
    return result;
  } catch(e) {
    delete rpcRequests[peer.requestId];
    if (e.code = 504) {
      throw boom.gatewayTimeout(`RPC Timeout to ${hostName} client`);
    }
    throw e;
  }
}


module.exports = {
  aedes,
  forwardWebRequest,
  publish,
  sendCloseRequest,
  rpcToClient,
};
