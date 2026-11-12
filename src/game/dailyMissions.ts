/**
 * Daily Missions & Cosmetic Pattern Unlocks
 * Deterministic daily missions keyed by local date (YYYY-MM-DD), tracking real
 * parkour challenges and item/relic collection across biomes.
 */
import {
  ShirtPatternId,
  SHIRT_PATTERNS,
  UNLOCKABLE_PATTERN_IDS,
  getPatternDef,
} from './patterns';
import {
  ThemeId,
  THEME_INFO,
  LevelKind,
  isDevMode,
  maxPlayableLevel,
  themeForLevel,
} from './progress';

export type MissionMetric =
  | 'collect_relics'
  | 'collect_items'
  | 'collect_orbs'
  | 'distinct_biomes'
  | 'reach_checkpoints'
  | 'complete_levels'
  | 'complete_parkour'
  | 'no_death_win'
  | 'time_trial_win'
  | 'chase_win'
  | 'biome_relics'
  | 'biome_complete';

export interface DailyMission {
  id: string;
  slotIndex: number;
  title: string;
  desc: string;
  category: 'parkour' | 'collection' | 'biome';
  metric: MissionMetric;
  target: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardPattern: ShirtPatternId;
  targetBiome?: ThemeId;
  biomesVisited?: ThemeId[];
}

export interface DailyMissionsSnapshot {
  dateKey: string;
  missions: DailyMission[];
  unlockedPatterns: ShirtPatternId[];
  claimableCount: number;
  totalUnlockableCount: number;
}

export type MissionGameEvent =
  | { type: 'relic_collected'; level: number; theme: ThemeId }
  | { type: 'orb_collected'; level: number; theme: ThemeId }
  | { type: 'item_collected'; itemType: string; level: number; theme: ThemeId }
  | { type: 'checkpoint_reached'; level: number; theme: ThemeId }
  | {
      type: 'level_completed';
      level: number;
      kind: LevelKind;
      theme: ThemeId;
      mode: 'free' | 'time_trial' | 'chase';
      deaths: number;
      timeSeconds: number;
      relicsFound: number;
    };

const DAILY_STORAGE_KEY = 'cozy-daily-missions-v1';
const PATTERNS_STORAGE_KEY = 'cozy-cosmetic-patterns-v1';

// ---------- Date & Seeded PRNG ----------

