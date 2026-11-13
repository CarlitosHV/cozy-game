/**
 * Player progress for the endless level ladder.
 *  - Levels 1-4 are the handmade worlds; from level 5 on they are generated dynamically
 *    (themes rotate: Acogedor → Cósmico → Pantano → Aero → Jardín → Castillo).
 *  - Levels unlock in order: finish level N to play level N+1.
 *  - Companions unlock every 10 levels: 10 Nubi, 20 Estelita, 30 Chispa, 40 Catarina,
 *    50 Lila (hada), 60 Quetsy (mini serpiente emplumada); the Hombre Polilla comes with the first
 *    Backrooms (level 15).
 *  - The Backrooms: levels 15, 25, 35… are a special world (yellow rooms, a warehouse and a
 *    corridor to run through) with monsters that hunt you (see levelBackrooms.ts); 25, 45, 65…
 *    are a boss fight against the Skinwalker instead.
 *  - Two generators: "Caja de arena" (open zone with orbs) and "Lucha contra jefes"
 *    (an arena with the world's boss). Which one a level gets is random but fixed per level.
 * Tip for testing: add ?desbloquear=todo to the URL to unlock everything (up to level 61).
 * Developer mode (see devMode.ts): unlocks every level and companion without touching the saved
 * progress, and can turn any level from 5 on into the world / boss you want to test.
 */
import type { CompanionStyle } from './character';

export type ThemeId =
  | 'cozy'
  | 'cosmic'
  | 'swamp'
  | 'aero'
  | 'garden'
  | 'castle'
  | 'neon'
  | 'cyberpunk'
  | 'lava'
  | 'ice'
  | 'desert'
  | 'candy'
  | 'backrooms';
/** The twelve open-air worlds (generated zones, parkour & boss arenas); the Backrooms have their own builder */
export type OutdoorThemeId = Exclude<ThemeId, 'backrooms'>;

export interface LevelInfo {
  id: number;
  name: string;
  desc: string;
  theme: ThemeId;
  accent: string;
  generated: boolean;
  /** Boss of this level (null on parkour, sandbox, and handmade levels) */
  boss: BossKind | null;
  totalCollectibles: number;
}

/** World progression order from level 11 onwards (10 levels per world, after World 1 Aero at 6–10) */
const WORLD_CYCLE: OutdoorThemeId[] = [
  'neon',
  'cyberpunk',
  'lava',
  'ice',
  'desert',
  'candy',
  'castle',
  'cosmic',
  'swamp',
  'garden',
  'cozy',
  'aero',
];

export const THEME_INFO: Record<ThemeId, { name: string; desc: string; accent: string }> = {
  cozy: { name: 'Archipiélago Acogedor', desc: 'Islas flotantes, hongos y nubes al atardecer.', accent: '#f59e0b' },
  cosmic: { name: 'Ruta Cósmica', desc: 'Asteroides, anillos planetarios y nebulosas.', accent: '#a78bfa' },
  swamp: { name: 'Pantano Sombrío', desc: 'Niebla, ruinas embrujadas y la torre de la bruja.', accent: '#84cc16' },
  aero: { name: 'Valle Aero', desc: 'Pradera brillante, cascadas y ciudad de cristal.', accent: '#38bdf8' },
  garden: { name: 'Jardín Gigante', desc: 'Eres diminuto: flores, hojas y gnomos traviesos.', accent: '#f472b6' },
  castle: { name: 'Castillo Embrujado', desc: 'Torres bajo la luna, vampiros, hombres lobo y gárgolas.', accent: '#ef4444' },
  neon: { name: 'Ciudad Neón', desc: 'Autopistas luminosas, palmeras láser y neón nocturno.', accent: '#e879f9' },
  cyberpunk: { name: 'Cyberpunk', desc: 'Megatorres de cromo, hologramas ácidos y lluvia eléctrica.', accent: '#22d3ee' },
  lava: { name: 'Volcán Infernal', desc: 'Roca basáltica, grietas de magma, géiseres y ceniza ardiente.', accent: '#f97316' },
  ice: { name: 'Cumbre Glacial', desc: 'Ventiscas, auroras boreales y plataformas de cristal helado.', accent: '#7dd3fc' },
  desert: { name: 'Dunas Doradas', desc: 'Templos de arenisca, obeliscos dorados y soles gemelos.', accent: '#fbbf24' },
  candy: { name: 'Reino Dulce', desc: 'Barquillos pastel, caramelos gigantes y nubes de algodón.', accent: '#fb7185' },
  backrooms: { name: 'Los Backrooms', desc: 'Cuartos amarillos sin fin, zumbido de lámparas y cosas que te siguen.', accent: '#d4b84a' },
};

