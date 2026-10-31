/**
 * Character Generator data: appearance options, curated cozy palettes,
 * harmonious random generation, random names and local persistence.
 * Shared by the 3D model builder (models.ts), the engine and the HUD.
 */

import { isCompanionUnlocked } from './progress';

export type BodyType = 'chico' | 'chica';
export type HairStyle = 'flequillo' | 'puntas' | 'rapado' | 'coleta' | 'largo' | 'trenzas' | 'chongo';
export type HatStyle = 'gorro' | 'gorra' | 'sombrero' | 'orejas' | 'flores' | 'ninguno';
export type EyeStyle = 'redondos' | 'grandes' | 'felices';
export type Accessory = 'ninguno' | 'lentes' | 'pecas';
export type CompanionStyle = 'nube' | 'estrella' | 'luciernaga' | 'catarina' | 'hada' | 'serpiente' | 'ninguno';
export type OutfitStyle = 'sueter' | 'sudadera' | 'chaqueta' | 'overol' | 'vestido' | 'poncho';

export interface CharacterAppearance {
  /** Male / female character. Each one keeps its own saved customization. */
  bodyType: BodyType;
  name: string;
  skinColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  eyeStyle: EyeStyle;
  accessory: Accessory;
  hatStyle: HatStyle;
  hatColor: string;
  outfitStyle: OutfitStyle;
  sweaterColor: string;
  /** Secondary outfit color: overall denim, poncho stripes, dress trim, hoodie pocket */
  detailColor: string;
  scarfColor: string;
  bootColor: string;
  backpack: boolean;
  companion: CompanionStyle;
  /** Vertical scale, 0.88 – 1.12 */
  height: number;
  /** Horizontal scale, 0.88 – 1.15 */
  build: number;
}

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  bodyType: 'chico',
  name: 'Viajero',
  skinColor: '#fed0bb',
  hairColor: '#543825',
  hairStyle: 'flequillo',
  eyeStyle: 'redondos',
  accessory: 'ninguno',
  hatStyle: 'gorro',
  hatColor: '#3d5a80',
  outfitStyle: 'sueter',
  sweaterColor: '#db6b50',
  detailColor: '#3d5a80',
  scarfColor: '#f2cc8f',
  bootColor: '#3d312a',
  backpack: true,
  companion: 'nube',
  height: 1,
  build: 1,
};

export const DEFAULT_CHICA: CharacterAppearance = {
  bodyType: 'chica',
  name: 'Viajera',
  skinColor: '#fed0bb',
  hairColor: '#8a5a34',
  hairStyle: 'largo',
  eyeStyle: 'grandes',
  accessory: 'ninguno',
  hatStyle: 'flores',
  hatColor: '#b56576',
  outfitStyle: 'vestido',
  sweaterColor: '#81b29a',
  detailColor: '#f2cc8f',
  scarfColor: '#f4f1de',
  bootColor: '#5e4636',
  backpack: true,
  companion: 'catarina',
  height: 0.97,
  build: 0.97,
};

export function defaultAppearanceFor(body: BodyType): CharacterAppearance {
  const a = { ...(body === 'chica' ? DEFAULT_CHICA : DEFAULT_APPEARANCE) };
  // Companions must be earned by finishing their level
  if (!isCompanionUnlocked(a.companion)) a.companion = 'ninguno';
  return a;
}

// ---------- Option lists (labels in Spanish for the UI) ----------

export const BODY_TYPES: { id: BodyType; name: string }[] = [
  { id: 'chico', name: 'Chico' },
  { id: 'chica', name: 'Chica' },
];

/** Each body type has its own hairstyle set. */
export const HAIR_STYLES: { id: HairStyle; name: string; bodies: BodyType[] }[] = [
  { id: 'largo', name: 'Largo', bodies: ['chica'] },
  { id: 'trenzas', name: 'Coletitas', bodies: ['chica'] },
  { id: 'chongo', name: 'Chongo', bodies: ['chica'] },
  { id: 'flequillo', name: 'Flequillo', bodies: ['chico', 'chica'] },
  { id: 'puntas', name: 'Puntas', bodies: ['chico'] },
  { id: 'rapado', name: 'Corto', bodies: ['chico'] },
  { id: 'coleta', name: 'Coleta', bodies: ['chico', 'chica'] },
];

export function hairStylesFor(body: BodyType) {
  return HAIR_STYLES.filter((h) => h.bodies.includes(body));
}

/** Each body type has its own wardrobe (hats and outfits). */
export const HAT_STYLES: { id: HatStyle; name: string; bodies: BodyType[] }[] = [
  { id: 'gorra', name: 'Gorra', bodies: ['chico'] },
  { id: 'gorro', name: 'Gorro', bodies: ['chico', 'chica'] },
  { id: 'sombrero', name: 'Sombrero', bodies: ['chico', 'chica'] },
  { id: 'flores', name: 'Corona Flores', bodies: ['chica'] },
  { id: 'orejas', name: 'Orejitas', bodies: ['chica'] },
  { id: 'ninguno', name: 'Nada', bodies: ['chico', 'chica'] },
];