export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMsUntilNextDailyReset(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

export function formatResetCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function hashDateKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Mission Templates ----------

interface MissionTemplate {
  key: string;
  category: 'parkour' | 'collection' | 'biome';
  metric: MissionMetric;
  title: (biome?: ThemeId, target?: number) => string;
  desc: (biome?: ThemeId, target?: number) => string;
  targets: number[];
  needsBiome?: boolean;
  preferredPattern?: ShirtPatternId;
}

const PARKOUR_TEMPLATES: MissionTemplate[] = [
  {
    key: 'no_death',
    category: 'parkour',
    metric: 'no_death_win',
    title: () => 'Paso Impecable',
    desc: () => 'Completa cualquier nivel sin caer al vacío ni perder.',
    targets: [1],
  },
  {
    key: 'time_trial',
    category: 'parkour',
    metric: 'time_trial_win',
    title: () => 'Corredor del Viento',
    desc: () => 'Gana 1 nivel en modo Contrarreloj antes de que acabe el tiempo.',
    targets: [1],
  },
  {
    key: 'chase',
    category: 'parkour',
    metric: 'chase_win',
    title: () => 'Escape Sombrío',
    desc: () => 'Completa 1 nivel en modo Persecución escapando del Acechador.',
    targets: [1],
  },
  {
    key: 'checkpoints',
    category: 'parkour',
    metric: 'reach_checkpoints',
    title: (_, t) => `Guardia de Santuarios (${t})`,
    desc: (_, t) => `Activa ${t} santuarios de descanso escalando en cualquier nivel.`,
    targets: [4, 5, 6],
  },
  {
    key: 'complete_levels',
    category: 'parkour',
    metric: 'complete_levels',
    title: (_, t) => (t === 1 ? 'Cima Conquistada' : `Escalada Doble (${t})`),
    desc: (_, t) => `Cruza el portal de victoria en ${t} ${t === 1 ? 'nivel' : 'niveles'} hoy.`,
    targets: [2, 3],
  },
];

const COLLECTION_TEMPLATES: MissionTemplate[] = [
  {
    key: 'relics',
    category: 'collection',
    metric: 'collect_relics',
    title: (_, t) => `Cazatesoros Estelar (${t})`,
    desc: (_, t) => `Recoge ${t} reliquias (bellotas doradas o cristales) en tus recorridos.`,
    targets: [8, 10, 12],
  },
  {
    key: 'items',
    category: 'collection',
    metric: 'collect_items',
    title: (_, t) => `Mochila de Explorador (${t})`,
    desc: (_, t) => `Recoge ${t} objetos del mundo (bayas mágicas, nueces o herramientas).`,
    targets: [3, 4, 5],
  },
  {
    key: 'distinct_biomes',
    category: 'collection',
    metric: 'distinct_biomes',
    title: (_, t) => `Coleccionista de Biomas (${t})`,
    desc: (_, t) => `Recoge reliquias u objetos en ${t} biomas diferentes hoy.`,
    targets: [2, 3],
  },
];

const BIOME_TEMPLATES: MissionTemplate[] = [
  {
    key: 'biome_relics',
    category: 'biome',
    metric: 'biome_relics',
    needsBiome: true,
    title: (b, t) => `Tesoros de ${b ? THEME_INFO[b].name : 'Bioma'} (${t})`,
    desc: (b, t) => `Recoge ${t} reliquias u objetos dentro de ${b ? THEME_INFO[b].name : 'este bioma'}.`,
    targets: [4, 5, 6],
  },
  {
    key: 'biome_complete',
    category: 'biome',
    metric: 'biome_complete',
    needsBiome: true,
    title: (b) => `Conquista: ${b ? THEME_INFO[b].name : 'Bioma'}`,
    desc: (b) => `Completa 1 nivel ambientado en ${b ? THEME_INFO[b].name : 'este bioma'}.`,
    targets: [1],
  },
];

const BIOME_PATTERN_MAP: Partial<Record<ThemeId, ShirtPatternId>> = {
  aero: 'rayas_aero',
  cosmic: 'constelacion',
  swamp: 'musgo_pantano',
  garden: 'hoja_jardin',
  neon: 'rejilla_neon',
  cyberpunk: 'circuito_cyber',
  lava: 'flama_volcan',
  ice: 'cristal_glacial',
  desert: 'sol_desierto',
  candy: 'remolino_dulce',
  castle: 'corona_real',
};

function reachableBiomes(): ThemeId[] {
  const maxLvl = Math.max(5, maxPlayableLevel());
  const set = new Set<ThemeId>();
  // Always ensure at least levels 1..5 biomes are included so every player can complete missions
  for (let l = 1; l <= Math.min(maxLvl, 95); l++) {
    const t = themeForLevel(l);
    if (t !== 'backrooms') set.add(t);
  }
  return Array.from(set);
}

// ---------- Persistence ----------

let unlockedCache: ShirtPatternId[] | null = null;
let dailyCache: { dateKey: string; missions: DailyMission[] } | null = null;

const stateListeners = new Set<() => void>();
const completionListeners = new Set<(mission: DailyMission) => void>();

function readUnlockedPatterns(): ShirtPatternId[] {
  const out = new Set<ShirtPatternId>(['liso']);
  try {
    const raw = window.localStorage.getItem(PATTERNS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const id of arr) {
          if (SHIRT_PATTERNS.some((p) => p.id === id)) {
            out.add(id as ShirtPatternId);
          }
        }
      }
    }
  } catch {
    // storage unavailable
  }
  return Array.from(out);
}

