import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSessionCookie,
  hashPin,
  parseCookies,
  verifyPin,
} from '../src/auth.js';

test('hashPin is deterministic and verifyPin rejects wrong PIN', async () => {
  const hash = await hashPin('123456', 'pepper');

  assert.equal(await verifyPin('123456', hash, 'pepper'), true);
  assert.equal(await verifyPin('000000', hash, 'pepper'), false);
});

test('parseCookies reads cookie header safely', () => {
  assert.deepEqual(parseCookies('sid=abc; theme=dark'), { sid: 'abc', theme: 'dark' });
  assert.deepEqual(parseCookies(''), {});
});

test('buildSessionCookie creates httpOnly secure cookie', () => {
  const cookie = buildSessionCookie('session-id', 3600);

  assert.match(cookie, /sid=session-id/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=3600/);
});
