/**
 * Player progress: which levels are finished and which companions are unlocked.
 * Every level belongs to one companion — finish the level to unlock it.
 *   Nivel 1 Archipiélago Acogedor → Nubi
 *   Nivel 2 Ruta Cósmica          → Estelita
 *   Nivel 3 Pantano Sombrío       → Chispa
 *   Nivel 4 Valle Aero            → Catarina
 * Tip for testing: open the game with ?desbloquear=todo in the URL to unlock everything.
 */
import type { CompanionStyle } from './character';

export interface LevelInfo {
  id: number;
  name: string;
  desc: string;
  companion: CompanionStyle;
  accent: string;
}

export const LEVELS: LevelInfo[] = [
  { id: 1, name: 'Archipiélago Acogedor', desc: 'Islas flotantes, hongos y nubes al atardecer.', companion: 'nube', accent: '#f59e0b' },
  { id: 2, name: 'Ruta Cósmica', desc: 'Asteroides, anillos planetarios y nebulosas.', companion: 'estrella', accent: '#a78bfa' },
  { id: 3, name: 'Pantano Sombrío', desc: 'Niebla, ruinas embrujadas y la torre de la bruja.', companion: 'luciernaga', accent: '#84cc16' },
  { id: 4, name: 'Valle Aero', desc: 'Pradera brillante, cascadas y ciudad de cristal.', companion: 'catarina', accent: '#38bdf8' },
];

export function levelForCompanion(c: CompanionStyle): LevelInfo | undefined {
  return LEVELS.find((l) => l.companion === c);
}

interface ProgressData {
  completed: number[];
}

const STORAGE_KEY = 'aether-leap-progress-v1';
let cache: ProgressData | null = null;

function read(): ProgressData {
  const data: ProgressData = { completed: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.completed)) {
        data.completed = parsed.completed.filter((n: unknown) => typeof n === 'number');
      }
    }
  } catch {
    // storage unavailable – start fresh
  }
  try {
    if (/[?&]desbloquear=todo\b/.test(window.location.search)) {
      data.completed = LEVELS.map((l) => l.id);
    }
  } catch {
    // ignore
  }
  return data;
}

function data(): ProgressData {
  if (!cache) cache = read();
  return cache;
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data()));
  } catch {
    // ignore
  }
}

export function isLevelCompleted(level: number): boolean {
  return data().completed.includes(level);
}

export function isCompanionUnlocked(c: CompanionStyle): boolean {
  if (c === 'ninguno') return true;
  const lvl = levelForCompanion(c);
  return lvl ? isLevelCompleted(lvl.id) : true;
}

/** Marks a level as finished. Returns the companion unlocked for the first time, if any. */
export function markLevelComplete(level: number): CompanionStyle | null {
  const d = data();
  if (d.completed.includes(level)) return null;
  d.completed.push(level);
  persist();
  return LEVELS.find((l) => l.id === level)?.companion ?? null;
}
