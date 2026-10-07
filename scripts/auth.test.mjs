import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const isAdmin = JSON.parse(readFileSync(resolve(root, 'package.json'))).name === 'bnak-admin-dashboard';
const protectedPath = isAdmin ? '/admin' : '/dashboard';
function modules() {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    function dependency(name) {
      if (name === 'react-router-dom') return { createBrowserRouter: routes => routes, redirect: location => new Response(null, { status: 302, headers: { Location: location } }), Navigate: () => null, Link: () => null, NavLink: () => null };
      if (!name.startsWith('.')) return require(name);
      const base = resolve(dirname(file), name);
      const target = [base+'.ts', base+'.tsx', resolve(base,'index.ts'), resolve(base,'index.tsx')].find(existsSync);
      if (!target) throw new Error('Cannot resolve '+name);
      return load(target);
    }
    new Function('require', 'module', 'exports', code)(dependency, module, module.exports);
    return module.exports;
  }
  return { service: load(resolve(root, 'src/services/authService.ts')).authService, route: () => load(resolve(root, 'src/routes/index.tsx')).router.find(route => route.path === protectedPath) };
}
const user = { id: 'test-member', email: 'test@example.com', firstName: 'Test', lastName: 'Member' };
function response(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }); }

test('password login uses same-origin authenticated API and propagates rejected credentials', async t => {
  const { service } = modules(); let captured;
  t.mock.method(globalThis, 'fetch', async (url, options) => { captured = { url, options }; return response({ user }); });
  assert.deepEqual(await service.passwordLogin(user.email, 'test password'), user);
  assert.equal(captured.url, '/api/auth/login');
  assert.equal(captured.options.credentials, 'same-origin');
  assert.equal(captured.options.method, 'POST');
  assert.deepEqual(JSON.parse(captured.options.body), { email: user.email, password: 'test password' });
  t.mock.method(globalThis, 'fetch', async () => response({ message: 'Email or password is incorrect.' }, 401));
  await assert.rejects(service.passwordLogin(user.email, 'wrong'), /Email or password is incorrect/);
});

test('session, Google sign-in and logout use auth endpoints; malformed responses fail clearly', async t => {
  const { service } = modules(); const paths = [];
  t.mock.method(globalThis, 'fetch', async url => { paths.push(url); return response({ user, member: { ...user, membershipNumber: 'BNAK-TEST' }, membership: { status: 'pending' } }); });
  assert.deepEqual(await service.session(), user);
  assert.deepEqual(await service.login('mock-google-credential'), user);
  await service.logout();
  assert.deepEqual(paths, ['/api/auth/session', '/api/auth/google', '/api/auth/logout']);
  t.mock.method(globalThis, 'fetch', async () => new Response('upstream unavailable', { status: 502 }));
  await assert.rejects(service.session(), /temporarily unavailable/);
});

test('protected dashboard redirects anonymous or expired sessions back to login with return path', async t => {
  const route = modules().route();
  t.mock.method(globalThis, 'fetch', async () => response({ user: null }));
  const path = protectedPath + (isAdmin ? '/analytics' : '/payments');
  const result = await route.loader({ request: new Request('http://localhost'+path) });
  assert.equal(result.status, 302);
  assert.equal(result.headers.get('Location'), '/login?returnTo='+encodeURIComponent(path));
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network unavailable'); });
  assert.equal((await route.loader({ request: new Request('http://localhost'+path) })).status, 302);
});

test('authenticated dashboard access enforces the administrator permission check', async t => {
  const route = modules().route(); const paths = [];
  t.mock.method(globalThis, 'fetch', async url => { paths.push(url); return response({ user, member: { ...user, membershipNumber: 'BNAK-TEST' }, membership: { status: 'pending' }, payments: [] }); });
  assert.equal(await route.loader({ request: new Request('http://localhost'+protectedPath) }), null);
  assert.deepEqual(paths, isAdmin ? ['/api/auth/session', '/api/admin/access'] : ['/api/auth/session', '/api/member/summary']);
  if (isAdmin) {
    t.mock.method(globalThis, 'fetch', async url => url === '/api/auth/session' ? response({ user }) : response({ message: 'Administrator access is required.' }, 403));
    await assert.rejects(route.loader({ request: new Request('http://localhost/admin') }), error => error instanceof Response && error.status === 403);
  }
});