export const OUTFIT_STYLES: { id: OutfitStyle; name: string; bodies: BodyType[] }[] = [
  { id: 'chaqueta', name: 'Chaqueta', bodies: ['chico'] },
  { id: 'vestido', name: 'Vestido', bodies: ['chica'] },
  { id: 'sueter', name: 'Suéter', bodies: ['chico', 'chica'] },
  { id: 'sudadera', name: 'Sudadera', bodies: ['chico', 'chica'] },
  { id: 'overol', name: 'Overol', bodies: ['chico', 'chica'] },
  { id: 'poncho', name: 'Poncho', bodies: ['chico', 'chica'] },
];

export function hatStylesFor(body: BodyType) {
  return HAT_STYLES.filter((h) => h.bodies.includes(body));
}

export function outfitStylesFor(body: BodyType) {
  return OUTFIT_STYLES.filter((o) => o.bodies.includes(body));
}

export const EYE_STYLES: { id: EyeStyle; name: string }[] = [
  { id: 'redondos', name: 'Redondos' },
  { id: 'grandes', name: 'Brillantes' },
  { id: 'felices', name: 'Felices ^^' },
];

export const ACCESSORIES: { id: Accessory; name: string }[] = [
  { id: 'ninguno', name: 'Nada' },
  { id: 'lentes', name: 'Lentes' },
  { id: 'pecas', name: 'Pecas' },
];

export const COMPANIONS: { id: CompanionStyle; name: string; desc: string }[] = [
  { id: 'nube', name: 'Nubi', desc: 'Nubecita con halo' },
  { id: 'estrella', name: 'Estelita', desc: 'Estrella dorada' },
  { id: 'luciernaga', name: 'Chispa', desc: 'Luciérnaga brillante' },
  { id: 'catarina', name: 'Catarina', desc: 'Mariquita de la suerte' },
  { id: 'hada', name: 'Lila', desc: 'Hada del jardín' },
  { id: 'serpiente', name: 'Jade', desc: 'Serpiente voladora' },
  { id: 'ninguno', name: 'Sin compañero', desc: 'Viaje en solitario' },
];

// ---------- Curated palettes ----------

export const SKIN_TONES = ['#fde3d3', '#fed0bb', '#f1c09a', '#e0a77e', '#c68a5e', '#a86d45', '#7d4f32', '#5a3824'];

export const HAIR_COLORS = [
  '#1f1a17', '#3b2a20', '#543825', '#8a5a34', '#c98b4a', '#e8c37a',
  '#f2efe6', '#b33c2e', '#e58fb1', '#7fb7d9', '#8f7cc4', '#6fa88a',
];

export const CLOTH_COLORS = [
  '#db6b50', '#e07a5f', '#f2cc8f', '#e9c46a', '#81b29a', '#588157',
  '#3d5a80', '#98c1d9', '#6d597a', '#b56576', '#f4f1de', '#2b2d42',
];

export const BOOT_COLORS = ['#3d312a', '#5e4636', '#8a6a4f', '#2b2d42', '#6b2f2a', '#3f4a3c'];

// ---------- Random generation ----------

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

const SYLLABLES = ['lu', 'mi', 'ka', 'no', 'ri', 'sa', 'to', 'bi', 'pe', 'ña', 'fe', 'li', 'mo', 'zu', 've', 'ra', 'ni', 'co', 'ta', 'nu', 'pi', 'lo'];
const EPITHETS = [
  'Saltanubes', 'del Alba', 'de las Brumas', 'Pies Ligeros', 'Brisa Suave',
  'del Prado', 'Cazaestrellas', 'Rebotahongos', 'del Mirador',
];
const ENDINGS: Record<BodyType, string[]> = {
  chico: ['o', 'el', 'on', 'ito', 'an'],
  chica: ['a', 'ina', 'ela', 'ita', 'is'],
};

export function generateRandomName(body: BodyType = 'chico'): string {
  const count = Math.random() < 0.6 ? 1 : 2;
  let base = '';
  for (let i = 0; i < count; i++) base += pick(SYLLABLES);
  base += pick(ENDINGS[body]);
  base = base.charAt(0).toUpperCase() + base.slice(1);
  const epithets = [...EPITHETS, body === 'chica' ? 'Soñadora' : 'Soñador'];
  return Math.random() < 0.5 ? `${base} ${pick(epithets)}` : base;
}

/** Picks a color from the palette that differs from all colors in `avoid`. */
function pickDistinct(palette: string[], avoid: string[]): string {
  const options = palette.filter((c) => !avoid.includes(c));
  return pick(options.length ? options : palette);
}

