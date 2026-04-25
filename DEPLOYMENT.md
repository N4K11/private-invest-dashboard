# Deployment Guide

This document covers the stable production deployment path for the private investment dashboard.

## Deployment targets
- Vercel
- VPS with Caddy or Nginx
- Docker-based VPS deployment

## Required environment
Minimum production env:
- `PRIVATE_DASHBOARD_SLUG`
- `DASHBOARD_SECRET_TOKEN`
- `NEXT_PUBLIC_SITE_URL`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_JSON`
  or
  `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

Optional but recommended:
- `COINGECKO_API_KEY`
- `CACHE_DRIVER`
- `CACHE_REDIS_REST_URL`
- `CACHE_REDIS_REST_TOKEN`
- `CACHE_KEY_PREFIX`

## Pre-deploy checklist
Run before every release:

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run verify:bundle
```

If `.env.local` exists and Google Sheets is configured:

```bash
node --env-file=.env.local scripts/validate-google-sheet.mjs
```

Manual checklist:
- private slug is long and rotated if needed
- dashboard secret token is long and rotated if needed
- service account still has access to the target file
- if admin mode is required, service account has `Editor`
- `NEXT_PUBLIC_SITE_URL` matches the final domain
- if external cache is enabled, Redis REST credentials are valid
- private route is not linked from the public homepage
- DNS already points to the deployment target
- TLS/HTTPS is enabled

## Security checklist
Expected production behavior:
- `/invest-dashboard/*` returns `no-store` and `X-Robots-Tag: noindex, nofollow`
- `/api/private/*` is inaccessible without token or session cookie
- private API routes return `401` without token
- rate limit returns `429` after repeated abuse
- dashboard secrets do not appear in `.next/static`
- `robots.txt` denies `/invest-dashboard` and `/api/private`

## Vercel deployment
1. Import the GitHub repository into Vercel.
2. Add all production env vars.
3. Redeploy after every secret rotation.
4. Open the private dashboard URL:
   `https://your-domain.com/invest-dashboard/<slug>`
5. Verify:
   - dashboard loads after token auth
   - `/api/private/portfolio` returns `401` without token
   - `/api/private/health` works with token

## VPS deployment without Docker
1. Clone the repository on the server.
2. Create `.env.local`.
3. Install dependencies:

```bash
npm install
```

4. Build the app:

```bash
npm run build
npm run verify:bundle
```

5. Start the app:

```bash
npm run start
```

6. Put Caddy or Nginx in front of the Node process.

## VPS deployment with Docker
1. Copy the repo or release archive to the server.
2. Create `.env.local` or inject env vars through Docker Compose.
3. Build the image:

```bash
docker compose build dashboard
```

4. Start the container:

```bash
docker compose up -d dashboard
```

5. Verify private routes and APIs after the container is healthy.

## Caddy example
```caddyfile
your-domain.com {
  encode zstd gzip

  header {
    Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
  }

  reverse_proxy 127.0.0.1:3000
}
```

## Nginx example
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Domain setup
- point the `A` record to the VPS IP or connect the domain to Vercel
- wait for DNS propagation
- enable HTTPS
- verify that the root domain is not advertising the private dashboard path

## External cache setup
If you want shared cache across instances, enable Redis REST:

```env
CACHE_DRIVER=redis_rest
CACHE_REDIS_REST_URL=https://your-upstash-or-compatible-endpoint
CACHE_REDIS_REST_TOKEN=your-token
CACHE_KEY_PREFIX=private-invest-dashboard
```

Behavior:
- local memory cache stays active as L1 cache
- Redis REST acts as shared fallback/storage layer
- if Redis is unavailable, the app falls back to memory cache instead of failing hard

## Troubleshooting
### Dashboard returns `401`
- check the `token` query param or login form token
- verify `DASHBOARD_SECRET_TOKEN`
- clear old cookie and re-login

### Dashboard loads but shows fallback/demo data
- verify Google Sheets env vars
- verify service account access to the file
- if the file is a Drive-hosted Excel workbook, enable Google Drive API too

### Admin mode shows read-only
- service account most likely has `Viewer`
- upgrade access to `Editor`

### External cache is degraded
- verify `CACHE_REDIS_REST_URL`
- verify `CACHE_REDIS_REST_TOKEN`
- confirm outbound network access from the deployment target
- the app should continue on memory cache while Redis is unavailable

### Bundle safety check fails
- inspect `.next/static`
- ensure only `NEXT_PUBLIC_*` vars are client-visible
- keep `getEnv()` and server credentials in server-only modules

## Post-deploy smoke test
Recommended checks:

```bash
curl -I https://your-domain.com/robots.txt
curl -I https://your-domain.com/invest-dashboard/<slug>
curl -i https://your-domain.com/api/private/portfolio
curl -i -H "x-dashboard-token: YOUR_TOKEN" https://your-domain.com/api/private/portfolio
curl -i -H "x-dashboard-token: YOUR_TOKEN" https://your-domain.com/api/private/health
```

Expected:
- `robots.txt` denies private paths
- dashboard route returns `200` only after auth flow
- private portfolio API returns `401` without token
- private APIs return `200` with token
