import test from 'node:test';
import assert from 'node:assert/strict';
import { redirects } from './netlify.mjs';

test('Netlify routes API before the SPA fallback and rejects invalid upstreams', () => {
  assert.equal(redirects('https://api.example.com/'), '/api/* https://api.example.com/api/:splat 200!\n/* /index.html 200\n');
  for (const value of [undefined, '', 'http://api.example.com', 'https://user:pass@api.example.com', 'https://api.example.com/api', 'https://api.example.com?x=1', 'https://api.example.com/#x']) {
    assert.throws(() => redirects(value), /API_UPSTREAM/);
  }
});

