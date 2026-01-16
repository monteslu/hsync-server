import { describe, it, expect } from 'vitest';
import config from '../../config.js';

describe('config', () => {
  it('should have default hsyncBase', () => {
    expect(config.hsyncBase).toBe('_hs');
  });

  it('should have default port', () => {
    expect(config.port).toBe(3101);
  });

  it('should have http config', () => {
    expect(config.http).toBeDefined();
    expect(config.http.host).toBe('0.0.0.0');
    expect(config.http.port).toBe(8883);
  });

  it('should have cookies config', () => {
    expect(config.cookies).toBeDefined();
    expect(config.cookies.name).toBe(config.hsyncBase);
    expect(config.cookies.path).toBe(`/${config.hsyncBase}`);
  });

  it('should have swagger options', () => {
    expect(config.swaggerOptions).toBeDefined();
    expect(config.swaggerOptions.basePath).toBe(`/${config.hsyncBase}`);
  });

  it('should have unauthed timeout default of 3 hours', () => {
    expect(config.unauthedTimeout).toBe(1000 * 60 * 60 * 3);
  });

  it('should have default unauthed name chars', () => {
    expect(config.unauthedNameChars).toBe(8);
  });
});
