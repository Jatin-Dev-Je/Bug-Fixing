# Bug-Fixing (monorepo)

This repository now uses an npm workspaces layout. The frontend app lives in `frontend/`.

## Quick start

From the repo root:

```powershell
# start dev server
npm run dev

# build the app
npm run build

# preview the built app
npm run preview

# lint sources
npm run lint

# type-check (no emit)
npm run typecheck
```

These scripts proxy to the workspace `frontend`.

## Project structure

- `frontend/` — React + TypeScript + Vite app (all code, configs, and deploy files live here)
  - `vercel.json`, `netlify.toml`, `public/_redirects` — SPA deploy configuration
  - `src/` — application source
  - `public/` — static assets

For app-specific details, see `frontend/README.md`.

## Deploy (monorepo)

- Netlify: this repo includes a root `netlify.toml` that sets `base = "frontend"` so builds run in the app workspace and publish `dist/`. Push to `main` to trigger a deploy.
- Vercel: set the Project “Root Directory” to `frontend` in the Dashboard (Project Settings → General). The `frontend/vercel.json` already defines SPA routing and output directory.
