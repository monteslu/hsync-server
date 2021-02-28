module.exports = {
  HSYNC_SECRET : process.env.HSYNC_SECRET, // keep it secret, keep it safe!
  HSYNC_BASE: process.env.HSYNC_BASE || '_hs', // this is where the hsync client websockets will connect
  INTERNAL_SOCKET_PORT: parseInt(process.env.INTERNAL_SOCKET_PORT) || 8883, // doesn't really matter, just pick a high port
  MAX_BYTES_PARSE : parseInt(process.env.MAX_BYTES_PARSE) || 10000, // max number of byets to read from first http data chunck
  PORT: process.env.PORT || 3101, // don't change this if deploying to app host like heroku or digital ocean
};