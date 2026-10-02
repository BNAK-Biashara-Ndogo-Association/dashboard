# BNAK Member Portal

A responsive React + TypeScript member dashboard, built with Vite, Tailwind CSS, React Router and Lucide icons.

```powershell
cd member_dashboard
npm install
npm run dev
```

Requires Node.js 22.13 or newer. `npm run dev` starts Vite on port 5173 and the sandbox payment API on port 3001. On Windows with PowerShell script execution disabled, use `npm.cmd` in place of `npm`.

Run `npm run build` to check TypeScript and create a production build. `npm run preview` serves the built app; run `npm run server` separately for payments in preview. `npm test` runs authentication and payment integration tests with stubbed Daraja responses and temporary payment ledgers. Tests do not send payment prompts or require credentials.

The portal starts at `/dashboard`. Profile, membership, payments, events and resources are available through the sidebar. Event detail pages, profile options, notifications and the mobile drawer are interactive. Google sign-in is required. Logout invalidates the server session.

`src/types` contains reusable data models; `src/services/memberService.ts` provides mock member data. `src/services/paymentService.ts` connects the Payments screen to the Node payment server. Sandbox payments are kept separate from mock payment records and do not extend membership validity. Google authentication is included; association membership verification and an admin dashboard are not.

Production hosting must rewrite application routes to `index.html` for direct links and refreshes to work with BrowserRouter. Vite provides this fallback during development.

## Daraja sandbox setup

Before using payments, complete Google sign-in setup below.

1. Create a sandbox app with M-PESA Express enabled in the [Safaricom Daraja portal](https://developer.safaricom.co.ke/apis). Get its consumer key, consumer secret, test shortcode and Lipa na M-PESA passkey from your sandbox credentials. The integration implements OAuth, M-PESA Express STK Push and STK Query; the [official Safaricom SDK](https://github.com/safaricom/mpesa-php-sdk/blob/master/src/Mpesa.php) documents these request fields and endpoints.
2. Copy `.env.example` to `.env`. Set `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE` and `MPESA_PASSKEY`. Leave `MPESA_ENV=sandbox`. Never put secrets in `VITE_*` variables or frontend code. `.env` and local payment data are gitignored.
3. Generate a callback secret: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Save it as `MPESA_CALLBACK_SECRET`.
4. Expose **port 3001** through your chosen HTTPS tunnel. Set `MPESA_CALLBACK_URL=https://YOUR-TUNNEL/api/mpesa/callback/YOUR-SECRET`. Preserve the tunnel's public Host header; do not rewrite it to localhost. Only the callback route is intended to be public. The API rejects other routes through a public hostname.
5. Restart `npm run dev`, open `/dashboard/payments`, and enter the phone number supported by your sandbox test setup. The server fixes the test renewal amount at KES 3,000. Follow any test prompt on the phone; never enter an M-PESA PIN in this app. Sandbox behavior depends on Safaricom's test setup and is not a live membership payment.
6. Accepted requests remain pending until the authenticated STK Query endpoint confirms success or failure. The UI polls every 15 seconds for two minutes; use **Check payment status** for later reconciliation. Reloading the page reloads the local payment history.

Without credentials the portal still runs and displays a setup-required state. Actual Safaricom connectivity must be tested with your own sandbox credentials and a reachable HTTPS callback.

## Server behavior

- `GET /api/mpesa/config`: setup readiness and the server-owned renewal product; never returns secrets.
- `GET /api/mpesa/payments`: saved sandbox attempts, with no full phone numbers or idempotency keys exposed.
- `POST /api/mpesa/payments`: `{ "phone": "0712345678", "productId": "annual-renewal" }` with an `Idempotency-Key` header. Browser requests must originate from `APP_ORIGINS`.
- `POST /api/mpesa/payments/:id/refresh`: checks status using server-side Daraja credentials.
- `POST /api/mpesa/callback/:secret`: promptly acknowledges callbacks and triggers a status query for a matching known transaction. Callback claims alone never mark a payment paid. Duplicate and unknown callbacks do not create records or overwrite terminal status.

The single-process sandbox ledger is atomically saved to `server/data/payments.json` and survives restarts. Use only one payment server against that file. OAuth tokens are cached in server memory; outbound calls have timeouts. Pending requests block new prompts, duplicate keys return the same attempt, and prompt/query cooldowns limit accidental repeated calls. Transport failures during initiation remain pending because Safaricom may have accepted the request. An attempt without a returned checkout ID requires manual reconciliation in the Daraja sandbox logs; do not clear it or resend until its outcome is known. The ledger deliberately stores no unverified receipt number.

This service binds to localhost and supports sandbox only. Live payments still require association membership verification, a transactional shared database, payment/invoice reconciliation, production operational controls, and approved Daraja production credentials. Changing `MPESA_ENV` alone cannot enable live payments.

## Google sign-in setup

1. In [Google Cloud / Google Auth Platform](https://console.cloud.google.com/auth/overview), configure the consent screen and create an OAuth client of type **Web application**. Add test users if the app is in testing mode.
2. Add the exact dashboard addresses you use to **Authorized JavaScript origins**: `http://localhost:5173` and `http://127.0.0.1:5173`. For preview also register `http://localhost:4173` and `http://127.0.0.1:4173`. This uses the Google Identity Services popup callback, so no redirect URI or client secret is needed. See [Google's setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).
3. Copy `.env.example` to `.env` if needed, preserving any existing payment settings. Set `GOOGLE_CLIENT_ID` to the Web client ID ending in `.apps.googleusercontent.com`, then restart `npm run dev`.
4. Open `/dashboard`. You will be sent to `/login`; after Google sign-in you return to the requested dashboard page. Sign out using the header or sidebar.

The server verifies the ID token's signature, audience, issuer and expiry using Google's official authentication library, and checks a one-use browser-bound nonce and verified email. Identity is keyed by Google's stable `sub` identifier. Tokens are never stored in browser storage. Sessions use random, HttpOnly, SameSite cookies, expire after eight hours, and are deleted on logout. Cookies also use Secure when `NODE_ENV=production`. Sessions are in memory: restarting the server signs everyone out. Deployment beyond this local sandbox needs HTTPS, an explicit hosting/origin configuration, and a shared persistent session store.

`GET /api/auth/config` provides the public client ID and a short-lived sign-in nonce. `POST /api/auth/google` accepts a Google credential, `GET /api/auth/session` returns the signed-in user or null, and `POST /api/auth/logout` invalidates the session. Login and logout require an allowed Origin. Payment endpoints require a session; payment attempts and idempotency keys are scoped to the Google account. Existing unowned sandbox ledger entries are not exposed to newly signed-in users; callbacks can still reconcile them.

Any Google account can authenticate; signing in does **not** establish association membership. Names and email come from Google, while membership, events and sample payment history remain clearly labeled demo data. Live Google sign-in requires your client ID, registered origins and a browser test; automated tests use a stubbed token verifier and do not contact Google or Safaricom.
# dashboard
# dashboard
