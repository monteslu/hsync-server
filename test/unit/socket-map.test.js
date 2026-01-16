import { describe, it, expect, beforeEach } from 'vitest';
import sockets from '../../lib/socket-map.js';

describe('socket-map', () => {
  beforeEach(() => {
    // Clear any existing sockets
    for (const key in sockets) {
      delete sockets[key];
    }
  });

  it('should export an object', () => {
    expect(typeof sockets).toBe('object');
  });

  it('should allow adding sockets by id', () => {
    const mockSocket = { id: 'test-123' };
    sockets['test-123'] = mockSocket;
    expect(sockets['test-123']).toBe(mockSocket);
  });

  it('should allow deleting sockets', () => {
    sockets['delete-me'] = { id: 'delete-me' };
    expect(sockets['delete-me']).toBeDefined();
    delete sockets['delete-me'];
    expect(sockets['delete-me']).toBeUndefined();
  });

  it('should allow iterating over sockets', () => {
    sockets['a'] = { id: 'a' };
    sockets['b'] = { id: 'b' };
    const keys = Object.keys(sockets);
    expect(keys).toContain('a');
    expect(keys).toContain('b');
  });
});