function persistUnlockedPatterns(list: ShirtPatternId[]) {
  try {
    window.localStorage.setItem(PATTERNS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export function getUnlockedPatterns(): ShirtPatternId[] {
  if (!unlockedCache) unlockedCache = readUnlockedPatterns();
  return [...unlockedCache];
}

export function isPatternUnlocked(pattern: ShirtPatternId | undefined): boolean {
  if (!pattern || pattern === 'liso') return true;
  if (isDevMode()) return true;
  return getUnlockedPatterns().includes(pattern);
}

export function unlockCosmeticPattern(pattern: ShirtPatternId): boolean {
  const current = getUnlockedPatterns();
  if (current.includes(pattern)) return false;
  const next = [...current, pattern];
  unlockedCache = next;
  persistUnlockedPatterns(next);
  notifyStateListeners();
  return true;
}

function pickRewardPattern(
  rng: () => number,
  usedToday: Set<ShirtPatternId>,
  preferred?: ShirtPatternId
): ShirtPatternId {
  const unlocked = new Set(getUnlockedPatterns());
  const lockedPool = UNLOCKABLE_PATTERN_IDS.filter((id) => !unlocked.has(id) && !usedToday.has(id));
  if (preferred && lockedPool.includes(preferred)) {
    usedToday.add(preferred);
    return preferred;
  }
  if (lockedPool.length > 0) {
    const picked = lockedPool[Math.floor(rng() * lockedPool.length)];
    usedToday.add(picked);
    return picked;
  }
  // Fallback when all unique patterns are already unlocked or assigned today
  const fallbackPool = UNLOCKABLE_PATTERN_IDS.filter((id) => !usedToday.has(id));
  const pool = fallbackPool.length > 0 ? fallbackPool : UNLOCKABLE_PATTERN_IDS;
  if (preferred && pool.includes(preferred)) {
    usedToday.add(preferred);
    return preferred;
  }
  const picked = pool[Math.floor(rng() * pool.length)];
  usedToday.add(picked);
  return picked;
}

function generateMissionsForDate(dateKey: string): DailyMission[] {
  const rng = mulberry32(hashDateKey(dateKey));
  const biomes = reachableBiomes();
  const usedRewards = new Set<ShirtPatternId>();

  const pickFrom = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const missions: DailyMission[] = [];

  // Slot 0: Parkour Challenge
  const pTpl = pickFrom(PARKOUR_TEMPLATES);
  const pTarget = pickFrom(pTpl.targets);
  missions.push({
    id: `${dateKey}-0-${pTpl.key}`,
    slotIndex: 0,
    title: pTpl.title(undefined, pTarget),
    desc: pTpl.desc(undefined, pTarget),
    category: 'parkour',
    metric: pTpl.metric,
    target: pTarget,
    progress: 0,
    completed: false,
    claimed: false,
    rewardPattern: pickRewardPattern(rng, usedRewards),
  });

  // Slot 1: Collection / Multi-Biome Challenge
  const cTpl = pickFrom(COLLECTION_TEMPLATES);
  const cTarget = pickFrom(cTpl.targets);
  missions.push({
    id: `${dateKey}-1-${cTpl.key}`,
    slotIndex: 1,
    title: cTpl.title(undefined, cTarget),
    desc: cTpl.desc(undefined, cTarget),
    category: 'collection',
    metric: cTpl.metric,
    target: cTarget,
    progress: 0,
    completed: false,
    claimed: false,
    rewardPattern: pickRewardPattern(rng, usedRewards),
    biomesVisited: cTpl.metric === 'distinct_biomes' ? [] : undefined,
  });

  // Slot 2: Biome-Specific Challenge (collect or complete inside a reachable biome)
  const bTpl = pickFrom(BIOME_TEMPLATES);
  const bTheme = pickFrom(biomes);
  const bTarget = pickFrom(bTpl.targets);
  const bPreferred = BIOME_PATTERN_MAP[bTheme];
  missions.push({
    id: `${dateKey}-2-${bTpl.key}-${bTheme}`,
    slotIndex: 2,
    title: bTpl.title(bTheme, bTarget),
    desc: bTpl.desc(bTheme, bTarget),
    category: 'biome',
    metric: bTpl.metric,
    target: bTarget,
    progress: 0,
    completed: false,
    claimed: false,
    targetBiome: bTheme,
    rewardPattern: pickRewardPattern(rng, usedRewards, bPreferred),
  });

  // Slot 3: Second distinct Parkour or Collection challenge (non-overlapping metric)
  const remainingPool = [...PARKOUR_TEMPLATES, ...COLLECTION_TEMPLATES].filter(
    (t) => t.metric !== pTpl.metric && t.metric !== cTpl.metric
  );
  const sTpl = pickFrom(remainingPool);
  const sTarget = pickFrom(sTpl.targets);
  missions.push({
    id: `${dateKey}-3-${sTpl.key}`,
    slotIndex: 3,
    title: sTpl.title(undefined, sTarget),
    desc: sTpl.desc(undefined, sTarget),
    category: sTpl.category,
    metric: sTpl.metric,
    target: sTarget,
    progress: 0,
    completed: false,
    claimed: false,
    rewardPattern: pickRewardPattern(rng, usedRewards),
    biomesVisited: sTpl.metric === 'distinct_biomes' ? [] : undefined,
  });

  return missions;
}

function readDailyStore(): { dateKey: string; missions: DailyMission[] } {
  const today = getLocalDateKey();
  try {
    const raw = window.localStorage.getItem(DAILY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { dateKey?: string; missions?: DailyMission[] };
      if (parsed?.dateKey === today && Array.isArray(parsed.missions) && parsed.missions.length > 0) {
        return { dateKey: today, missions: parsed.missions };
      }
    }
  } catch {
    // ignore storage read error
  }
  const fresh = { dateKey: today, missions: generateMissionsForDate(today) };
  persistDailyStore(fresh);
  return fresh;
}

function persistDailyStore(store: { dateKey: string; missions: DailyMission[] }) {
  try {
    window.localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

function ensureTodayStore(): { dateKey: string; missions: DailyMission[] } {
  const today = getLocalDateKey();
  if (!dailyCache || dailyCache.dateKey !== today) {
    dailyCache = readDailyStore();
  }
  return dailyCache;
}

function notifyStateListeners() {
  for (const cb of stateListeners) {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  }
}

export function getDailyMissionsState(): DailyMissionsSnapshot {
  const store = ensureTodayStore();
  const unlockedPatterns = getUnlockedPatterns();
  const claimableCount = store.missions.filter((m) => m.completed && !m.claimed).length;
  return {
    dateKey: store.dateKey,
    missions: store.missions.map((m) => ({
      ...m,
      biomesVisited: m.biomesVisited ? [...m.biomesVisited] : undefined,
    })),
    unlockedPatterns,
    claimableCount,
    totalUnlockableCount: UNLOCKABLE_PATTERN_IDS.length,
  };
}

export function subscribeDailyMissions(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

export function subscribeMissionCompleted(listener: (mission: DailyMission) => void): () => void {
  completionListeners.add(listener);
  return () => completionListeners.delete(listener);
}

/**
 * Claims a completed daily mission's cosmetic pattern reward.
 * Returns the unlocked pattern definition, or null if not claimable.
 */
export function claimDailyMissionReward(missionId: string): {
  pattern: ShirtPatternId;
  newlyUnlocked: boolean;
  name: string;
} | null {
  const store = ensureTodayStore();
  const mission = store.missions.find((m) => m.id === missionId);
  if (!mission || !mission.completed || mission.claimed) return null;

  mission.claimed = true;
  persistDailyStore(store);

  const newlyUnlocked = unlockCosmeticPattern(mission.rewardPattern);
  const def = getPatternDef(mission.rewardPattern);
  notifyStateListeners();
  return {
    pattern: mission.rewardPattern,
    newlyUnlocked,
    name: def.name,
  };
}

/** Records a live gameplay event and advances today's matching missions. */
export function recordMissionEvent(event: MissionGameEvent): void {
  const store = ensureTodayStore();
  let changed = false;
  const newlyCompleted: DailyMission[] = [];

  const advance = (m: DailyMission, delta: number) => {
    if (m.completed || delta <= 0) return;
    m.progress = Math.min(m.target, m.progress + delta);
    changed = true;
    if (m.progress >= m.target) {
      m.completed = true;
      newlyCompleted.push({ ...m });
    }
  };

  const trackBiomeVisit = (m: DailyMission, theme: ThemeId) => {
    if (m.completed) return;
    if (!m.biomesVisited) m.biomesVisited = [];
    if (!m.biomesVisited.includes(theme)) {
      m.biomesVisited.push(theme);
      m.progress = Math.min(m.target, m.biomesVisited.length);
      changed = true;
      if (m.progress >= m.target) {
        m.completed = true;
        newlyCompleted.push({ ...m });
      }
    }
  };

  for (const m of store.missions) {
    if (m.completed) continue;

    switch (event.type) {
      case 'relic_collected':
        if (m.metric === 'collect_relics') advance(m, 1);
        else if (m.metric === 'distinct_biomes') trackBiomeVisit(m, event.theme);
        else if (m.metric === 'biome_relics' && m.targetBiome === event.theme) advance(m, 1);
        break;

      case 'orb_collected':
        if (m.metric === 'collect_orbs') advance(m, 1);
        else if (m.metric === 'distinct_biomes') trackBiomeVisit(m, event.theme);
        else if (m.metric === 'biome_relics' && m.targetBiome === event.theme) advance(m, 1);
        break;

      case 'item_collected':
        if (m.metric === 'collect_items') advance(m, 1);
        else if (m.metric === 'distinct_biomes') trackBiomeVisit(m, event.theme);
        else if (m.metric === 'biome_relics' && m.targetBiome === event.theme) advance(m, 1);
        break;

      case 'checkpoint_reached':
        if (m.metric === 'reach_checkpoints') advance(m, 1);
        break;

      case 'level_completed':
        if (m.metric === 'complete_levels') advance(m, 1);
        else if (m.metric === 'complete_parkour' && (event.kind === 'parkour' || event.kind === 'handmade')) {
          advance(m, 1);
        } else if (m.metric === 'no_death_win' && event.deaths === 0) {
          advance(m, 1);
        } else if (m.metric === 'time_trial_win' && event.mode === 'time_trial') {
          advance(m, 1);
        } else if (m.metric === 'chase_win' && event.mode === 'chase') {
          advance(m, 1);
        } else if (m.metric === 'biome_complete' && m.targetBiome === event.theme) {
          advance(m, 1);
        }
        break;
    }
  }

  if (changed) {
    persistDailyStore(store);
    notifyStateListeners();
    for (const completedMission of newlyCompleted) {
      for (const cb of completionListeners) {
        try {
          cb(completedMission);
        } catch {
          // ignore
        }
      }
    }
  }
}
