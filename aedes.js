const Aedes = require('aedes');
const rawr = require('rawr');
const boom = require('@hapi/boom');
const { EventEmitter } = require('events');
const debug = require('debug')('hsync:mqtt');

const sockets = require('./lib/socket-map');
const BAD_GATEWAY = require('./lib/bad-gateway');
const { auth, dyns } = require('./lib/auth');

let aedes;

const clients = {};

function publish(topic, payload) {
  aedes.publish({ topic, payload, qos: 0, retain: false }, (err) => {
    if (err) {
      debug('error publishing', topic, payload.length, err);
    }
  });
}

function createClientPeer(client) {
  const methods = {
    add: (a, b) => {
      return a + b;
    },
    setHsyncPeerKey: (peerName, key) => {
      debug('setting peer key', peerName, key);
    }
  };
  const { hostName } = client;
  const transport = new EventEmitter();
  transport.send = (msg) => {
    if (typeof msg === 'object') {
      msg = JSON.stringify(msg);
    }
    const topic = `msg/${hostName}/srpc`;
    // debug('sending', topic, msg);
    publish(topic, Buffer.from(msg));
  };
  transport.receiveData = (msg) => {
    if (typeof msg !== 'string') {
      msg = msg.toString();
    }
    if (msg) {
      msg = JSON.parse(msg);
    }
    transport.emit('rpc', msg);
  };

  const peer = rawr({ transport, timeout: 5000, methods });

  return peer;
}

