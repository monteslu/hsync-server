# hsync-server

[![npm version](https://img.shields.io/npm/v/hsync-server.svg)](https://www.npmjs.com/package/hsync-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Server component for [hsync](https://github.com/monteslu/hsync) — creates unlimited public web URLs for your local web servers, no matter where they're running.

## Features

- 🌐 **Reverse proxy** - Expose local servers with public URLs
- 🔌 **WebSocket tunneling** - Real-time bidirectional communication
- 🔐 **Authenticated & anonymous modes** - Secure with shared secret or allow public tunnels
- 📡 **TCP relaying** - Tunnel arbitrary TCP connections between peers via WebRTC
- 🚀 **One-click deploy** - Deploy to Heroku, DigitalOcean, or self-host

## Quick Start

```bash
npm install hsync-server
```

```bash
export HSYNC_SECRET="your-secret-here"
npm start
```

Server runs on port 3101 by default.

## Deploy

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/monteslu/hsync-server)

## Configuration

See [docs/customization.md](./docs/customization.md) for full configuration options including:

- Environment variables
- Nginx reverse proxy setup
- Docker deployment
- Unauthenticated access settings

## Client

Use with the [hsync client](https://github.com/monteslu/hsync):

```bash
npx hsync -s your-server.com -k your-secret -n myapp -p 3000
```

Your local port 3000 is now available at `https://myapp.your-server.com`

## License

MIT
