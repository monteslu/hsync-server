import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auth, createDyn, dyns } from '../../lib/auth.js';

// Mock config
vi.mock('../../config.js', () => ({
  default: {
    hsyncSecret: 'test-secret',
    unauthedNames: true,
    serverBase: 'test.hsync.example.com',
    unauthedTimeout: 3600000,
    unauthedNameChars: 8,
  },
}));

describe('auth', () => {
  beforeEach(() => {
    // Clear dyns before each test
    for (const key in dyns) {
      delete dyns[key];
    }
  });

  describe('auth function', () => {
    it('should return true when secret matches hsyncSecret', async () => {
      const result = await auth({}, 'anyhost', 'test-secret');

      expect(result).toBe(true);
    });

    it('should return false when secret does not match', async () => {
      const result = await auth({}, 'anyhost', 'wrong-secret');

      expect(result).toBe(false);
    });

    it('should return false for empty secret', async () => {
      const result = await auth({}, 'anyhost', '');

      expect(result).toBe(false);
    });

    it('should return false for null secret', async () => {
      const result = await auth({}, 'anyhost', null);

      expect(result).toBe(false);
    });

    it('should authenticate dynamic hostname with correct secret', async () => {
      // First create a dynamic hostname
      const dyn = await createDyn();

      const result = await auth({}, dyn.url, dyn.secret);

      expect(result).toBe(true);
    });

    it('should reject dynamic hostname with wrong secret', async () => {
      const dyn = await createDyn();

      const result = await auth({}, dyn.url, 'wrong-secret');

      expect(result).toBe(false);
    });

    it('should use dyn auth over hsyncSecret for dyn hostnames', async () => {
      const dyn = await createDyn();

      // Using the global secret should fail for dyn hostname
      const result = await auth({}, dyn.url, 'test-secret');

      expect(result).toBe(false);
    });
  });

  describe('createDyn function', () => {
    it('should create dynamic hostname entry', async () => {
      const dyn = await createDyn();

      expect(dyn).toBeDefined();
      expect(dyn.id).toBeTypeOf('string');
      expect(dyn.secret).toBeTypeOf('string');
      expect(dyn.url).toBeTypeOf('string');
    });

    it('should generate id with correct length', async () => {
      const dyn = await createDyn();

      expect(dyn.id).toHaveLength(8); // unauthedNameChars = 8
    });

    it('should generate url with serverBase', async () => {
      const dyn = await createDyn();

      expect(dyn.url).toMatch(/\.test\.hsync\.example\.com$/);
      expect(dyn.url).toBe(`${dyn.id}.test.hsync.example.com`);
    });

    it('should set created timestamp', async () => {
      const before = Date.now();
      const dyn = await createDyn();
      const after = Date.now();

      expect(dyn.created).toBeGreaterThanOrEqual(before);
      expect(dyn.created).toBeLessThanOrEqual(after);
    });

    it('should set lastAccessed same as created', async () => {
      const dyn = await createDyn();

      expect(dyn.lastAccessed).toBe(dyn.created);
    });

    it('should set timeout from config', async () => {
      const dyn = await createDyn();

      expect(dyn.timeout).toBe(3600000);
    });

    it('should store dyn in dyns object', async () => {
      const dyn = await createDyn();

      expect(dyns[dyn.url]).toBe(dyn);
    });

    it('should create unique ids for multiple calls', async () => {
      const dyn1 = await createDyn();
      const dyn2 = await createDyn();
      const dyn3 = await createDyn();

      expect(dyn1.id).not.toBe(dyn2.id);
      expect(dyn2.id).not.toBe(dyn3.id);
      expect(dyn1.id).not.toBe(dyn3.id);
    });

    it('should create unique secrets for multiple calls', async () => {
      const dyn1 = await createDyn();
      const dyn2 = await createDyn();

      expect(dyn1.secret).not.toBe(dyn2.secret);
    });

    it('should only use allowed characters in id', async () => {
      const allowedChars = '23456789abcdefghjkmnpqrtvwxyz';

      for (let i = 0; i < 10; i++) {
        const dyn = await createDyn();
        for (const char of dyn.id) {
          expect(allowedChars).toContain(char);
        }
      }
    });
  });

  describe('dyns object', () => {
    it('should be an object', () => {
      expect(dyns).toBeTypeOf('object');
    });

    it('should start empty in tests', () => {
      expect(Object.keys(dyns)).toHaveLength(0);
    });

    it('should accumulate dyn entries', async () => {
      await createDyn();
      await createDyn();
      await createDyn();

      expect(Object.keys(dyns)).toHaveLength(3);
    });

    it('should be modifiable', async () => {
      const dyn = await createDyn();
      const url = dyn.url;

      delete dyns[url];

      expect(dyns[url]).toBeUndefined();
    });
  });
});

describe('auth with disabled dynamic names', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should throw when unauthedNames is false', async () => {
    vi.doMock('../../config.js', () => ({
      default: {
        hsyncSecret: 'test-secret',
        unauthedNames: false,
        serverBase: 'test.hsync.example.com',
      },
    }));

    const { createDyn: createDynDisabled } = await import('../../lib/auth.js');

    await expect(createDynDisabled()).rejects.toThrow();
  });

  it('should throw when serverBase is not set', async () => {
    vi.doMock('../../config.js', () => ({
      default: {
        hsyncSecret: 'test-secret',
        unauthedNames: true,
        serverBase: null,
      },
    }));

    const { createDyn: createDynNoBase } = await import('../../lib/auth.js');

    await expect(createDynNoBase()).rejects.toThrow();
  });
});
