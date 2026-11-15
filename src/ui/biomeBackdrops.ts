import type { ThemeId } from '../game/progress';

export interface BiomeBackdropLayers {
  farUrl: string;
  stageUrl: string;
  ambientColor: string;
  floorTint: string;
}

const LAYER_CACHE = new Map<ThemeId, BiomeBackdropLayers>();
const WIDTH = 1600;
const HEIGHT = 900;

// Shared 1-point perspective constants tuned so the Three.js lobby camera
// places the character's feet squarely on the solid terrace deck (~72% viewport Y)
// across center Play, left-shifted Shop, and right-shifted Character Creator views.
const VP_X = WIDTH * 0.5;
const VP_Y = HEIGHT * 0.452; // 406.8
const DECK_BACK_Y = 548; // 60.9% height — back edge / parapet
const DECK_FRONT_Y = 844; // 93.8% height — front beveled slab edge

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Projects a perspective coordinate on the terrace floor plane. u in [-1.5..1.5], depth t in [0 (back)..1 (front)]. */
function deckPoint(u: number, t: number): { x: number; y: number } {
  // Exponential y-foreshortening creates realistic 3D floor compression near horizon
  const easedT = Math.pow(t, 1.52);
  const y = DECK_BACK_Y + (DECK_FRONT_Y - DECK_BACK_Y) * easedT;
  const spread = 0.42 + 0.58 * ((y - VP_Y) / (DECK_FRONT_Y - VP_Y));
  const x = VP_X + u * (WIDTH * 0.54) * spread;
  return { x, y };
}

