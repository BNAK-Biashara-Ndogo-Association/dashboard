# BNAK Member Dashboard

React + TypeScript frontend for the member portal, deployed to Netlify. The Node API lives in the separate [`../backend`](../backend/README.md) folder.

## Local development

Requires Node.js 22.13 or newer. Start the backend in its own terminal using its README, then run:

```powershell
cd member_dashboard
npm ci
npm run dev
```

Vite runs on port 5173 and proxies `/api` to the backend on port 3001. `npm run preview` uses the same API proxy. On Windows use `npm.cmd` if PowerShell blocks `npm`.

## Build and deployment

`npm run build` checks TypeScript and builds `dist`. `npm test` tests Netlify routing. On Netlify, set `API_UPSTREAM` to your deployed backend HTTPS origin and use `npm run build:netlify`; the included `netlify.toml` configures this automatically. See [deployment instructions](DEPLOYMENT.md).

Backend credentials belong in `../backend/.env` or the backend host environment. The dashboard needs no Google or Daraja secrets.

Google login is required, but membership, events, resources and sample payment records remain demo data. Live membership and production payment processing still require implementation.
