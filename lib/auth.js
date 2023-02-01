const debug = require('debug')('hsync:auth');
const b64id = require('b64id');
const boom = require('@hapi/boom');
const sample = require('lodash.sample')
const config = require('../config');

const dyns = {};

const sampleChars = '23456789abcdefghjkmnpqrtvwxyz';

function getRandomId() {
  // TODO make this pluggable?
  // 1 in half a trillion chance of collision by default ¯\_(ツ)_/¯
  return (new Array(config.unauthedNameChars)).fill(0).map(a => sample(sampleChars)).join('');
}

async function auth(hostName, secret) {
  debug('hsync auth', hostName, secret);
  if (dyns[hostName]) {
    return dyns[hostName].secret === secret;
  }
  return config.hsyncSecret === secret;
}

async function createDyn() {
  console.log('starting dyn');
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
  console.log('created', id, url);
  debug('new dyn', dyns[url]);
  return dyns[url];
}

module.exports = {
  auth,
  createDyn,
  dyns,
};
