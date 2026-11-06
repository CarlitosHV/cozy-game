/**
 * Player progress for the endless level ladder.
 *  - Levels 1-4 are the handmade worlds; from level 5 on they are generated dynamically
 *    (themes rotate: Acogedor → Cósmico → Pantano → Aero → Jardín → Castillo).
 *  - Levels unlock in order: finish level N to play level N+1.
 *  - Companions unlock every 10 levels: 10 Nubi, 20 Estelita, 30 Chispa, 40 Catarina,
 *    50 Lila (hada), 60 Jade (serpiente voladora).
 *  - Two generators: "Caja de arena" (open zone with orbs) and "Lucha contra jefes"
 *    (an arena with the world's boss). Which one a level gets is random but fixed per level.
 * Tip for testing: add ?desbloquear=todo to the URL to unlock everything (up to level 61).
 * Developer mode (see devMode.ts): unlocks every level and companion without touching the saved
 * progress, and can turn any level from 5 on into the world / boss you want to test.
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
  /** Boss of this level (null on sandbox and handmade levels) */
  boss: BossKind | null;
  totalCollectibles: number;
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

// ---------------------------------------------------------------------------
// Developer mode: everything unlocked + one level turned into the world / generator you pick.
// ---------------------------------------------------------------------------
export interface DevLevelPick {
  level: number;
  kind: 'sandbox' | 'boss';
  theme: ThemeId;
}
export const DEV_MAX_LEVEL = 61;
const DEV_KEY = 'cozy-dev-mode';
let devOn = (() => {
  try {
    return window.localStorage.getItem(DEV_KEY) === '1';
  } catch {
    return false;
  }
})();
let devPick: DevLevelPick | null = null;

export function isDevMode(): boolean {
  return devOn;
}

export function setDevMode(on: boolean): void {
  devOn = on;
  if (!on) devPick = null;
  try {
    if (on) window.localStorage.setItem(DEV_KEY, '1');
    else window.localStorage.removeItem(DEV_KEY);
  } catch {
    // ignore
  }
}

/** Turn a level (5+) into the world and generator chosen in the developer panel; null clears it. */
export function setDevLevelPick(pick: DevLevelPick | null): void {
  devPick = pick && pick.level > 4 ? { ...pick, level: Math.floor(pick.level) } : null;
}

export function getDevLevelPick(): DevLevelPick | null {
  return devPick;
}

/** Theme of any level: 1 to 6 in order (cozy, cosmic, swamp, aero, garden, castle), then looping smoothly. */
export function themeForLevel(level: number): ThemeId {
  if (devPick && devPick.level === level) return devPick.theme;
  const idx = Math.max(0, Math.floor(level) - 1);
  return THEME_ORDER[idx % THEME_ORDER.length];
}

// ---------------------------------------------------------------------------
// Level generators: from level 5 on, each level is (at random, but always the same for a
// given number) either a "Caja de arena" open zone or a "Lucha contra jefe" arena.
// ---------------------------------------------------------------------------
export type LevelKind = 'handmade' | 'sandbox' | 'boss';
export type BossKind = 'bird' | 'glitch' | 'ufo' | 'skeleton' | 'gnome' | 'dracula';

/** One boss per world. */
export const BOSS_FOR_THEME: Record<ThemeId, BossKind> = {
  cozy: 'bird',
  aero: 'glitch',
  cosmic: 'ufo',
  swamp: 'skeleton',
  garden: 'gnome',
  castle: 'dracula',
};