function fillSky(ctx: CanvasRenderingContext2D, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawRadialGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  innerColor: string,
  outerColor: string
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, innerColor);
  g.addColorStop(1, outerColor);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function drawGodRays(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  color: string,
  count = 5,
  spread = 0.85
) {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = (t - 0.5) * spread + Math.PI * 0.5;
    const len = 1100;
    const w1 = 22;
    const w2 = 155 + (i % 2) * 55;
    const ex = ox + Math.cos(angle) * len;
    const ey = oy + Math.sin(angle) * len;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const g = ctx.createLinearGradient(ox, oy, ex, ey);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox + nx * w1, oy + ny * w1);
    ctx.lineTo(ex + nx * w2, ey + ny * w2);
    ctx.lineTo(ex - nx * w2, ey - ny * w2);
    ctx.lineTo(ox - nx * w1, oy - ny * w1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawMountainBand(
  ctx: CanvasRenderingContext2D,
  baseY: number,
  amp: number,
  freq: number,
  phase: number,
  fill: string | CanvasGradient,
  jaggedness = 0.35
) {
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = 0; x <= WIDTH; x += 18) {
    const t = x / WIDTH;
    const h =
      Math.sin(t * Math.PI * freq + phase) * amp +
      Math.cos(t * Math.PI * freq * 2.3 + phase * 1.7) * (amp * jaggedness) +
      Math.sin(t * Math.PI * freq * 5.1 + phase * 0.4) * (amp * jaggedness * 0.4);
    ctx.lineTo(x, baseY - Math.abs(h));
  }
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawRollingHills(
  ctx: CanvasRenderingContext2D,
  baseY: number,
  amp: number,
  freq: number,
  phase: number,
  fill: string | CanvasGradient
) {
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = 0; x <= WIDTH; x += 24) {
    const t = x / WIDTH;
    const y =
      baseY +
      Math.sin(t * Math.PI * freq + phase) * amp +
      Math.cos(t * Math.PI * freq * 0.55 - phase) * (amp * 0.45);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawCloudPuff(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
  color: string,
  alpha = 0.72
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const lobes = [
    [-0.55, 0.12, 0.36],
    [-0.22, -0.08, 0.46],
    [0.16, -0.14, 0.52],
    [0.5, 0.06, 0.38],
    [0, 0.16, 0.48],
  ];
  ctx.beginPath();
  for (const [dx, dy, r] of lobes) {
    ctx.moveTo(cx + dx * scale + r * scale, cy + dy * scale);
    ctx.arc(cx + dx * scale, cy + dy * scale, r * scale, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

function drawFloatingIsland(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  topColor: string,
  rockColor: string,
  accentColor?: string
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.48, cy);
  ctx.lineTo(cx - w * 0.25, cy + h * 0.65);
  ctx.lineTo(cx - w * 0.04, cy + h);
  ctx.lineTo(cx + w * 0.2, cy + h * 0.72);
  ctx.lineTo(cx + w * 0.48, cy);
  ctx.closePath();
  ctx.fillStyle = rockColor;
  ctx.fill();

  // Lit rock facet
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.48, cy);
  ctx.lineTo(cx - w * 0.04, cy + h);
  ctx.lineTo(cx - w * 0.02, cy + h * 0.15);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.52, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = topColor;
  ctx.fill();

  if (accentColor) {
    ctx.fillStyle = accentColor;
    ctx.fillRect(cx - w * 0.04, cy + h * 0.05, w * 0.07, h * 1.15);
  }
  ctx.restore();
}

function drawPineTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string) {
  ctx.fillStyle = color;
  for (let tier = 0; tier < 3; tier++) {
    const ty = y - tier * 18 * scale;
    const tw = (22 - tier * 5) * scale;
    const th = (30 - tier * 3) * scale;
    ctx.beginPath();
    ctx.moveTo(x, ty - th);
    ctx.lineTo(x + tw, ty);
    ctx.lineTo(x - tw, ty);
    ctx.closePath();
    ctx.fill();
  }
}

function drawStars(ctx: CanvasRenderingContext2D, rand: () => number, count: number, maxY = HEIGHT * 0.6, tint = '#ffffff') {
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = rand() * WIDTH;
    const y = rand() * maxY;
    const r = 0.7 + rand() * 2.1;
    ctx.globalAlpha = 0.35 + rand() * 0.65;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSubtleGrain(ctx: CanvasRenderingContext2D, rand: () => number, alpha = 0.024) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(rand() * WIDTH, rand() * HEIGHT, 2, 2);
  }
  ctx.restore();
}

interface TerraceStyle {
  deckTop: string;
  deckMid: string;
  deckFrontLight: string;
  slabFaceTop: string;
  slabFaceBottom: string;
  slabBevel: string;
  seamColor: string;
  seamHighlight: string;
  curbTop: string;
  curbFace: string;
  medallionOuter: string;
  medallionInner: string;
  medallionTrim: string;
  glowTint: string;
  postColor: string;
  postCapColor: string;
  pillarShade: string;
  lanternGlow?: string;
  slabJointColor: string;
  mode?: 'stone' | 'wood' | 'cyber' | 'ice' | 'candy' | 'carpet';
}

/**
 * Draws a true 1-point perspective 3D architectural terrace/plaza occupying the lower 39% of
 * the scene, with receding tiles, horizon balustrade, flanking pillars casting perspective shadows,
 * an inlaid hero dais (plus subtle flanking pads for Shop & Creator), and a thick 3D front slab lip.
 */
function drawPerspectiveTerrace(
  ctx: CanvasRenderingContext2D,
  style: TerraceStyle,
  rand: () => number
) {
  ctx.save();

  // 1. Subtle abyss/drop shadow underneath front edge (shows deck is elevated above the vista)
  const underShadow = ctx.createLinearGradient(0, DECK_FRONT_Y, 0, HEIGHT);
  underShadow.addColorStop(0, 'rgba(8, 12, 24, 0.72)');
  underShadow.addColorStop(1, 'rgba(8, 12, 24, 0.92)');
  ctx.fillStyle = underShadow;
  ctx.fillRect(0, DECK_FRONT_Y, WIDTH, HEIGHT - DECK_FRONT_Y);

  // 2. Main perspective terrace floor surface (full width so character always has solid ground)
  const floorGrad = ctx.createLinearGradient(0, DECK_BACK_Y, 0, DECK_FRONT_Y);
  floorGrad.addColorStop(0, style.deckTop);
  floorGrad.addColorStop(0.5, style.deckMid);
  floorGrad.addColorStop(1, style.deckFrontLight);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, DECK_BACK_Y, WIDTH, DECK_FRONT_Y - DECK_BACK_Y);

  // Atmospheric center floor bounce highlight (anchors focal showcase)
  drawRadialGlow(ctx, VP_X, 682, 420, style.glowTint, 'rgba(255,255,255,0)');

  // 3. Foreshortened perspective tile / plank / cyber grid
  const rows = style.mode === 'carpet' ? 9 : 11;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, DECK_BACK_Y, WIDTH, DECK_FRONT_Y - DECK_BACK_Y);
  ctx.clip();

  // Horizontal perspective seams (exponentially spaced toward viewer)
  for (let r = 1; r < rows; r++) {
    const t = r / rows;
    const y = DECK_BACK_Y + (DECK_FRONT_Y - DECK_BACK_Y) * Math.pow(t, 1.52);
    ctx.strokeStyle = style.seamColor;
    ctx.lineWidth = 1 + t * 1.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();

    // Crisp sunward tile bevel highlight 1.5px below seam
    ctx.strokeStyle = style.seamHighlight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + 1.5);
    ctx.lineTo(WIDTH, y + 1.5);
    ctx.stroke();
  }

  // Radiating perspective seams converging on VP_X, VP_Y
  const cols = style.mode === 'wood' ? 22 : 16;
  for (let c = -cols; c <= cols; c++) {
    const u = (c / cols) * 1.65;
    const pBack = deckPoint(u, 0);
    const pFront = deckPoint(u, 1);
    ctx.strokeStyle = style.seamColor;
    ctx.lineWidth = Math.abs(c) % 2 === 0 ? 1.8 : 1.1;
    ctx.beginPath();
    ctx.moveTo(pBack.x, pBack.y);
    ctx.lineTo(pFront.x, pFront.y);
    ctx.stroke();
  }

  // Random subtle stone/tile tonal variation patches so slabs feel physically inlaid
  if (style.mode !== 'carpet') {
    for (let i = 0; i < 28; i++) {
      const rIdx = 1 + Math.floor(rand() * (rows - 2));
      const cIdx = Math.floor((rand() - 0.5) * 20);
      const t0 = rIdx / rows;
      const t1 = (rIdx + 1) / rows;
      const u0 = (cIdx / 12) * 1.4;
      const u1 = ((cIdx + 1) / 12) * 1.4;
      const a = deckPoint(u0, t0);
      const b = deckPoint(u1, t0);
      const cPt = deckPoint(u1, t1);
      const dPt = deckPoint(u0, t1);
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.038)' : 'rgba(10,15,28,0.05)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(cPt.x, cPt.y);
      ctx.lineTo(dPt.x, dPt.y);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // Moist carpet mottled weave for Backrooms
    for (let i = 0; i < 90; i++) {
      const rx = rand() * WIDTH;
      const ry = DECK_BACK_Y + rand() * (DECK_FRONT_Y - DECK_BACK_Y);
      ctx.fillStyle = rand() > 0.5 ? 'rgba(65,55,25,0.08)' : 'rgba(255,245,190,0.04)';
      ctx.fillRect(rx, ry, 18 + rand() * 32, 3 + rand() * 4);
    }
  }

  // 4. Perspective Flanking Wing Curbs (3D raised side stone rails converging toward horizon)
  for (const side of [-1, 1] as const) {
    const outerBack = deckPoint(side * 1.15, 0);
    const outerFront = deckPoint(side * 1.24, 1);
    const innerBack = deckPoint(side * 0.96, 0);
    const innerFront = deckPoint(side * 1.03, 1);
    const heightBack = 16;
    const heightFront = 34;

    // Cast shadow onto terrace floor from side curb
    ctx.fillStyle = 'rgba(10, 14, 26, 0.22)';
    ctx.beginPath();
    ctx.moveTo(innerBack.x, innerBack.y);
    ctx.lineTo(innerFront.x, innerFront.y);
    ctx.lineTo(innerFront.x - side * 52, innerFront.y);
    ctx.lineTo(innerBack.x - side * 18, innerBack.y);
    ctx.closePath();
    ctx.fill();

    // Inner vertical curb face
    ctx.fillStyle = style.curbFace;
    ctx.beginPath();
    ctx.moveTo(innerBack.x, innerBack.y - heightBack);
    ctx.lineTo(innerFront.x, innerFront.y - heightFront);
    ctx.lineTo(innerFront.x, innerFront.y);
    ctx.lineTo(innerBack.x, innerBack.y);
    ctx.closePath();
    ctx.fill();

    // Top flat surface of side curb
    ctx.fillStyle = style.curbTop;
    ctx.beginPath();
    ctx.moveTo(outerBack.x, outerBack.y - heightBack);
    ctx.lineTo(outerFront.x, outerFront.y - heightFront);
    ctx.lineTo(innerFront.x, innerFront.y - heightFront);
    ctx.lineTo(innerBack.x, innerBack.y - heightBack);
    ctx.closePath();
    ctx.fill();
  }

  // 5. Elevated Perspective Dais / Promenade Medallions (Center Play + Left Shop + Right Creator)
  // Using foreshortened 3D ring ellipses with thickness rim so feet always stand on solid carved inlay!
  const drawInlaidDais = (cx: number, cy: number, rx: number, ry: number, thickness: number, primary: boolean) => {
    // Outer shadow beneath dais step
    ctx.save();
    ctx.fillStyle = primary ? 'rgba(10, 14, 26, 0.34)' : 'rgba(10, 14, 26, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + thickness + 3, rx * 1.05, ry * 1.09, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3D vertical step cylinder skirt
    const skirtGrad = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
    skirtGrad.addColorStop(0, style.curbFace);
    skirtGrad.addColorStop(0.5, style.slabFaceTop);
    skirtGrad.addColorStop(1, style.curbFace);
    ctx.fillStyle = skirtGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + thickness, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(cx - rx, cy);
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();

    // Top stone/metal disc of dais
    const discGrad = ctx.createRadialGradient(cx, cy - ry * 0.25, rx * 0.1, cx, cy, rx);
    discGrad.addColorStop(0, style.medallionInner);
    discGrad.addColorStop(0.76, style.medallionOuter);
    discGrad.addColorStop(1, style.curbTop);
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp illuminated rim bevel
    ctx.strokeStyle = style.medallionTrim;
    ctx.lineWidth = primary ? 3 : 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.96, ry * 0.94, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Inner compass / glyph ring
    ctx.strokeStyle = style.seamHighlight;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.68, ry * 0.66, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Radial stone joints on the dais
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      ctx.strokeStyle = style.seamColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rx * 0.68, cy + Math.sin(a) * ry * 0.66);
      ctx.lineTo(cx + Math.cos(a) * rx * 0.96, cy + Math.sin(a) * ry * 0.94);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Secondary side inlays aligning with Shop (x~400) & Character Creator (x~1088) viewpoints
  drawInlaidDais(405, 678, 175, 31, 7, false);
  drawInlaidDais(1095, 678, 175, 31, 7, false);
  // Hero central pedestal aligning directly beneath Play lobby character boots
  drawInlaidDais(VP_X, 684, 275, 48, 11, true);

  ctx.restore(); // end floor clip

  // 6. Back Horizon Parapet Wall / Balustrade (anchors horizon at DECK_BACK_Y = 548)
  const parapetH = style.mode === 'carpet' ? 14 : 26;
  // Soft ambient occlusion strip where terrace meets parapet
  const aoStrip = ctx.createLinearGradient(0, DECK_BACK_Y, 0, DECK_BACK_Y + 26);
  aoStrip.addColorStop(0, 'rgba(10, 15, 28, 0.42)');
  aoStrip.addColorStop(1, 'rgba(10, 15, 28, 0)');
  ctx.fillStyle = aoStrip;
  ctx.fillRect(0, DECK_BACK_Y, WIDTH, 26);

  // Parapet vertical wall
  ctx.fillStyle = style.curbFace;
  ctx.fillRect(0, DECK_BACK_Y - parapetH, WIDTH, parapetH);
  // Parapet sunlit coping top
  ctx.fillStyle = style.curbTop;
  ctx.fillRect(0, DECK_BACK_Y - parapetH - 5, WIDTH, 6);
  ctx.fillStyle = style.slabBevel;
  ctx.fillRect(0, DECK_BACK_Y - parapetH - 5, WIDTH, 1.5);

  // Perspective balustrade posts along the horizon edge (keep center 670..930 low/open so hero vista shines)
  for (let px = 55; px <= WIDTH - 55; px += 115) {
    const distFromCenter = Math.abs(px - VP_X);
    const isCenterBay = distFromCenter < 150;
    const postW = isCenterBay ? 16 : 22;
    const postH = isCenterBay ? 18 : 34;
    const baseY = DECK_BACK_Y - parapetH;

    // Shadow cast forward onto terrace from post
    ctx.fillStyle = 'rgba(10, 14, 26, 0.2)';
    ctx.beginPath();
    ctx.moveTo(px - postW * 0.5, DECK_BACK_Y);
    ctx.lineTo(px + postW * 0.5, DECK_BACK_Y);
    ctx.lineTo(px + postW * 0.9, DECK_BACK_Y + 18);
    ctx.lineTo(px - postW * 0.2, DECK_BACK_Y + 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = style.postColor;
    ctx.fillRect(px - postW * 0.5, baseY - postH, postW, postH);
    ctx.fillStyle = style.postCapColor;
    ctx.fillRect(px - postW * 0.62, baseY - postH - 5, postW * 1.24, 6);

    if (style.lanternGlow && !isCenterBay && Math.abs(px - VP_X) < 620 && Math.round(px / 115) % 2 === 0) {
      drawRadialGlow(ctx, px, baseY - postH - 12, 34, style.lanternGlow, 'rgba(255,255,255,0)');
      ctx.fillStyle = '#fff9db';
      ctx.beginPath();
      ctx.arc(px, baseY - postH - 12, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 7. Framing Midground Architectural Pillars on Left & Right Wings (add strong foreground/midground 3D depth)
  const drawFramingPillar = (cx: number, baseY: number, pw: number, ph: number, dir: 1 | -1) => {
    // Diagonal perspective cast shadow across the terrace floor
    ctx.fillStyle = 'rgba(10, 14, 28, 0.28)';
    ctx.beginPath();
    ctx.moveTo(cx - pw * 0.5, baseY);
    ctx.lineTo(cx + pw * 0.5, baseY);
    ctx.lineTo(cx + pw * 0.5 + dir * 135, baseY + 58);
    ctx.lineTo(cx - pw * 0.5 + dir * 95, baseY + 58);
    ctx.closePath();
    ctx.fill();

    // Base plinth
    ctx.fillStyle = style.curbTop;
    ctx.fillRect(cx - pw * 0.72, baseY - 22, pw * 1.44, 22);
    ctx.fillStyle = style.curbFace;
    ctx.fillRect(cx - pw * 0.72, baseY - 8, pw * 1.44, 8);

    // Column shaft with 3D cylindrical/chamfered shading gradient
    const colG = ctx.createLinearGradient(cx - pw * 0.5, baseY, cx + pw * 0.5, baseY);
    if (dir === 1) {
      colG.addColorStop(0, style.postCapColor);
      colG.addColorStop(0.55, style.postColor);
      colG.addColorStop(1, style.pillarShade);
    } else {
      colG.addColorStop(0, style.pillarShade);
      colG.addColorStop(0.45, style.postColor);
      colG.addColorStop(1, style.postCapColor);
    }
    ctx.fillStyle = colG;
    ctx.fillRect(cx - pw * 0.5, baseY - ph, pw, ph - 22);

    // Crown capital
    ctx.fillStyle = style.postCapColor;
    ctx.fillRect(cx - pw * 0.72, baseY - ph - 16, pw * 1.44, 16);

    if (style.lanternGlow) {
      drawRadialGlow(ctx, cx, baseY - ph - 32, 68, style.lanternGlow, 'rgba(255,255,255,0)');
      ctx.fillStyle = '#fffbeb';
      ctx.beginPath();
      ctx.arc(cx, baseY - ph - 32, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (style.mode !== 'carpet') {
    drawFramingPillar(190, 650, 44, 210, 1);
    drawFramingPillar(WIDTH - 190, 650, 44, 210, -1);
  }

  // 8. Thick 3D Beveled Front Slab Lip (y = 844..900) — unmistakable physical thickness!
  const slabGrad = ctx.createLinearGradient(0, DECK_FRONT_Y, 0, HEIGHT);
  slabGrad.addColorStop(0, style.slabFaceTop);
  slabGrad.addColorStop(1, style.slabFaceBottom);
  ctx.fillStyle = slabGrad;
  ctx.fillRect(0, DECK_FRONT_Y, WIDTH, HEIGHT - DECK_FRONT_Y);

  // Top edge bright specular bevel line (y = 844)
  ctx.fillStyle = style.slabBevel;
  ctx.fillRect(0, DECK_FRONT_Y, WIDTH, 4);

  // Carved masonry block joints / steel ribs along the 56px front thickness face
  ctx.strokeStyle = style.slabJointColor;
  ctx.lineWidth = 2;
  for (let x = 60; x < WIDTH; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, DECK_FRONT_Y + 4);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  if (style.mode === 'cyber') {
    // Diagonal hazard/trim chevrons on front girder
    ctx.fillStyle = 'rgba(250, 204, 21, 0.42)';
    for (let x = 20; x < WIDTH; x += 180) {
      ctx.beginPath();
      ctx.moveTo(x, DECK_FRONT_Y + 14);
      ctx.lineTo(x + 28, DECK_FRONT_Y + 14);
      ctx.lineTo(x + 14, DECK_FRONT_Y + 42);
      ctx.lineTo(x - 14, DECK_FRONT_Y + 42);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

function paintCozy(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#4f86b8'],
    [0.36, '#87b5d4'],
    [0.7, '#f8c390'],
    [1, '#fde3b4'],
  ]);
  drawRadialGlow(far, WIDTH * 0.5, HEIGHT * 0.41, 460, 'rgba(255,244,210,0.9)', 'rgba(255,205,135,0)');
  drawGodRays(far, WIDTH * 0.5, HEIGHT * 0.24, 'rgba(255, 245, 214, 0.16)', 6, 1.05);

  drawCloudPuff(far, 260, 170, 170, '#fff4e6', 0.68);
  drawCloudPuff(far, 1310, 145, 200, '#fff2df', 0.72);
  drawCloudPuff(far, 980, 240, 145, '#ffe8d0', 0.54);

  drawFloatingIsland(far, 250, 390, 210, 120, '#8ec275', '#9d8775', 'rgba(220,248,255,0.48)');
  drawFloatingIsland(far, 1340, 350, 240, 145, '#7cb868', '#8f7968', 'rgba(220,248,255,0.48)');
  drawFloatingIsland(far, 1100, 460, 130, 80, '#96c97f', '#a68f7c');

  drawRollingHills(far, 585, 58, 2.1, 0.6, 'rgba(130, 152, 138, 0.55)');
  drawRollingHills(far, 640, 48, 2.8, 2.1, '#79a868');

  // Stage layer: mid pines behind parapet + solid limestone & oak outlook terrace
  for (let i = 0; i < 12; i++) {
    const x = i < 6 ? 25 + rand() * 320 : 1245 + rand() * 325;
    const y = 550 + rand() * 25;
    drawPineTree(stage, x, y, 0.75 + rand() * 0.75, '#3e6e42');
  }

  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#d7c9b3',
      deckMid: '#e8dcc7',
      deckFrontLight: '#f3ead9',
      slabFaceTop: '#8e7c69',
      slabFaceBottom: '#5a4d40',
      slabBevel: '#fff8ec',
      seamColor: 'rgba(104, 88, 70, 0.28)',
      seamHighlight: 'rgba(255, 250, 240, 0.42)',
      curbTop: '#efe4d2',
      curbFace: '#9d8974',
      medallionOuter: '#d5c1a4',
      medallionInner: '#f7eedf',
      medallionTrim: '#f0a45a',
      glowTint: 'rgba(255, 240, 210, 0.36)',
      postColor: '#cbbba3',
      postCapColor: '#f5ebd9',
      pillarShade: '#7d6b59',
      lanternGlow: 'rgba(255, 214, 130, 0.55)',
      slabJointColor: 'rgba(65, 54, 44, 0.42)',
      mode: 'stone',
    },
    rand
  );
}

function paintAero(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#0c7ad9'],
    [0.38, '#38bdf8'],
    [0.72, '#a7f3d0'],
    [1, '#ecfeff'],
  ]);
  drawRadialGlow(far, WIDTH * 0.64, HEIGHT * 0.22, 380, 'rgba(255,255,255,0.92)', 'rgba(186,230,253,0)');
  drawGodRays(far, WIDTH * 0.64, HEIGHT * 0.16, 'rgba(255, 255, 255, 0.16)', 5, 0.9);

  drawCloudPuff(far, 290, 175, 210, '#ffffff', 0.82);
  drawCloudPuff(far, 780, 135, 165, '#ffffff', 0.72);
  drawCloudPuff(far, 1290, 195, 235, '#ffffff', 0.85);

  const towers = [
    [120, 340, 74, 280],
    [210, 290, 86, 330],
    [315, 365, 68, 260],
    [1210, 330, 78, 295],
    [1310, 275, 92, 345],
    [1425, 355, 72, 265],
  ];
  for (const [tx, ty, tw, th] of towers) {
    const g = far.createLinearGradient(tx, ty, tx + tw, ty + th);
    g.addColorStop(0, 'rgba(255,255,255,0.82)');
    g.addColorStop(0.5, 'rgba(125,211,252,0.62)');
    g.addColorStop(1, 'rgba(56,189,248,0.48)');
    far.fillStyle = g;
    far.beginPath();
    far.roundRect(tx, ty, tw, th, [18, 18, 0, 0]);
    far.fill();
    far.strokeStyle = 'rgba(255,255,255,0.75)';
    far.lineWidth = 2;
    far.stroke();
  }
  drawRollingHills(far, 600, 50, 1.9, 0.3, '#6ee7b7');

  // Stage layer: Glossy white marble & aqua-glass aero observation skydeck
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#bae6fd',
      deckMid: '#e0f7ff',
      deckFrontLight: '#f4fcff',
      slabFaceTop: '#0ea5e9',
      slabFaceBottom: '#0369a1',
      slabBevel: '#ffffff',
      seamColor: 'rgba(14, 165, 233, 0.24)',
      seamHighlight: 'rgba(255, 255, 255, 0.72)',
      curbTop: '#ffffff',
      curbFace: '#38bdf8',
      medallionOuter: '#a5f3fc',
      medallionInner: '#ffffff',
      medallionTrim: '#0ea5e9',
      glowTint: 'rgba(255, 255, 255, 0.5)',
      postColor: '#e0f2fe',
      postCapColor: '#ffffff',
      pillarShade: '#38bdf8',
      lanternGlow: 'rgba(103, 232, 249, 0.55)',
      slabJointColor: 'rgba(255, 255, 255, 0.45)',
      mode: 'stone',
    },
    rand
  );
}

function paintCosmic(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#070518'],
    [0.45, '#191042'],
    [0.8, '#2d195c'],
    [1, '#4c267a'],
  ]);
  drawRadialGlow(far, WIDTH * 0.25, HEIGHT * 0.34, 460, 'rgba(192,132,252,0.34)', 'rgba(192,132,252,0)');
  drawRadialGlow(far, WIDTH * 0.76, HEIGHT * 0.38, 440, 'rgba(56,189,248,0.28)', 'rgba(56,189,248,0)');
  drawStars(far, rand, 240, HEIGHT * 0.72, '#f5f3ff');

  far.save();
  const px = 1230;
  const py = 215;
  const planetG = far.createRadialGradient(px - 35, py - 35, 16, px, py, 108);
  planetG.addColorStop(0, '#f0abfc');
  planetG.addColorStop(0.55, '#8b5cf6');
  planetG.addColorStop(1, '#312e81');
  far.fillStyle = planetG;
  far.beginPath();
  far.arc(px, py, 105, 0, Math.PI * 2);
  far.fill();

  far.translate(px, py);
  far.rotate(-0.28);
  far.strokeStyle = 'rgba(224,231,255,0.68)';
  far.lineWidth = 14;
  far.beginPath();
  far.ellipse(0, 0, 195, 42, 0, 0, Math.PI * 2);
  far.stroke();
  far.restore();

  drawRadialGlow(far, 270, 210, 110, 'rgba(165,243,252,0.35)', 'rgba(165,243,252,0)');
  far.fillStyle = '#bae6fd';
  far.beginPath();
  far.arc(270, 210, 44, 0, Math.PI * 2);
  far.fill();

  drawMountainBand(far, 610, 85, 3.2, 0.5, '#1d1240', 0.55);

  // Stage layer: Obsidian astral observatory deck etched with cyan/violet constellation inlays
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#1e1344',
      deckMid: '#2a1a5e',
      deckFrontLight: '#362176',
      slabFaceTop: '#1b113d',
      slabFaceBottom: '#0b071d',
      slabBevel: '#a5f3fc',
      seamColor: 'rgba(167, 139, 250, 0.34)',
      seamHighlight: 'rgba(103, 232, 249, 0.2)',
      curbTop: '#4c328a',
      curbFace: '#1c123c',
      medallionOuter: '#2d1c63',
      medallionInner: '#472a94',
      medallionTrim: '#67e8f9',
      glowTint: 'rgba(168, 85, 247, 0.38)',
      postColor: '#2d1c63',
      postCapColor: '#8b5cf6',
      pillarShade: '#110a2b',
      lanternGlow: 'rgba(103, 232, 249, 0.7)',
      slabJointColor: 'rgba(103, 232, 249, 0.25)',
      mode: 'cyber',
    },
    rand
  );
}

