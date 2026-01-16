import { describe, it, expect } from 'vitest';
import { parseReqHeaders, createParser } from '../../lib/simple-parse.js';

describe('parseReqHeaders', () => {
  it('should parse a simple GET request', async () => {
    const request = Buffer.from(
      'GET /test HTTP/1.1\r\n' + 'Host: example.com\r\n' + 'User-Agent: test\r\n' + '\r\n'
    );

    const result = await parseReqHeaders(request);

    expect(result.method).toBe('GET');
    expect(result.url).toBe('/test');
    expect(result.version).toBe('HTTP/1.1');
    expect(result.host).toBe('example.com');
    expect(result.headers.host).toBe('example.com');
    expect(result.headers['user-agent']).toBe('test');
    expect(result.headersFinished).toBe(true);
  });

  it('should parse a POST request', async () => {
    const request = Buffer.from(
      'POST /api/data HTTP/1.1\r\n' +
        'Host: api.example.com\r\n' +
        'Content-Type: application/json\r\n' +
        '\r\n' +
        '{"key":"value"}'
    );

    const result = await parseReqHeaders(request);

    expect(result.method).toBe('POST');
    expect(result.url).toBe('/api/data');
    expect(result.headers['content-type']).toBe('application/json');
  });

  it('should handle requests with no host header', async () => {
    const request = Buffer.from('GET / HTTP/1.1\r\n' + '\r\n');

    const result = await parseReqHeaders(request);

    expect(result.headersFinished).toBe(false);
    expect(result.host).toBeUndefined();
  });

  it('should lowercase header names', async () => {
    const request = Buffer.from(
      'GET / HTTP/1.1\r\n' + 'Host: test.com\r\n' + 'X-Custom-Header: value\r\n' + '\r\n'
    );

    const result = await parseReqHeaders(request);

    expect(result.headers['x-custom-header']).toBe('value');
  });
});

describe('createParser', () => {
  it('should parse complete request immediately', async () => {
    const request = Buffer.from('GET /path HTTP/1.1\r\n' + 'Host: myhost.com\r\n' + '\r\n');

    const parser = createParser(request);
    const result = await parser.parse();

    expect(result.url).toBe('/path');
    expect(result.host).toBe('myhost.com');
  });

  it('should handle incremental data', async () => {
    const firstPart = Buffer.from('GET /incremental HTTP/1.1\r\n');
    const parser = createParser(firstPart);

    // Start parsing (won't resolve yet)
    const parsePromise = parser.parse();

    // Add more data
    const secondPart = Buffer.from('Host: incremental.com\r\n\r\n');
    await parser.addData(secondPart);

    const result = await parsePromise;
    expect(result.url).toBe('/incremental');
    expect(result.host).toBe('incremental.com');
  });

  it('should timeout if headers never complete', async () => {
    const incompletePart = Buffer.from('GET /timeout HTTP/1.1\r\n');
    const parser = createParser(incompletePart, 100); // 100ms timeout

    await expect(parser.parse()).rejects.toBe('parsing timeout');
  });
});
