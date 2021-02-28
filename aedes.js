const net = require('net');
const Aedes = require('aedes');
const b64id = require('b64id');
const rawr = require('rawr');
const sockets = require('./socket-map');
const BAD_GATEWAY = require('./bad-gateway');
const EventEmitter = require('events').EventEmitter;

const rpcRequests = {};

const {
  INTERNAL_SOCKET_PORT,
  HSYNC_SECRET,
} = require('./config');

console.log({HSYNC_SECRET})

const aedes = Aedes({

  authenticate: (client, username, password, callback) => {

    // console.log('\n\nauthenticate', client.id, username, password?.toString(), '\n');
  
    let authed = HSYNC_SECRET === password?.toString();
    
    if(authed) {
      // const hostName = client.req.headers.host.split(':')[0];
      client.hostName = username;
      const topic = `web/${username}/#`;
      // console.log('mq username', username);
      client.subscribe({topic, qos: 0}, (err) => {
        if (err) {
          console.log('Error subscribing', topic, err);
        }
      });
      const msgTopic = `msg/${username}/#`;
      client.subscribe({topic: msgTopic , qos: 0}, (err) => {
        if (err) {
          console.log('Error subscribing', msgTopic, err);
        }
      });
    }
    callback(null, authed);
  },
  authorizePublish: (client, packet, callback) => {
    console.log('authorizePublish',  packet.topic, !!packet.payload);
    
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
          // console.log('CLOSE FOUND', host, socketId);
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
          console.log('cant message self', msgTo, client.hostName, senderName);
          callback(new Error('cant send message to self'));
          return;
        } else if (senderName !== client.hostName) {
          console.log('must specify own name as 3rd segment', msgTo, client.hostName, senderName);
          callback(new Error('must specify own name on 3rd topic segment'));
          return;
        }

      } else if (name === 'ssrpc') {
        const msgFrom = host;
        const requestId = socketId;
        if (msgFrom !== client.hostName) {
          console.log('cant rpc to server for someone else', msgFrom, client.hostName, requestId);
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
    // console.log('authorizeSubscribe', client.id, sub.topic);
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
    console.log('PARSING FAILED, why no host?', topic, info ? 'first' : '');
    socket.end();
    return;
  }

  // TODO this wont work if mqtt is external, or servers are clustered
  if (!Object.keys(aedes.clients).length) {
    console.log('NO MQ Client for:', socket.hostName);
    socket.write(BAD_GATEWAY);  
    socket.end();
    delete sockets[socket.socketId];
    return;
  }


  console.log('↓ WEB REQUEST', topic, data.length, info ? 'first' : '');

  if (info) { //first packet on socket
    const { headers } = info;
    const size = info.contentLengthHeader;
    const connection = headers.connection;
    // sometimes we have to wait for more data even tho a request says to close.
    // console.log('size', size, 'connect', headers.connection, 'bodylength', info.bodyLength);  
    if((connection === 'close') && size && (size > info.bodyLength)) {
      socket.httpWaiting = { data, size, currentBodySize: size };
      socket.httpWaiting.timeoutId = setTimeout(() => {
        console.log('waited long enough, just send what we have.', topic, socket.httpWaiting.data.legth)
        publish(topic, socket.httpWaiting.data);
        socket.httpWaiting = null;
      }, 3000); // TODO make configurable
      return;
    }

    return publish(topic, data);

  } else if (socket.httpWaiting) {
    const { httpWaiting } = socket;
    const newSize = httpWaiting.currentBodySize + data.length;
    console.log('waiting current:', httpWaiting.currentBodySize, 'new', data.length, 'new_total', newSize, 'total_needed', httpWaiting.size);
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
    // console.log('sending', topic, msg);
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
      console.log('error publishing', topic, payload.length, err);
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
    throw e;
  }
}

function handleMQTTSocket(socket, data) {
  // TODO would be a hell of a lot cooler if it could just forward data instead of making a socket here.
  const mqTCPSocket = new net.Socket();
  mqTCPSocket.connect(INTERNAL_SOCKET_PORT, '127.0.0.1', () => {
    console.log('CONNECTED TO LOCAL MQTT/HTTP SERVER', socket.socketId, socket.hostName);
  });

  mqTCPSocket.on('data', (data) => {
    //console.log(`← to MQTT CLIENT ${socket.socketId}`, socket.hostName, data.length);
    socket.write(data);
  });
  mqTCPSocket.on('close', () => {
    console.log('LOCAL MQTT/HTTP CONNECTION CLOSED', socket.socketId, socket.hostName);
    socket.end();
    delete sockets[socket.socketId];
  });
  socket.mqTCPSocket = mqTCPSocket;
  // console.log(`→ to MQTT SERVER ${socket.socketId}`, socket.hostName);
  socket.mqTCPSocket.write(data);
  return socket;
}


module.exports = {
  aedes,
  forwardWebRequest,
  publish,
  handleMQTTSocket,
  sendCloseRequest,
  rpcToClient,
};
