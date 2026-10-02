import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuth } from './auth.mjs';
import { createApp } from './app.mjs';
import { loadConfig } from './config.mjs';

async function fixture(t, options = {}) {
  let clock = Date.now();
  const auth = createAuth({ clientId: 'test-client', now: () => clock, verify: async credential => {
    if (credential === 'invalid') throw new Error('Invalid signature/audience/expiry');
    return JSON.parse(credential);
  }, ...options });
  const server = createApp({ config: loadConfig({}), auth, payments: { list: () => [] } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, cookie = '') => fetch(base + path, { headers: { Cookie: cookie } });
  const post = (path, body, cookie = '', origin = 'http://localhost:5173') => fetch(base + path, { method: 'POST', headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const challenge = async () => { const response = await get('/api/auth/config'); return { ...(await response.json()), cookie: response.headers.getSetCookie()[0].split(';')[0] }; };
  const credential = nonce => JSON.stringify({ sub: 'google-user-1', email: 'member@example.com', email_verified: true, given_name: 'Jane', nonce });
  return { get, post, challenge, credential, advance: () => { clock += 9 * 60 * 60 * 1000; } };
}

test('session protects API, persists sign-in, uses secure cookie attributes and is revoked by logout', async t => {
  const f = await fixture(t, { secure: true });
  assert.equal((await f.get('/api/mpesa/payments')).status, 401);
  const c = await f.challenge();
  const response = await f.post('/api/auth/google', { credential: f.credential(c.nonce) }, c.cookie);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.firstName, 'Jane');
  const header = response.headers.getSetCookie()[0];
  for (const flag of ['HttpOnly', 'SameSite=Lax', 'Secure', 'Max-Age=28800']) assert.ok(header.includes(flag));
  const cookie = header.split(';')[0];
  assert.equal((await (await f.get('/api/auth/session', cookie)).json()).user.id, 'google-user-1');
  assert.equal((await f.get('/api/mpesa/payments', cookie)).status, 200);
  assert.equal((await f.post('/api/auth/logout', {}, cookie)).status, 200);
  assert.equal((await f.get('/api/mpesa/payments', cookie)).status, 401);
});

test('rejects invalid tokens, wrong nonce, unverified email, missing challenge and challenge replay', async t => {
  const f = await fixture(t);
  for (const make of [() => 'invalid', () => f.credential('wrong'), nonce => JSON.stringify({ sub: 'x', email: 'x@example.com', email_verified: false, nonce })]) {
    const c = await f.challenge();
    assert.equal((await f.post('/api/auth/google', { credential: make(c.nonce) }, c.cookie)).status, 401);
  }
  const c = await f.challenge();
  const body = { credential: f.credential(c.nonce) };
  assert.equal((await f.post('/api/auth/google', body)).status, 401);
  assert.equal((await f.post('/api/auth/google', body, c.cookie)).status, 200);
  assert.equal((await f.post('/api/auth/google', body, c.cookie)).status, 401);
});

test('rejects cross-origin login/logout and expires sessions and challenges', async t => {
  const f = await fixture(t);
  const c = await f.challenge();
  const body = { credential: f.credential(c.nonce) };
  assert.equal((await f.post('/api/auth/google', body, c.cookie, 'https://evil.example')).status, 403);
  const response = await f.post('/api/auth/google', body, c.cookie);
  const cookie = response.headers.getSetCookie()[0].split(';')[0];
  assert.equal((await f.post('/api/auth/logout', {}, cookie, 'https://evil.example')).status, 403);
  const expired = await f.challenge();
  f.advance();
  assert.equal((await f.get('/api/mpesa/payments', cookie)).status, 401);
  assert.equal((await f.post('/api/auth/google', { credential: f.credential(expired.nonce) }, expired.cookie)).status, 401);
});

test('missing configuration fails closed', async t => {
  const f = await fixture(t, { clientId: '' });
  assert.equal((await f.challenge()).clientId, '');
  assert.equal((await f.post('/api/auth/google', { credential: 'anything' })).status, 503);
  assert.equal((await f.get('/api/mpesa/payments')).status, 401);
});
