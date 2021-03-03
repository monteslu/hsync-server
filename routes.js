const Path = require('path');
const Joi = require('joi');

const config = require('./config');
const { rpcToClient } =  require('./aedes');

console.log({rpcToClient})

const routes = [
  {
    method: 'GET',
    path: `/${config.hsyncBase}/admin/{param*}`,
      handler: {
        directory: {
          path: Path.join(__dirname, 'public'),
          index: ['index.html'],
        }
      }
  },
  {
    method: 'GET',
    path: '/favicon.ico',
    handler: function (req, h) {
      return h.file(Path.join(__dirname, 'public') + '/favicon.ico');
    }
  },
  {
    method: 'POST',
    path: `/${config.hsyncBase}/rpc`,
    handler: function (req, h) {
      console.log('hello', req.info.hostname);
      return rpcToClient(req.info.hostname, req.payload.method, ...req.payload.params);
    },
    config: {
      description: 'Make an rpc call to the hsync client',
      tags: ['api'],
      validate: {
        payload: Joi.object({
          method: Joi.string().required(),
          params: Joi.array().required(),
        }).label('RpcRequest'),
      }
    },
  },
  {
    method: 'POST',
    path: `/${config.hsyncBase}/auth`,
    handler: function (req, h) {
      console.log('hello', req.info.hostname);
      return rpcToClient(req.info.hostname, req.payload.method, ...req.payload.params);
    },
    config: {
      description: 'Login for the admin UI',
      tags: ['api'],
      validate: {
        payload: Joi.object({
          secret: Joi.string().required(),
        }).label('Auth'),
      }
    },
  },
  {
    method: 'GET',
    path: `/${config.hsyncBase}/me`,
    handler: function (req, h) {
      console.log('hello', req.info.hostname);
      return rpcToClient(req.info.hostname, req.payload.method, ...req.payload.params);
    },
    config: {
      description: 'Check logged in status',
      tags: ['api'],
    },
  },
  {
    method: 'GET',
    path: `/${config.hsyncBase}/logout`,
    handler: function (req, h) {
      console.log('hello', req.info.hostname);
      return rpcToClient(req.info.hostname, req.payload.method, ...req.payload.params);
    },
    config: {
      description: 'Logout of the admin UI',
      tags: ['api'],
    },
  },
];

module.exports = routes;