export function generateRandomAppearance(body: BodyType = 'chico', keepName?: string): CharacterAppearance {
  const sweaterColor = pick(CLOTH_COLORS);
  const scarfColor = pickDistinct(CLOTH_COLORS, [sweaterColor]);
  const hatColor = pickDistinct(CLOTH_COLORS, [sweaterColor, scarfColor]);
  const detailColor = pickDistinct(CLOTH_COLORS, [sweaterColor, scarfColor]);
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    bodyType: body,
    name: keepName ?? generateRandomName(body),
    skinColor: pick(SKIN_TONES),
    hairColor: pick(HAIR_COLORS),
    hairStyle: pick(hairStylesFor(body)).id,
    eyeStyle: pick(EYE_STYLES).id,
    accessory: Math.random() < 0.55 ? 'ninguno' : pick(ACCESSORIES).id,
    hatStyle: pick(hatStylesFor(body)).id,
    hatColor,
    outfitStyle: pick(outfitStylesFor(body)).id,
    sweaterColor,
    detailColor,
    scarfColor,
    bootColor: pick(BOOT_COLORS),
    backpack: Math.random() < 0.75,
    companion: pick(COMPANIONS.filter((c) => isCompanionUnlocked(c.id))).id,
    height: round2(0.9 + Math.random() * 0.2),
    build: round2(0.9 + Math.random() * 0.22),
  };
}

// ---------- Persistence ----------

/** One saved character per body type, plus which one is currently selected. */
export interface CharacterRoster {
  active: BodyType;
  chico: CharacterAppearance;
  chica: CharacterAppearance;
}

const STORAGE_KEY = 'aether-leap-characters-v2';
const LEGACY_KEY = 'aether-leap-character-v1';

/** Merges any partial/old stored data over the defaults so new fields never break. */
export function sanitizeAppearance(raw: unknown, forcedBody?: BodyType): CharacterAppearance {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const body: BodyType = forcedBody ?? (r.bodyType === 'chica' ? 'chica' : 'chico');
  const out: CharacterAppearance = defaultAppearanceFor(body);
  if (!raw || typeof raw !== 'object') return out;
  const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
  const oneOf = <T extends string>(v: unknown, list: { id: T }[]): v is T =>
    typeof v === 'string' && list.some((o) => o.id === v);
  const clamp = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

  if (typeof r.name === 'string' && r.name.trim()) out.name = r.name.slice(0, 24);
  if (isHex(r.skinColor)) out.skinColor = r.skinColor;
  if (isHex(r.hairColor)) out.hairColor = r.hairColor;
  if (isHex(r.hatColor)) out.hatColor = r.hatColor;
  if (isHex(r.sweaterColor)) out.sweaterColor = r.sweaterColor;
  if (isHex(r.detailColor)) out.detailColor = r.detailColor;
  if (oneOf(r.outfitStyle, outfitStylesFor(body))) out.outfitStyle = r.outfitStyle;
  if (isHex(r.scarfColor)) out.scarfColor = r.scarfColor;
  if (isHex(r.bootColor)) out.bootColor = r.bootColor;
  if (oneOf(r.hairStyle, hairStylesFor(body))) out.hairStyle = r.hairStyle;
  if (oneOf(r.hatStyle, hatStylesFor(body))) out.hatStyle = r.hatStyle;
  if (oneOf(r.eyeStyle, EYE_STYLES)) out.eyeStyle = r.eyeStyle;
  if (oneOf(r.accessory, ACCESSORIES)) out.accessory = r.accessory;
  if (oneOf(r.companion, COMPANIONS) && isCompanionUnlocked(r.companion)) out.companion = r.companion;
  if (typeof r.backpack === 'boolean') out.backpack = r.backpack;
  out.height = clamp(r.height, 0.88, 1.12, out.height);
  out.build = clamp(r.build, 0.88, 1.15, out.build);
  return out;
}

// In-memory copy so switching characters still works when storage is blocked
let rosterCache: CharacterRoster | null = null;

function readRoster(): CharacterRoster {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const r = JSON.parse(raw) as Record<string, unknown>;
      return {
        active: r.active === 'chica' ? 'chica' : 'chico',
        chico: sanitizeAppearance(r.chico, 'chico'),
        chica: sanitizeAppearance(r.chica, 'chica'),
      };
    }
    // Migrate the single character saved by the first version of the creator
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      return {
        active: 'chico',
        chico: sanitizeAppearance(JSON.parse(legacy), 'chico'),
        chica: defaultAppearanceFor('chica'),
      };
    }
  } catch {
    // storage unavailable (private mode, blocked) – fall back to defaults
  }
  return { active: 'chico', chico: defaultAppearanceFor('chico'), chica: defaultAppearanceFor('chica') };
}

export function loadRoster(): CharacterRoster {
  if (!rosterCache) rosterCache = readRoster();
  return { ...rosterCache, chico: { ...rosterCache.chico }, chica: { ...rosterCache.chica } };
}

/** The currently selected character. */
export function loadAppearance(): CharacterAppearance {
  const roster = loadRoster();
  return roster[roster.active];
}

/** Saves a character into its own body-type slot and makes it the active one. */
export function saveAppearance(appearance: CharacterAppearance) {
  const roster = loadRoster();
  roster[appearance.bodyType] = { ...appearance };
  roster.active = appearance.bodyType;
  rosterCache = roster;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(roster));
  } catch {
    // ignore
  }
}
