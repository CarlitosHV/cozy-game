export type PhotoFilter =
  | 'natural'
  | 'golden_hour'
  | 'dreamy_pastel'
  | 'cozy_sunset'
  | 'starry_twilight'
  | 'sakura_bloom'
  | 'emerald_forest'
  | 'cyber_neon'
  | 'vintage_sepia'
  | 'noir_classic';

export type PhotoStyle =
  | 'clean'
  | 'cinema'
  | 'analog'
  | 'dreamy'
  | 'vibrant'
  | 'moody';

export type PhotoFrame =
  | 'none'
  | 'polaroid'
  | 'cinematic'
  | 'filmstrip'
  | 'postcard'
  | 'magazine'
  | 'grid';

export interface PhotoGradeSpec {
  brightness: number; // 1 = neutral
  contrast: number;   // 1 = neutral
  saturation: number; // 1 = neutral
  sepia: number;      // 0..1
  grayscale: number;  // 0..1
  hueRotateDeg: number;
  fade: number;       // 0..0.22 black-point lift
  tint?: { r: number; g: number; b: number; alpha: number };
  splitShadows?: [number, number, number];
  splitHighlights?: [number, number, number];
  lightLeak?: { color: string; r: number; g: number; b: number; opacity: number };
}

export interface PhotoFilterDefinition {
  id: PhotoFilter;
  name: string;
  color: string;
  swatch: string;
  desc: string;
  grade: PhotoGradeSpec;
}

export interface PhotoStyleDefinition {
  id: PhotoStyle;
  name: string;
  desc: string;
  badgeColor: string;
  vignette: number;   // 0..1
  grain: number;      // 0..1
  bloom: number;      // 0..1
  contrastBoost: number;   // multiplier around 1.0
  saturationBoost: number; // multiplier around 1.0
  brightnessBoost: number; // multiplier around 1.0
  shadowCoolness?: [number, number, number];
  fadeBoost?: number;
}

export interface PhotoStudioSettings {
  filter: PhotoFilter;
  intensity: number; // 0..100
  style: PhotoStyle;
  vignette: number;  // 0..100
  grain: number;     // 0..100
  bloom: number;     // 0..100
  frame: PhotoFrame;
}

export const DEFAULT_PHOTO_SETTINGS: PhotoStudioSettings = {
  filter: 'natural',
  intensity: 100,
  style: 'clean',
  vignette: 0,
  grain: 0,
  bloom: 0,
  frame: 'none',
};