// ---------------------------------------------------------------------------
// Developer mode: everything unlocked + one level turned into the world / generator you pick.
// ---------------------------------------------------------------------------
export interface DevLevelPick {
  level: number;
  kind: 'parkour' | 'sandbox' | 'boss' | 'backrooms';
  theme: ThemeId;
}
export const DEV_MAX_LEVEL = 120;
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

/**
 * Theme of any level:
 * - Levels 1–5 are fixed (1 cozy, 2 cosmic, 3 swamp, 4 aero, 5 garden).
 * - From level 6 onwards, levels are grouped into contiguous Worlds ("mundos"):
 *   6–10 Valle Aero, 11–20 Ciudad Neón, 21–30 Cyberpunk, 31–40 Volcán Infernal,
 *   41–50 Cumbre Glacial, 51–60 Dunas Doradas, 61–70 Reino Dulce, 71–80 Castillo, etc.
 *   (with Backrooms anomalies at 15, 25, 35...).
 */
export function themeForLevel(level: number): ThemeId {
  if (devPick && devPick.level === level) return devPick.kind === 'backrooms' ? 'backrooms' : devPick.theme;
  if (isBackroomsLevel(level)) return 'backrooms';
  const n = Math.max(1, Math.floor(level));
  if (n === 1) return 'cozy';
  if (n === 2) return 'cosmic';
  if (n === 3) return 'swamp';
  if (n === 4) return 'aero';
  if (n === 5) return 'garden';
  if (n <= 10) return 'aero';
  const block = Math.floor((n - 11) / 10);
  return WORLD_CYCLE[block % WORLD_CYCLE.length];
}

// ---------------------------------------------------------------------------
// Level generators: from level 5 on, each level is either "Parkour" (Only Up style),
// "Caja de arena" (open zone with orbs), "Lucha contra jefe" (every 10 levels), or Backrooms.
// ---------------------------------------------------------------------------
export type LevelKind = 'handmade' | 'parkour' | 'sandbox' | 'boss' | 'backrooms';
export type BossKind = 'bird' | 'glitch' | 'ufo' | 'skeleton' | 'gnome' | 'dracula' | 'skinwalker';

