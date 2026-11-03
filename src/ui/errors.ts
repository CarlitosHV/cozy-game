import {
  CHARACTER_NAME_MAX,
  DISPLAY_NAME_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  isEmailValid,
  isPasswordValid,
  isUsernameValid,
} from './validation';

export type AuthField = 'username' | 'email' | 'password' | 'passwordConfirm' | 'displayName';

export type FieldErrors = Partial<Record<AuthField | 'form', string>>;

/** Local validation: what went wrong + how to fix it. */
export function usernameHint(value: string): string | null {
  const clean = value.trim();
  if (!clean) return 'Falta el usuario. Escribe uno de 3 a 20 letras.';
  if (clean.length < USERNAME_MIN) {
    return `El usuario es muy corto. Añade letras hasta llegar a ${USERNAME_MIN}.`;
  }
  if (clean.length > USERNAME_MAX) {
    return `El usuario es muy largo. Déjalo en ${USERNAME_MAX} caracteres o menos.`;
  }
  if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
    return 'Hay símbolos que no se pueden usar. Quédate con letras, números o _.';
  }
  return null;
}

export function emailHint(value: string): string | null {
  const clean = value.trim();
  if (!clean) return 'Falta el correo. Escríbelo para continuar.';
  if (!clean.includes('@')) {
    return 'Al correo le falta un @. Ejemplo: tu_nombre@correo.com';
  }
  const domain = clean.split('@')[1] ?? '';
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return 'El correo está incompleto. Revisa la parte después del @.';
  }
  if (!isEmailValid(clean)) {
    return 'Ese correo no se reconoce. Revísalo o prueba con otro.';
  }
  return null;
}

export function passwordHint(value: string, mode: 'login' | 'register'): string | null {
  if (!value) return 'Falta la clave. Escríbela para continuar.';
  if (mode === 'login') return null;
  if (value.length < PASSWORD_MIN) {
    return `La clave es muy corta. Usa al menos ${PASSWORD_MIN} caracteres.`;
  }
  if (!/[A-Z]/.test(value)) {
    return 'A la clave le falta una mayúscula. Añade al menos una.';
  }
  if (!/[a-z]/.test(value)) {
    return 'A la clave le falta una minúscula. Añade al menos una.';
  }
  if (!/[0-9]/.test(value)) {
    return 'A la clave le falta un número. Añade al menos uno.';
  }
  if (!isPasswordValid(value)) {
    return 'La clave aún no cumple lo pedido. Mira la lista de abajo.';
  }
  return null;
}

export function passwordConfirmHint(password: string, confirm: string): string | null {
  if (!confirm) return 'Repite la clave en este campo para confirmarla.';
  if (confirm !== password) {
    return 'Las claves no coinciden. Escríbela otra vez igual que arriba.';
  }
  return null;
}

export function displayNameHint(value: string): string | null {
  if (value.length > DISPLAY_NAME_MAX) {
    return `El nombre público es muy largo. Acórtalo a ${DISPLAY_NAME_MAX} caracteres.`;
  }
  return null;
}

export function characterNameHint(value: string): string | null {
  const clean = value.trim();
  if (!clean) {
    return 'Falta el nombre. Escríbelo o elige una sugerencia.';
  }
  if (value.length > CHARACTER_NAME_MAX) {
    return `El nombre es muy largo. Acórtalo a ${CHARACTER_NAME_MAX} caracteres o menos.`;
  }
  return null;
}

/**
 * Maps API / network failures to a field when possible.
 * Returns `form` for general problems that aren't tied to one input.
 */
export function mapAuthServerError(error: unknown, mode: 'login' | 'register'): FieldErrors {
  const err = error as Error & { status?: number; code?: string };
  const status = err.status;
  const raw = `${err.message || ''} ${err.code || ''}`.toLowerCase();

  if (err.code === 'SERVER_OFFLINE' || /failed to fetch|networkerror|load failed|sin conexión|no hay conexión/i.test(raw)) {
    return {
      form: 'No hay conexión ahora. Revisa tu internet y vuelve a intentar con los mismos datos.',
    };
  }

  if (status === 429) {
    return {
      form: 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
    };
  }

  if (status === 500 || status === 502 || status === 503) {
    return {
      form: 'El servicio no responde ahora. Tus datos siguen aquí: inténtalo en unos minutos.',
    };
  }

  if (
    /username.*(taken|exists|already|en uso|ocupado)|user.*(taken|exists)|usuario.*(existe|uso|ocupado)/i.test(
      raw
    )
  ) {
    return {
      username: 'Ese usuario ya está en uso. Prueba con otro nombre.',
    };
  }

  if (
    /email.*(taken|exists|already|en uso|registrad)|correo.*(existe|uso|registrad)/i.test(raw)
  ) {
    return {
      email: 'Ese correo ya tiene cuenta. Entra con él o usa otro correo.',
    };
  }

  if (
    mode === 'login' &&
    (status === 401 ||
      status === 403 ||
      /invalid|credential|password|unauthorized|incorrect|wrong|clave|contraseña|login/i.test(raw))
  ) {
    return {
      password: 'Correo o clave incorrectos. Revísalos — no borramos lo que escribiste.',
      email: 'Revisa que el correo esté bien escrito.',
    };
  }

  if (status === 400 || status === 422) {
    if (/email|correo/i.test(raw)) {
      return { email: 'Ese correo no se aceptó. Revísalo e inténtalo de nuevo.' };
    }
    if (/username|usuario/i.test(raw)) {
      return { username: 'Ese usuario no se aceptó. Cámbialo e inténtalo de nuevo.' };
    }
    if (/password|clave|contraseña/i.test(raw)) {
      return {
        password: 'Esa clave no se aceptó. Cámbiala siguiendo los requisitos de abajo.',
      };
    }
    return {
      form: 'Algunos datos no se aceptaron. Revisa los campos en rojo e inténtalo de nuevo.',
    };
  }

  return {
    form: 'No se pudo completar. Revisa los datos — siguen escritos — e inténtalo otra vez.',
  };
}

export function collectAuthFieldErrors(input: {
  mode: 'login' | 'register';
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  displayName: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (input.mode === 'register') {
    const u = usernameHint(input.username);
    if (u) errors.username = u;
    const d = displayNameHint(input.displayName);
    if (d) errors.displayName = d;
    const pc = passwordConfirmHint(input.password, input.passwordConfirm);
    if (pc) errors.passwordConfirm = pc;
  }
  const e = emailHint(input.email);
  if (e) errors.email = e;
  const p = passwordHint(input.password, input.mode);
  if (p) errors.password = p;
  return errors;
}