export const PHOTO_FILTERS: PhotoFilterDefinition[] = [
  {
    id: 'natural',
    name: 'Natural',
    color: '#f8fafc',
    swatch: 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%)',
    desc: 'Puro y nítido',
    grade: {
      brightness: 1.02,
      contrast: 1.04,
      saturation: 1.05,
      sepia: 0,
      grayscale: 0,
      hueRotateDeg: 0,
      fade: 0,
    },
  },
  {
    id: 'golden_hour',
    name: 'Hora dorada',
    color: '#f59e0b',
    swatch: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 55%, #b45309 100%)',
    desc: 'Luz ámbar solar',
    grade: {
      brightness: 1.06,
      contrast: 1.1,
      saturation: 1.32,
      sepia: 0.24,
      grayscale: 0,
      hueRotateDeg: -6,
      fade: 0.03,
      tint: { r: 255, g: 185, b: 85, alpha: 0.16 },
      splitShadows: [12, 4, -8],
      splitHighlights: [22, 10, -14],
      lightLeak: { color: 'rgba(255, 190, 92, 0.36)', r: 255, g: 190, b: 92, opacity: 0.36 },
    },
  },
  {
    id: 'dreamy_pastel',
    name: 'Pastel ensueño',
    color: '#c4b5fd',
    swatch: 'linear-gradient(135deg, #fbcfe8 0%, #c4b5fd 55%, #bae6fd 100%)',
    desc: 'Suave y luminoso',
    grade: {
      brightness: 1.11,
      contrast: 0.92,
      saturation: 1.14,
      sepia: 0.06,
      grayscale: 0,
      hueRotateDeg: 8,
      fade: 0.1,
      tint: { r: 230, g: 198, b: 255, alpha: 0.15 },
      splitShadows: [14, 8, 24],
      splitHighlights: [12, 6, 16],
      lightLeak: { color: 'rgba(232, 196, 255, 0.32)', r: 232, g: 196, b: 255, opacity: 0.32 },
    },
  },
  {
    id: 'cozy_sunset',
    name: 'Atardecer cálido',
    color: '#fb7185',
    swatch: 'linear-gradient(135deg, #fda4af 0%, #f97316 55%, #9d174d 100%)',
    desc: 'Melocotón y coral',
    grade: {
      brightness: 1.02,
      contrast: 1.14,
      saturation: 1.38,
      sepia: 0.22,
      grayscale: 0,
      hueRotateDeg: -16,
      fade: 0.04,
      tint: { r: 255, g: 120, b: 110, alpha: 0.18 },
      splitShadows: [18, -4, 14],
      splitHighlights: [24, 8, -10],
      lightLeak: { color: 'rgba(255, 118, 102, 0.34)', r: 255, g: 118, b: 102, opacity: 0.34 },
    },
  },
  {
    id: 'sakura_bloom',
    name: 'Sueño Sakura',
    color: '#f472b6',
    swatch: 'linear-gradient(135deg, #fce7f3 0%, #f472b6 55%, #db2777 100%)',
    desc: 'Rosa cerezo etéreo',
    grade: {
      brightness: 1.07,
      contrast: 1.02,
      saturation: 1.24,
      sepia: 0.08,
      grayscale: 0,
      hueRotateDeg: -10,
      fade: 0.07,
      tint: { r: 255, g: 162, b: 205, alpha: 0.19 },
      splitShadows: [16, 4, 14],
      splitHighlights: [20, 10, 18],
      lightLeak: { color: 'rgba(255, 168, 212, 0.34)', r: 255, g: 168, b: 212, opacity: 0.34 },
    },
  },
  {
    id: 'emerald_forest',
    name: 'Bosque vivo',
    color: '#10b981',
    swatch: 'linear-gradient(135deg, #6ee7b7 0%, #059669 55%, #064e3b 100%)',
    desc: 'Verdes profundos',
    grade: {
      brightness: 0.99,
      contrast: 1.15,
      saturation: 1.28,
      sepia: 0.05,
      grayscale: 0,
      hueRotateDeg: 10,
      fade: 0.02,
      tint: { r: 42, g: 196, b: 148, alpha: 0.14 },
      splitShadows: [-10, 10, 8],
      splitHighlights: [6, 16, 4],
    },
  },
  {
    id: 'starry_twilight',
    name: 'Noche estelar',
    color: '#38bdf8',
    swatch: 'linear-gradient(135deg, #7dd3fc 0%, #2563eb 55%, #1e1b4b 100%)',
    desc: 'Índigo y azul frío',
    grade: {
      brightness: 0.92,
      contrast: 1.2,
      saturation: 1.18,
      sepia: 0,
      grayscale: 0,
      hueRotateDeg: -22,
      fade: 0.03,
      tint: { r: 58, g: 130, b: 246, alpha: 0.22 },
      splitShadows: [-12, 4, 28],
      splitHighlights: [-6, 12, 22],
    },
  },
  {
    id: 'cyber_neon',
    name: 'Neón vívido',
    color: '#e879f9',
    swatch: 'linear-gradient(135deg, #22d3ee 0%, #a855f7 52%, #ec4899 100%)',
    desc: 'Cian y magenta',
    grade: {
      brightness: 1.0,
      contrast: 1.28,
      saturation: 1.52,
      sepia: 0,
      grayscale: 0,
      hueRotateDeg: 16,
      fade: 0.01,
      tint: { r: 192, g: 72, b: 255, alpha: 0.18 },
      splitShadows: [-16, 14, 28],
      splitHighlights: [22, -6, 24],
      lightLeak: { color: 'rgba(56, 189, 248, 0.28)', r: 56, g: 189, b: 248, opacity: 0.28 },
    },
  },
  {
    id: 'vintage_sepia',
    name: 'Retro 35mm',
    color: '#d97706',
    swatch: 'linear-gradient(135deg, #fcd34d 0%, #b45309 60%, #451a03 100%)',
    desc: 'Película nostálgica',
    grade: {
      brightness: 0.98,
      contrast: 1.14,
      saturation: 0.78,
      sepia: 0.58,
      grayscale: 0,
      hueRotateDeg: -4,
      fade: 0.08,
      tint: { r: 214, g: 160, b: 96, alpha: 0.16 },
      splitShadows: [10, 4, -8],
      splitHighlights: [18, 12, -10],
    },
  },
  {
    id: 'noir_classic',
    name: 'Noir B&N',
    color: '#94a3b8',
    swatch: 'linear-gradient(135deg, #f8fafc 0%, #64748b 50%, #0f172a 100%)',
    desc: 'Blanco y negro',
    grade: {
      brightness: 1.0,
      contrast: 1.34,
      saturation: 0,
      sepia: 0,
      grayscale: 1,
      hueRotateDeg: 0,
      fade: 0.04,
      splitShadows: [-4, -2, 6],
      splitHighlights: [10, 10, 8],
    },
  },
];

