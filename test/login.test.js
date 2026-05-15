import assert from 'node:assert/strict';
import test from 'node:test';

import { onRequest } from '../functions/api/login.js';

test('login rejects troubleshooting bypass PIN when user PIN does not match', async () => {
  const env = {
    PIN_PEPPER: 'pepper',
    DB: {
      prepare() {
        return {
          bind() {
            return {
              first: async () => ({
                id: 1,
                province_code: 'nakhon_pathom',
                province_label: 'Nakhon Pathom',
                role: 'province',
                pin_hash: 'not-a-real-hash',
              }),
            };
          },
        };
      },
    },
  };

  const response = await onRequest({
    env,
    request: new Request('https://example.test/api/login', {
      method: 'POST',
      body: JSON.stringify({ province_code: 'nakhon_pathom', pin: 'coconut2026' }),
      headers: { 'content-type': 'application/json' },
    }),
  });

  assert.equal(response.status, 401);
});
