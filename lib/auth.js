import createDebug from 'debug';
import b64id from 'b64id';
import boom from '@hapi/boom';
import sample from 'lodash.sample';
import config from '../config.js';

const debug = createDebug('hsync:auth');

const dyns = {};

const sampleChars = '23456789abcdefghjkmnpqrtvwxyz';

function getRandomId() {
  // TODO make this pluggable?
  // 1 in half a trillion chance of collision by default ¯\_(ツ)_/¯
  return new Array(config.unauthedNameChars)
    .fill(0)
    .map(() => sample(sampleChars))
    .join('');
}

async function auth(client, hostName, secret) {
  debug('hsync auth', hostName, secret);
  console.log('AUTH CHECK:', { hostName, secret, hasDyn: !!dyns[hostName], configSecret: config.hsyncSecret });
  if (dyns[hostName]) {
    console.log('AUTH DYN:', { dynSecret: dyns[hostName].secret, matches: dyns[hostName].secret === secret });
    return dyns[hostName].secret === secret;
  }
  console.log('AUTH STATIC:', { configSecret: config.hsyncSecret, matches: config.hsyncSecret === secret });
  return config.hsyncSecret === secret;
}

async function createDyn() {
  debug('starting dyn');
  if (!config.unauthedNames || !config.serverBase) {
    throw boom.notFound();
  }
  const id = getRandomId();
  const secret = b64id.generateId();
  const now = Date.now();
  const url = `${id}.${config.serverBase}`;
  dyns[url] = {
    id,
    secret,
    created: now,
    lastAccessed: now,
    url,
    timeout: config.unauthedTimeout,
  };
  debug('created', id, url);
  debug('new dyn', dyns[url]);
  return dyns[url];
}

export { auth, createDyn, dyns };
