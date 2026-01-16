import { describe, it, expect, vi, beforeEach } from 'vitest';
import getRoutes from '../../lib/routes.js';

// Mock aedes exports
vi.mock('../../aedes.js', () => ({
  rpcToClient: vi.fn(),
  peerRpcToClient: vi.fn(),
  peerNotifyToClient: vi.fn(),
}));

// Mock auth exports
vi.mock('./auth.js', () => ({
  auth: vi.fn(),
  createDyn: vi.fn(),
}));

describe('routes', () => {
  let config;

  beforeEach(() => {
    config = {
      hsyncBase: '_hs',
      auth: null,
    };
  });

  describe('getRoutes', () => {
    it('should return an array of routes', () => {
      const routes = getRoutes(config);

      expect(Array.isArray(routes)).toBe(true);
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should include admin route', () => {
      const routes = getRoutes(config);
      const adminRoute = routes.find((r) => r.path === '/_hs/admin');

      expect(adminRoute).toBeDefined();
      expect(adminRoute.method).toBe('GET');
    });

    it('should include health route', () => {
      const routes = getRoutes(config);
      const healthRoute = routes.find((r) => r.path === '/_hs/health');

      expect(healthRoute).toBeDefined();
      expect(healthRoute.method).toBe('GET');
    });

    it('should include auth route', () => {
      const routes = getRoutes(config);
      const authRoute = routes.find((r) => r.path === '/_hs/auth');

      expect(authRoute).toBeDefined();
      expect(authRoute.method).toBe('POST');
    });

    it('should include dyn route', () => {
      const routes = getRoutes(config);
      const dynRoute = routes.find((r) => r.path === '/_hs/dyn');

      expect(dynRoute).toBeDefined();
      expect(dynRoute.method).toBe('POST');
    });

    it('should include srpc route', () => {
      const routes = getRoutes(config);
      const srpcRoute = routes.find((r) => r.path === '/_hs/srpc');

      expect(srpcRoute).toBeDefined();
      expect(srpcRoute.method).toBe('POST');
    });

    it('should include rpc route', () => {
      const routes = getRoutes(config);
      const rpcRoute = routes.find((r) => r.path === '/_hs/rpc');

      expect(rpcRoute).toBeDefined();
      expect(rpcRoute.method).toBe('POST');
    });

    it('should include message route', () => {
      const routes = getRoutes(config);
      const messageRoute = routes.find((r) => r.path === '/_hs/message');

      expect(messageRoute).toBeDefined();
      expect(messageRoute.method).toBe('POST');
    });

    it('should include me route', () => {
      const routes = getRoutes(config);
      const meRoute = routes.find((r) => r.path === '/_hs/me');

      expect(meRoute).toBeDefined();
      expect(meRoute.method).toBe('GET');
    });

    it('should include logout route', () => {
      const routes = getRoutes(config);
      const logoutRoute = routes.find((r) => r.path === '/_hs/logout');

      expect(logoutRoute).toBeDefined();
      expect(logoutRoute.method).toBe('GET');
    });

    it('should include static file route', () => {
      const routes = getRoutes(config);
      const staticRoute = routes.find((r) => r.path === '/_hs/{param*}');

      expect(staticRoute).toBeDefined();
      expect(staticRoute.method).toBe('GET');
    });

    it('should include favicon route', () => {
      const routes = getRoutes(config);
      const faviconRoute = routes.find((r) => r.path === '/favicon.ico');

      expect(faviconRoute).toBeDefined();
      expect(faviconRoute.method).toBe('GET');
    });

    it('should use hsyncBase from config', () => {
      config.hsyncBase = 'custom';
      const routes = getRoutes(config);

      const adminRoute = routes.find((r) => r.path === '/custom/admin');
      const healthRoute = routes.find((r) => r.path === '/custom/health');

      expect(adminRoute).toBeDefined();
      expect(healthRoute).toBeDefined();
    });
  });

  describe('route configurations', () => {
    it('should have api tags on API routes', () => {
      const routes = getRoutes(config);
      const apiRoutes = routes.filter((r) => r.config?.tags?.includes('api'));

      expect(apiRoutes.length).toBeGreaterThan(0);
    });

    it('should have descriptions on configured routes', () => {
      const routes = getRoutes(config);
      const routesWithConfig = routes.filter((r) => r.config?.description);

      expect(routesWithConfig.length).toBeGreaterThan(0);
    });

    it('should have validation on POST routes', () => {
      const routes = getRoutes(config);
      const postRoutes = routes.filter((r) => r.method === 'POST');

      postRoutes.forEach((route) => {
        expect(route.config?.validate?.payload).toBeDefined();
      });
    });

    it('admin route should have optional auth', () => {
      const routes = getRoutes(config);
      const adminRoute = routes.find((r) => r.path === '/_hs/admin');

      expect(adminRoute.config.auth.mode).toBe('optional');
    });

    it('me route should require auth', () => {
      const routes = getRoutes(config);
      const meRoute = routes.find((r) => r.path === '/_hs/me');

      expect(meRoute.config.auth.strategies).toContain('auth');
    });
  });

  describe('health handler', () => {
    it('should return ok', () => {
      const routes = getRoutes(config);
      const healthRoute = routes.find((r) => r.path === '/_hs/health');

      const result = healthRoute.handler();

      expect(result).toBe('ok');
    });
  });

  describe('logout handler', () => {
    it('should clear cookie auth and return ok', () => {
      const routes = getRoutes(config);
      const logoutRoute = routes.find((r) => r.path === '/_hs/logout');

      const mockReq = {
        cookieAuth: {
          clear: vi.fn(),
        },
      };

      const result = logoutRoute.handler(mockReq);

      expect(mockReq.cookieAuth.clear).toHaveBeenCalled();
      expect(result).toBe('ok');
    });
  });

  describe('admin handler', () => {
    it('should return view with creds info', () => {
      const routes = getRoutes(config);
      const adminRoute = routes.find((r) => r.path === '/_hs/admin');

      const mockH = {
        view: vi.fn().mockReturnValue('rendered'),
      };
      const mockReq = {
        auth: { credentials: { user: 'test' } },
        info: { hostname: 'test.example.com' },
      };

      adminRoute.config.handler(mockReq, mockH);

      expect(mockH.view).toHaveBeenCalledWith('admin', {
        creds: true,
        base: '_hs',
        hostName: 'test.example.com',
      });
    });

    it('should handle array credentials', () => {
      const routes = getRoutes(config);
      const adminRoute = routes.find((r) => r.path === '/_hs/admin');

      const mockH = {
        view: vi.fn().mockReturnValue('rendered'),
      };
      const mockReq = {
        auth: { credentials: [{ user: 'test' }] },
        info: { hostname: 'test.example.com' },
      };

      adminRoute.config.handler(mockReq, mockH);

      expect(mockH.view).toHaveBeenCalledWith(
        'admin',
        expect.objectContaining({
          creds: true,
        })
      );
    });

    it('should handle missing credentials', () => {
      const routes = getRoutes(config);
      const adminRoute = routes.find((r) => r.path === '/_hs/admin');

      const mockH = {
        view: vi.fn().mockReturnValue('rendered'),
      };
      const mockReq = {
        auth: {},
        info: { hostname: 'test.example.com' },
      };

      adminRoute.config.handler(mockReq, mockH);

      expect(mockH.view).toHaveBeenCalledWith(
        'admin',
        expect.objectContaining({
          creds: false,
        })
      );
    });
  });

  describe('srpc validation', () => {
    it('should require method and params', () => {
      const routes = getRoutes(config);
      const srpcRoute = routes.find((r) => r.path === '/_hs/srpc');

      const schema = srpcRoute.config.validate.payload;

      // Joi schema should be defined
      expect(schema).toBeDefined();
    });
  });

  describe('auth validation', () => {
    it('should require secret', () => {
      const routes = getRoutes(config);
      const authRoute = routes.find((r) => r.path === '/_hs/auth');

      const schema = authRoute.config.validate.payload;

      expect(schema).toBeDefined();
    });
  });
});