function paintSwamp(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#101d19'],
    [0.45, '#20382e'],
    [0.78, '#3f5a47'],
    [1, '#627c60'],
  ]);
  drawRadialGlow(far, WIDTH * 0.28, HEIGHT * 0.24, 240, 'rgba(236,253,205,0.68)', 'rgba(163,230,53,0)');
  far.fillStyle = '#ecfccb';
  far.beginPath();
  far.arc(WIDTH * 0.28, HEIGHT * 0.24, 48, 0, Math.PI * 2);
  far.fill();

  drawMountainBand(far, 580, 75, 2.2, 0.3, '#253b2f', 0.25);

  far.fillStyle = '#1d2d23';
  far.fillRect(1240, 315, 76, 310);
  far.beginPath();
  far.moveTo(1224, 318);
  far.lineTo(1278, 210);
  far.lineTo(1332, 318);
  far.closePath();
  far.fill();

  // Stage layer: Weathered timber boardwalk pier & mossy stone ritual circle over the bayou
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#3e3326',
      deckMid: '#554533',
      deckFrontLight: '#68553f',
      slabFaceTop: '#3b2e21',
      slabFaceBottom: '#1c150e',
      slabBevel: '#bef264',
      seamColor: 'rgba(18, 14, 9, 0.56)',
      seamHighlight: 'rgba(190, 242, 100, 0.14)',
      curbTop: '#6c5a44',
      curbFace: '#2c2218',
      medallionOuter: '#495843',
      medallionInner: '#6b7e58',
      medallionTrim: '#a3e635',
      glowTint: 'rgba(190, 242, 100, 0.24)',
      postColor: '#4e3e2d',
      postCapColor: '#725d47',
      pillarShade: '#261d14',
      lanternGlow: 'rgba(217, 249, 157, 0.68)',
      slabJointColor: 'rgba(20, 14, 8, 0.6)',
      mode: 'wood',
    },
    rand
  );
}

