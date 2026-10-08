import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('member summaries populate published events and changing accounts clears the event cache', async () => {
  const code = ts.transpileModule(readFileSync(new URL('../src/services/memberService.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const event = { id: 'event-1', name: 'Training', date: '2050-10-08', time: '10:00', category: 'Workshop', location: 'Nairobi', description: 'Business training' };
  let captured;
  const fetch = async (url, init) => { captured = { url, ...init }; return new Response(JSON.stringify({ member: { id: 'member-1' }, membership: { status: 'active' }, events: [event] })); };
  new Function('fetch', 'module', 'exports', code)(fetch, module, module.exports);
  const service = module.exports.memberService;
  service.setUser({ id: 'member-1' });
  await service.refresh();
  assert.equal(captured.url, '/api/member/summary');
  assert.equal(captured.credentials, 'same-origin');
  assert.deepEqual(service.getEvents(), [event]);
  service.setUser({ id: 'member-2' });
  assert.deepEqual(service.getEvents(), []);
});
