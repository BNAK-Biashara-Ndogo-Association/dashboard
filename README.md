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

Members sign in with passwords or configured Google sign-in. Membership and payment history come from the backend; events currently show an empty state. Follow the backend live payment deployment guide before collecting payments.

The standalone admin frontend lives in [`../admin_dashboard`](../admin_dashboard/README.md).

## Authentication tests

Run `npm test` to check the frontend auth service and protected route loader: password and Google request handling, rejected credentials, malformed responses, anonymous session redirects, and signed-in access. These tests mock network responses and load the actual TypeScript services and routes; they do not drive a browser or perform a real Google OAuth exchange. The backend's `server/dashboard-auth.test.mjs` exercises real password hashing, session cookies, member registration, admin permissions, assisted registration, payment recording, activation, logout and expiry in an isolated database.
