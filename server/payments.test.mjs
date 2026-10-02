import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import { loadConfig } from './config.mjs';
import { credentials, createDaraja, DarajaError, normalizePhone } from './daraja.mjs';
import { createStore } from './store.mjs';
import { createPayments } from './payments.mjs';
import { createApp } from './app.mjs';

const secret = 'a'.repeat(64);
const config = loadConfig({ MPESA_ENV: 'sandbox', MPESA_CONSUMER_KEY: 'test-key', MPESA_CONSUMER_SECRET: 'test-secret', MPESA_SHORTCODE: '174379', MPESA_PASSKEY: 'test-passkey', MPESA_CALLBACK_SECRET: secret, MPESA_CALLBACK_URL: `https://example.com/api/mpesa/callback/${secret}` });
const input = { phone: '0712345678', productId: 'annual-renewal' };
const key = 'request-1234567890123456';
const accepted = { ResponseCode: '0', CheckoutRequestID: 'checkout-1', MerchantRequestID: 'merchant-1' };
function fixture(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bnak-payments-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'payments.json');
  const store = createStore(file);
  let time = Date.now();
  const daraja = { initiate: async () => accepted, query: async () => ({ ...accepted, ResultCode: '0' }), ...overrides };
  return { store, file, service: createPayments({ config, store, daraja, now: () => time }), advance: () => { time += 31000; } };
}
test('validates sandbox configuration and refuses production with mock members', () => {
  assert.equal(config.ready, true);
  assert.equal(loadConfig({}).ready, false);
  assert.match(loadConfig({ MPESA_ENV: 'production' }).issue, /authenticated members/);
  assert.equal(loadConfig({ MPESA_CALLBACK_URL: 'http://localhost' }).ready, false);
});
test('normalizes Kenyan numbers and rejects invalid phone numbers', () => {
  for (const value of ['0712 345 678', '+254712345678', '254712345678']) assert.equal(normalizePhone(value), '254712345678');
  assert.equal(normalizePhone('0112345678'), '254112345678');
  for (const value of ['123', '254812345678', '<script>', undefined, 712345678]) assert.throws(() => normalizePhone(value));
});
test('builds password using the Nairobi timestamp', () => {
  const data = credentials(config, new Date('2026-09-28T08:05:04Z'));
  assert.equal(data.Timestamp, '20260928110504');
  assert.equal(Buffer.from(data.Password, 'base64').toString(), '174379test-passkey20260928110504');
});
test('OAuth token is cached; STK request and query use official sandbox endpoints', async () => {
  const calls = [];
  const fetchMock = async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => url.includes('/oauth/') ? { access_token: 'token', expires_in: 3600 } : accepted }; };
  const api = createDaraja(config, fetchMock);
  await api.initiate({ amount: 3000, phone: '254712345678' });
  await api.query('checkout-1');
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /sandbox.safaricom.co.ke\/oauth\/v1\/generate/);
  assert.match(calls[1].url, /\/mpesa\/stkpush\/v1\/processrequest$/);
  assert.match(calls[2].url, /\/mpesa\/stkpushquery\/v1\/query$/);
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.Amount, 3000); assert.equal(body.TransactionType, 'CustomerPayBillOnline');
  assert.equal(body.PhoneNumber, '254712345678'); assert.equal(body.CallBackURL, config.callbackUrl);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer token');
});
test('STK transport timeout is ambiguous and not retried automatically', async () => {
  let calls = 0;
  const api = createDaraja(config, async url => { calls++; if (url.includes('oauth')) return { ok: true, json: async () => ({ access_token: 'token' }) }; throw new Error('timeout'); });
  await assert.rejects(api.initiate({ amount: 3000, phone: '254712345678' }), error => error.ambiguous === true);
  assert.equal(calls, 2);
});
test('server owns amount; STK acceptance remains pending; history survives restart', async t => {
  let sent;
  const { service, file } = fixture(t, { initiate: async record => { sent = record; return accepted; } });
  const payment = await service.initiate({ ...input, amount: 1, memberId: 'attacker' }, key);
  assert.equal(sent.amount, 3000); assert.equal(payment.status, 'pending'); assert.equal(payment.canCheck, true);
  assert.equal(payment.phone, undefined); assert.equal(payment.key, undefined);
  assert.equal(createStore(file).all()[0].checkoutId, 'checkout-1');
});
test('same idempotency key sends one STK request and concurrent new keys are blocked', async t => {
  let calls = 0;
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  const { service } = fixture(t, { initiate: async () => { calls++; await wait; return accepted; } });
  const first = service.initiate(input, key);
  const duplicate = await service.initiate(input, key);
  await assert.rejects(service.initiate(input, `${key}-new`), error => error.status === 409);
  await assert.rejects(service.initiate({ ...input, phone: '0112345678' }, key), error => error.status === 409);
  release();
  assert.equal((await first).id, duplicate.id); assert.equal(calls, 1);
});
test('invalid phone and product are rejected before creating a record', async t => {
  const { service, store } = fixture(t);
  await assert.rejects(service.initiate({ ...input, phone: 'abc' }, key), error => error.status === 400);
  await assert.rejects(service.initiate({ ...input, productId: 'custom' }, key), error => error.status === 400);
  await assert.rejects(service.initiate(input, 'short'), error => error.status === 400);
  assert.equal(store.all().length, 0);
});
test('callback cannot declare payment successful; status query is authoritative', async t => {
  let calls = 0;
  const { service } = fixture(t, { query: async () => { calls++; return { ...accepted, ResultCode: 1032 }; } });
  const payment = await service.initiate(input, key);
  await service.callback({ Body: { stkCallback: { ...accepted, ResultCode: 0 } } });
  assert.equal(service.list()[0].status, 'failed');
  assert.match(service.list()[0].message, /cancelled/);
  await service.callback({ Body: { stkCallback: { ...accepted, ResultCode: 0 } } });
  assert.equal(calls, 1); assert.equal((await service.reconcile(payment.id)).status, 'failed');
});
test('successful query marks paid; duplicate or unknown callbacks do not alter it', async t => {
  const { service } = fixture(t);
  const payment = await service.initiate(input, key);
  assert.equal((await service.reconcile(payment.id)).status, 'paid');
  await service.callback({ Body: { stkCallback: { ...accepted, ResultCode: 1032 } } });
  await service.callback({ Body: { stkCallback: { ...accepted, CheckoutRequestID: 'unknown', ResultCode: 0 } } });
  assert.equal(service.list()[0].status, 'paid');
});
test('mismatched query IDs, unavailable status, and query errors remain pending', async t => {
  for (const query of [async () => ({ ...accepted, CheckoutRequestID: 'other', ResultCode: 0 }), async () => ({ errorCode: '500.001.1001' }), async () => { throw new Error('offline'); }]) {
    const { service } = fixture(t, { query });
    const payment = await service.initiate(input, key);
    assert.equal((await service.reconcile(payment.id)).status, 'pending');
  }
});
test('status checks are throttled; pending payment can be reconciled later', async t => {
  let calls = 0;
  const { service, advance } = fixture(t, { query: async () => { calls++; return calls === 1 ? {} : { ...accepted, ResultCode: 0 }; } });
  const payment = await service.initiate(input, key);
  await service.reconcile(payment.id); await service.reconcile(payment.id);
  assert.equal(calls, 1); advance();
  assert.equal((await service.reconcile(payment.id)).status, 'paid');
});
test('definite initiation failure can be retried after cooldown; timeout blocks duplicate prompts', async t => {
  const failed = fixture(t, { initiate: async () => { throw new DarajaError('Rejected'); } });
  assert.equal((await failed.service.initiate(input, key)).status, 'failed');
  await assert.rejects(failed.service.initiate(input, `${key}-2`), error => error.status === 429);
  failed.advance();
  assert.equal((await failed.service.initiate(input, `${key}-2`)).status, 'failed');
  const unknown = fixture(t, { initiate: async () => { throw new DarajaError('Timeout', { ambiguous: true }); } });
  const attempt = await unknown.service.initiate(input, key);
  assert.equal(attempt.status, 'pending'); assert.equal(attempt.canCheck, false);
  await assert.rejects(unknown.service.initiate(input, `${key}-2`), error => error.status === 409);
});
test('HTTP API protects local origins, callback secret and server configuration', async t => {
  const { service } = fixture(t);
  const server = createApp({ config, payments: service, auth: { user: () => ({ id: 'test-member' }) } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const safeConfig = await (await fetch(`${base}/api/mpesa/config`)).json();
  assert.equal(safeConfig.ready, true);
  assert.equal(JSON.stringify(safeConfig).includes('test-secret'), false);
  const body = JSON.stringify(input);
  assert.equal((await fetch(`${base}/api/mpesa/payments`, { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body })).status, 403);
  assert.equal((await fetch(`${base}/api/mpesa/callback/wrong`, { method: 'POST' })).status, 404);
  const headers = { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'Idempotency-Key': key };
  assert.equal((await fetch(`${base}/api/mpesa/payments`, { method: 'POST', headers, body: '{' })).status, 400);
  const response = await fetch(`${base}/api/mpesa/payments`, { method: 'POST', headers, body });
  assert.equal(response.status, 200); assert.equal((await response.json()).status, 'pending');
  const remoteStatus = await new Promise((resolve, reject) => {
    const request = httpRequest(`${base}/api/mpesa/payments`, { headers: { Host: 'public-tunnel.example' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject); request.end();
  });
  assert.equal(remoteStatus, 403);
});

test('payment history and idempotency belong to the authenticated Google account', async t => {
  const { service, store } = fixture(t);
  const first = await service.initiate(input, key, 'alice');
  const second = await service.initiate(input, key, 'bob');
  assert.notEqual(first.id, second.id);
  assert.deepEqual(service.list('alice').map(item => item.id), [first.id]);
  assert.deepEqual(service.list('bob').map(item => item.id), [second.id]);
  assert.deepEqual(service.list('other'), []);
  assert.equal(store.all().find(item => item.id === first.id).userId, 'alice');
  const server = createApp({ config, payments: service, auth: { user: () => ({ id: 'bob' }) } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/mpesa/payments/${first.id}/refresh`, { method: 'POST', headers: { Origin: 'http://localhost:5173' } });
  assert.equal(response.status, 404);
});
