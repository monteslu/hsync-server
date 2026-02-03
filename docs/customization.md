# hsync-server Configuration & Customization

hsync-server creates unlimited public web URLs for your local web servers, no matter where they're running. This guide covers all configuration options.

## Quick Start

```bash
npm install
npm start
```

Server starts on port 3101 by default.

## Environment Variables

All configuration is done via environment variables:

### Required

| Variable | Description |
|----------|-------------|
| `HSYNC_SECRET` | **Required.** Shared secret for authenticated connections. Keep this secure! |

### Server Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3101` | Main HTTP/WebSocket port. Don't change on hosted platforms (Heroku, DO App Platform). |
| `HSYNC_BASE` | `_hs` | URL path prefix for hsync WebSocket connections and API. |
| `HSYNC_SERVER_BASE` | `null` | Custom base URL if running behind a reverse proxy. |
| `INTERNAL_SOCKET_PORT` | `8883` | Internal socket port (rarely needs changing). |

### Unauthenticated Access

| Variable | Default | Description |
|----------|---------|-------------|
| `HSYNC_ALLOW_UNAUTHED_NAMES` | `false` | Allow connections without the secret (generates random subdomain). |
| `HSYNC_UNAUTHED_TIMEOUT` | `10800000` | Timeout for unauthed connections in ms (default: 3 hours). |
| `HSYNC_UNAUTHED_NAME_CHARS` | `8` | Number of random characters for unauthed subdomains. |

### Limits

| Variable | Default | Description |
|----------|---------|-------------|
| `HSYNC_DYNAMIC_MAX` | `10000000` | Maximum dynamic data size in bytes (default: 10MB). |

## Example Configurations

### Basic Self-Hosted

```bash
export HSYNC_SECRET="your-super-secret-key-here"
export PORT=3101
npm start
```

Access at `http://localhost:3101`

### With Custom Domain (Nginx)

```bash
export HSYNC_SECRET="your-super-secret-key-here"
export HSYNC_SERVER_BASE="https://tunnel.yourdomain.com"
npm start
```

Nginx config:
```nginx
server {
    listen 443 ssl;
    server_name tunnel.yourdomain.com *.tunnel.yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3101;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Public Server (Allow Unauthed)

```bash
export HSYNC_SECRET="admin-secret-for-named-tunnels"
export HSYNC_ALLOW_UNAUTHED_NAMES=true
export HSYNC_UNAUTHED_TIMEOUT=3600000  # 1 hour
export HSYNC_UNAUTHED_NAME_CHARS=12    # Longer random names
npm start
```

This allows anyone to create temporary tunnels with random subdomains.

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3101
CMD ["npm", "start"]
```

```bash
docker build -t hsync-server .
docker run -d \
  -p 3101:3101 \
  -e HSYNC_SECRET="your-secret" \
  -e HSYNC_ALLOW_UNAUTHED_NAMES=true \
  hsync-server
```

### Heroku / DigitalOcean App Platform

These platforms set `PORT` automatically. Just configure:

```bash
heroku config:set HSYNC_SECRET="your-secret"
heroku config:set HSYNC_ALLOW_UNAUTHED_NAMES=true
```

## API Endpoints

Once running, the server exposes:

| Endpoint | Description |
|----------|-------------|
| `/{HSYNC_BASE}/documentation` | Swagger API documentation |
| `/{HSYNC_BASE}/swagger.json` | OpenAPI spec |
| `/{HSYNC_BASE}` | WebSocket endpoint for hsync clients |

Default: `http://localhost:3101/_hs/documentation`

## Client Connection

Connect from the [hsync client](https://github.com/monteslu/hsync):

```javascript
import { hsync } from 'hsync';

// Authenticated (gets your chosen subdomain)
hsync({
  server: 'wss://tunnel.yourdomain.com/_hs',
  secret: 'your-secret',
  name: 'myapp',
  local: 'http://localhost:3000'
});
// Result: https://myapp.tunnel.yourdomain.com → localhost:3000

// Unauthenticated (gets random subdomain)
hsync({
  server: 'wss://tunnel.yourdomain.com/_hs',
  local: 'http://localhost:3000'
});
// Result: https://a8x9k2m1.tunnel.yourdomain.com → localhost:3000
```

## Security Considerations

1. **Always use HTTPS in production** - Run behind a TLS-terminating reverse proxy
2. **Keep HSYNC_SECRET secure** - Anyone with this can claim any subdomain
3. **Set reasonable timeouts** - Especially if allowing unauthenticated access
4. **Monitor usage** - Check for abuse if running a public server

## Troubleshooting

### WebSocket connection fails
- Ensure your reverse proxy supports WebSocket upgrades
- Check that `Upgrade` and `Connection` headers are forwarded

### Random subdomains not working
- Set `HSYNC_ALLOW_UNAUTHED_NAMES=true`
- Check that wildcard DNS is configured for your domain

### Cookie issues
- The cookie path is set to `/{HSYNC_BASE}` by default
- Ensure your domain and cookie settings align

## Resources

- [hsync client](https://github.com/monteslu/hsync) - Client library for connecting
- [Report issues](https://github.com/monteslu/hsync-server/issues)
