/**
 * Character Generator data: appearance options, curated cozy palettes,
 * harmonious random generation, random names and local persistence.
 * Shared by the 3D model builder (models.ts), the engine and the HUD.
 */

import { isCompanionUnlocked } from './progress';
import { ShirtPatternId, SHIRT_PATTERNS } from './patterns';
import { isPatternUnlocked } from './dailyMissions';

export type { ShirtPatternId };

export type BodyType = 'chico' | 'chica';
export type HairStyle = 'flequillo' | 'puntas' | 'rapado' | 'coleta' | 'largo' | 'trenzas' | 'chongo';
export type HatStyle = 'gorro' | 'gorra' | 'sombrero' | 'orejas' | 'flores' | 'ninguno';
export type EyeStyle = 'redondos' | 'grandes' | 'felices';
export type Accessory = 'ninguno' | 'lentes' | 'pecas';
export type CompanionStyle = 'nube' | 'estrella' | 'luciernaga' | 'catarina' | 'hada' | 'serpiente' | 'polilla' | 'ninguno';
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
  /** Cosmetic fabric pattern unlocked via Daily Missions or Shop */
  shirtPattern?: ShirtPatternId;
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
  /** Optional shop cosmetic variant identifiers & tints */
  hatVariant?: string;
  outfitVariant?: string;
  glassesVariant?: string;
  glassesColor?: string;
  backpackVariant?: string;
  backpackColor?: string;
  hairVariant?: string;
  skinVariant?: string;
  accentGlowColor?: string;
  equippedShopIds?: string[];
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
  shirtPattern: 'liso',
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
  shirtPattern: 'liso',
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
  // Companions must be earned by finishing their level or unlocked via shop
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
  { id: 'felices', name: 'Felices' },
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
  { id: 'serpiente', name: 'Quetsy', desc: 'Mini serpiente emplumada' },
  { id: 'polilla', name: 'Hombre Polilla', desc: 'Regresa el tiempo' },
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

export const NAME_SUGGESTIONS: Record<BodyType, string[]> = {
  chico: ['Nublo', 'Kai del Alba', 'Pepito Rebotahongos', 'Milo Brisa Suave', 'Tomi Cazaestrellas'],
  chica: ['Luna', 'Mika del Prado', 'Nina Saltanubes', 'Sira de las Brumas', 'Vera Soñadora'],
};

const COLOR_LABELS: Record<string, string> = {
  '#fde3d3': 'Piel clara',
  '#fed0bb': 'Piel melocotón',
  '#f1c09a': 'Piel arena',
  '#e0a77e': 'Piel miel',
  '#c68a5e': 'Piel canela',
  '#a86d45': 'Piel bronce',
  '#7d4f32': 'Piel cacao',
  '#5a3824': 'Piel ébano',
  '#1f1a17': 'Pelo negro',
  '#3b2a20': 'Pelo café',
  '#543825': 'Pelo castaño',
  '#8a5a34': 'Pelo cobrizo',
  '#c98b4a': 'Pelo rubio oscuro',
  '#e8c37a': 'Pelo rubio',
  '#f2efe6': 'Pelo platino',
  '#b33c2e': 'Pelo rojo',
  '#e58fb1': 'Pelo rosa',
  '#7fb7d9': 'Pelo azul',
  '#8f7cc4': 'Pelo lila',
  '#6fa88a': 'Pelo menta',
  '#2b2d42': 'Tinta',
  '#3d312a': 'Nogal',
  '#5e4636': 'Roble',
  '#8a6a4f': 'Cuero',
  '#6b2f2a': 'Terracota',
  '#3f4a3c': 'Musgo oscuro',
  '#db6b50': 'Coral',
  '#e07a5f': 'Salmón',
  '#f2cc8f': 'Crema',
  '#e9c46a': 'Mostaza',
  '#81b29a': 'Salvia',
  '#588157': 'Bosque',
  '#3d5a80': 'Azul noche',
  '#98c1d9': 'Cielo',
  '#6d597a': 'Lavanda',
  '#b56576': 'Rosa viejo',
  '#f4f1de': 'Marfil',
};