function paintGarden(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#7dd3fc'],
    [0.42, '#bae6fd'],
    [0.75, '#fef3c7'],
    [1, '#dcfce7'],
  ]);
  drawRadialGlow(far, WIDTH * 0.72, HEIGHT * 0.24, 380, 'rgba(255,251,235,0.92)', 'rgba(254,243,199,0)');
  drawGodRays(far, WIDTH * 0.72, HEIGHT * 0.16, 'rgba(255, 250, 224, 0.18)', 5, 0.85);
  drawCloudPuff(far, 320, 170, 175, '#ffffff', 0.75);
  drawCloudPuff(far, 1190, 145, 185, '#ffffff', 0.75);

  drawRollingHills(far, 585, 52, 2.0, 0.8, '#86efac');
  drawRollingHills(far, 620, 42, 2.6, 2.2, '#4ade80');

  // Giant background garden blooms peeking over the conservatory patio parapet
  const flowerSpots = [
    [110, 455, 44, '#f472b6'],
    [255, 490, 34, '#facc15'],
    [1345, 480, 40, '#fb7185'],
    [1485, 445, 48, '#f472b6'],
  ] as const;
  for (const [fx, fy, fr, fc] of flowerSpots) {
    stage.strokeStyle = '#15803d';
    stage.lineWidth = 10;
    stage.beginPath();
    stage.moveTo(fx, fy);
    stage.quadraticCurveTo(fx + 10, fy + 90, fx - 4, DECK_BACK_Y + 8);
    stage.stroke();

    stage.fillStyle = fc;
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      stage.beginPath();
      stage.ellipse(fx + Math.cos(a) * fr * 0.75, fy + Math.sin(a) * fr * 0.75, fr * 0.45, fr * 0.26, a, 0, Math.PI * 2);
      stage.fill();
    }
    stage.fillStyle = '#fde047';
    stage.beginPath();
    stage.arc(fx, fy, fr * 0.35, 0, Math.PI * 2);
    stage.fill();
  }

  // Stage layer: Sunlit terracotta & cream limestone botanical patio
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#e8d7bd',
      deckMid: '#f5e7d2',
      deckFrontLight: '#fbf2e4',
      slabFaceTop: '#c28862',
      slabFaceBottom: '#7c4d32',
      slabBevel: '#fffcf5',
      seamColor: 'rgba(146, 94, 62, 0.26)',
      seamHighlight: 'rgba(255, 252, 244, 0.52)',
      curbTop: '#faefe0',
      curbFace: '#c89b79',
      medallionOuter: '#e6b89c',
      medallionInner: '#fff6ea',
      medallionTrim: '#4ade80',
      glowTint: 'rgba(254, 249, 195, 0.38)',
      postColor: '#ead5bc',
      postCapColor: '#fff8ee',
      pillarShade: '#b89474',
      lanternGlow: 'rgba(253, 224, 71, 0.45)',
      slabJointColor: 'rgba(92, 56, 36, 0.38)',
      mode: 'stone',
    },
    rand
  );
}

