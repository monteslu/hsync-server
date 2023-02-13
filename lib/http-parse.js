const { HTTPParser, methods } = require('_http_common');
const debug = require('debug')('hsync:parser');
const TIMEOUT = 500;

const kOnHeaders = HTTPParser.kOnHeaders | 0;
const kOnHeadersComplete = HTTPParser.kOnHeadersComplete | 0;
const kOnBody = HTTPParser.kOnBody | 0;
const kOnMessageComplete = HTTPParser.kOnMessageComplete | 0;


function parseReqHeaders(buff) {
  return new Promise((resolve) => {
    const parser = new HTTPParser();
    parser.initialize(HTTPParser.REQUEST, {});

    const info = {
      bodyLength: 0,
      bodyStart: null,
      headers: {},
      finished: false,
      headersFinished: false,
      bodyFinished: false,
    };

    parser.headers = [];

    parser[kOnHeaders] = () => {
      // console.log('kOnHeaders');
    };
    parser[kOnHeadersComplete] = (major, minor, parsedHeaders, methodId, url) => {
      parsedHeaders.forEach((h, idx) => {
        if ((idx % 2) === 0) {
          info.headers[h.toLowerCase()] = parsedHeaders[idx + 1];
        }
      })
      info.method = methods[methodId];
      info.url = url;
      info.major = major;
      info.minor = minor;
      info.host = info.headers.host?.split(':')[0];
      info.length = buff.length;
      if (info.headers['content-length']) {
        const lenParsed = parseInt(info.headers['content-length']);
        info.contentLengthHeader = Number.isNaN(lenParsed) ? null : lenParsed;
      }
      info.headersFinished = true;
      debug('headers complete', info.url);
    };
    parser[kOnBody] = (buff, start, bodyLength) => {
      const size = info.contentLengthHeader;
      debug('kOnBody buff.length', buff.length,'start', start, 'bodyLength', bodyLength, 'contentLength', size)
      info.bodyLength = bodyLength;
      info.bodyStart = start;
      info.bodyFinished = true;

      // this kinda sucks
      const { connection } = info.headers;
      if ((connection === 'close') && size && (size > bodyLength)) {
        // kOnMessageComplete wont fire, so just finish it here
        // console.log('konbody finished');
        resolve(info);
      }
    };
    parser[kOnMessageComplete] = () => {
      info.finished = true;
      debug('kOnMessageComplete');
      // console.log('kOnMessageComplete');
      resolve(info);
    };
    setTimeout(() => {
      if (!info.finished) {
        debug('parse timed out');
        try {
          parser.finish();
        }catch (e) {
          debug('cant stop parse', e);
        }
        resolve(info);
      }
    }, TIMEOUT);
    parser.execute(buff, 0, buff.length);
  });
}

module.exports = {
  parseReqHeaders,
};