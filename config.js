import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pack = require('./package.json');

// Time constants (in milliseconds)
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = MS_PER_SECOND * 60;
const MS_PER_HOUR = MS_PER_MINUTE * 60;

// Default values
const DEFAULTS = {
  PORT: 3101,
  INTERNAL_PORT: 8883,
  MAX_DYNAMIC_DATA_BYTES: 10 * 1024 * 1024, // 10 MB
  UNAUTHED_SESSION_TIMEOUT_MS: MS_PER_HOUR * 3, // 3 hours
  UNAUTHED_NAME_LENGTH: 8,
  RPC_TIMEOUT_MS: 5000,
  HTTP_WAIT_TIMEOUT_MS: 3000,
  DYN_CLEANUP_INTERVAL_MS: MS_PER_MINUTE, // 1 minute
  PARSE_SLEEP_MS: 25,
  PARSE_TIMEOUT_MS: 2000,
  SWAGGER_PATH_PREFIX_SIZE: 2,
};

const config = {
  hsyncSecret: process.env.HSYNC_SECRET, // keep it secret, keep it safe!
  hsyncBase: process.env.HSYNC_BASE || '_hs', // this is where the hsync client websockets will connect
  port: process.env.PORT || DEFAULTS.PORT, // don't change this if deploying to app host like heroku or digital ocean
  serverBase: process.env.HSYNC_SERVER_BASE || null,
  maxDynamicData: parseInt(process.env.HSYNC_DYNAMIC_MAX || DEFAULTS.MAX_DYNAMIC_DATA_BYTES, 10),
  unauthedNames: process.env.HSYNC_ALLOW_UNAUTHED_NAMES || false,
  unauthedTimeout: Number(process.env.HSYNC_UNAUTHED_TIMEOUT) || DEFAULTS.UNAUTHED_SESSION_TIMEOUT_MS,
  unauthedNameChars: Number(process.env.HSYNC_UNAUTHED_NAME_CHARS) || DEFAULTS.UNAUTHED_NAME_LENGTH,
};

config.cookies = {
  password: process.env.HSYNC_COOKIE_SECRET || config.hsyncSecret + config.hsyncSecret, // at least 32 characters
  name: config.hsyncBase,
  isSecure: false,
  path: `/${config.hsyncBase}`,
};

config.http = {
  host: '0.0.0.0',
  port: parseInt(process.env.INTERNAL_SOCKET_PORT, 10) || DEFAULTS.INTERNAL_PORT,
  routes: {
    cors: {
      credentials: true,
      origin: ['*'],
    },
    validate: {
      failAction: (request, h, err) => {
        throw err;
      },
    },
  },
};

config.swaggerOptions = {
  info: {
    title: pack.name,
    description: pack.description,
    version: pack.version,
  },
  tags: [
    {
      name: 'api',
      description: 'hsync api',
      externalDocs: {
        description: 'find out more',
        url: 'https://github.com/monteslu/hsync-server',
      },
    },
  ],
  basePath: `/${config.hsyncBase}`,
  documentationPath: `/${config.hsyncBase}/documentation`,
  swaggerUIPath: `/${config.hsyncBase}/swaggerui/`,
  jsonPath: `/${config.hsyncBase}/swagger.json`,
  pathPrefixSize: DEFAULTS.SWAGGER_PATH_PREFIX_SIZE,
};

export default config;
export { DEFAULTS };
