const pack = require('./package.json');

const config = {
  hsyncSecret : process.env.HSYNC_SECRET, // keep it secret, keep it safe!
  hsyncBase: process.env.HSYNC_BASE || '_hs', // this is where the hsync client websockets will connect
  port: process.env.PORT || 3101, // don't change this if deploying to app host like heroku or digital ocean
};


config.cookies = {
  password: process.env.HSYNC_COOKIE_SECRET || (config.hsyncSecret + config.hsyncSecret), // at least 32 characters
  name: config.hsyncBase,
  isSecure: false,
  path: `/${config.hsyncBase}`,
};

config.http = {
  host: '0.0.0.0',
  port: parseInt(process.env.INTERNAL_SOCKET_PORT) || 8883, // doesn't really matter, just pick a high port,
  routes: {
    cors: {
      credentials: true,
      origin: ['*'],
    },
  },
};

config.swaggerOptions = {
  info: {
    title: pack.name,
    description: pack.description,
    version: pack.version,
  },
  tags: [{
    name: 'api',
    description: 'hsync api',
    externalDocs: {
      description: 'find out more',
      url: 'https://github.com/monteslu/hsync-server',
    },
  }],
  basePath: `/${config.hsyncBase}`,
  documentationPath: `/${config.hsyncBase}/documentation`,
  swaggerUIPath: `/${config.hsyncBase}/swaggerui/`,
  pathPrefixSize: 2,
};


module.exports = config;