export const PHOTO_STYLES: PhotoStyleDefinition[] = [
  {
    id: 'clean',
    name: 'Limpio',
    desc: 'Sin viñeta ni grano',
    badgeColor: '#e2e8f0',
    vignette: 0,
    grain: 0,
    bloom: 0,
    contrastBoost: 1,
    saturationBoost: 1,
    brightnessBoost: 1,
  },
  {
    id: 'cinema',
    name: 'Cine',
    desc: 'Viñeta y contraste fílmico',
    badgeColor: '#f59e0b',
    vignette: 0.5,
    grain: 0.1,
    bloom: 0.14,
    contrastBoost: 1.1,
    saturationBoost: 1.04,
    brightnessBoost: 0.98,
  },
  {
    id: 'analog',
    name: 'Carrete 35mm',
    desc: 'Grano retro y negros suaves',
    badgeColor: '#fb923c',
    vignette: 0.36,
    grain: 0.38,
    bloom: 0.15,
    contrastBoost: 0.96,
    saturationBoost: 0.92,
    brightnessBoost: 1.02,
    fadeBoost: 0.07,
  },
  {
    id: 'dreamy',
    name: 'Onírico',
    desc: 'Resplandor cálido etéreo',
    badgeColor: '#c084fc',
    vignette: 0.22,
    grain: 0.05,
    bloom: 0.56,
    contrastBoost: 0.93,
    saturationBoost: 1.08,
    brightnessBoost: 1.06,
    fadeBoost: 0.05,
  },
  {
    id: 'vibrant',
    name: 'Vívido',
    desc: 'Colores intensos y claridad',
    badgeColor: '#34d399',
    vignette: 0.18,
    grain: 0,
    bloom: 0.22,
    contrastBoost: 1.12,
    saturationBoost: 1.22,
    brightnessBoost: 1.03,
  },
  {
    id: 'moody',
    name: 'Dramático',
    desc: 'Sombras profundas y viñeta',
    badgeColor: '#60a5fa',
    vignette: 0.65,
    grain: 0.2,
    bloom: 0.06,
    contrastBoost: 1.18,
    saturationBoost: 0.86,
    brightnessBoost: 0.93,
    shadowCoolness: [-8, 0, 16],
  },
];

