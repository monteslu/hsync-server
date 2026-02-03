const { describe, it, expect } = require('vitest');
const { parseReqHeaders, createParser } = require('../lib/simple-parse');

describe('simple-parse', () => {
  describe('parseReqHeaders', () => {
    it('parses a simple GET request', async () => {
      const request = Buffer.from(
        'GET /path HTTP/1.1\r\n' +
        'Host: example.com\r\n' +
        'User-Agent: test\r\n' +
        '\r\n'
      );
      
      const result = await parseReqHeaders(request);
      
      expect(result.method).toBe('GET');
      expect(result.url).toBe('/path');
      expect(result.version).toBe('HTTP/1.1');
      expect(result.headers.host).toBe('example.com');
      expect(result.headers['user-agent']).toBe('test');
      expect(result.headersFinished).toBe(true);
    });

    it('parses a POST request with content-type', async () => {
      const request = Buffer.from(
        'POST /api/data HTTP/1.1\r\n' +
        'Host: api.example.com\r\n' +
        'Content-Type: application/json\r\n' +
        'Content-Length: 13\r\n' +
        '\r\n' +
        '{"foo":"bar"}'
      );
      
      const result = await parseReqHeaders(request);
      
      expect(result.method).toBe('POST');
      expect(result.url).toBe('/api/data');
      expect(result.headers['content-type']).toBe('application/json');
      expect(result.headers['content-length']).toBe('13');
    });

    it('handles missing host header', async () => {
      const request = Buffer.from(
        'GET / HTTP/1.1\r\n' +
        '\r\n'
      );
      
      const result = await parseReqHeaders(request);
      
      expect(result.headersFinished).toBe(false);
    });
  });

  describe('createParser', () => {
    it('creates a parser that resolves on complete headers', async () => {
      const request = Buffer.from(
        'GET /test HTTP/1.1\r\n' +
        'Host: test.local\r\n' +
        '\r\n'
      );
      
      const parser = createParser(request);
      const result = await parser.parse();
      
      expect(result.headersFinished).toBe(true);
      expect(result.host).toBe('test.local');
    });

    it('can add data incrementally', async () => {
      const part1 = Buffer.from('GET /test HTTP/1.1\r\n');
      const part2 = Buffer.from('Host: incremental.local\r\n\r\n');
      
      const parser = createParser(part1);
      const parsePromise = parser.parse();
      
      // Add remaining data
      await parser.addData(part2);
      
      const result = await parsePromise;
      expect(result.host).toBe('incremental.local');
    });
  });
});
