# Self-Hosting Guide

RetroBoard Pro is a single TypeScript application that serves everything — API, WebSocket, and frontend — from one process. No reverse proxy required, no microservices to orchestrate.

## Production Build

```bash
cd services/retroboard-server

# Build the backend (outputs to dist/)
npm run build

# Build the frontend (outputs to dist/client/)
npm run build --prefix client
```

### Start the Server

```bash
DATABASE_URL="postgres://user:pass@db:5432/retroboard" \
JWT_SECRET="your-production-secret-at-least-32-chars" \
NODE_ENV=production \
PORT=3000 \
npm start
```

The server handles:
- REST API at `/api/v1/*`
- WebSocket connections at `/ws`
- Static frontend files (React SPA)
- All on a single port

## Database Setup

### New Installation

```bash
# Create the database
createdb retroboard

# Run all migrations
DATABASE_URL="postgres://user:pass@db:5432/retroboard" npm run db:migrate

# Seed templates and icebreaker questions
DATABASE_URL="postgres://user:pass@db:5432/retroboard" npm run db:seed
```

### Upgrades

When upgrading to a new version, just run migrations again. The runner tracks which migrations have been applied and only runs new ones:

```bash
DATABASE_URL="postgres://user:pass@db:5432/retroboard" npm run db:migrate
```

Migrations are forward-only — there are no rollbacks. Each migration runs in a transaction, so a failed migration won't leave the database in a partial state.

## Deployment Options

### Bare Metal / VM

```bash
# Install Node.js 20+
# Install PostgreSQL 15+
# Clone repo, build, configure env, start

# Use a process manager like pm2:
npm install -g pm2
pm2 start dist/server.js --name retroboard \
  --env DATABASE_URL="..." \
  --env JWT_SECRET="..." \
  --env NODE_ENV=production
```

### Docker

Example `Dockerfile`:

```dockerfile
FROM node:20-slim AS build
WORKDIR /app

COPY services/retroboard-server/package*.json ./
RUN npm ci --production=false

COPY services/retroboard-server/ ./
RUN npm run build

COPY services/retroboard-server/client/package*.json ./client/
RUN cd client && npm ci --production=false
RUN cd client && npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
docker build -t retroboard .
docker run -d \
  -e DATABASE_URL="postgres://user:pass@host:5432/retroboard" \
  -e JWT_SECRET="your-secret" \
  -p 3000:3000 \
  retroboard
```

### Docker Compose

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: retroboard
      POSTGRES_USER: retroboard
      POSTGRES_PASSWORD: secretpass
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  app:
    build: .
    depends_on:
      - db
    environment:
      DATABASE_URL: postgres://retroboard:secretpass@db:5432/retroboard
      JWT_SECRET: change-me-to-a-random-64-char-string-use-openssl-rand
      NODE_ENV: production
    ports:
      - "3000:3000"

volumes:
  pgdata:
```

```bash
docker compose up -d
docker compose exec app npm run db:migrate
docker compose exec app npm run db:seed
```

## Multi-Tenant Setup

If you run multiple applications on a shared PostgreSQL instance, use schema isolation instead of separate databases:

```bash
# Each app gets its own schema
DB_SCHEMA=retroboard DATABASE_URL="postgres://localhost/shared_db" npm run db:migrate
DB_SCHEMA=retroboard DATABASE_URL="postgres://localhost/shared_db" npm start
```

This creates all RetroBoard tables inside the `retroboard` schema. Other apps can use different schemas on the same database. See [Configuration — Schema Isolation](./configuration.md#schema-isolation) for details.

### Database Users

For additional isolation, create dedicated PostgreSQL users per app:

```sql
-- Create a user for RetroBoard
CREATE USER retroboard_app WITH PASSWORD 'strong-password';

-- Create the schema and grant access
CREATE SCHEMA retroboard AUTHORIZATION retroboard_app;

-- Grant connect privilege
GRANT CONNECT ON DATABASE shared_db TO retroboard_app;
```

Then configure:
```bash
DB_SCHEMA=retroboard
DATABASE_URL="postgres://retroboard_app:strong-password@localhost:5432/shared_db"
```

## Reverse Proxy (Optional)

RetroBoard Pro works fine without a reverse proxy, but if you want TLS termination or path-based routing:

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name retro.yourcompany.com;

    ssl_certificate     /etc/ssl/certs/retro.crt;
    ssl_certificate_key /etc/ssl/private/retro.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

The `Upgrade` and `Connection` headers are essential for WebSocket connections.

### Caddy

```
retro.yourcompany.com {
    reverse_proxy localhost:3000
}
```

Caddy handles TLS automatically and supports WebSocket out of the box.

## Health Check

The server exposes a health endpoint:

```bash
curl http://localhost:3000/api/v1/health
```

Use this for load balancer health checks, Docker `HEALTHCHECK`, or uptime monitoring.

## Backups

RetroBoard Pro stores everything in PostgreSQL. Back up the database and you've backed up everything:

```bash
# Full backup
pg_dump -Fc retroboard > retroboard_$(date +%Y%m%d).dump

# Restore
pg_restore -d retroboard retroboard_20260218.dump
```

For multi-tenant setups, back up schema-specific data:

```bash
pg_dump -Fc -n retroboard shared_db > retroboard_schema_$(date +%Y%m%d).dump
```

## Security Checklist

- [ ] `JWT_SECRET` is a cryptographically random string (not a dictionary word)
- [ ] `NODE_ENV=production` is set (enables security headers, disables debug output)
- [ ] `DISABLE_RATE_LIMIT` is **not** set (rate limiting active)
- [ ] PostgreSQL is not exposed to the internet (bind to localhost or use firewall)
- [ ] Database credentials use a dedicated user with minimal privileges
- [ ] TLS is enabled (via reverse proxy or managed platform)
- [ ] Database backups are scheduled and tested
