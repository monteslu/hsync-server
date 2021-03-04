const debug = require('debug')('hsync:auth');
const config = require('../config');

async function auth(hostName, secret) {
  debug('hsync auth', hostName, secret);
  return config.hsyncSecret === secret;
}

module.exports = {
  auth
};