export const PHOTO_FRAMES: { id: PhotoFrame; name: string; desc: string }[] = [
  { id: 'none', name: 'Sin marco', desc: 'Composición limpia' },
  { id: 'polaroid', name: 'Polaroid', desc: 'Borde blanco clásico' },
  { id: 'cinematic', name: 'Cinemático', desc: 'Barras panorámicas 2.39:1' },
  { id: 'filmstrip', name: 'Carrete 35mm', desc: 'Borde analógico perforado' },
  { id: 'postcard', name: 'Postal', desc: 'Sello aéreo y marco' },
  { id: 'magazine', name: 'Portada', desc: 'Cabecera editorial' },
  { id: 'grid', name: 'Guía tercios', desc: 'Líneas para encuadrar' },
];

export function getFilterDef(id: PhotoFilter): PhotoFilterDefinition {
  return PHOTO_FILTERS.find((f) => f.id === id) ?? PHOTO_FILTERS[0];
}

export function getStyleDef(id: PhotoStyle): PhotoStyleDefinition {
  return PHOTO_STYLES.find((s) => s.id === id) ?? PHOTO_STYLES[0];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface ResolvedPhotoGrade {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  grayscale: number;
  hueRotateDeg: number;
  fade: number;
  tint: { r: number; g: number; b: number; alpha: number } | null;
  splitShadows: [number, number, number];
  splitHighlights: [number, number, number];
  lightLeak: { color: string; r: number; g: number; b: number; opacity: number } | null;
  vignette: number;
  grain: number;
  bloom: number;
}

export function resolvePhotoGrade(settings: PhotoStudioSettings): ResolvedPhotoGrade {
  const f = getFilterDef(settings.filter).grade;
  const s = getStyleDef(settings.style);
  const t = Math.max(0, Math.min(1, settings.intensity / 100));

  const brightness = lerp(1, f.brightness, t) * s.brightnessBoost;
  const contrast = lerp(1, f.contrast, t) * s.contrastBoost;
  const saturation = lerp(1, f.saturation, t) * s.saturationBoost;
  const sepia = lerp(0, f.sepia, t);
  const grayscale = lerp(0, f.grayscale, t);
  const hueRotateDeg = lerp(0, f.hueRotateDeg, t);
  const fade = lerp(0, f.fade, t) + (s.fadeBoost ?? 0);

  const tint =
    f.tint && t > 0.01
      ? { r: f.tint.r, g: f.tint.g, b: f.tint.b, alpha: f.tint.alpha * t }
      : null;

  const shFilter = f.splitShadows ?? [0, 0, 0];
  const shStyle = s.shadowCoolness ?? [0, 0, 0];
  const splitShadows: [number, number, number] = [
    shFilter[0] * t + shStyle[0],
    shFilter[1] * t + shStyle[1],
    shFilter[2] * t + shStyle[2],
  ];

  const hiFilter = f.splitHighlights ?? [0, 0, 0];
  const splitHighlights: [number, number, number] = [
    hiFilter[0] * t,
    hiFilter[1] * t,
    hiFilter[2] * t,
  ];

  const bloom = Math.max(0, Math.min(1, settings.bloom / 100));
  const vignette = Math.max(0, Math.min(1, settings.vignette / 100));
  const grain = Math.max(0, Math.min(1, settings.grain / 100));

  const lightLeak =
    f.lightLeak && (t > 0.02 || bloom > 0.02)
      ? {
          ...f.lightLeak,
          opacity: f.lightLeak.opacity * Math.max(t * 0.75, bloom * 0.95),
        }
      : bloom > 0.04
        ? {
            color: `rgba(255, 224, 178, ${(bloom * 0.42).toFixed(3)})`,
            r: 255,
            g: 224,
            b: 178,
            opacity: bloom * 0.42,
          }
        : null;

  return {
    brightness,
    contrast,
    saturation,
    sepia,
    grayscale,
    hueRotateDeg,
    fade,
    tint,
    splitShadows,
    splitHighlights,
    lightLeak,
    vignette,
    grain,
    bloom,
  };
}

export function buildLiveCssFilter(settings: PhotoStudioSettings): string {
  const g = resolvePhotoGrade(settings);
  const parts: string[] = [];
  if (Math.abs(g.brightness - 1) > 0.005) parts.push(`brightness(${g.brightness.toFixed(3)})`);
  if (Math.abs(g.contrast - 1) > 0.005) parts.push(`contrast(${g.contrast.toFixed(3)})`);
  if (Math.abs(g.saturation - 1) > 0.005) parts.push(`saturate(${g.saturation.toFixed(3)})`);
  if (g.sepia > 0.005) parts.push(`sepia(${g.sepia.toFixed(3)})`);
  if (g.grayscale > 0.005) parts.push(`grayscale(${g.grayscale.toFixed(3)})`);
  if (Math.abs(g.hueRotateDeg) > 0.3) parts.push(`hue-rotate(${g.hueRotateDeg.toFixed(1)}deg)`);
  if (g.bloom > 0.08) {
    // Subtle optical softness lift without blurring UI edges
    parts.push(`brightness(${(1 + g.bloom * 0.06).toFixed(3)})`);
  }
  return parts.length > 0 ? parts.join(' ') : 'none';
}

let cachedGrainUrl: string | null = null;
export function getFilmGrainDataUrl(): string {
  if (cachedGrainUrl) return cachedGrainUrl;
  if (typeof document === 'undefined') return '';
  const size = 96;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(size, size);
  const d = img.data;
  let seed = 1337;
  for (let i = 0; i < d.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = (seed >>> 24) & 0xff;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 36;
  }
  ctx.putImageData(img, 0, 0);
  cachedGrainUrl = c.toDataURL('image/png');
  return cachedGrainUrl;
}

/**
 * Pixel-level color grading + atmosphere processor that does NOT depend on ctx.filter
 * (so it works identically on Safari, iOS WebKit, Firefox, Chrome, and Android).
 */
function applyResolvedGradeToCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  g: ResolvedPhotoGrade
) {
  const w = canvas.width;
  const h = canvas.height;
  const needsPixelPass =
    Math.abs(g.brightness - 1) > 0.005 ||
    Math.abs(g.contrast - 1) > 0.005 ||
    Math.abs(g.saturation - 1) > 0.005 ||
    g.sepia > 0.005 ||
    g.grayscale > 0.005 ||
    Math.abs(g.hueRotateDeg) > 0.3 ||
    g.fade > 0.005 ||
    g.tint !== null ||
    g.grain > 0.01 ||
    Math.abs(g.splitShadows[0]) + Math.abs(g.splitShadows[1]) + Math.abs(g.splitShadows[2]) > 0.5 ||
    Math.abs(g.splitHighlights[0]) + Math.abs(g.splitHighlights[1]) + Math.abs(g.splitHighlights[2]) > 0.5;

  if (needsPixelPass) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    // Precompute hue rotation matrix (Rodrigues around (1,1,1) normalized in Rec.709 luminance space)
    const hueRad = (g.hueRotateDeg * Math.PI) / 180;
    const cosH = Math.cos(hueRad);
    const sinH = Math.sin(hueRad);
    const lumR = 0.2126;
    const lumG = 0.7152;
    const lumB = 0.0722;

    const h00 = lumR + cosH * (1 - lumR) + sinH * -lumR;
    const h01 = lumG + cosH * -lumG + sinH * -lumG;
    const h02 = lumB + cosH * -lumB + sinH * (1 - lumB);

    const h10 = lumR + cosH * -lumR + sinH * 0.143;
    const h11 = lumG + cosH * (1 - lumG) + sinH * 0.14;
    const h12 = lumB + cosH * -lumB + sinH * -0.283;

    const h20 = lumR + cosH * -lumR + sinH * -(1 - lumR);
    const h21 = lumG + cosH * -lumG + sinH * lumG;
    const h22 = lumB + cosH * (1 - lumB) + sinH * lumB;

    const bright = g.brightness + g.bloom * 0.05;
    const contrast = g.contrast;
    const sat = g.saturation;
    const sepia = g.sepia;
    const gray = g.grayscale;
    const fadeLift = g.fade * 255;
    const fadeScale = 1 - g.fade * 0.35;

    const tintR = g.tint ? g.tint.r : 0;
    const tintG = g.tint ? g.tint.g : 0;
    const tintB = g.tint ? g.tint.b : 0;
    const tintA = g.tint ? g.tint.alpha : 0;

    const [shR, shG, shB] = g.splitShadows;
    const [hiR, hiG, hiB] = g.splitHighlights;
    const grainAmp = g.grain * 42;
    let seed = 48271;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let gr = data[i + 1];
      let b = data[i + 2];

      // 1. Hue rotate
      if (Math.abs(g.hueRotateDeg) > 0.3) {
        const nr = h00 * r + h01 * gr + h02 * b;
        const ng = h10 * r + h11 * gr + h12 * b;
        const nb = h20 * r + h21 * gr + h22 * b;
        r = nr;
        gr = ng;
        b = nb;
      }

      // 2. Sepia
      if (sepia > 0.005) {
        const sr = r * 0.393 + gr * 0.769 + b * 0.189;
        const sg = r * 0.349 + gr * 0.686 + b * 0.168;
        const sb = r * 0.272 + gr * 0.534 + b * 0.131;
        r = r + (sr - r) * sepia;
        gr = gr + (sg - gr) * sepia;
        b = b + (sb - b) * sepia;
      }

      // 3. Grayscale
      if (gray > 0.005) {
        const l = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
        r = r + (l - r) * gray;
        gr = gr + (l - gr) * gray;
        b = b + (l - b) * gray;
      }

      // 4. Saturation
      if (Math.abs(sat - 1) > 0.005) {
        const l = 0.2126 * r + 0.7152 * gr + 0.0722 * b;
        r = l + (r - l) * sat;
        gr = l + (gr - l) * sat;
        b = l + (b - l) * sat;
      }

      // 5. Brightness + Contrast + Fade lift
      r = (r * bright - 128) * contrast + 128;
      gr = (gr * bright - 128) * contrast + 128;
      b = (b * bright - 128) * contrast + 128;

      if (fadeLift > 0.5) {
        r = r * fadeScale + fadeLift;
        gr = gr * fadeScale + fadeLift;
        b = b * fadeScale + fadeLift;
      }

      // 6. Split toning (shadows vs highlights)
      const lum = Math.max(0, Math.min(1, (0.2126 * r + 0.7152 * gr + 0.0722 * b) / 255));
      const shW = (1 - lum) * (1 - lum);
      const hiW = lum * lum;
      r += shR * shW + hiR * hiW;
      gr += shG * shW + hiG * hiW;
      b += shB * shW + hiB * hiW;

      // 7. Color wash tint
      if (tintA > 0.004) {
        r = r * (1 - tintA) + tintR * tintA;
        gr = gr * (1 - tintA) + tintG * tintA;
        b = b * (1 - tintA) + tintB * tintA;
      }

      // 8. Film grain
      if (grainAmp > 0.5) {
        seed = (seed * 16807) % 2147483647;
        const n = (seed / 2147483647 - 0.5) * grainAmp;
        r += n;
        gr += n;
        b += n;
      }

      data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      data[i + 1] = gr < 0 ? 0 : gr > 255 ? 255 : gr;
      data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // 9. Atmospheric bloom / light leak radial glow
  if (g.lightLeak && g.lightLeak.opacity > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const grad = ctx.createRadialGradient(w * 0.14, h * 0.16, 0, w * 0.14, h * 0.16, Math.max(w, h) * 0.75);
    grad.addColorStop(0, `rgba(${g.lightLeak.r}, ${g.lightLeak.g}, ${g.lightLeak.b}, ${Math.min(0.65, g.lightLeak.opacity).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(${g.lightLeak.r}, ${g.lightLeak.g}, ${g.lightLeak.b}, ${(g.lightLeak.opacity * 0.28).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 10. Soft ambient bloom halo
  if (g.bloom > 0.04) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const bloomGrad = ctx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.08, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    bloomGrad.addColorStop(0, `rgba(255, 244, 224, ${(g.bloom * 0.26).toFixed(3)})`);
    bloomGrad.addColorStop(1, 'rgba(255, 244, 224, 0)');
    ctx.fillStyle = bloomGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 11. Vignette
  if (g.vignette > 0.02) {
    ctx.save();
    const outerR = Math.hypot(w, h) * 0.54;
    const innerR = outerR * (0.48 - g.vignette * 0.14);
    const vig = ctx.createRadialGradient(w * 0.5, h * 0.5, innerR, w * 0.5, h * 0.5, outerR);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, `rgba(10, 8, 14, ${Math.min(0.88, g.vignette * 0.85).toFixed(3)})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

/**
 * High-Resolution Photo Compositor with Cross-Browser Pixel Grading, Styles and Frames.
 */
export function renderFinalPhotoWithFrame(
  rawImgSrc: string,
  settings: PhotoStudioSettings,
  checkpointName: string
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const grade = resolvePhotoGrade(settings);

      // First render & color-grade the raw screenshot into a temporary buffer canvas
      const gradedCanvas = document.createElement('canvas');
      gradedCanvas.width = img.width;
      gradedCanvas.height = img.height;
      const gCtx = gradedCanvas.getContext('2d')!;
      gCtx.drawImage(img, 0, 0);
      applyResolvedGradeToCanvas(gradedCanvas, gCtx, grade);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const frame = settings.frame;

      if (frame === 'polaroid') {
        const borderX = Math.round(img.width * 0.05);
        const topY = Math.round(img.height * 0.05);
        const bottomY = Math.round(img.height * 0.18);
        canvas.width = img.width + borderX * 2;
        canvas.height = img.height + topY + bottomY;

        ctx.fillStyle = '#f8f5ee';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(gradedCanvas, borderX, topY, img.width, img.height);

        ctx.strokeStyle = 'rgba(58, 45, 33, 0.14)';
        ctx.lineWidth = Math.max(2, Math.round(img.width * 0.002));
        ctx.strokeRect(borderX, topY, img.width, img.height);

        ctx.fillStyle = '#3a2d21';
        ctx.font = `600 ${Math.round(canvas.height * 0.04)}px 'Playfair Display', serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Cozy Leap · ' + checkpointName, canvas.width / 2, canvas.height - bottomY * 0.38);

        resolve(canvas.toDataURL('image/png'));
      } else if (frame === 'cinematic') {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(gradedCanvas, 0, 0);

        const barHeight = Math.round(canvas.height * 0.12);
        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, canvas.width, barHeight);
        ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

        ctx.fillStyle = '#dfb15b';
        ctx.font = `600 ${Math.round(canvas.height * 0.026)}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('COZY LEAP · ' + checkpointName.toUpperCase(), canvas.width / 2, canvas.height - barHeight * 0.36);

        resolve(canvas.toDataURL('image/png'));
      } else if (frame === 'filmstrip') {
        const padX = Math.round(img.width * 0.035);
        const padY = Math.round(img.height * 0.11);
        canvas.width = img.width + padX * 2;
        canvas.height = img.height + padY * 2;

        ctx.fillStyle = '#141210';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(gradedCanvas, padX, padY, img.width, img.height);

        // Sprocket holes top & bottom
        const holeCount = 12;
        const holeW = Math.round(canvas.width * 0.035);
        const holeH = Math.round(padY * 0.44);
        const stepX = (canvas.width - padX * 2) / holeCount;
        ctx.fillStyle = '#f2ede4';
        for (let i = 0; i < holeCount; i++) {
          const hx = Math.round(padX + i * stepX + (stepX - holeW) * 0.5);
          ctx.beginPath();
          ctx.roundRect(hx, Math.round(padY * 0.24), holeW, holeH, 4);
          ctx.roundRect(hx, canvas.height - Math.round(padY * 0.24) - holeH, holeW, holeH, 4);
          ctx.fill();
        }

        ctx.fillStyle = '#f59e0b';
        ctx.font = `700 ${Math.round(padY * 0.24)}px monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(`COZY 400 · ${checkpointName.toUpperCase()}`, canvas.width - padX, canvas.height - Math.round(padY * 0.06));

        resolve(canvas.toDataURL('image/png'));
      } else if (frame === 'postcard') {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(gradedCanvas, 0, 0);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.round(canvas.width * 0.018);
        ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

        const stampW = Math.round(canvas.width * 0.12);
        const stampH = Math.round(canvas.height * 0.14);
        ctx.fillStyle = '#d4a373';
        ctx.fillRect(canvas.width - stampW - 32, 32, stampW, stampH);
        ctx.strokeStyle = '#faedcd';
        ctx.lineWidth = 3;
        ctx.strokeRect(canvas.width - stampW - 32, 32, stampW, stampH);

        ctx.fillStyle = '#2b2118';
        ctx.font = `bold ${Math.round(canvas.height * 0.024)}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('ISLES', canvas.width - stampW / 2 - 32, 32 + stampH * 0.58);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
        ctx.font = `italic 600 ${Math.round(canvas.height * 0.032)}px 'Playfair Display', serif`;
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 8;
        ctx.fillText(`Saludos desde ${checkpointName}`, Math.round(canvas.width * 0.04), canvas.height - Math.round(canvas.height * 0.05));

        resolve(canvas.toDataURL('image/png'));
      } else if (frame === 'magazine') {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(gradedCanvas, 0, 0);

        // Editorial dark gradient top & bottom for readability
        const topG = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.24);
        topG.addColorStop(0, 'rgba(12, 10, 18, 0.72)');
        topG.addColorStop(1, 'rgba(12, 10, 18, 0)');
        ctx.fillStyle = topG;
        ctx.fillRect(0, 0, canvas.width, canvas.height * 0.24);

        const botG = ctx.createLinearGradient(0, canvas.height * 0.74, 0, canvas.height);
        botG.addColorStop(0, 'rgba(12, 10, 18, 0)');
        botG.addColorStop(1, 'rgba(12, 10, 18, 0.78)');
        ctx.fillStyle = botG;
        ctx.fillRect(0, canvas.height * 0.74, canvas.width, canvas.height * 0.26);

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.55)';
        ctx.lineWidth = Math.max(2, Math.round(canvas.width * 0.004));
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        ctx.fillStyle = '#fbbf24';
        ctx.font = `800 ${Math.round(canvas.height * 0.08)}px 'Playfair Display', serif`;
        ctx.textAlign = 'center';
        ctx.fillText('COZY LEAP', canvas.width / 2, Math.round(canvas.height * 0.13));

        ctx.fillStyle = '#f8fafc';
        ctx.font = `600 ${Math.round(canvas.height * 0.022)}px 'Outfit', sans-serif`;
        ctx.fillText('EDICIÓN DE AVENTURA', canvas.width / 2, Math.round(canvas.height * 0.17));

        ctx.textAlign = 'left';
        ctx.font = `700 ${Math.round(canvas.height * 0.032)}px 'Outfit', sans-serif`;
        ctx.fillText(checkpointName.toUpperCase(), Math.round(canvas.width * 0.045), canvas.height - Math.round(canvas.height * 0.065));

        resolve(canvas.toDataURL('image/png'));
      } else {
        resolve(gradedCanvas.toDataURL('image/png'));
      }
    };
    img.src = rawImgSrc;
  });
}