export const BOSS_INFO: Record<BossKind, { name: string; short: string; desc: string; steps: string[] }> = {
  bird: {
    name: 'Plumarroca, el Ave de Piedra',
    short: 'Plumarroca',
    desc: 'Un ave gigante lanza piedras desde lo alto de las torres y huye si te acercas.',
    steps: [
      'Plumarroca lanza piedras: mira los círculos rojos en el suelo y esquívalos',
      'Sus cuervos bajan a picotearte: pégales con el bate o la resortera',
      'Si te acercas a su torre, te siente y se va volando a otra',
      'Toma la resortera y junta piedras: dispárale para espantarla',
      'Cuando esté volando, dale con la resortera: ¡cae al suelo mareada!',
      'Corre y golpéala con el bate o cáele encima antes de que despierte',
    ],
  },
  glitch: {
    name: 'ERR0R.exe, el Monstruo Glitch',
    short: 'ERR0R.exe',
    desc: 'Un error del sistema que crea copias glitch de ti.',
    steps: [
      'ERR0R.exe crea copias glitch de tu personaje: derrótalas',
      'Usa el bate, la resortera o cáeles encima',
      'Cada copia suelta un orbe de luz: recógelo',
      'Lanza los orbes de luz al monstruo (usa el objeto apuntando con la cámara)',
      'Salta las ondas de pantallazo que salen del monstruo',
    ],
  },
  ufo: {
    name: 'La Nave Nodriza',
    short: 'Nave Nodriza',
    desc: 'Un ovni gigante dispara láseres, suelta aliens y se lleva las vacas. Si se lleva todas, pierdes.',
    steps: [
      'Junta piedras y dispárale al vidrio del ovni con la resortera',
      'Esquiva los círculos rojos: ahí cae un rayo láser',
      'Protege a las vacas: si el ovni secuestra una, ¡lánzale la red! Las que se lleva no vuelven',
      'Si se lleva todas las vacas, pierdes la batalla',
      'Bajan aliens por un rayo verde: pégales con el bate (o 2 piedras) antes de que salten',
    ],
  },
  skeleton: {
    name: 'Huesudo, el Esqueleto del Pantano',
    short: 'Huesudo',
    desc: 'Un esqueleto gigante se esconde en el pantano y sale por cualquier lado, hasta del lago.',
    steps: [
      'Huesudo se agacha y sale en otro lugar: el círculo verde avisa por dónde',
      'Los esqueletos bailarines te atrapan y te llevan a su boca: te mastica y te escupe',
      'Si te atrapan, pulsa saltar muchas veces para soltarte',
      'Rescata a tus amigos golpeando al que tiene la jaula de huesos',
      'Junta bombas y lánzalas a la boca de Huesudo cuando la abra',
    ],
  },
  gnome: {
    name: 'El Rey Gnomo',
    short: 'Rey Gnomo',
    desc: 'El rey de los gnomos ataca con su mazo gigante.',
    steps: [
      'El Rey Gnomo golpea el suelo con su mazo: salta las ondas',
      'Si el rey toma una red del suelo, te la lanza: sal del círculo celeste',
      'Lánzale tú la red para atraparlo unos segundos',
      'Salen gnomos guerreros a protegerlo y ayudantes a quitarle la red: pégales',
      'Mientras está atrapado, golpéalo con el bate, piedras o cayéndole encima',
    ],
  },
  dracula: {
    name: 'El Conde Drácula',
    short: 'Drácula',
    desc: 'Drácula oscurece todo; solo la luz de los candelabros lo debilita.',
    steps: [
      'Drácula oscurece la pantalla y ataca en picada: esquívalo',
      'Toma una antorcha y acércate a los candelabros: cada antorcha prende solo 2',
      'No te quedes mucho en la oscuridad: salen manos de sombra del suelo',
      'Con todos los candelabros prendidos, Drácula cae debilitado',
      'Golpéalo mientras está débil: luego volverá a apagar las velas',
    ],
  },
};

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Handmade worlds 1-4; from 5 on, each level is randomly (but always the same) a sandbox or a boss fight. */
export function levelKind(level: number): LevelKind {
  if (level <= 4) return 'handmade';
  if (devPick && devPick.level === level) return devPick.kind;
  return mulberry(level * 7717 + 3 * 131)() < 0.3 ? 'boss' : 'sandbox';
}

export function isBossLevel(level: number): boolean {
  return levelKind(level) === 'boss';
}

