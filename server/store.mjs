import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Single-process sandbox ledger. An atomic replacement preserves requests on restart.
export function createStore(file) {
  let records = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  if (!Array.isArray(records)) throw new Error('Invalid payment ledger. Restore it before starting the payment service.');
  return {
    all: () => structuredClone(records),
    save(record) {
      const next = [...records.filter(item => item.id !== record.id), structuredClone(record)];
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(`${file}.tmp`, JSON.stringify(next, null, 2), { mode: 0o600 });
      renameSync(`${file}.tmp`, file);
      records = next;
      return record;
    },
  };
}
