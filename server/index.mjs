import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { createDaraja } from './daraja.mjs';
import { createStore } from './store.mjs';
import { createPayments } from './payments.mjs';
import { createApp } from './app.mjs';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const config = loadConfig();
const store = createStore(fileURLToPath(new URL('./data/payments.json', import.meta.url)));
const payments = createPayments({ config, store, daraja: createDaraja(config) });
const server = createApp({ config, payments });
server.listen(3001, '127.0.0.1', () => {
  console.log(`Daraja sandbox API: http://127.0.0.1:3001 (${config.ready ? 'configured' : 'credentials required'})`);
});
server.on('error', error => { console.error(`Payment server: ${error.code || 'startup failed'}`); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