function paintCastle(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#130c24'],
    [0.45, '#2c1747'],
    [0.78, '#582252'],
    [1, '#7c2d4a'],
  ]);
  drawStars(far, rand, 130, HEIGHT * 0.56, '#fde68a');
  drawRadialGlow(far, WIDTH * 0.52, HEIGHT * 0.25, 260, 'rgba(254,243,199,0.72)', 'rgba(254,243,199,0)');
  far.fillStyle = '#fef3c7';
  far.beginPath();
  far.arc(WIDTH * 0.52, HEIGHT * 0.25, 72, 0, Math.PI * 2);
  far.fill();

  drawMountainBand(far, 585, 90, 2.8, 0.2, '#241438', 0.45);

  far.fillStyle = '#180d29';
  const castleTowers = [
    [110, 290, 80, 360],
    [210, 370, 120, 290],
    [1250, 340, 110, 320],
    [1380, 260, 88, 390],
  ];
  for (const [cx, cy, cw, ch] of castleTowers) {
    far.fillRect(cx, cy, cw, ch);
    far.beginPath();
    far.moveTo(cx - 10, cy);
    far.lineTo(cx + cw / 2, cy - 105);
    far.lineTo(cx + cw + 10, cy);
    far.closePath();
    far.fill();
    far.fillStyle = '#fb923c';
    far.beginPath();
    far.roundRect(cx + cw * 0.36, cy + 48, cw * 0.28, 34, [12, 12, 0, 0]);
    far.fill();
    far.fillStyle = '#180d29';
  }

  // Stage layer: Torchlit Gothic castle courtyard flagstones with crimson & brass inlay
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#2b213b',
      deckMid: '#3a2d4f',
      deckFrontLight: '#493a63',
      slabFaceTop: '#2c223c',
      slabFaceBottom: '#130d1d',
      slabBevel: '#f59e0b',
      seamColor: 'rgba(12, 8, 22, 0.56)',
      seamHighlight: 'rgba(253, 224, 71, 0.14)',
      curbTop: '#56456f',
      curbFace: '#211830',
      medallionOuter: '#4c2548',
      medallionInner: '#6b335c',
      medallionTrim: '#fbbf24',
      glowTint: 'rgba(251, 146, 60, 0.28)',
      postColor: '#44355a',
      postCapColor: '#6d588a',
      pillarShade: '#191125',
      lanternGlow: 'rgba(251, 146, 60, 0.78)',
      slabJointColor: 'rgba(10, 6, 18, 0.62)',
      mode: 'stone',
    },
    rand
  );
}

