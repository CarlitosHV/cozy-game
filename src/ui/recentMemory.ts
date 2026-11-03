const PREFIX = 'cozy-leap-recent:';

function read(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function write(key: string, values: string[]) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(values));
  } catch {
    // ignore
  }
}

/** Newest first, unique, capped. */
export function pushRecent(key: string, value: string, limit = 6): string[] {
  const clean = value.trim();
  if (!clean) return read(key);
  const next = [clean, ...read(key).filter((v) => v.toLowerCase() !== clean.toLowerCase())].slice(
    0,
    limit
  );
  write(key, next);
  return next;
}

export function getRecent(key: string): string[] {
  return read(key);
}

export const RECENT_KEYS = {
  emails: 'emails',
  characterNames: 'character-names',
  levelSearches: 'level-searches',
} as const;
