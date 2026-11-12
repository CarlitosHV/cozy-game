/**
 * Procedural cosmetic clothing patterns rendered onto 256x256 CanvasTextures (SRGBColorSpace)
 * and cached for reuse across the local player, remote friends, and 2D UI swatches.
 */
import * as THREE from 'three';

export type ShirtPatternId =
  | 'liso'
  | 'rayas_aero'
  | 'constelacion'
  | 'circuito_cyber'
  | 'rejilla_neon'
  | 'flama_volcan'
  | 'cristal_glacial'
  | 'musgo_pantano'
  | 'remolino_dulce'
  | 'corona_real'
  | 'hoja_jardin'
  | 'sol_desierto';

export interface ShirtPatternDef {
  id: ShirtPatternId;
  name: string;
  desc: string;
  biomeHint: string;
  defaultUnlocked?: boolean;
}

export const SHIRT_PATTERNS: ShirtPatternDef[] = [
  {
    id: 'liso',
    name: 'Liso Clásico',
    desc: 'Tela tejida uniforme y acogedora.',
    biomeHint: 'Inicial',
    defaultUnlocked: true,
  },
  {
    id: 'rayas_aero',
    name: 'Brisa Aero',
    desc: 'Franjas diagonales inspiradas en las corrientes del cielo.',
    biomeHint: 'Valle Aero',
  },
  {
    id: 'constelacion',
    name: 'Constelación',
    desc: 'Destellos estelares y polvo cósmico dorado.',
    biomeHint: 'Ruta Cósmica',
  },
  {
    id: 'musgo_pantano',
    name: 'Espora Mística',
    desc: 'Manchas orgánicas del pantano con esporas luminosas.',
    biomeHint: 'Pantano Sombrío',
  },
  {
    id: 'hoja_jardin',
    name: 'Follaje Vivo',
    desc: 'Trama botánica de hojas y brotes primaverales.',
    biomeHint: 'Jardín Gigante',
  },
  {
    id: 'rejilla_neon',
    name: 'Pulso Neón',
    desc: 'Retícula nocturna de horizonte retro luminoso.',
    biomeHint: 'Ciudad Neón',
  },
  {
    id: 'circuito_cyber',
    name: 'Circuito Cromo',
    desc: 'Trazos digitales y nodos de alta tecnología.',
    biomeHint: 'Cyberpunk',
  },
  {
    id: 'flama_volcan',
    name: 'Brasa Ígnea',
    desc: 'Ondas de magma incandescente y chispas de ceniza.',
    biomeHint: 'Volcán Infernal',
  },
  {
    id: 'cristal_glacial',
    name: 'Escarcha Boreal',
    desc: 'Facetas geométricas de hielo y copos cristalinos.',
    biomeHint: 'Cumbre Glacial',
  },
  {
    id: 'sol_desierto',
    name: 'Chevrón Solar',
    desc: 'Greca geométrica dorada de antiguos templos de arena.',
    biomeHint: 'Dunas Doradas',
  },
  {
    id: 'remolino_dulce',
    name: 'Caramelo Giratorio',
    desc: 'Franjas festivas y motas dulces de azúcar.',
    biomeHint: 'Reino Dulce',
  },
  {
    id: 'corona_real',
    name: 'Arlequín Real',
    desc: 'Rombos heráldicos con ribete dorado del castillo.',
    biomeHint: 'Castillo Embrujado',
  },
];

export const UNLOCKABLE_PATTERN_IDS: ShirtPatternId[] = SHIRT_PATTERNS
  .filter((p) => !p.defaultUnlocked)
  .map((p) => p.id);

export function getPatternDef(id?: string): ShirtPatternDef {
  return SHIRT_PATTERNS.find((p) => p.id === id) ?? SHIRT_PATTERNS[0];
}

// ---------- Color helpers ----------

