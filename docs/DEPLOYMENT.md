<!-- generated-by: gsd-doc-writer -->
# Deployment Guide

This document describes deployment architecture, build pipelines, production configuration, and rollback procedures for **dithr**.

---

## Deployment Targets

The platform is architected for strict $0/month operations across free-tier serverless and container infrastructure:

| Component | Target Platform | Specification File | Live URL |
|-----------|-----------------|--------------------|----------|
| **Frontend Studio & Landing Page** | Cloudflare Pages | `wrangler.toml` | `https://dithr.pages.dev` (Overview), `https://dithr.pages.dev/studio/` (Studio) |
| **Backend Export API** | Render (Free Web Service) | `render.yaml` | `https://dithr-api.onrender.com` |

---

## Build Pipeline & Deployment Workflows

### 1. Web Studio Deployment (Cloudflare Pages)

The frontend is an optimized SPA built with Vite and deployed directly to Cloudflare's global edge network.

#### Production Build Command
```bash
cd web
npm run build
```
This produces optimized production assets in `web/dist/`, including `index.html`, minified JS/CSS bundles, and `_redirects` for client-side routing.

#### Deploy with Wrangler
```bash
npx wrangler pages deploy web/dist --project-name=dithr --commit-dirty=true
```

Upon successful deployment, Cloudflare immediately propagates DNS and serves the product landing page under `https://dithr.pages.dev/` and the interactive studio under `https://dithr.pages.dev/studio/` with edge SSL and HTTP/3 support. Non-matching paths return a custom 404 page with 404 status.

---

### 2. Export API Backend Deployment (Render)

The backend microservice runs as an auto-managed Python container on Render using declarative Infrastructure-as-Code (`render.yaml`):

```yaml
services:
  - type: web
    name: dithr-api
    runtime: python
    region: oregon
    plan: free
    buildCommand: "pip install -r requirements.txt && pip install -e ."
    startCommand: "uvicorn src.api.main:app --host 0.0.0.0 --port $PORT --workers 1"
    envVars:
      - key: ENVIRONMENT
        value: production
      - key: CORS_ORIGINS
        value: "https://dithr.pages.dev,http://localhost:5173,http://127.0.0.1:5173"
      - key: TURNSTILE_SECRET_KEY
        sync: false
      - key: TURNSTILE_SITE_KEY
        sync: false
```

#### Render Health Checks
Render automatically monitors `GET /api/health`. If the health check returns HTTP 200 within 30 seconds of container boot, traffic is routed to the new container and the old instance is retired.

---

## Production Configuration Reference

### Environment Variables

#### Cloudflare Pages (Frontend)
- `VITE_API_BASE_URL`: Full HTTPS URL of the deployed Render backend (e.g., `https://dithr-api.onrender.com`).
- `VITE_TURNSTILE_SITE_KEY`: Public Cloudflare Turnstile site key.

#### Render (Backend)
- `ENVIRONMENT`: `production`
- `CORS_ORIGINS`: `https://dithr.pages.dev`
- `TURNSTILE_SECRET_KEY`: Private Cloudflare Turnstile secret key.
- `TURNSTILE_SITE_KEY`: Public Cloudflare Turnstile site key.
- `TURNSTILE_DISABLED`: `false` (enforces bot protection in production).

---

## Rollback Procedures

### Frontend Instant Rollback (Cloudflare Pages)
1. **Via Cloudflare Dashboard**:
   - Navigate to **Cloudflare Dashboard** → **Workers & Pages** → **dithr** → **Deployments**.
   - Locate the target previous deployment commit.
   - Click **Rollback to this deployment**.

2. **Via Wrangler CLI**:
   ```bash
   npx wrangler pages deployment list --project-name=dithr
   npx wrangler pages deployment switch <deployment-id> --project-name=dithr
   ```

### Backend Rollback (Render)
1. Navigate to **Render Dashboard** → **dithr-api** → **Events**.
2. Locate the previous successful deploy.
3. Click **Rollback** to revert to the previous container image and restart the service.