function paintNeon(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#09061f'],
    [0.42, '#240b4c'],
    [0.72, '#6d166e'],
    [1, '#b8257b'],
  ]);
  drawStars(far, rand, 120, HEIGHT * 0.45, '#e0f2fe');

  const sx = WIDTH * 0.5;
  const sy = HEIGHT * 0.44;
  drawRadialGlow(far, sx, sy, 320, 'rgba(244,114,182,0.52)', 'rgba(244,114,182,0)');
  const sunG = far.createLinearGradient(0, sy - 140, 0, sy + 120);
  sunG.addColorStop(0, '#fde047');
  sunG.addColorStop(0.55, '#fb7185');
  sunG.addColorStop(1, '#c026d3');
  far.fillStyle = sunG;
  far.beginPath();
  far.arc(sx, sy, 140, 0, Math.PI * 2);
  far.fill();

  far.fillStyle = '#4c115b';
  for (let i = 0; i < 6; i++) {
    far.fillRect(sx - 150, sy + 14 + i * 20, 300, 4.5 + i * 1.3);
  }

  const buildings = [
    [40, 310, 95, 360, '#22d3ee'],
    [150, 250, 110, 420, '#e879f9'],
    [275, 355, 85, 315, '#38bdf8'],
    [1220, 345, 92, 325, '#e879f9'],
    [1330, 235, 115, 435, '#22d3ee'],
    [1460, 305, 100, 365, '#f472b6'],
  ] as const;
  for (const [bx, by, bw, bh, edge] of buildings) {
    far.fillStyle = '#120a2e';
    far.fillRect(bx, by, bw, bh);
    far.strokeStyle = edge;
    far.lineWidth = 2.5;
    far.strokeRect(bx, by, bw, bh);
  }

  // Stage layer: Synthwave smoked-glass skybridge with crisp cyan/magenta laser rails
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#160932',
      deckMid: '#230d4b',
      deckFrontLight: '#2e1065',
      slabFaceTop: '#1b0b3d',
      slabFaceBottom: '#080316',
      slabBevel: '#22d3ee',
      seamColor: 'rgba(34, 211, 238, 0.44)',
      seamHighlight: 'rgba(232, 121, 249, 0.28)',
      curbTop: '#38166b',
      curbFace: '#14082b',
      medallionOuter: '#271054',
      medallionInner: '#3f177c',
      medallionTrim: '#22d3ee',
      glowTint: 'rgba(232, 121, 249, 0.38)',
      postColor: '#1f0d42',
      postCapColor: '#e879f9',
      pillarShade: '#0d0420',
      lanternGlow: 'rgba(34, 211, 238, 0.8)',
      slabJointColor: 'rgba(34, 211, 238, 0.35)',
      mode: 'cyber',
    },
    rand
  );
}

function paintCyberpunk(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#07131f'],
    [0.45, '#0f283b'],
    [0.78, '#1a3a4a'],
    [1, '#284552'],
  ]);
  drawRadialGlow(far, WIDTH * 0.25, HEIGHT * 0.32, 360, 'rgba(34,211,238,0.24)', 'rgba(34,211,238,0)');
  drawRadialGlow(far, WIDTH * 0.78, HEIGHT * 0.38, 340, 'rgba(250,204,21,0.2)', 'rgba(250,204,21,0)');

  for (let i = 0; i < 24; i++) {
    const bw = 55 + rand() * 95;
    const bh = 240 + rand() * 360;
    const bx = i * 70 - 20;
    const by = HEIGHT - 180 - bh;
    if (bx > 530 && bx < 1010) {
      const shortH = 120 + rand() * 140;
      far.fillStyle = '#0c1c29';
      far.fillRect(bx, HEIGHT - 180 - shortH, bw, shortH);
      continue;
    }
    far.fillStyle = i % 2 === 0 ? '#0b1824' : '#102232';
    far.fillRect(bx, by, bw, bh);
    far.fillStyle = i % 3 === 0 ? 'rgba(34,211,238,0.62)' : i % 3 === 1 ? 'rgba(250,204,21,0.56)' : 'rgba(244,63,94,0.48)';
    for (let wy = by + 24; wy < HEIGHT - 230; wy += 24) {
      if (rand() > 0.35) far.fillRect(bx + 12, wy, bw - 24, 4);
    }
  }

  // Stage layer: Wet rooftop steel helipad & holographic grating with hazard chevrons
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#162430',
      deckMid: '#1f3342',
      deckFrontLight: '#284254',
      slabFaceTop: '#1b2c39',
      slabFaceBottom: '#0a1219',
      slabBevel: '#facc15',
      seamColor: 'rgba(34, 211, 238, 0.32)',
      seamHighlight: 'rgba(250, 204, 21, 0.16)',
      curbTop: '#334d60',
      curbFace: '#14212b',
      medallionOuter: '#1c3343',
      medallionInner: '#28495f',
      medallionTrim: '#facc15',
      glowTint: 'rgba(34, 211, 238, 0.32)',
      postColor: '#253a4a',
      postCapColor: '#38bdf8',
      pillarShade: '#0c151d',
      lanternGlow: 'rgba(250, 204, 21, 0.72)',
      slabJointColor: 'rgba(15, 23, 42, 0.65)',
      mode: 'cyber',
    },
    rand
  );
}

function paintLava(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#1c1012'],
    [0.35, '#451412'],
    [0.72, '#9a2815'],
    [1, '#ea580c'],
  ]);
  drawRadialGlow(far, WIDTH * 0.5, HEIGHT * 0.55, 520, 'rgba(251,146,60,0.68)', 'rgba(251,146,60,0)');

  drawMountainBand(far, 540, 155, 2.3, 0.4, '#361310', 0.45);
  drawMountainBand(far, 600, 120, 3.1, 1.8, '#230d0b', 0.42);

  far.strokeStyle = '#fb923c';
  far.lineWidth = 6;
  far.beginPath();
  far.moveTo(295, 395);
  far.bezierCurveTo(320, 480, 265, 530, 345, 650);
  far.stroke();
  far.beginPath();
  far.moveTo(1275, 385);
  far.bezierCurveTo(1250, 470, 1310, 530, 1230, 650);
  far.stroke();

  // Stage layer: Forged basalt citadel bridge glowing with magma fissures in perspective seams
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#261412',
      deckMid: '#361b17',
      deckFrontLight: '#47221d',
      slabFaceTop: '#2a1310',
      slabFaceBottom: '#120605',
      slabBevel: '#fb923c',
      seamColor: 'rgba(249, 115, 22, 0.46)',
      seamHighlight: 'rgba(253, 224, 71, 0.24)',
      curbTop: '#4c2620',
      curbFace: '#1e0d0b',
      medallionOuter: '#3d1914',
      medallionInner: '#59231a',
      medallionTrim: '#fb923c',
      glowTint: 'rgba(249, 115, 22, 0.36)',
      postColor: '#3a1c17',
      postCapColor: '#7c2d12',
      pillarShade: '#160807',
      lanternGlow: 'rgba(251, 146, 60, 0.85)',
      slabJointColor: 'rgba(249, 115, 22, 0.35)',
      mode: 'stone',
    },
    rand
  );
}