function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#db6b50';
  return {
    r: parseInt(clean.slice(1, 3), 16),
    g: parseInt(clean.slice(3, 5), 16),
    b: parseInt(clean.slice(5, 7), 16),
  };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(a.r + (b.r - a.r) * t);
  const g = clamp(a.g + (b.g - a.g) * t);
  const bl = clamp(a.b + (b.b - a.b) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// ---------- Procedural Canvas Drawing ----------

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawPatternOnCanvas(
  ctx: CanvasRenderingContext2D,
  size: number,
  pattern: ShirtPatternId,
  baseColor: string,
  detailColor: string
): void {
  const isDarkBase = luminance(baseColor) < 0.45;
  const hiColor = mixHex(baseColor, '#ffffff', isDarkBase ? 0.42 : 0.55);
  const loColor = mixHex(baseColor, '#16141a', 0.35);
  const accent = mixHex(detailColor, '#ffffff', 0.2);

  // Base cloth fill
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  // Subtle knit grain shared by all patterned garments
  ctx.fillStyle = isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)';
  const step = Math.max(8, size / 16);
  for (let y = 0; y < size; y += step) {
    for (let x = ((y / step) % 2) * (step / 2); x < size; x += step) {
      ctx.fillRect(x, y, Math.max(1, step * 0.25), Math.max(1, step * 0.25));
    }
  }

  switch (pattern) {
    case 'liso':
      break;

    case 'rayas_aero': {
      const band = size / 4;
      ctx.save();
      ctx.strokeStyle = rgba(hiColor, 0.85);
      ctx.lineWidth = band * 0.28;
      for (let i = -size; i < size * 2; i += band) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(detailColor, 0.72);
      ctx.lineWidth = band * 0.14;
      for (let i = -size + band * 0.5; i < size * 2; i += band) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + size, size);
        ctx.stroke();
      }
      ctx.restore();
      break;
    }

    case 'constelacion': {
      // Twinkling stars & constellation connectors
      const pts: [number, number, number][] = [
        [0.18, 0.2, 0.055],
        [0.48, 0.14, 0.042],
        [0.78, 0.28, 0.06],
        [0.64, 0.58, 0.048],
        [0.24, 0.62, 0.058],
        [0.86, 0.8, 0.045],
        [0.44, 0.86, 0.052],
      ];
      ctx.strokeStyle = rgba('#fef08a', 0.42);
      ctx.lineWidth = Math.max(1.5, size * 0.01);
      ctx.beginPath();
      ctx.moveTo(pts[0][0] * size, pts[0][1] * size);
      ctx.lineTo(pts[1][0] * size, pts[1][1] * size);
      ctx.lineTo(pts[2][0] * size, pts[2][1] * size);
      ctx.lineTo(pts[3][0] * size, pts[3][1] * size);
      ctx.lineTo(pts[4][0] * size, pts[4][1] * size);
      ctx.closePath();
      ctx.stroke();

      for (const [px, py, r] of pts) {
        ctx.fillStyle = '#fde68a';
        drawStar(ctx, px * size, py * size, size * r, size * r * 0.42, 4);
      }
      ctx.fillStyle = rgba(hiColor, 0.8);
      for (const [dx, dy] of [
        [0.1, 0.44],
        [0.36, 0.38],
        [0.9, 0.52],
        [0.64, 0.88],
        [0.14, 0.88],
      ]) {
        ctx.beginPath();
        ctx.arc(dx * size, dy * size, size * 0.016, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'circuito_cyber': {
      ctx.strokeStyle = mixHex(detailColor, '#22d3ee', 0.55);
      ctx.lineWidth = Math.max(1.5, size * 0.022);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const paths: [number, number][][] = [
        [[0, 0.25], [0.28, 0.25], [0.42, 0.39], [0.72, 0.39], [1, 0.25]],
        [[0.18, 0], [0.18, 0.52], [0.34, 0.68], [0.34, 1]],
        [[0.58, 0], [0.58, 0.2], [0.76, 0.2], [0.76, 0.72], [0.56, 0.88], [0.56, 1]],
        [[0, 0.82], [0.22, 0.82], [0.32, 0.72]],
        [[0.76, 0.62], [1, 0.62]],
      ];
      for (const line of paths) {
        ctx.beginPath();
        line.forEach(([x, y], idx) => {
          if (idx === 0) ctx.moveTo(x * size, y * size);
          else ctx.lineTo(x * size, y * size);
        });
        ctx.stroke();
      }
      ctx.fillStyle = '#a5f3fc';
      for (const [nx, ny] of [
        [0.28, 0.25],
        [0.72, 0.39],
        [0.18, 0.52],
        [0.76, 0.62],
        [0.22, 0.82],
        [0.58, 0.2],
      ]) {
        ctx.beginPath();
        ctx.arc(nx * size, ny * size, size * 0.032, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'rejilla_neon': {
      const cells = 4;
      const cell = size / cells;
      ctx.fillStyle = rgba(loColor, 0.45);
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = mixHex(detailColor, '#f472b6', 0.45);
      ctx.lineWidth = Math.max(1.5, size * 0.025);
      for (let i = 0; i <= cells; i++) {
        const p = i * cell;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();
      }
      ctx.fillStyle = '#fde047';
      for (let i = 0; i < cells; i++) {
        for (let j = 0; j < cells; j++) {
          if ((i + j) % 2 === 0) {
            ctx.beginPath();
            ctx.arc((i + 0.5) * cell, (j + 0.5) * cell, size * 0.024, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;
    }

    case 'flama_volcan': {
      const waves = 4;
      const wStep = size / waves;
      // Dark charred base bands + fiery orange/amber tongues
      for (let row = 0; row < 2; row++) {
        const yOff = row * (size * 0.5);
        ctx.fillStyle = rgba('#fb923c', 0.85);
        ctx.beginPath();
        ctx.moveTo(0, yOff + size * 0.46);
        for (let i = 0; i <= waves; i++) {
          const x0 = i * wStep;
          const xMid = x0 + wStep * 0.5;
          ctx.quadraticCurveTo(x0 + wStep * 0.25, yOff + size * 0.14, xMid, yOff + size * 0.34);
          ctx.quadraticCurveTo(x0 + wStep * 0.75, yOff + size * 0.5, x0 + wStep, yOff + size * 0.46);
        }
        ctx.lineTo(size, yOff + size * 0.5);
        ctx.lineTo(0, yOff + size * 0.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = rgba('#fde047', 0.82);
        ctx.beginPath();
        ctx.moveTo(0, yOff + size * 0.49);
        for (let i = 0; i <= waves; i++) {
          const x0 = i * wStep;
          ctx.quadraticCurveTo(x0 + wStep * 0.32, yOff + size * 0.28, x0 + wStep, yOff + size * 0.49);
        }
        ctx.lineTo(size, yOff + size * 0.5);
        ctx.lineTo(0, yOff + size * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }

    case 'cristal_glacial': {
      const facets: [number, number, number, number, string][] = [
        [0, 0, 0.5, 0.35, rgba(hiColor, 0.7)],
        [0.5, 0, 0.5, 0.45, rgba('#bae6fd', 0.6)],
        [0.15, 0.35, 0.45, 0.45, rgba('#e0f2fe', 0.55)],
        [0.55, 0.45, 0.45, 0.55, rgba(detailColor, 0.45)],
      ];
      for (const [fx, fy, fw, fh, col] of facets) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(fx * size, fy * size);
        ctx.lineTo((fx + fw) * size, (fy + fh * 0.4) * size);
        ctx.lineTo((fx + fw * 0.6) * size, (fy + fh) * size);
        ctx.closePath();
        ctx.fill();
      }
      // Snowflakes
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1.5, size * 0.018);
      for (const [cx, cy, r] of [
        [0.25, 0.26, 0.11],
        [0.76, 0.72, 0.12],
        [0.75, 0.22, 0.075],
        [0.24, 0.78, 0.08],
      ]) {
        for (let k = 0; k < 3; k++) {
          const a = (k * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo((cx - Math.cos(a) * r) * size, (cy - Math.sin(a) * r) * size);
          ctx.lineTo((cx + Math.cos(a) * r) * size, (cy + Math.sin(a) * r) * size);
          ctx.stroke();
        }
      }
      break;
    }

    case 'musgo_pantano': {
      const blobs: [number, number, number, number][] = [
        [0.2, 0.25, 0.17, 0.11],
        [0.7, 0.18, 0.15, 0.12],
        [0.5, 0.56, 0.2, 0.13],
        [0.18, 0.78, 0.14, 0.1],
        [0.84, 0.74, 0.15, 0.11],
      ];
      ctx.fillStyle = rgba(loColor, 0.55);
      for (const [bx, by, rx, ry] of blobs) {
        ctx.beginPath();
        ctx.ellipse(bx * size, by * size, rx * size, ry * size, bx * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#bef264';
      for (const [sx, sy] of [
        [0.24, 0.22],
        [0.68, 0.2],
        [0.46, 0.54],
        [0.56, 0.6],
        [0.2, 0.8],
        [0.82, 0.72],
        [0.4, 0.14],
        [0.88, 0.42],
      ]) {
        ctx.beginPath();
        ctx.arc(sx * size, sy * size, size * 0.025, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'remolino_dulce': {
      const stripes = 6;
      const w = size / stripes;
      for (let i = -2; i <= stripes + 2; i++) {
        ctx.fillStyle = i % 2 === 0 ? rgba('#fff1f2', 0.82) : rgba(detailColor, 0.65);
        ctx.beginPath();
        ctx.moveTo(i * w, 0);
        ctx.lineTo((i + 0.5) * w, 0);
        ctx.lineTo((i - 0.5) * w, size);
        ctx.lineTo((i - 1) * w, size);
        ctx.closePath();
        ctx.fill();
      }
      // Candy sprinkles
      const sprinkleColors = ['#fde047', '#38bdf8', '#f472b6', '#4ade80'];
      for (let i = 0; i < 12; i++) {
        const px = ((i * 0.29) % 0.86) + 0.07;
        const py = ((i * 0.41) % 0.86) + 0.07;
        ctx.save();
        ctx.translate(px * size, py * size);
        ctx.rotate(i * 0.9);
        ctx.fillStyle = sprinkleColors[i % sprinkleColors.length];
        ctx.fillRect(-size * 0.035, -size * 0.014, size * 0.07, size * 0.028);
        ctx.restore();
      }
      break;
    }

    case 'corona_real': {
      const grid = 4;
      const cell = size / grid;
      for (let r = 0; r < grid; r++) {
        for (let c = 0; c < grid; c++) {
          if ((r + c) % 2 === 0) {
            ctx.fillStyle = rgba(loColor, 0.48);
          } else {
            ctx.fillStyle = rgba(accent, 0.42);
          }
          const cx = (c + 0.5) * cell;
          const cy = (r + 0.5) * cell;
          ctx.beginPath();
          ctx.moveTo(cx, cy - cell * 0.48);
          ctx.lineTo(cx + cell * 0.48, cy);
          ctx.lineTo(cx, cy + cell * 0.48);
          ctx.lineTo(cx - cell * 0.48, cy);
          ctx.closePath();
          ctx.fill();

          if ((r + c) % 2 === 0) {
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(cx, cy, size * 0.02, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;
    }

    case 'hoja_jardin': {
      const leaves: [number, number, number][] = [
        [0.2, 0.22, -0.5],
        [0.72, 0.24, 0.45],
        [0.46, 0.5, 0.15],
        [0.2, 0.78, 0.6],
        [0.76, 0.78, -0.4],
      ];
      for (const [lx, ly, rot] of leaves) {
        ctx.save();
        ctx.translate(lx * size, ly * size);
        ctx.rotate(rot);
        ctx.fillStyle = mixHex(hiColor, '#4ade80', 0.48);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.14, size * 0.068, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba('#ecfccb', 0.85);
        ctx.lineWidth = Math.max(1, size * 0.012);
        ctx.beginPath();
        ctx.moveTo(-size * 0.11, 0);
        ctx.lineTo(size * 0.11, 0);
        ctx.stroke();
        ctx.restore();
      }
      // Small blossoms
      for (const [fx, fy] of [
        [0.48, 0.18],
        [0.86, 0.52],
        [0.14, 0.52],
        [0.5, 0.85],
      ]) {
        ctx.fillStyle = '#fbcfe8';
        drawStar(ctx, fx * size, fy * size, size * 0.048, size * 0.025, 5);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(fx * size, fy * size, size * 0.018, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'sol_desierto': {
      const rows = 4;
      const rowH = size / rows;
      for (let r = 0; r < rows; r++) {
        const y = r * rowH;
        ctx.strokeStyle = r % 2 === 0 ? '#fbbf24' : rgba(hiColor, 0.85);
        ctx.lineWidth = Math.max(2, size * 0.032);
        ctx.lineCap = 'square';
        ctx.beginPath();
        const zig = 4;
        const zW = size / zig;
        ctx.moveTo(0, y + rowH * 0.75);
        for (let i = 0; i < zig; i++) {
          ctx.lineTo(i * zW + zW * 0.5, y + rowH * 0.25);
          ctx.lineTo((i + 1) * zW, y + rowH * 0.75);
        }
        ctx.stroke();
      }
      break;
    }
  }
}

// ---------- Cached Three.js Textures & UI Swatches ----------

const textureCache = new Map<string, THREE.CanvasTexture>();
const swatchCache = new Map<string, string>();

/**
 * Returns a shared, cached CanvasTexture for the given clothing pattern and colors.
 * Returns null for 'liso' so plain fabric preserves fast flat-color shading.
 */
export function getClothingPatternTexture(
  pattern: ShirtPatternId | undefined,
  baseColor: string,
  detailColor: string
): THREE.CanvasTexture | null {
  if (!pattern || pattern === 'liso') return null;
  const key = `${pattern}|${baseColor.toLowerCase()}|${detailColor.toLowerCase()}`;
  const existing = textureCache.get(key);
  if (existing) return existing;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawPatternOnCanvas(ctx, size, pattern, baseColor, detailColor);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  // Keep memory bounded while retaining active player & friends textures
  if (textureCache.size > 48) {
    const oldestKey = textureCache.keys().next().value;
    if (oldestKey) {
      textureCache.get(oldestKey)?.dispose();
      textureCache.delete(oldestKey);
    }
  }

  textureCache.set(key, tex);
  return tex;
}

/** Generates a cached 64x64 data URL swatch for 2D React UI buttons & mission previews. */
export function getPatternSwatchUrl(
  pattern: ShirtPatternId,
  baseColor: string,
  detailColor: string
): string {
  const key = `${pattern}|${baseColor.toLowerCase()}|${detailColor.toLowerCase()}`;
  const existing = swatchCache.get(key);
  if (existing) return existing;

  if (typeof document === 'undefined') return '';
  const size = 72;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    drawPatternOnCanvas(ctx, size, pattern, baseColor, detailColor);
  }
  const url = canvas.toDataURL('image/png');
  if (swatchCache.size > 96) {
    const oldest = swatchCache.keys().next().value;
    if (oldest) swatchCache.delete(oldest);
  }
  swatchCache.set(key, url);
  return url;
}
