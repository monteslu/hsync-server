const r = '\r\n';

function parseReqHeaders(data) {
  const dataStr = data.toString();
  // console.log('parsing', dataStr);
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

  return result;
}

function createParser(firstPacket, timeout = 2000) {
  let fullData = firstPacket;
  let resolver, timeoutId;

  const p = {
    parse: () => {
      return new Promise((resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject('parsing timeout');
        }, timeout);
        resolver = resolve;
        
        const result = parseReqHeaders(fullData);
        // console.log('parse first pass', result);
        if (result.headersFinished) {
          clearTimeout(timeoutId);
          resolve(result);
        }
      });
    },
    addData: (data) => {
      fullData = Buffer.concat(fullData, data);
      const result = parseReqHeaders(fullData);
      console.log('additional pass', result);
      if (result.headersFinished) {
        clearTimeout(timeoutId);
        resolve(result);
      }
    }
  }
  return p;
}

module.exports = {
  createParser,
  parseReqHeaders,
};