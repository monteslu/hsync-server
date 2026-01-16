import createDebug from 'debug';
import { DEFAULTS } from '../config.js';

const debug = createDebug('hsync:simple-parse');

const r = '\r\n';

async function sleep(millis) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

async function parseReqHeaders(data) {
  const dataStr = data.toString();
  // debug('parsing', dataStr);
  const reqText = dataStr.split(r + r);
  const rawLines = reqText[0].split(r);
  const top = rawLines.shift();
  const [method, url, version] = top.split(' ');
  const headers = {};
  rawLines.forEach((rl) => {
    const [rn, rv] = rl.split(':');
    const headerName = ('' + rn).trim().toLowerCase();
    headers[headerName] = ('' + rv).trim();
  });
  const result = {
    headers,
    top,
    url,
    version,
    method,
    headersFinished: !!headers.host,
    host: headers.host,
  };

  await sleep(DEFAULTS.PARSE_SLEEP_MS);

  return result;
}

function createParser(firstPacket, timeout = DEFAULTS.PARSE_TIMEOUT_MS) {
  let fullData = firstPacket;
  let resolver;
  let timeoutId;

  const p = {
    parse: () => {
      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject('parsing timeout');
        }, timeout);
        resolver = resolve;

        parseReqHeaders(fullData)
          .then((result) => {
            if (result.headersFinished) {
              clearTimeout(timeoutId);
              resolve(result);
            }
          })
          .catch(reject);
      });
    },
    addData: async (data) => {
      fullData = Buffer.concat([fullData, data]);
      const result = await parseReqHeaders(fullData);
      debug('additional pass', result);
      if (result.headersFinished) {
        clearTimeout(timeoutId);
        resolver(result);
      }
    },
  };
  return p;
}

export { createParser, parseReqHeaders };