/** One boss per world. */
export const BOSS_FOR_THEME: Record<ThemeId, BossKind> = {
  cozy: 'bird',
  aero: 'glitch',
  cosmic: 'ufo',
  swamp: 'skeleton',
  garden: 'gnome',
  castle: 'dracula',
  neon: 'glitch',
  cyberpunk: 'ufo',
  lava: 'skeleton',
  ice: 'bird',
  desert: 'gnome',
  candy: 'glitch',
  backrooms: 'skinwalker',
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
  skinwalker: {
    name: 'El Skinwalker de los Backrooms',
    short: 'Skinwalker',
    desc: 'Una criatura con cráneo de venado que imita voces y te caza en la penumbra.',
    steps: [
      'El Skinwalker te caza: cuando se agacha, se va a lanzar sobre ti. ¡Esquívalo!',
      'Toma un cráneo de obsidiana y úsalo cuando esté cerca: grita y huye un rato',
      'Mientras huye, busca la daga de obsidiana (un brillo morado en algún cuarto)',
      'Con la daga en la mano, déjalo acercarse y úsala cuando lo tengas enfrente',
      'La daga se rompe al primer golpe: espántalo otra vez y busca otra',
      'Suelta copias de ti y de tus amigos: un golpe de bate las hace transformarse, y luego vacía su barra de vida a batazos',
      'Si una copia se topa con la persona real que imita, huye a juntarse con otras… y se fusionan en un Nahual',
      'Cuando lo espantas a veces abre un portal en la pared o el suelo, y sale junto a otro jugador',
      'Si escuchas que alguien te llama… no es tu amigo',
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

/**
 * Levels 1–4 are fixed handmade worlds; level 5 is fixed Jardín Gigante sandbox.
 * From level 6 on: bosses appear strictly every 10 levels (10, 20, 30… — never back-to-back),
 * levels 15, 25, 35… are the Backrooms, and all other levels rotate between complex non-linear
 * procedural parkour courses and open sandbox zones.
 */
export function levelKind(level: number): LevelKind {
  if (level <= 4) return 'handmade';
  if (devPick && devPick.level === level) return devPick.kind;
  if (level === 5) return 'sandbox';
  if (level >= 10 && level % 10 === 0) return 'boss';
  if (isBackroomsLevel(level)) return 'backrooms';
  // Levels 6–9 showcase Only-Up Aero Parkour leading up to Boss 10; afterwards ~3/4 parkour & ~1/4 sandbox zones
  if (level <= 9) return 'parkour';
  return level % 4 === 0 ? 'sandbox' : 'parkour';
}

/** Levels 15, 25, 35… fall into the Backrooms. */
export function isBackroomsLevel(level: number): boolean {
  return level >= 15 && level % 10 === 5;
}

export function isBossLevel(level: number): boolean {
  return levelKind(level) === 'boss';
}

export function bossForLevel(level: number): BossKind | null {
  return isBossLevel(level) ? BOSS_FOR_THEME[themeForLevel(level)] : null;
}

/** Relics (crystals and acorns) in each kind of level — the generators place exactly these. */
export const RELICS = { handmade: 12, parkour: 12, zone: 25, boss: 8, backrooms: 12 } as const;

export function levelTotalCollectibles(level: number): number {
  const kind = levelKind(level);
  return kind === 'handmade'
    ? RELICS.handmade
    : kind === 'parkour'
      ? RELICS.parkour
      : kind === 'boss'
        ? RELICS.boss
        : kind === 'backrooms'
          ? RELICS.backrooms
          : RELICS.zone;
}

export function levelInfo(level: number): LevelInfo {
  const theme = themeForLevel(level);
  const t = THEME_INFO[theme];
  const boss = bossForLevel(level);
  const kind = levelKind(level);
  return {
    id: level,
    name: boss ? `Jefe: ${BOSS_INFO[boss].short} · ${t.name}` : kind === 'parkour' ? `Parkour · ${t.name}` : t.name,
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

  if (levelKind(level) === 'backrooms') {
    return {
      title: `Nivel ${level} · Los Backrooms`,
      goal: 'Encuentra la salida antes de que algo te encuentre a ti',
      steps: [
        'Tienes 3 corazones: cada mordida te quita uno; sin corazones vuelves al último punto de control',
        'La salida del laberinto está cerrada: busca la llave en un callejón sin salida (el Maniquí solo se mueve si no lo ves)',
        'El almacén está a oscuras y no tiene piso: salta de caja en caja; cuando vuelva la luz, avanza rápido. Las Sonrisas vuelan hacia ti en lo oscuro',
        'En el pasillo rojo te persigue la Araña (algo salió mal con ella): lanza un orbe de luz (granada) para cegarla',
        'El pasillo se alarga sin fin… hasta que jalas las 3 palancas escondidas en huecos de las paredes. Detrás de la puerta: ¡corre y salta los obstáculos hasta la SALIDA!',
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

  if (levelKind(level) === 'parkour') {
    return {
      title: `Nivel ${level} · ${info.name}`,
      goal: 'Supera la ruta sinuosa de subidas, bajadas y saltos hasta el portal de la cima',
      steps: [
        'La ruta no es recta: gira en curvas, desciende a cañones profundos y vuelve a escalar torres',
        'Usa trampolines, corrientes ascendentes y plataformas móviles para avanzar',
        'Explora bifurcaciones opcionales para reunir las 12 reliquias y bayas de impulso',
        'Activa los santuarios intermedios y cruza el portal brillante al final',
      ],
    };
  }

  return {
    title: `Nivel ${level} · ${info.name}`,
    goal: 'Reúne los orbes y conquista la fortaleza',
    steps: [
      'Explora el mundo abierto con calma',
      'Encuentra los orbes siguiendo sus rayos de luz',
      ...(level >= 6
        ? ['Vence al guardián de la arena: suelta la palanca que abre la trampilla del sótano']
        : ['Algunos orbes están en bóvedas: busca una llave']),
      'Con todos los orbes se abre la fortaleza del centro',
      'Entra y sube la espiral hasta la cima (cuidado con péndulos y molinillos)',
      'Morir baja tu calificación: ¡llega rápido, sin caer y con muchas reliquias!',
    ],
  };
}

/** The 5 core worlds (levels 1-5). */
export const LEVELS: LevelInfo[] = [1, 2, 3, 4, 5].map(levelInfo);

/** Companions earned every 10 levels. */
export const COMPANION_UNLOCKS: { companion: CompanionStyle; level: number }[] = [
  { companion: 'nube', level: 10 },
  { companion: 'polilla', level: 15 },
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
  unlockedCompanions?: CompanionStyle[];
}

const STORAGE_KEY = 'aether-leap-progress-v2';
const LEGACY_KEY = 'aether-leap-progress-v1';
let cache: ProgressData | null = null;

function read(): ProgressData {
  const data: ProgressData = { highestCompleted: 0, unlockedCompanions: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.highestCompleted === 'number') data.highestCompleted = Math.max(0, Math.floor(parsed.highestCompleted));
      if (Array.isArray(parsed?.unlockedCompanions)) {
        data.unlockedCompanions = parsed.unlockedCompanions.filter((c: unknown): c is CompanionStyle => typeof c === 'string');
      }
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

export function unlockShopCompanion(c: CompanionStyle): void {
  if (!c || c === 'ninguno') return;
  const d = data();
  if (!d.unlockedCompanions) d.unlockedCompanions = [];
  if (!d.unlockedCompanions.includes(c)) {
    d.unlockedCompanions.push(c);
    persist();
  }
}

export function isCompanionUnlocked(c: CompanionStyle): boolean {
  if (c === 'ninguno' || devOn) return true;
  if (data().unlockedCompanions?.includes(c)) return true;
  const lvl = unlockLevelFor(c);
  return lvl === undefined ? true : data().highestCompleted >= lvl;
}

/** Next companion still to earn (or null when all are unlocked). */
export function nextCompanionUnlock(): { companion: CompanionStyle; level: number } | null {
  return COMPANION_UNLOCKS.find((u) => !isCompanionUnlocked(u.companion)) ?? null;
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
export function syncProgressFromBackend(highestCompletedLvl: number, companions?: string[]): void {
  const d = data();
  d.highestCompleted = Math.max(d.highestCompleted, highestCompletedLvl);
  if (Array.isArray(companions)) {
    for (const c of companions) {
      if (typeof c === 'string' && c !== 'ninguno') {
        if (!d.unlockedCompanions) d.unlockedCompanions = [];
        if (!d.unlockedCompanions.includes(c as CompanionStyle)) {
          d.unlockedCompanions.push(c as CompanionStyle);
        }
      }
    }
  }
  persist();
}

