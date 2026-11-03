export type Requirement = {
  id: string;
  label: string;
  ok: boolean;
};

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
export const DISPLAY_NAME_MAX = 40;
export const CHARACTER_NAME_MAX = 24;

export function sanitizeUsernameInput(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, USERNAME_MAX);
}

export function usernameRequirements(value: string): Requirement[] {
  const clean = value.trim();
  return [
    {
      id: 'len',
      label: `Entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres`,
      ok: clean.length >= USERNAME_MIN && clean.length <= USERNAME_MAX,
    },
    {
      id: 'chars',
      label: 'Solo letras, números o _',
      ok: clean.length === 0 || /^[a-zA-Z0-9_]+$/.test(clean),
    },
  ];
}

export function isUsernameValid(value: string): boolean {
  return usernameRequirements(value).every((r) => r.ok) && value.trim().length > 0;
}

export function emailRequirements(value: string): Requirement[] {
  const clean = value.trim();
  const hasAt = clean.includes('@');
  const domain = hasAt ? clean.split('@')[1] ?? '' : '';
  return [
    {
      id: 'at',
      label: 'Incluye un @',
      ok: hasAt,
    },
    {
      id: 'domain',
      label: 'Dominio con punto (ej. correo@sitio.com)',
      ok: domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.'),
    },
  ];
}

export function isEmailValid(value: string): boolean {
  const clean = value.trim();
  if (!clean) return false;
  return emailRequirements(clean).every((r) => r.ok);
}

export function passwordRequirements(value: string): Requirement[] {
  return [
    {
      id: 'len',
      label: `Al menos ${PASSWORD_MIN} caracteres`,
      ok: value.length >= PASSWORD_MIN,
    },
    {
      id: 'upper',
      label: 'Una mayúscula',
      ok: /[A-Z]/.test(value),
    },
    {
      id: 'lower',
      label: 'Una minúscula',
      ok: /[a-z]/.test(value),
    },
    {
      id: 'digit',
      label: 'Un número',
      ok: /[0-9]/.test(value),
    },
  ];
}

export function isPasswordValid(value: string): boolean {
  return passwordRequirements(value).every((r) => r.ok);
}

export function characterNameRequirements(value: string): Requirement[] {
  const clean = value.trim();
  return [
    {
      id: 'filled',
      label: 'Escribe un nombre',
      ok: clean.length > 0,
    },
    {
      id: 'len',
      label: `Máximo ${CHARACTER_NAME_MAX} caracteres`,
      ok: value.length <= CHARACTER_NAME_MAX,
    },
  ];
}

export function isCharacterNameValid(value: string): boolean {
  return characterNameRequirements(value).every((r) => r.ok);
}

export function sanitizeCharacterNameInput(raw: string): string {
  return raw.replace(/\s+/g, ' ').slice(0, CHARACTER_NAME_MAX);
}
