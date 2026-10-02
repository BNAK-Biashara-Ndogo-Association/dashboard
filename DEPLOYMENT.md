# Netlify dashboard and separate Node API

The public website (`../bnak_site`) and this member dashboard are separate Netlify sites. Deploy the dashboard on its selected domain, `member.biasharandogoassociatonofkenya.com`, and link to it from the public website. The backend runs as one persistent Node process behind HTTPS. This configuration prepares hosted testing; the product still uses demo membership data and sandbox payments. It is not ready to collect real membership payments.

## Backend

The selected backend host is a Contabo VPS. Use the [Contabo deployment guide](../backend/CONTABO.md) and Compose stack in `../backend` for setup, HTTPS and persistent storage.

Use Node 22.13 or later. Set the service root to `backend` when deploying the containing workspace, or the repository root when deploying the backend folder alone. Install with `npm ci --omit=dev`; start with `npm start`. Alternatively build the included Dockerfile using `../backend` as its build context. Configure HTTPS termination at the hosting service.

Set these backend environment variables:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` (enables Secure cookies and deployment validation) |
| `HOST` | `0.0.0.0` |
| `PORT` | Hosting-assigned port; defaults to `3001` |
| `API_HOSTS` | Exact backend hostname, e.g. `api.biasharandogoassociatonofkenya.com`; comma-separated if multiple hosts are required, without scheme or port |
| `APP_ORIGINS` | Exact HTTPS dashboard origin, e.g. `https://member.biasharandogoassociatonofkenya.com`; comma-separated, without trailing slashes |
| `GOOGLE_CLIENT_ID` | Google Web application client ID |
| `PAYMENT_DATA_FILE` | Absolute file path on a persistent volume, e.g. `/data/payments.json` |
| `MPESA_ENV` | `sandbox`; live mode is rejected |

Register the dashboard origin in Google's authorized JavaScript origins. Use the canonical dashboard domain for login; any extra Netlify domain used for login must also be listed in Google and `APP_ORIGINS`. Do not allow arbitrary deploy-preview origins against the production API.

Mount persistent storage at `/data` for Docker and ensure the `node` user can write to it. Keep exactly one API instance: the JSON payment ledger and memory sessions do not support multiple workers. Back up the ledger and test recovery. Restarting the API currently signs users out.

`GET /api/health` is an unauthenticated liveness check returning only `{"status":"ok"}`. It does not claim that Google, Daraja, storage or live membership services are ready. Hosting load balancers may use this path without an allowed Host header. Other API routes require an allowed host, except the secret-authenticated Daraja callback.

For sandbox payment testing, also configure the server-only Daraja variables from `../backend/.env.example`. Point the callback directly to `https://api.biasharandogoassociatonofkenya.com/api/mpesa/callback/YOUR-SECRET`. Keep callback paths out of access logs because they contain a secret. Do not place credentials in Netlify frontend variables or commit a `.env` file.

## Netlify dashboard

Select `member_dashboard` as the base directory if deploying the workspace; leave the base empty if this dashboard is the repository root. The included `netlify.toml` uses `npm run build:netlify` and publishes `dist`.

Set the Netlify build variable `API_UPSTREAM=https://api.biasharandogoassociatonofkenya.com` (an origin only). The production origin is supplied by `netlify.toml`; override it for staging. Invalid origins fail the Netlify build. The Netlify build generates `dist/_redirects` with the API proxy first and the React route fallback second. Ordinary `npm run build` also includes the production rules from `public/_redirects`, so manual uploads preserve routing. Browser calls remain relative `/api/...`, allowing the existing HttpOnly cookies to stay on the dashboard origin. No frontend API URL or cross-origin cookie configuration is needed. This follows [Netlify's proxy routing documentation](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/).

Use a separate API and Google configuration for staging. Set `API_UPSTREAM` per deploy context so previews do not accidentally access the main service. The existing public website has its own Netlify configuration and is deployed independently.

## Verify after deployment

1. Run `npm test` in `backend`, then `npm test` and `npm run build` in `member_dashboard` before release.
2. Verify `/api/health` directly on the backend and through the dashboard domain returns JSON, not the SPA HTML.
3. Open `/dashboard/payments` directly and refresh to verify React routing.
4. Sign in using Google on the canonical dashboard domain. Inspect the session cookie for Secure, HttpOnly and SameSite=Lax; refresh, then sign out and confirm protected API access returns 401.
5. Using sandbox credentials, initiate and reconcile a sandbox payment, then restart the API and confirm payment history persists after signing in again. Test the public callback with the actual provider.

Local automated tests use stubs; they cannot verify deployed TLS, proxy cookie forwarding, Google configuration or Safaricom connectivity.

## Remaining live-launch work

- Replace `src/services/memberService.ts` demo records with database-backed members, membership status, events and resources. Map Google identities to approved association members and enforce authorization on the server.
- Replace memory sessions and the single-process JSON ledger with persistent stores appropriate for deployment, including transactional payment idempotency, migrations, backups and restore checks.
- Implement live payment/invoice reconciliation and membership renewal updates, then verify with approved Daraja production credentials. Do not remove the sandbox guard to skip this work.
- Add deployment monitoring, error reporting, abuse controls and a reconciliation procedure for uncertain payment outcomes. Complete end-to-end testing on the actual domains before inviting members.
