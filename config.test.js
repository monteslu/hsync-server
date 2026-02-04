import { describe, it, expect } from 'vitest';

describe('hsync-server', () => {
  it('can import config', async () => {
    const config = await import('./config.js');
    expect(config).toBeDefined();
  });
});
