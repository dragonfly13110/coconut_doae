export async function hashPin(pin, pepper = '') {
  const text = `${pepper}:${String(pin)}`;
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPin(pin, expectedHash, pepper = '') {
  if (!pin || !expectedHash) return false;
  return timingSafeEqual(await hashPin(pin, pepper), expectedHash);
}

export function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function buildSessionCookie(sessionId, maxAgeSeconds) {
  return [
    `sid=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ].join('; ');
}

export function clearSessionCookie() {
  return 'sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export function randomId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  const left = String(a);
  const right = String(b);
  if (left.length !== right.length) return false;

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}
