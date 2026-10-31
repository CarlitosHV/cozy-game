/**
 * Player progress for the endless level ladder.
 *  - Levels 1-4 are the handmade worlds; from level 5 on they are generated dynamically
 *    (themes rotate: Acogedor → Cósmico → Pantano → Aero → Jardín → Castillo).
 *  - Levels unlock in order: finish level N to play level N+1.
 *  - Companions unlock every 10 levels: 10 Nubi, 20 Estelita, 30 Chispa, 40 Catarina,
 *    50 Lila (hada), 60 Jade (serpiente voladora).
 * Tip for testing: add ?desbloquear=todo to the URL to unlock everything (up to level 61).
 */
import type { CompanionStyle } from './character';

export type ThemeId = 'cozy' | 'cosmic' | 'swamp' | 'aero' | 'garden' | 'castle';

export interface LevelInfo {
  id: number;
  name: string;
  desc: string;
  theme: ThemeId;
  accent: string;
  generated: boolean;
}

const THEME_ORDER: ThemeId[] = ['cozy', 'cosmic', 'swamp', 'aero', 'garden', 'castle'];

export const THEME_INFO: Record<ThemeId, { name: string; desc: string; accent: string }> = {
  cozy: { name: 'Archipiélago Acogedor', desc: 'Islas flotantes, hongos y nubes al atardecer.', accent: '#f59e0b' },
  cosmic: { name: 'Ruta Cósmica', desc: 'Asteroides, anillos planetarios y nebulosas.', accent: '#a78bfa' },
  swamp: { name: 'Pantano Sombrío', desc: 'Niebla, ruinas embrujadas y la torre de la bruja.', accent: '#84cc16' },
  aero: { name: 'Valle Aero', desc: 'Pradera brillante, cascadas y ciudad de cristal.', accent: '#38bdf8' },
  garden: { name: 'Jardín Gigante', desc: 'Eres diminuto: flores, hojas y gnomos traviesos.', accent: '#f472b6' },
  castle: { name: 'Castillo Embrujado', desc: 'Torres bajo la luna, vampiros, hombres lobo y gárgolas.', accent: '#ef4444' },
};

/** Theme of any level: 1-4 handmade, then the 6 worlds rotating forever. */
export function themeForLevel(level: number): ThemeId {
  if (level <= 4) return THEME_ORDER[Math.max(0, level - 1)];
  return THEME_ORDER[(level - 5) % THEME_ORDER.length];
}

export function levelInfo(level: number): LevelInfo {
  const theme = themeForLevel(level);
  const t = THEME_INFO[theme];
  return {
    id: level,
    name: t.name,
    desc: level <= 4 ? t.desc : `Nivel generado · ${t.desc}`,
    theme,
    accent: t.accent,
    generated: level > 4,
  };
}

export interface LevelHowTo {
  title: string;
  goal: string;
  steps: string[];
}

/** Clear objective + steps shown at level start and in the pause menu. */
export function levelHowTo(level: number): LevelHowTo {
  const info = levelInfo(level);

  if (level === 1) {
    return {
      title: 'Nivel 1 · Archipiélago Acogedor',
      goal: 'Cruza las plataformas y llega al portal de la cima',
      steps: [
        'Avanza hacia adelante por las islas flotantes',
        'Usa hongos elásticos, nubes móviles y géiseres para ganar altura',
        'Toca los santuarios para guardar tu progreso',
        'Al final, cruza el portal brillante para completar el nivel',
      ],
    };
  }

  if (level === 2) {
    return {
      title: 'Nivel 2 · Ruta Cósmica',
      goal: 'Salta entre asteroides hasta el portal estelar',
      steps: [
        'Sigue la ruta entre islas espaciales y anillos',
        'Usa plataformas móviles e impulsos para no caer al vacío',
        'Llega al portal del Observatorio Estelar para ganar',
      ],
    };
  }

  if (level === 3) {
    return {
      title: 'Nivel 3 · Pantano Sombrío',
      goal: 'Atraviesa la bruma y escala hasta el santuario',
      steps: [
        'Avanza por las plataformas del pantano y las ruinas',
        'Cuidado con la niebla y los obstáculos del camino',
        'Escala la torre y cruza el portal del santuario',
      ],
    };
  }

  if (level === 4) {
    return {
      title: 'Nivel 4 · Valle Aero',
      goal: 'Cruza praderas y cristal hasta el portal final',
      steps: [
        'Sigue la ruta por cascadas y plataformas aéreas',
        'Usa impulsos y trampolines para salvar los huecos',
        'Llega a la Plaza del Globo y cruza el portal',
      ],
    };
  }

  return {
    title: `Nivel ${level} · ${info.name}`,
    goal: 'Reúne los orbes y conquista la fortaleza',
    steps: [
      'Explora el mundo abierto con calma',
      'Encuentra los orbes 🔮 siguiendo sus rayos de luz',
      'Algunos orbes están en bóvedas: busca una llave 🔑',
      'Con todos los orbes se abre la fortaleza del centro',
      'Entra y sube la espiral hasta la cima para ganar',
    ],
  };
}