export function bossForLevel(level: number): BossKind | null {
  return isBossLevel(level) ? BOSS_FOR_THEME[themeForLevel(level)] : null;
}

export function levelTotalCollectibles(level: number): number {
  if (level === 1) return 12;
  return 10;
}

export function levelInfo(level: number): LevelInfo {
  const theme = themeForLevel(level);
  const t = THEME_INFO[theme];
  const boss = bossForLevel(level);
  return {
    id: level,
    name: boss ? `Jefe: ${BOSS_INFO[boss].short} · ${t.name}` : t.name,
    desc: boss ? BOSS_INFO[boss].desc : t.desc,
    theme,
    accent: t.accent,
    generated: level > 4,
    boss,
    totalCollectibles: levelTotalCollectibles(level),
  };
}

export interface LevelHowTo {
  title: string;
  goal: string;
  steps: string[];
}

/** Clear objective + steps shown at level start and in the pause menu. */
export function levelHowTo(level: number, mode?: string): LevelHowTo {
  const info = levelInfo(level);

  if (mode === 'chase') {
    return {
      title: `Nivel ${level} · Modo Persecución`,
      goal: '¡Escapa del Acechador Sombrío y llega al portal de la cima!',
      steps: [
        'El Acechador Sombrío te persigue sin descanso desde atrás: ¡no te detengas!',
        'Si se acerca a menos de 8 metros, la pantalla vibrará en rojo y escucharás la alarma.',
        'Aprovecha los hongos elásticos, atajos y saltos precisos para ganar distancia y cruzar el portal.',
      ],
    };
  }

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

  const boss = bossForLevel(level);
  if (boss) {
    const b = BOSS_INFO[boss];
    return {
      title: `Nivel ${level} · ${b.name}`,
      goal: `Derrota a ${b.short} y cruza el portal`,
      steps: [
        ...b.steps,
        'Cuida tu barra de vida: hamburguesas y papitas la recuperan',
        'Bate y red se rompen con el uso: en la arena aparecen más',
      ],
    };
  }

  if (level === 5) {
    return {
      title: 'Nivel 5 · Jardín Gigante',
      goal: 'Asciende entre flores gigantes y alcanza la cima del Girasol',
      steps: [
        'Explora las hojas colosales, enredaderas y tallos trepadores',
        'Salta entre pétalos primaverales y evita las trampas de espinas',
        'Llega a la Gran Torre del Girasol y cruza el portal',
      ],
    };
  }

  return {
    title: `Nivel ${level} · ${info.name}`,
    goal: 'Reúne los orbes y conquista la fortaleza',
    steps: [
      'Explora el mundo abierto con calma',
      'Encuentra los orbes siguiendo sus rayos de luz',
      'Algunos orbes están en bóvedas: busca una llave',
      'Con todos los orbes se abre la fortaleza del centro',
      'Entra y sube la espiral hasta la cima para ganar',
    ],
  };
}

/** The 5 core worlds (levels 1-5). */
export const LEVELS: LevelInfo[] = [1, 2, 3, 4, 5].map(levelInfo);

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
    if (/[?&](unlock(?:=all|=true)?|desbloquear(?:=todo)?|debug(?:=true)?)\b/i.test(window.location.search)) {
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
  const normal = data().highestCompleted + 1;
  return devOn ? Math.max(normal, DEV_MAX_LEVEL) : normal;
}

export function isLevelUnlocked(level: number): boolean {
  return level >= 1 && level <= maxPlayableLevel();
}

export function isLevelCompleted(level: number): boolean {
  return level <= data().highestCompleted;
}

export function isCompanionUnlocked(c: CompanionStyle): boolean {
  if (c === 'ninguno' || devOn) return true;
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

/** Synchronizes progress from backend API (sets highestCompleted = maxUnlockedLevel - 1) */
export function syncProgressFromBackend(highestCompletedLvl: number): void {
  const d = data();
  d.highestCompleted = Math.max(d.highestCompleted, highestCompletedLvl);
  persist();
}