export function colorLabel(hex: string): string {
  const key = hex.toLowerCase();
  return COLOR_LABELS[key] ?? hex.toUpperCase();
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
  const unlockedPatterns = SHIRT_PATTERNS.filter((p) => isPatternUnlocked(p.id));
  const pickedPattern = unlockedPatterns.length > 1 && Math.random() < 0.7 ? pick(unlockedPatterns).id : 'liso';
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
    shirtPattern: pickedPattern,
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

export function normalizeHexColor(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  if (short) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  }
  return null;
}

function cleanVariant(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().slice(0, 64);
  if (!s || s.toLowerCase() === 'none' || s.toLowerCase() === 'ninguno' || s.toLowerCase() === 'false') {
    return undefined;
  }
  return s;
}

/** Merges any partial/old stored data over the defaults so new fields never break. */
export function sanitizeAppearance(raw: unknown, forcedBody?: BodyType, isRemote: boolean = false): CharacterAppearance {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const body: BodyType = forcedBody ?? (r.bodyType === 'chica' ? 'chica' : 'chico');
  const out: CharacterAppearance = defaultAppearanceFor(body);
  if (!raw || typeof raw !== 'object') return out;
  const oneOf = <T extends string>(v: unknown, list: { id: T }[]): v is T =>
    typeof v === 'string' && list.some((o) => o.id === v);
  const clamp = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

  if (typeof r.displayName === 'string' && r.displayName.trim()) out.name = r.displayName.trim().slice(0, 24);
  else if (typeof r.name === 'string' && r.name.trim()) out.name = r.name.trim().slice(0, 24);
  else if (typeof r.playerName === 'string' && r.playerName.trim()) out.name = r.playerName.trim().slice(0, 24);

  const skinHex = normalizeHexColor(r.skinColor);
  if (skinHex) out.skinColor = skinHex;
  const hairHex = normalizeHexColor(r.hairColor);
  if (hairHex) out.hairColor = hairHex;

  const sweaterHex = normalizeHexColor(r.sweaterColor) ?? normalizeHexColor(r.shirtColor);
  if (sweaterHex) out.sweaterColor = sweaterHex;

  const detailHex = normalizeHexColor(r.detailColor) ?? normalizeHexColor(r.pantsColor);
  if (detailHex) out.detailColor = detailHex;

  const hatHex = normalizeHexColor(r.hatColor);
  if (hatHex) out.hatColor = hatHex;
  else if (detailHex) out.hatColor = detailHex;

  const bootHex = normalizeHexColor(r.bootColor) ?? normalizeHexColor(r.shoesColor);
  if (bootHex) out.bootColor = bootHex;

  const scarfHex = normalizeHexColor(r.scarfColor);
  if (scarfHex) out.scarfColor = scarfHex;
  else if (detailHex) out.scarfColor = detailHex;

  const glassesHex = normalizeHexColor(r.glassesColor);
  if (glassesHex) out.glassesColor = glassesHex;

  const backpackHex = normalizeHexColor(r.backpackColor);
  if (backpackHex) out.backpackColor = backpackHex;

  const glowHex = normalizeHexColor(r.accentGlowColor) ?? normalizeHexColor(r.glowColor);
  if (glowHex) out.accentGlowColor = glowHex;

  // Outfit & shirt style (allow all valid base outfits so shop outfits never get stripped on reload)
  const rawOutfitToken =
    typeof r.outfitVariant === 'string'
      ? r.outfitVariant
      : typeof r.outfit === 'string'
        ? r.outfit
        : typeof r.shirtStyle === 'string'
          ? r.shirtStyle
          : '';

  if (oneOf(r.outfitStyle, OUTFIT_STYLES)) {
    out.outfitStyle = r.outfitStyle;
  } else if (rawOutfitToken) {
    const s = rawOutfitToken.toLowerCase();
    if (s.includes('hoodie') || s.includes('sudadera')) out.outfitStyle = 'sudadera';
    else if (
      s.includes('jacket') ||
      s.includes('chaqueta') ||
      s.includes('neon') ||
      s.includes('cyber') ||
      s.includes('tech') ||
      s.includes('ninja') ||
      s.includes('astro') ||
      s.includes('space')
    ) {
      out.outfitStyle = 'chaqueta';
    } else if (s.includes('overall') || s.includes('overol')) out.outfitStyle = 'overol';
    else if (s.includes('dress') || s.includes('vestido') || s.includes('robe') || s.includes('royal') || s.includes('mage') || s.includes('wizard')) {
      out.outfitStyle = 'vestido';
    } else if (s.includes('poncho') || s.includes('cape') || s.includes('capa')) out.outfitStyle = 'poncho';
    else if (s.includes('sueter') || s.includes('sweater')) out.outfitStyle = 'sueter';
  }
  const outfitVar = cleanVariant(r.outfitVariant ?? r.outfit ?? r.shirtStyle);
  if (outfitVar) out.outfitVariant = outfitVar;

  // Hair style (allow all valid hair styles so shop hairs never get stripped on reload)
  if (oneOf(r.hairStyle, HAIR_STYLES)) {
    out.hairStyle = r.hairStyle;
  } else if (typeof r.hairStyle === 'string' || typeof r.hair === 'string') {
    const h = String(r.hairStyle || r.hair).toLowerCase();
    if (h.includes('cozy_messy') || h.includes('messy') || h.includes('flequillo') || h.includes('wave')) out.hairStyle = 'flequillo';
    else if (h.includes('short_crop') || h.includes('crop') || h.includes('rapado') || h.includes('corto')) out.hairStyle = 'rapado';
    else if (h.includes('spike') || h.includes('puntas') || h.includes('mohawk') || h.includes('neon')) out.hairStyle = 'puntas';
    else if (h.includes('ponytail') || h.includes('coleta')) out.hairStyle = 'coleta';
    else if (h.includes('braid') || h.includes('trenza') || h.includes('coletita') || h.includes('twin')) out.hairStyle = 'trenzas';
    else if (h.includes('bun') || h.includes('chongo')) out.hairStyle = 'chongo';
    else if (h.includes('long') || h.includes('largo') || h.includes('galaxy') || h.includes('cosmic')) out.hairStyle = 'largo';
  }
  const hairVar = cleanVariant(r.hairVariant ?? (typeof r.hairStyle === 'string' && !oneOf(r.hairStyle, HAIR_STYLES) ? r.hairStyle : r.hair));
  if (hairVar) out.hairVariant = hairVar;

  // Skin variant
  const skinVar = cleanVariant(r.skinVariant ?? r.skinStyle ?? r.skin);
  if (skinVar) out.skinVariant = skinVar;

  // Hat style
  const rawHatStr = typeof r.hat === 'string' ? r.hat : '';
  const hatVarToken = cleanVariant(r.hatVariant ?? (rawHatStr && rawHatStr !== 'none' && rawHatStr !== 'ninguno' ? rawHatStr : undefined));
  if (oneOf(r.hatStyle, HAT_STYLES)) {
    out.hatStyle = r.hatStyle;
  } else if (rawHatStr) {
    const h = rawHatStr.toLowerCase();
    if (h === 'none' || h === 'ninguno') out.hatStyle = 'ninguno';
    else if (h.includes('beanie') || h.includes('gorro_cozy') || h === 'gorro') out.hatStyle = 'gorro';
    else if (h.includes('cap') || h.includes('gorra') || h.includes('visor') || h.includes('helmet') || h.includes('casco') || h.includes('headphone') || h.includes('audifono')) out.hatStyle = 'gorra';
    else if (h.includes('sunhat') || h.includes('sombrero') || h.includes('explorador') || h.includes('wizard') || h.includes('mago') || h.includes('witch') || h.includes('beret') || h.includes('boina')) out.hatStyle = 'sombrero';
    else if (h.includes('flower') || h.includes('flores') || h.includes('crown') || h.includes('corona') || h.includes('halo')) out.hatStyle = 'flores';
    else if (h.includes('ear') || h.includes('oreja') || h.includes('horn') || h.includes('cuerno')) out.hatStyle = 'orejas';
    else out.hatStyle = 'sombrero';
  }
  if (out.hatStyle !== 'ninguno' && hatVarToken) {
    out.hatVariant = hatVarToken;
  } else if (rawHatStr.toLowerCase() === 'none' || rawHatStr.toLowerCase() === 'ninguno') {
    out.hatStyle = 'ninguno';
    out.hatVariant = undefined;
  }

  // Eyes
  if (oneOf(r.eyeStyle, EYE_STYLES)) {
    out.eyeStyle = r.eyeStyle;
  } else if (typeof r.eyesStyle === 'string') {
    const e = r.eyesStyle.toLowerCase();
    if (e.includes('big') || e.includes('grand') || e.includes('bright')) out.eyeStyle = 'grandes';
    else if (e.includes('happy') || e.includes('felic')) out.eyeStyle = 'felices';
    else out.eyeStyle = 'redondos';
  }

  // Accessories / Glasses
  const rawGlassesStr = typeof r.glasses === 'string' ? r.glasses : '';
  const glassesVarToken = cleanVariant(r.glassesVariant ?? (rawGlassesStr && !['none', 'ninguno', 'pecas', 'freckles'].includes(rawGlassesStr.toLowerCase()) ? rawGlassesStr : undefined));
  if (oneOf(r.accessory, ACCESSORIES)) {
    out.accessory = r.accessory;
  } else if (rawGlassesStr) {
    const g = rawGlassesStr.toLowerCase();
    if (g === 'none' || g === 'ninguno') out.accessory = 'ninguno';
    else if (g.includes('freckle') || g.includes('pecas')) out.accessory = 'pecas';
    else out.accessory = 'lentes';
  }
  if (out.accessory === 'lentes' && glassesVarToken) {
    out.glassesVariant = glassesVarToken;
  } else if (out.accessory !== 'lentes') {
    out.glassesVariant = undefined;
  }

  // Companion
  const mapCompanion = (val: unknown): CompanionStyle | null => {
    if (oneOf(val, COMPANIONS)) return val;
    if (typeof val !== 'string') return null;
    const c = val.toLowerCase();
    if (c === 'none' || c === 'ninguno') return 'ninguno';
    if (c.includes('cloud') || c.includes('nube') || c.includes('nubi')) return 'nube';
    if (c.includes('star') || c.includes('estrell')) return 'estrella';
    if (c.includes('firefly') || c.includes('luciernaga') || c.includes('chispa')) return 'luciernaga';
    if (c.includes('ladybug') || c.includes('catarina') || c.includes('mariquita')) return 'catarina';
    if (c.includes('fairy') || c.includes('hada') || c.includes('lila')) return 'hada';
    if (c.includes('serpent') || c.includes('snake') || c.includes('serpiente') || c.includes('quetsy')) return 'serpiente';
    if (c.includes('moth') || c.includes('polilla')) return 'polilla';
    return null;
  };
  const resolvedCompanion = mapCompanion(r.companion);
  if (resolvedCompanion && (isRemote || isCompanionUnlocked(resolvedCompanion))) {
    out.companion = resolvedCompanion;
  }

  // Cosmetic shirt pattern
  const rawPattern = r.shirtPattern ?? r.clothingPattern ?? r.pattern;
  const mapPattern = (val: unknown): ShirtPatternId | null => {
    if (oneOf(val, SHIRT_PATTERNS)) return val;
    if (typeof val !== 'string') return null;
    const p = val.toLowerCase();
    if (p.includes('liso') || p.includes('solid') || p === 'none') return 'liso';
    if (p.includes('aero') || p.includes('stripe') || p.includes('raya')) return 'rayas_aero';
    if (p.includes('constel') || p.includes('star') || p.includes('cosmic')) return 'constelacion';
    if (p.includes('cyber') || p.includes('circuit')) return 'circuito_cyber';
    if (p.includes('neon') || p.includes('grid') || p.includes('rejilla')) return 'rejilla_neon';
    if (p.includes('flama') || p.includes('volcan') || p.includes('flame') || p.includes('lava')) return 'flama_volcan';
    if (p.includes('cristal') || p.includes('glacial') || p.includes('ice')) return 'cristal_glacial';
    if (p.includes('musgo') || p.includes('pantano') || p.includes('swamp')) return 'musgo_pantano';
    if (p.includes('remolino') || p.includes('dulce') || p.includes('candy')) return 'remolino_dulce';
    if (p.includes('corona') || p.includes('real') || p.includes('royal')) return 'corona_real';
    if (p.includes('hoja') || p.includes('jardin') || p.includes('leaf')) return 'hoja_jardin';
    if (p.includes('sol') || p.includes('desierto') || p.includes('sun')) return 'sol_desierto';
    return null;
  };
  const resolvedPattern = mapPattern(rawPattern);
  if (resolvedPattern && (isRemote || isPatternUnlocked(resolvedPattern))) {
    out.shirtPattern = resolvedPattern;
  }

  // Backpack
  const rawPackStr = typeof r.backpack === 'string' ? r.backpack : '';
  const packVarToken = cleanVariant(r.backpackVariant ?? (rawPackStr && !['none', 'ninguno', 'false', 'true'].includes(rawPackStr.toLowerCase()) ? rawPackStr : undefined));
  if (typeof r.backpack === 'boolean') {
    out.backpack = r.backpack;
  } else if (typeof r.backpack === 'string') {
    const b = r.backpack.toLowerCase();
    out.backpack = b !== 'none' && b !== 'ninguno' && b !== 'false';
  }
  if (out.backpack && packVarToken) {
    out.backpackVariant = packVarToken;
  } else if (!out.backpack) {
    out.backpackVariant = undefined;
  }

  if (Array.isArray(r.equippedShopIds)) {
    out.equippedShopIds = r.equippedShopIds.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 32);
  } else if (Array.isArray(r.equippedItems)) {
    out.equippedShopIds = r.equippedItems.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 32);
  }

  out.height = clamp(r.height, 0.88, 1.12, out.height);
  out.build = clamp(r.build, 0.88, 1.15, out.build);
  return out;
}