function launchAedes(config) {
  function clearOldDyns() {
    for (const name in dyns) {
      const d = dyns[name];
      const now = Date.now();
      if ((now - d.created) > config.unauthedTimeout) {
        try {
          clients[name].close();
        } catch (e) {
          debug('error disconnecting duplicate client', e);
        }
        delete dyns[name];
      }
    }

    setTimeout(clearOldDyns, 60000);
  }

  if (config.unauthedNames) {
    clearOldDyns();
  }

  aedes = Aedes({

    authenticate: async (client, username, password, callback) => {
      const authImpl = config.auth || auth;
      const authed = await authImpl(client, username, password?.toString());

      if (authed) {
        // const hostName = client.req.headers.host.split(':')[0];
        client.hostName = username;
        const topic = `web/${username}/#`;
        // debug('mq username', username);
        client.subscribe({ topic, qos: 0 }, (err) => {
          if (err) {
            debug('Error subscribing', topic, err);
          }
        });
        const msgTopic = `msg/${username}/#`;
        client.subscribe({ topic: msgTopic, qos: 0 }, (err) => {
          if (err) {
            debug('Error subscribing', msgTopic, err);
          }
        });
        client.peer = createClientPeer(client);
        if (clients[username]) {
          try {
            clients[username].close();
          } catch (e) {
            debug('error disconnecting duplicate client', e);
          }
        }
        clients[username] = client;
      }
      callback(null, authed);
    },
    authorizePublish: async (client, packet, callback) => {
      const { payload, topic } = packet;
      debug('authorizePublish', topic, !!payload);
      if (topic) {
        const topicSegments = topic.split('/');
        const [name, host, socketId] = topicSegments;
        if (name === 'reply') {
          if (socketId) {
            const socket = sockets[socketId];
            if (socket) {
              socket.write(payload);
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
        } else if (name === 'srpc') {
          const msgFrom = host;
          if (msgFrom !== client.hostName) {
            debug('cant rpc to server for someone else', msgFrom, client.hostName);
            callback(new Error('cant rpc to server for someone else'));
            return;
          } else {
            client.peer.transport.receiveData(payload);
            return;
          }
        } else if (name === 'rpc') {
          const msgFrom = host;
          const requestId = socketId;
          if (msgFrom !== client.hostName) {
            debug('cant rpc to server for someone else', msgFrom, client.hostName, requestId);
            callback(new Error('cant rpc to server for someone else'));
            return;
          } else {
            try {
              const fullMsg = JSON.parse(payload.toString());
              debug('rpc from client to hsync-server', fullMsg);
            } catch (e) {
              debug('error parsing', e);
              callback(e);
            }
            return;
          }
        }
      }
      callback(null);
    },

    authorizeSubscribe: (client, sub, callback) => {
      debug('authorizeSubscribe', client.id, sub.topic);
      callback(null, sub);
    }
  });

  return aedes;
}

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

  if (info) { // first packet on socket
    const { headers } = info;
    const size = info.contentLengthHeader;
    const connection = headers.connection;
    // sometimes we have to wait for more data even tho a request says to close.
    // debug('size', size, 'connect', headers.connection, 'bodylength', info.bodyLength);
    if ((connection === 'close') && size && (size > info.bodyLength)) {
      socket.httpWaiting = { data, size, currentBodySize: size };
      socket.httpWaiting.timeoutId = setTimeout(() => {
        debug('waited long enough, just send what we have.', topic, socket.httpWaiting.data.legth);
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

    if (newSize >= httpWaiting.size) {
      clearTimeout(httpWaiting.timeoutId);
      publish(topic, httpWaiting.data);
      socket.httpWaiting = null;
      return;
    }
    return;
  }

  return publish(topic, data);
}

async function rpcToClient(hostname, methodName, ...rest) {
  if (!clients[hostname]) {
    return boom.notFound();
  }
  const { peer } = clients[hostname];
  try {
    // debug('rpcToClient', hostname, methodName, rest);
    const result = await peer.methods[methodName](...rest);
    debug('rpcToClient result', result);
    return result;
  } catch (e) {
    if (e.code === 504) {
      throw boom.gatewayTimeout(`RPC Timeout to ${hostname} client`);
    } else if (e.message) {
      throw boom.notImplemented(e.message);
    }
    throw e;
  }
}

async function notifyToClient(hostname, methodName, ...rest) {
  if (!clients[hostname]) {
    return boom.notFound();
  }
  const { peer } = clients[hostname];
  try {
    debug('notifyToClient', hostname, methodName);
    peer.notifiers[methodName](...rest);
    return 'ok';
  } catch (e) {
    if (e.code === 504) {
      throw boom.gatewayTimeout(`RPC Timeout to ${hostname} client`);
    } else if (e.message) {
      throw boom.notImplemented(e.message);
    }
    throw e;
  }
}

async function peerRpcToClient(msg) {
  debug('peerRpcToClient msg', msg);
  // debug('hosts', msg.toHost, msg.fromHost);
  const toUrl = new URL(msg.toHost);
  // const fromUrl = new URL(msg.fromHost);

  // debug('to', toUrl.hostname, 'from', fromUrl.hostname);
  const toClient = clients[toUrl.hostname];

  if (!toClient) {
    debug('no client found', toUrl.hostname);
    throw boom.notFound('Client not found', toUrl.hostname);
  }

  // TODO validate source (fromUrl)

  try {
    const result = await rpcToClient(toUrl.hostname, 'peerRpc', msg);
    // debug('rpcToClient result', result);
    // delete rpcRequests[peer.requestId];
    return result;
  } catch (e) {
    // delete rpcRequests[peer.requestId];
    if (e.code === 504) {
      throw boom.gatewayTimeout(`RPC Timeout to ${toUrl.hostname} client`);
    } else if (e.message) {
      throw boom.notImplemented(e.message);
    }
    throw e;
  }
}

async function peerNotifyToClient(toHost, methodName, msg) {
  debug('peerNotifyToClient msg', toHost, methodName);
  // debug('to', toUrl.hostname, 'from', fromUrl.hostname);
  const toClient = clients[toHost];

  if (!toClient) {
    debug('no client found', toHost);
    throw boom.notFound('Client not found', toHost);
  }

  try {
    const result = await notifyToClient(toHost, methodName, msg);
    // debug('rpcToClient result', result);
    // delete rpcRequests[peer.requestId];
    return result;
  } catch (e) {
    // delete rpcRequests[peer.requestId];
    if (e.code === 504) {
      throw boom.gatewayTimeout(`RPC Timeout to ${toHost} client`);
    } else if (e.message) {
      throw boom.notImplemented(e.message);
    }
    throw e;
  }
}

module.exports = {
  forwardWebRequest,
  publish,
  sendCloseRequest,
  rpcToClient,
  peerRpcToClient,
  peerNotifyToClient,
  launchAedes,
};
