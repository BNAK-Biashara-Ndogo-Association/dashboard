import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function redirects(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Set API_UPSTREAM to the HTTPS origin of the deployed backend.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('API_UPSTREAM must be an HTTPS origin without credentials, a path, query or fragment.');
  }
  return `/api/* ${url.origin}/api/:splat 200!\n/* /index.html 200\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(new URL('../dist/_redirects', import.meta.url), redirects(process.env.API_UPSTREAM));
}
