const DEFAULT_LOCALE =
  typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'es-MX';

export function getAppLocale(): string {
  return DEFAULT_LOCALE;
}

/** Short local date, e.g. 2 nov 2026 */
export function formatDate(value: string | number | Date, locale = getAppLocale()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** Local date + time for timestamps */
export function formatDateTime(value: string | number | Date, locale = getAppLocale()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Money in local currency format */
export function formatMoney(
  amount: number,
  currency = 'MXN',
  locale = getAppLocale()
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Compact duration for rankings, e.g. 12,34 s */
export function formatSeconds(seconds: number, locale = getAppLocale()): string {
  return `${Number(seconds).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} s`;
}

/** mm:ss for in-run timers */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const STATUS_HINTS: Record<number, string> = {
  400: 'Los datos no se aceptaron. Revísalos e inténtalo de nuevo.',
  401: 'Tu sesión se cerró. Vuelve a entrar con tu correo y clave.',
  403: 'No puedes hacer eso con esta cuenta. Entra con otra o pide acceso.',
  404: 'No encontramos eso. Vuelve atrás e inténtalo otra vez.',
  409: 'Ese dato ya está en uso. Elige otro e inténtalo de nuevo.',
  422: 'Algunos datos no son válidos. Corrige los campos marcados.',
  429: 'Demasiados intentos. Espera un minuto y vuelve a probar.',
  500: 'Falló algo de nuestro lado. Tus datos siguen aquí: inténtalo más tarde.',
  502: 'El servicio no responde. Espera un momento e inténtalo otra vez.',
  503: 'Estamos en mantenimiento. Vuelve en unos minutos.',
};

const CODE_HINTS: Record<string, string> = {
  USER_NOT_FOUND: 'No encontramos ese usuario. Revisa el nombre e inténtalo.',
  ALREADY_FRIENDS: 'Ya son amigos. No hace falta pedir otra vez.',
  FRIEND_REQUEST_PENDING: 'Ya hay una solicitud en camino. Espera su respuesta.',
  NOT_FRIENDS: 'Solo puedes invitar a quien ya esté en tu lista de amigos.',
  FRIEND_OFFLINE: 'Esa persona no está conectada ahora. Prueba más tarde.',
  INVITE_EXPIRED: 'La invitación ya caducó. Pide otra desde Amigos.',
  INVALID_INVITE: 'La invitación no es válida. Cierra e inténtalo de nuevo.',
  INVALID_FRIEND_REQUEST: 'No puedes enviarte una solicitud a ti mismo.',
  FORBIDDEN: 'No puedes hacer eso con esta cuenta.',
  SERVER_OFFLINE: 'No hay conexión ahora. Revisa tu internet e inténtalo de nuevo.',
};

/** Turns API / network errors into short everyday wording (what + how). */
export function friendlyError(
  error: unknown,
  fallback = 'Algo salió mal. Tus datos siguen aquí: inténtalo de nuevo.'
): string {
  if (!error) return fallback;

  const err = error as Error & { status?: number; code?: string };
  const status = typeof err.status === 'number' ? err.status : undefined;
  const raw = (err.message || '').trim();
  const code = (err.code || '').trim();

  if (code && CODE_HINTS[code]) {
    return CODE_HINTS[code];
  }

  if (err.code === 'SERVER_OFFLINE' || /failed to fetch|networkerror|load failed/i.test(raw)) {
    return 'No hay conexión ahora. Revisa tu internet e inténtalo de nuevo.';
  }

  if (status && STATUS_HINTS[status]) {
    return STATUS_HINTS[status];
  }

  if (/^HTTP\s*\d+/i.test(raw) || /backend|api\/v\d|localhost|127\.0\.0\.1|:\d{2,5}/i.test(raw)) {
    return status && STATUS_HINTS[status] ? STATUS_HINTS[status] : fallback;
  }

  if (!raw) return fallback;

  if (/^[A-Z0-9_]+$/.test(raw) || raw.length > 140) {
    return fallback;
  }

  if (/no hay conexión|sin conexión|inténtalo/i.test(raw)) {
    return raw;
  }

  return raw;
}