export interface ShopPatchMeta {
  id?: string;
  category?: string;
  previewColor?: string;
}

/**
 * Applies a backend cosmetic `appearance` or `appearancePatch` onto a base CharacterAppearance,
 * mapping backend property names (shirtColor, pantsColor, shoesColor, hat, outfit, etc.) cleanly.
 */
export function applyBackendAppearancePatch(
  base: CharacterAppearance,
  patch: Record<string, unknown> | null | undefined,
  bypassLocks: boolean = true,
  itemMeta?: ShopPatchMeta
): CharacterAppearance {
  if (!patch || typeof patch !== 'object') return { ...base };
  const merged: Record<string, unknown> = { ...base };

  // Copy direct & backend-aliased properties cleanly so they override `base`'s frontend fields
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined && v !== null) merged[k] = v;
  }

  const shirtHex = normalizeHexColor(patch.shirtColor);
  if (shirtHex) merged.sweaterColor = shirtHex;
  const pantsHex = normalizeHexColor(patch.pantsColor);
  if (pantsHex) merged.detailColor = pantsHex;
  const shoesHex = normalizeHexColor(patch.shoesColor);
  if (shoesHex) merged.bootColor = shoesHex;
  const hatHex = normalizeHexColor(patch.hatColor);
  if (hatHex) merged.hatColor = hatHex;
  const scarfHex = normalizeHexColor(patch.scarfColor);
  if (scarfHex) merged.scarfColor = scarfHex;
  const skinHex = normalizeHexColor(patch.skinColor);
  if (skinHex) merged.skinColor = skinHex;
  const hairHex = normalizeHexColor(patch.hairColor);
  if (hairHex) merged.hairColor = hairHex;
  const glassesHex = normalizeHexColor(patch.glassesColor);
  if (glassesHex) merged.glassesColor = glassesHex;
  const backpackHex = normalizeHexColor(patch.backpackColor);
  if (backpackHex) merged.backpackColor = backpackHex;
  const glowHex = normalizeHexColor(patch.accentGlowColor) ?? normalizeHexColor(patch.glowColor);
  if (glowHex) merged.accentGlowColor = glowHex;

  // Apply category previewColor fallback when patch omits the specific part color
  const previewHex = normalizeHexColor(itemMeta?.previewColor);
  if (previewHex) {
    if (itemMeta?.category === 'hat' && !hatHex && !normalizeHexColor(patch.hatColor)) {
      merged.hatColor = previewHex;
    } else if (itemMeta?.category === 'glasses' && !glassesHex) {
      merged.glassesColor = previewHex;
    } else if (itemMeta?.category === 'backpack' && !backpackHex) {
      merged.backpackColor = previewHex;
    } else if (itemMeta?.category === 'skin' && !skinHex) {
      merged.skinColor = previewHex;
    } else if (itemMeta?.category === 'hair' && !hairHex) {
      merged.hairColor = previewHex;
    } else if (itemMeta?.category === 'outfit' && !glowHex) {
      merged.accentGlowColor = previewHex;
    }
  }

  // Prevent stale base variants/enums from overriding incoming backend patches
  if (typeof patch.shirtStyle === 'string' || typeof patch.outfit === 'string' || typeof patch.outfitStyle === 'string') {
    if (!('outfitStyle' in patch)) delete merged.outfitStyle;
    const ov = cleanVariant(patch.outfit ?? patch.shirtStyle ?? patch.outfitStyle);
    merged.outfitVariant = ov;
  }
  if (typeof patch.hat === 'string' || typeof patch.hatStyle === 'string') {
    if (!('hatStyle' in patch)) delete merged.hatStyle;
    const hv = cleanVariant(patch.hat ?? patch.hatStyle);
    merged.hatVariant = hv;
  }
  if (typeof patch.glasses === 'string' || typeof patch.accessory === 'string') {
    if (!('accessory' in patch)) delete merged.accessory;
    const gv = cleanVariant(patch.glasses ?? patch.accessory);
    merged.glassesVariant = gv;
  }
  if ('backpack' in patch || 'backpackVariant' in patch) {
    const bv = cleanVariant(patch.backpackVariant ?? patch.backpack);
    merged.backpackVariant = bv;
  }
  if (typeof patch.hairStyle === 'string' || typeof patch.hair === 'string') {
    const hairv = cleanVariant(patch.hairStyle ?? patch.hair);
    merged.hairVariant = hairv;
  }
  if (typeof patch.skinStyle === 'string' || typeof patch.skin === 'string') {
    const sv = cleanVariant(patch.skinStyle ?? patch.skin);
    merged.skinVariant = sv;
  }
  if (('pattern' in patch || 'clothingPattern' in patch) && !('shirtPattern' in patch)) {
    delete merged.shirtPattern;
  }

  if (itemMeta?.id) {
    const currentIds = Array.isArray(merged.equippedShopIds)
      ? (merged.equippedShopIds as string[]).filter((x) => typeof x === 'string')
      : [];
    if (!currentIds.includes(itemMeta.id)) {
      merged.equippedShopIds = [...currentIds, itemMeta.id];
    }
  }

  return sanitizeAppearance(merged, base.bodyType, bypassLocks);
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
        chico: sanitizeAppearance(r.chico, 'chico', true),
        chica: sanitizeAppearance(r.chica, 'chica', true),
      };
    }
    // Migrate the single character saved by the first version of the creator
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      return {
        active: 'chico',
        chico: sanitizeAppearance(JSON.parse(legacy), 'chico', true),
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
