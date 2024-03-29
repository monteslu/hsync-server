const Path = require('path');
const Joi = require('joi');
const boom = require('@hapi/boom');
const debug = require('debug')('hsync:routes');
const { rpcToClient, peerRpcToClient, peerNotifyToClient } = require('../aedes');
const { auth, createDyn } = require('./auth');

function getCreds(req) {
  const creds = req.auth?.credentials;
  if (Array.isArray(creds)) {
    return creds[0];
  }
  return creds;
}

function getRoutes(config) {
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
          debug({ creds });
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
      path: `/${config.hsyncBase}/rpc`,
      handler: async (req) => {
        debug('rpc', req.info.hostname, req.payload.method);
        const rpcResult = await peerRpcToClient(req.payload);
        debug('peerRpcToClient result', rpcResult);
        return rpcResult;
      },
      config: {
        description: 'Make a peer rpc call to the hsync client',
        tags: ['api'],
        validate: {
          payload: Joi.object({
            msg: Joi.object({
              jsonrpc: Joi.string(),
              method: Joi.string().required(),
              params: Joi.array().required(),
              id: Joi.alternatives(Joi.string(), Joi.number())
            }),
            myAuth: Joi.string(),
            toHost: Joi.string(),
            fromHost: Joi.string(),
          }).label('PeerRpcRequest'),
        }
      },
    },
    {
      method: 'POST',
      path: `/${config.hsyncBase}/message`,
      handler: async (req) => {
        const { query, headers, payload: reqPayload } = req;
        debug('rpc', req.info.hostname, req.payload);
        const ip = req.headers['req-forwarded-for'] || req.info.remoteAddress;
        const msg = {
          payload: reqPayload.payload,
          topic: String(reqPayload.topic),
          headers,
          query,
          ip,
        };
        const rpcResult = await peerNotifyToClient(req.info.hostname, 'external_message', msg);
        debug('peerRpcToClient result', rpcResult);
        return rpcResult;
      },
      config: {
        description: 'Message hsync client a {topic, payload}',
        tags: ['api'],
        validate: {
          payload: Joi.object(),
        }
      },
    },
    {
      method: 'POST',
      path: `/${config.hsyncBase}/auth`,
      handler: async (req, h) => {
        const { secret, toAdmin, type } = req.payload;
        const authImpl = config.auth || auth;
        const authed = await authImpl({ req, type, toAdmin }, req.info.hostname, secret);
        if (authed) {
          const user = { hostName: req.info.hostname, authed: true };
          req.cookieAuth.set(user);
          if (toAdmin) {
            return h.redirect(`/${config.hsyncBase}/admin`);
          }
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
            type: Joi.string().allow(null).allow(''),
            toAdmin: Joi.boolean().allow(null).allow(''),
          }).label('Auth'),
        }
      },
    },
    {
      method: 'POST',
      path: `/${config.hsyncBase}/dyn`,
      handler: async () => {
        try {
          debug('starting dyn');
          const dyn = await createDyn();
          debug('dyn', dyn);
          return dyn;
        } catch (e) {
          debug('error creating dyn', e);
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
      handler: (req) => {
        req.cookieAuth.clear();
        return 'ok';
      },
      config: {
        description: 'Logout of the admin UI',
        tags: ['api'],
      },
    },
    {
      method: 'GET',
      path: `/${config.hsyncBase}/health`,
      handler: () => {
        return 'ok';
      },
      config: {
        description: 'Health check',
        tags: ['api'],
      },
    },
  ];

  return routes;
}

module.exports = getRoutes;
