const debug = require('debug')('hsync:auth');
const b64id = require('b64id');
const boom = require('@hapi/boom');
const config = require('../config');

const dyns = {};

async function auth(hostName, secret) {
  debug('hsync auth', hostName, secret);
  if (dyns[hostName]) {
    return dyns[hostName].secret === secret;
  }
  return config.hsyncSecret === secret;
}

async function createDyn() {
  if (!config.dynamicBase) {
    throw boom.notFound();
  }
  const id = `d${b64id.generateId()}`;
  const secret = b64id.generateId();
  const now = Date.now();
  const url = `${id}.${config.dynamicBase}`;
  dyns[url] = {
    id,
    secret,
    created: now,
    lastAccessed: now,
    url,
  };
  debug('new dyn', dyns[url]);
  return dyns[url];
}

module.exports = {
  auth,
  createDyn,
};