function paintIce(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#0c2340'],
    [0.36, '#155e75'],
    [0.72, '#7dd3fc'],
    [1, '#e0f2fe'],
  ]);

  far.save();
  for (let r = 0; r < 3; r++) {
    const g = far.createLinearGradient(0, 90 + r * 42, WIDTH, 240 + r * 38);
    g.addColorStop(0, 'rgba(52,211,153,0)');
    g.addColorStop(0.35, 'rgba(52,211,153,0.36)');
    g.addColorStop(0.65, 'rgba(56,189,248,0.36)');
    g.addColorStop(1, 'rgba(167,139,250,0)');
    far.fillStyle = g;
    far.beginPath();
    far.moveTo(0, 190 + r * 35);
    far.bezierCurveTo(420, 70 + r * 30, 1080, 260 + r * 20, WIDTH, 120 + r * 35);
    far.lineTo(WIDTH, 230 + r * 35);
    far.bezierCurveTo(1080, 350 + r * 20, 420, 170 + r * 30, 0, 280 + r * 35);
    far.closePath();
    far.fill();
  }
  far.restore();

  drawMountainBand(far, 560, 165, 2.7, 0.6, '#93c5fd', 0.58);
  drawMountainBand(far, 610, 120, 3.4, 2.1, '#bae6fd', 0.52);
  drawStars(far, rand, 65, HEIGHT * 0.5, '#ffffff');

  // Crystal spires rising on stage wings
  const icePeaks = [
    [75, 575, 110, 220],
    [170, 580, 82, 160],
    [1415, 580, 92, 175],
    [1515, 575, 115, 230],
  ];
  for (const [ix, iy, iw, ih] of icePeaks) {
    stage.fillStyle = 'rgba(125, 211, 252, 0.78)';
    stage.beginPath();
    stage.moveTo(ix - iw / 2, iy);
    stage.lineTo(ix, iy - ih);
    stage.lineTo(ix + iw / 2, iy);
    stage.closePath();
    stage.fill();
  }

  // Stage layer: Sculpted glacial sapphire ice-terrace cliff with frosted snow trim
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#bae6fd',
      deckMid: '#e0f2fe',
      deckFrontLight: '#f0f9ff',
      slabFaceTop: '#38bdf8',
      slabFaceBottom: '#0284c7',
      slabBevel: '#ffffff',
      seamColor: 'rgba(14, 116, 144, 0.25)',
      seamHighlight: 'rgba(255, 255, 255, 0.78)',
      curbTop: '#f8fdff',
      curbFace: '#7dd3fc',
      medallionOuter: '#bae6fd',
      medallionInner: '#ffffff',
      medallionTrim: '#0ea5e9',
      glowTint: 'rgba(224, 242, 254, 0.52)',
      postColor: '#bae6fd',
      postCapColor: '#ffffff',
      pillarShade: '#38bdf8',
      lanternGlow: 'rgba(103, 232, 249, 0.6)',
      slabJointColor: 'rgba(255, 255, 255, 0.52)',
      mode: 'ice',
    },
    rand
  );
}

function paintDesert(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#4b86b4'],
    [0.36, '#9ec5d6'],
    [0.68, '#f6bd72'],
    [1, '#fde68a'],
  ]);
  drawRadialGlow(far, WIDTH * 0.54, HEIGHT * 0.42, 380, 'rgba(255,248,220,0.9)', 'rgba(251,191,36,0)');
  drawGodRays(far, WIDTH * 0.54, HEIGHT * 0.26, 'rgba(255, 246, 200, 0.16)', 5, 0.9);

  far.fillStyle = 'rgba(180, 98, 52, 0.48)';
  far.beginPath();
  far.moveTo(90, 580);
  far.lineTo(140, 445);
  far.lineTo(310, 445);
  far.lineTo(360, 580);
  far.closePath();
  far.fill();

  far.beginPath();
  far.moveTo(1180, 580);
  far.lineTo(1235, 425);
  far.lineTo(1430, 425);
  far.lineTo(1490, 580);
  far.closePath();
  far.fill();

  drawRollingHills(far, 585, 48, 1.8, 0.5, '#eab364');
  drawRollingHills(far, 625, 42, 2.3, 2.1, '#d98c3e');

  // Stage layer: Carved sandstone temple promenade with sun-dial mosaic inlay
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#d79e5e',
      deckMid: '#e8b97c',
      deckFrontLight: '#f3cfa0',
      slabFaceTop: '#a36434',
      slabFaceBottom: '#5e3418',
      slabBevel: '#fef3c7',
      seamColor: 'rgba(116, 62, 26, 0.34)',
      seamHighlight: 'rgba(254, 243, 199, 0.44)',
      curbTop: '#f3d19e',
      curbFace: '#b6743d',
      medallionOuter: '#dba159',
      medallionInner: '#fde68a',
      medallionTrim: '#f59e0b',
      glowTint: 'rgba(254, 240, 199, 0.36)',
      postColor: '#d99e5b',
      postCapColor: '#fde68a',
      pillarShade: '#8c5124',
      lanternGlow: 'rgba(251, 191, 36, 0.58)',
      slabJointColor: 'rgba(92, 46, 18, 0.46)',
      mode: 'stone',
    },
    rand
  );
}

function paintCandy(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#f9a8d4'],
    [0.36, '#fbcfe8'],
    [0.68, '#ddd6fe'],
    [1, '#ccfbf1'],
  ]);

  far.save();
  far.globalAlpha = 0.32;
  const rainbow = ['#fb7185', '#fbbf24', '#4ade80', '#38bdf8', '#c084fc'];
  rainbow.forEach((c, idx) => {
    far.strokeStyle = c;
    far.lineWidth = 14;
    far.beginPath();
    far.arc(WIDTH * 0.5, HEIGHT * 0.72, 540 - idx * 14, Math.PI * 1.08, Math.PI * 1.92);
    far.stroke();
  });
  far.restore();

  drawCloudPuff(far, 250, 185, 190, '#fff5fa', 0.86);
  drawCloudPuff(far, 1340, 175, 210, '#fff5fa', 0.86);
  drawRollingHills(far, 585, 50, 2.0, 0.5, '#f9a8d4');

  // Stage-side giant peppermint lollipops
  const pops = [
    [105, 410, 48, '#f43f5e'],
    [1495, 405, 50, '#a855f7'],
  ] as const;
  for (const [lx, ly, lr, lc] of pops) {
    stage.fillStyle = '#ffffff';
    stage.fillRect(lx - 5, ly, 10, DECK_BACK_Y - ly + 10);
    stage.fillStyle = lc;
    stage.beginPath();
    stage.arc(lx, ly, lr, 0, Math.PI * 2);
    stage.fill();
    stage.strokeStyle = '#ffffff';
    stage.lineWidth = 6;
    stage.beginPath();
    stage.arc(lx, ly, lr * 0.58, 0, Math.PI * 1.5);
    stage.stroke();
  }

  // Stage layer: Golden waffle-cone & pastel frosted wafer terrace
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#f3be7a',
      deckMid: '#fad29b',
      deckFrontLight: '#fde2ba',
      slabFaceTop: '#f472b6',
      slabFaceBottom: '#db2777',
      slabBevel: '#fff1f8',
      seamColor: 'rgba(180, 104, 42, 0.28)',
      seamHighlight: 'rgba(255, 245, 224, 0.52)',
      curbTop: '#fff1f8',
      curbFace: '#f472b6',
      medallionOuter: '#fbcfe8',
      medallionInner: '#fff8fc',
      medallionTrim: '#f43f5e',
      glowTint: 'rgba(255, 241, 248, 0.45)',
      postColor: '#fbcfe8',
      postCapColor: '#ffffff',
      pillarShade: '#f472b6',
      lanternGlow: 'rgba(244, 114, 182, 0.52)',
      slabJointColor: 'rgba(255, 255, 255, 0.45)',
      mode: 'candy',
    },
    rand
  );
}