/** The 4 handmade worlds (kept for reference/UI). */
export const LEVELS: LevelInfo[] = [1, 2, 3, 4].map(levelInfo);

/** Companions earned every 10 levels. */
export const COMPANION_UNLOCKS: { companion: CompanionStyle; level: number }[] = [
  { companion: 'nube', level: 10 },
  { companion: 'estrella', level: 20 },
  { companion: 'luciernaga', level: 30 },
  { companion: 'catarina', level: 40 },
  { companion: 'hada', level: 50 },
  { companion: 'serpiente', level: 60 },
];

export function unlockLevelFor(c: CompanionStyle): number | undefined {
  return COMPANION_UNLOCKS.find((u) => u.companion === c)?.level;
}

interface ProgressData {
  highestCompleted: number;
}

const STORAGE_KEY = 'aether-leap-progress-v2';
const LEGACY_KEY = 'aether-leap-progress-v1';
let cache: ProgressData | null = null;

function read(): ProgressData {
  const data: ProgressData = { highestCompleted: 0 };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.highestCompleted === 'number') data.highestCompleted = Math.max(0, Math.floor(parsed.highestCompleted));
    } else {
      // Migrate the first progress format ({ completed: [1, 2, …] })
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed?.completed)) {
          const done = new Set(parsed.completed.filter((n: unknown) => typeof n === 'number'));
          let h = 0;
          while (done.has(h + 1)) h++;
          data.highestCompleted = h;
        }
      }
    }
  } catch {
    // storage unavailable – start fresh
  }
  try {
    if (/[?&]desbloquear=todo\b/.test(window.location.search)) {
      data.highestCompleted = Math.max(data.highestCompleted, 60);
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

export function highestCompleted(): number {
  return data().highestCompleted;
}

/** The furthest level you can play right now. */
export function maxPlayableLevel(): number {
  return data().highestCompleted + 1;
}

export function isLevelUnlocked(level: number): boolean {
  return level >= 1 && level <= maxPlayableLevel();
}

export function isLevelCompleted(level: number): boolean {
  return level <= data().highestCompleted;
}

export function isCompanionUnlocked(c: CompanionStyle): boolean {
  if (c === 'ninguno') return true;
  const lvl = unlockLevelFor(c);
  return lvl === undefined ? true : data().highestCompleted >= lvl;
}

/** Next companion still to earn (or null when all are unlocked). */
export function nextCompanionUnlock(): { companion: CompanionStyle; level: number } | null {
  return COMPANION_UNLOCKS.find((u) => data().highestCompleted < u.level) ?? null;
}

/** Marks a level as finished. Returns the companion unlocked by it for the first time, if any. */
export function markLevelComplete(level: number): CompanionStyle | null {
  const d = data();
  if (level <= d.highestCompleted) return null;
  const before = d.highestCompleted;
  d.highestCompleted = Math.max(d.highestCompleted, level);
  persist();
  const reward = COMPANION_UNLOCKS.find((u) => u.level > before && u.level <= d.highestCompleted);
  return reward ? reward.companion : null;
}
