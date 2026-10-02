import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { HttpError, renewal } from './payments.mjs';
import { createAuth } from './auth.mjs';

function sameSecret(actual, expected) {
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return b.length >= 32 && a.length === b.length && timingSafeEqual(a, b);
}
async function readJson(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new HttpError(415, 'Use application/json.');
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16384) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  try { const body = JSON.parse(Buffer.concat(chunks).toString()); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); return body; }
  catch { throw new HttpError(400, 'Invalid JSON body.'); }
}

export function createApp({ config, payments, auth = createAuth() }) {
  const server = createServer(async (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (code, value) => { response.writeHead(code); response.end(JSON.stringify(value)); };
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      if (path.startsWith('/api/mpesa/callback/')) {
        if (request.method !== 'POST' || !config.ready || !sameSecret(path.slice('/api/mpesa/callback/'.length), config.callbackSecret)) throw new HttpError(404, 'Not found.');
        const body = await readJson(request);
        // Return promptly; the next UI poll also reconciles if the callback arrives early.
        void payments.callback(body).catch(() => console.error('Daraja callback could not be reconciled; status query is available.'));
        return send(200, { ResultCode: 0, ResultDesc: 'Accepted' });
      }
      // Keep the sandbox API local-only, including through public tunnels.
      const hostname = (request.headers.host || '').split(':')[0];
      if (!['localhost', '127.0.0.1'].includes(hostname)) throw new HttpError(403, 'The sandbox payment API is available only on localhost.');
      const origin = request.headers.origin;
      if (origin && !config.origins.includes(origin)) throw new HttpError(403, 'Origin is not allowed.');
      if (request.method === 'POST' && !origin) throw new HttpError(403, 'A dashboard origin is required.');
      if (request.method === 'GET' && path === '/api/auth/config') return send(200, auth.config(request, response));
      if (request.method === 'GET' && path === '/api/auth/session') return send(200, { user: auth.user(request) });
      if (request.method === 'POST' && path === '/api/auth/google') return send(200, await auth.login(request, response, await readJson(request)));
      if (request.method === 'POST' && path === '/api/auth/logout') return send(200, auth.logout(request, response));
      const user = auth.user(request);
      if (!user) throw new HttpError(401, 'Please sign in to continue.');
      if (request.method === 'GET' && path === '/api/mpesa/config') return send(200, { ready: config.ready, environment: 'sandbox', message: config.issue, product: renewal });
      if (request.method === 'GET' && path === '/api/mpesa/payments') return send(200, payments.list(user.id));
      if (request.method === 'POST' && path === '/api/mpesa/payments') return send(200, await payments.initiate(await readJson(request), request.headers['idempotency-key'], user.id));
      const match = path.match(/^\/api\/mpesa\/payments\/([a-zA-Z0-9-]+)\/refresh$/);
      if (request.method === 'POST' && match) {
        if (!payments.list(user.id).some(payment => payment.id === match[1])) throw new HttpError(404, 'Payment not found.');
        return send(200, await payments.reconcile(match[1]));
      }
      throw new HttpError(404, 'Not found.');
    } catch (error) { send(error instanceof HttpError ? error.status : 500, { message: error instanceof HttpError ? error.message : 'The payment service encountered an error. Please try again later.' }); }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  return server;
}
