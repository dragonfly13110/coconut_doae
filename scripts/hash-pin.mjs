import { createHash } from 'node:crypto';

const pin = process.argv[2];
const pepper = process.env.PIN_PEPPER || process.env.SESSION_SECRET || '';

if (!pin) {
  console.error('Usage: PIN_PEPPER="your-secret" node scripts/hash-pin.mjs <pin>');
  process.exit(1);
}

const hash = createHash('sha256').update(`${pepper}:${String(pin)}`).digest('hex');
console.log(hash);
