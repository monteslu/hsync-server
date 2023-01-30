const Path = require('path');
const Joi = require('joi');
const boom = require('@hapi/boom');
const debug = require('debug')('hsync:routes');
const config = require('../config');
const { rpcToClient } =  require('../aedes');
const { auth, createDyn } = require('./auth');

function getCreds(req) {
  const creds = req.auth?.credentials;
  if (Array.isArray(creds)) {
    return creds[0];
  }
  return creds;
}

const routes = [
  {
    method: 'GET',
    path: `/${config.hsyncBase}/admin`,
    config: {
      description: 'View the admin UI',
      auth: {
        strategies: ['auth'],
        mode: 'optional',
      },
      handler: (req, h) => {
        const creds = getCreds(req);
        console.log({creds});
        return h.view('admin', {
          creds: !!creds,
          base: config.hsyncBase,
          hostName: req.info.hostname
        });
      },
    },
  },
  {
    method: 'GET',
    path: `/${config.hsyncBase}/{param*}`,
      handler: {
        directory: {
          path: Path.join(__dirname, '../public'),
          index: ['index.html'],
        }
      }
  },
  {
    method: 'GET',
    path: `/${config.hsyncBase}/lib/{param*}`,
      handler: {
        directory: {
          path: Path.join(__dirname, '../public/lib'),
          index: ['index.html'],
        }
      }
  },
  {
    method: 'GET',
    path: '/favicon.ico',
    handler: (req, h) => {
      return h.file(Path.join(__dirname, 'public') + '/favicon.ico');
    }
  },
  {
    method: 'POST',
    path: `/${config.hsyncBase}/srpc`,
    handler: (req) => {
      debug('srpc', req.info.hostname, req.payload.method);
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
    handler: async (req) => {
      const authed = await auth(req.info.hostname, req.payload.secret);
      if (authed) {
        const user = {hostName: req.info.hostname};
        req.cookieAuth.set(user);
        return user;
      }
     
      return boom.unauthorized();
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
    method: 'POST',
    path: `/${config.hsyncBase}/dyn`,
    handler: async () => {
      try {
        console.log('starting dyn');
        const dyn = await createDyn();
        console.log('dyn', dyn);
        return dyn;
      } catch(e) {
        console.log('error creating dyn', e);
        throw e;
      }
    },
    config: {
      description: 'Create dynamic login',
      tags: ['api'],
      validate: {
        payload: Joi.object(),
      }
    },
  },
  {
    method: 'GET',
    path: `/${config.hsyncBase}/me`,
    config: {
      auth: {
        strategies: ['auth'],
      },
      handler: getCreds,
      description: 'Checks Authentication',
      tags: ['api'],
    },
  },
  {
    method: 'GET',
    path: `/${config.hsyncBase}/logout`,
    handler: (req ) => {
      req.cookieAuth.clear();
      return 'ok';
    },
    config: {
      description: 'Logout of the admin UI',
      tags: ['api'],
    },
  },
];

module.exports = routes;