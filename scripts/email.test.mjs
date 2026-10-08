import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function service(fetch) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(new URL('../src/services/emailService.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('fetch', 'module', 'exports', code)(fetch, module, module.exports);
  return module.exports.emailService;
}

test('member certificate email uses the authenticated backend without browser-selected recipients or secrets', async () => {
  let captured;
  const emails = service(async (url, init) => { captured = { url, ...init }; return new Response(JSON.stringify({ status: 'accepted' })); });
  await emails.certificate();
  assert.equal(captured.url, '/api/member/email/certificate');
  assert.equal(captured.credentials, 'same-origin');
  assert.equal(captured.method, 'POST');
  assert.deepEqual(JSON.parse(captured.body), {});
  assert.equal(captured.headers.Authorization, undefined);
  await emails.config();
  assert.equal(captured.url, '/api/member/email/config');
  const failed = service(async () => new Response(JSON.stringify({ message: 'Your membership has expired.' }), { status: 409 }));
  await assert.rejects(failed.certificate(), /membership has expired/);
});
