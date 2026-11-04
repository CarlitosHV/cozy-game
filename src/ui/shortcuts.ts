/** Keyboard shortcuts for frequent players. Novices never need these. */

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export type ShortcutRow = { action: string; keys: string; context: string };

/** Shown in Cómo jugar — progressive disclosure only. */
export const POWER_SHORTCUTS: ShortcutRow[] = [
  { action: 'Ayuda', keys: '?', context: 'Siempre' },
  { action: 'Objetivo del nivel', keys: 'O', context: 'Jugando' },
  { action: 'Seguir / Siguiente', keys: 'Enter', context: 'Pausa · Victoria · Fin' },
  { action: 'Empezar de nuevo', keys: 'R', context: 'Victoria · Fin' },
  { action: 'Elegir nivel', keys: '1–9 / flechas', context: 'Menú de niveles · Ranking' },
  { action: 'Tirar objeto', keys: 'Mayús+1–5', context: 'Jugando' },
  { action: 'Batear', keys: 'V', context: 'Lucha contra jefes' },
  { action: 'Pantalla completa', keys: 'F', context: 'Siempre' },
  { action: 'Filtro foto anterior/siguiente', keys: '[  ]', context: 'Modo foto' },
  { action: 'Marco foto anterior/siguiente', keys: ',  .', context: 'Modo foto' },
  { action: 'Reset cámara foto', keys: '0', context: 'Modo foto' },
  { action: 'Deshacer look', keys: 'Ctrl+Z', context: 'Creador' },
  { action: 'Pestañas del creador', keys: '1–4', context: 'Creador' },
];
