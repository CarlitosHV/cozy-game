/**
 * Access to the developer panel: click your user name on the title screen → "Modo desarrollador"
 * and type the password. Once it is right, this browser remembers it (until you lock it again
 * from the panel).
 *
 * Only a hash of the password lives in the code, so it isn't readable at a glance. It is a
 * convenience lock for testing, not real security: the panel only changes this browser
 * (unlocks every level and companion, lets you pick any world / generator / boss) and
 * never touches the progress saved on the server.
 */
const ACCESS_KEY = 'cozy-dev-access';
const SALT = 7;
const PASSWORD_HASH = 6846363075753765;

/** cyrb53: small, fast, synchronous string hash (works on http too, unlike crypto.subtle). */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function checkDevPassword(password: string): boolean {
  return cyrb53(password, SALT) === PASSWORD_HASH;
}

export function hasDevAccess(): boolean {
  try {
    return window.localStorage.getItem(ACCESS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setDevAccess(on: boolean): void {
  try {
    if (on) window.localStorage.setItem(ACCESS_KEY, '1');
    else window.localStorage.removeItem(ACCESS_KEY);
  } catch {
    // ignore
  }
}