function paintBackrooms(far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) {
  fillSky(far, [
    [0, '#4f4627'],
    [0.45, '#8c7e4c'],
    [0.82, '#695c34'],
    [1, '#3d351d'],
  ]);

  const vx = WIDTH * 0.5;
  const vy = HEIGHT * 0.44;

  // Perspective corridor walls converging cleanly to horizon vanishing point
  far.fillStyle = '#a89962';
  far.beginPath();
  far.moveTo(0, 0);
  far.lineTo(vx - 260, vy - 130);
  far.lineTo(vx - 260, vy + 165);
  far.lineTo(0, DECK_BACK_Y + 60);
  far.closePath();
  far.fill();

  far.beginPath();
  far.moveTo(WIDTH, 0);
  far.lineTo(vx + 260, vy - 130);
  far.lineTo(vx + 260, vy + 165);
  far.lineTo(WIDTH, DECK_BACK_Y + 60);
  far.closePath();
  far.fill();

  far.strokeStyle = 'rgba(72, 62, 32, 0.22)';
  far.lineWidth = 3;
  for (let x = 40; x < WIDTH; x += 44) {
    if (x > vx - 250 && x < vx + 250) continue;
    far.beginPath();
    far.moveTo(x, 0);
    far.lineTo(x, DECK_BACK_Y);
    far.stroke();
  }

  const lights = [
    [WIDTH * 0.26, 75, 180, 46],
    [WIDTH * 0.5, 95, 160, 42],
    [WIDTH * 0.74, 75, 180, 46],
    [WIDTH * 0.5, 200, 108, 28],
  ];
  for (const [lx, ly, lw, lh] of lights) {
    drawRadialGlow(far, lx, ly + lh / 2, lw * 1.15, 'rgba(255,247,205,0.45)', 'rgba(255,247,205,0)');
    far.fillStyle = '#fef9c3';
    far.fillRect(lx - lw / 2, ly, lw, lh);
  }

  far.fillStyle = '#5c502b';
  far.fillRect(vx - 260, vy - 130, 520, 295);
  far.fillStyle = '#332c16';
  far.fillRect(vx - 95, vy - 75, 190, 240);

  // Stage layer: Perspective damp-carpeted Backrooms office lobby floor with baseboard molding
  drawPerspectiveTerrace(
    stage,
    {
      deckTop: '#6d6037',
      deckMid: '#8a7a47',
      deckFrontLight: '#9c8a53',
      slabFaceTop: '#4a4023',
      slabFaceBottom: '#2b2513',
      slabBevel: '#fef08a',
      seamColor: 'rgba(54, 46, 22, 0.25)',
      seamHighlight: 'rgba(254, 249, 195, 0.14)',
      curbTop: '#b5a468',
      curbFace: '#5a4e2c',
      medallionOuter: '#786a3d',
      medallionInner: '#9e8d56',
      medallionTrim: '#e7d796',
      glowTint: 'rgba(254, 249, 195, 0.26)',
      postColor: '#8d7d4b',
      postCapColor: '#b9a76a',
      pillarShade: '#4a4023',
      slabJointColor: 'rgba(35, 30, 16, 0.45)',
      mode: 'carpet',
    },
    rand
  );
}

const THEME_META: Record<ThemeId, { ambientColor: string; floorTint: string }> = {
  cozy: { ambientColor: 'rgba(255, 226, 168, 0.28)', floorTint: 'rgba(255, 236, 195, 0.34)' },
  aero: { ambientColor: 'rgba(103, 232, 249, 0.26)', floorTint: 'rgba(186, 230, 253, 0.38)' },
  cosmic: { ambientColor: 'rgba(192, 132, 252, 0.3)', floorTint: 'rgba(103, 232, 249, 0.32)' },
  swamp: { ambientColor: 'rgba(190, 242, 100, 0.24)', floorTint: 'rgba(163, 230, 53, 0.26)' },
  garden: { ambientColor: 'rgba(253, 224, 71, 0.24)', floorTint: 'rgba(134, 239, 172, 0.3)' },
  castle: { ambientColor: 'rgba(251, 146, 60, 0.28)', floorTint: 'rgba(251, 191, 36, 0.28)' },
  neon: { ambientColor: 'rgba(232, 121, 249, 0.3)', floorTint: 'rgba(34, 211, 238, 0.38)' },
  cyberpunk: { ambientColor: 'rgba(34, 211, 238, 0.28)', floorTint: 'rgba(250, 204, 21, 0.28)' },
  lava: { ambientColor: 'rgba(251, 146, 60, 0.34)', floorTint: 'rgba(249, 115, 22, 0.36)' },
  ice: { ambientColor: 'rgba(186, 230, 253, 0.32)', floorTint: 'rgba(125, 211, 252, 0.38)' },
  desert: { ambientColor: 'rgba(253, 224, 71, 0.28)', floorTint: 'rgba(251, 191, 36, 0.32)' },
  candy: { ambientColor: 'rgba(244, 114, 182, 0.24)', floorTint: 'rgba(251, 207, 232, 0.42)' },
  backrooms: { ambientColor: 'rgba(254, 240, 138, 0.22)', floorTint: 'rgba(254, 249, 195, 0.24)' },
};

const PAINTERS: Record<
  ThemeId,
  (far: CanvasRenderingContext2D, stage: CanvasRenderingContext2D, rand: () => number) => void
> = {
  cozy: paintCozy,
  aero: paintAero,
  cosmic: paintCosmic,
  swamp: paintSwamp,
  garden: paintGarden,
  castle: paintCastle,
  neon: paintNeon,
  cyberpunk: paintCyberpunk,
  lava: paintLava,
  ice: paintIce,
  desert: paintDesert,
  candy: paintCandy,
  backrooms: paintBackrooms,
};

export function getBiomeBackdropLayers(theme: ThemeId): BiomeBackdropLayers {
  const cached = LAYER_CACHE.get(theme);
  if (cached) return cached;

  const meta = THEME_META[theme] ?? THEME_META.cozy;
  if (typeof document === 'undefined') {
    return { farUrl: '', stageUrl: '', ...meta };
  }

  const farCanvas = document.createElement('canvas');
  farCanvas.width = WIDTH;
  farCanvas.height = HEIGHT;
  const farCtx = farCanvas.getContext('2d');

  const stageCanvas = document.createElement('canvas');
  stageCanvas.width = WIDTH;
  stageCanvas.height = HEIGHT;
  const stageCtx = stageCanvas.getContext('2d');

  if (!farCtx || !stageCtx) {
    return { farUrl: '', stageUrl: '', ...meta };
  }

  let seed = 1337;
  for (let i = 0; i < theme.length; i++) {
    seed = (seed * 31 + theme.charCodeAt(i)) | 0;
  }
  const rand = mulberry32(seed);
  const paint = PAINTERS[theme] ?? paintCozy;
  paint(farCtx, stageCtx, rand);
  drawSubtleGrain(farCtx, rand, 0.022);
  drawSubtleGrain(stageCtx, rand, 0.016);

  const layers: BiomeBackdropLayers = {
    farUrl: farCanvas.toDataURL('image/jpeg', 0.9),
    stageUrl: stageCanvas.toDataURL('image/png'),
    ...meta,
  };
  LAYER_CACHE.set(theme, layers);
  return layers;
}

export function getBiomeBackdropUrl(theme: ThemeId): string {
  return getBiomeBackdropLayers(theme).farUrl;
}
