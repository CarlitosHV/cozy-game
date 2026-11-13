import type { ThemeId } from '../game/progress';

const BACKDROP_CACHE = new Map<ThemeId, string>();
const WIDTH = 1600;
const HEIGHT = 900;

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
  // Craggy underside
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.48, cy);
  ctx.lineTo(cx - w * 0.25, cy + h * 0.65);
  ctx.lineTo(cx - w * 0.04, cy + h);
  ctx.lineTo(cx + w * 0.2, cy + h * 0.72);
  ctx.lineTo(cx + w * 0.48, cy);
  ctx.closePath();
  ctx.fillStyle = rockColor;
  ctx.fill();

  // Lush/themed top cap
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

function drawStars(ctx: CanvasRenderingContext2D, rand: () => number, count: number, maxY = HEIGHT * 0.68, tint = '#ffffff') {
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

function drawStageHaze(ctx: CanvasRenderingContext2D, color: string, heightRatio = 0.32) {
  const startY = HEIGHT * (1 - heightRatio);
  const g = ctx.createLinearGradient(0, startY, 0, HEIGHT);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, startY, WIDTH, HEIGHT - startY);
}

function drawSubtleGrain(ctx: CanvasRenderingContext2D, rand: () => number, alpha = 0.03) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 1800; i++) {
    ctx.fillStyle = rand() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(rand() * WIDTH, rand() * HEIGHT, 2, 2);
  }
  ctx.restore();
}

function paintCozy(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#4f86b8'],
    [0.36, '#87b5d4'],
    [0.7, '#f8c390'],
    [1, '#fde3b4'],
  ]);
  drawRadialGlow(ctx, WIDTH * 0.5, HEIGHT * 0.42, 460, 'rgba(255,244,210,0.88)', 'rgba(255,205,135,0)');

  drawCloudPuff(ctx, 260, 170, 170, '#fff4e6', 0.65);
  drawCloudPuff(ctx, 1310, 145, 200, '#fff2df', 0.68);
  drawCloudPuff(ctx, 980, 240, 145, '#ffe8d0', 0.52);

  // Far floating islands
  drawFloatingIsland(ctx, 250, 390, 210, 120, '#8ec275', '#9d8775', 'rgba(220,248,255,0.45)');
  drawFloatingIsland(ctx, 1340, 350, 240, 145, '#7cb868', '#8f7968', 'rgba(220,248,255,0.45)');
  drawFloatingIsland(ctx, 1100, 460, 130, 80, '#96c97f', '#a68f7c');

  drawRollingHills(ctx, 640, 62, 2.1, 0.6, 'rgba(130, 152, 138, 0.55)');
  drawRollingHills(ctx, 710, 54, 2.8, 2.1, '#79a868');
  drawRollingHills(ctx, 795, 42, 3.3, 0.9, '#5d9154');

  for (let i = 0; i < 16; i++) {
    const x = i < 8 ? 30 + rand() * 410 : 1140 + rand() * 430;
    const y = 735 + rand() * 85;
    drawPineTree(ctx, x, y, 0.8 + rand() * 0.9, '#3e6e42');
  }

  drawStageHaze(ctx, 'rgba(255, 232, 198, 0.72)', 0.28);
}

function paintAero(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#0c7ad9'],
    [0.38, '#38bdf8'],
    [0.72, '#a7f3d0'],
    [1, '#ecfeff'],
  ]);
  drawRadialGlow(ctx, WIDTH * 0.64, HEIGHT * 0.22, 380, 'rgba(255,255,255,0.92)', 'rgba(186,230,253,0)');

  drawCloudPuff(ctx, 290, 175, 210, '#ffffff', 0.82);
  drawCloudPuff(ctx, 780, 135, 165, '#ffffff', 0.72);
  drawCloudPuff(ctx, 1290, 195, 235, '#ffffff', 0.85);

  // Glossy eco-glass city towers on left/right horizon
  const towers = [
    [120, 420, 74, 280],
    [210, 370, 86, 330],
    [315, 445, 68, 260],
    [1210, 410, 78, 295],
    [1310, 355, 92, 345],
    [1425, 435, 72, 265],
  ];
  for (const [tx, ty, tw, th] of towers) {
    const g = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
    g.addColorStop(0, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.5, 'rgba(125,211,252,0.58)');
    g.addColorStop(1, 'rgba(56,189,248,0.45)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, [18, 18, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Rolling Aero meadows & turquoise water ribbon
  drawRollingHills(ctx, 645, 55, 1.9, 0.3, '#6ee7b7');
  drawRollingHills(ctx, 715, 48, 2.4, 1.8, '#34d399');

  // Turquoise reflection pool in valley
  const waterGrad = ctx.createLinearGradient(0, 720, 0, 900);
  waterGrad.addColorStop(0, '#38bdf8');
  waterGrad.addColorStop(1, '#0284c7');
  ctx.fillStyle = waterGrad;
  ctx.fillRect(0, 755, WIDTH, 145);

  drawRollingHills(ctx, 790, 38, 2.7, 3.1, '#22c55e');

  // Translucent glossy Aero bubbles
  ctx.save();
  for (let i = 0; i < 24; i++) {
    const bx = rand() * WIDTH;
    const by = 120 + rand() * 640;
    const br = 12 + rand() * 34;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  drawStageHaze(ctx, 'rgba(236, 254, 255, 0.65)', 0.24);
}

function paintCosmic(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#070518'],
    [0.45, '#191042'],
    [0.8, '#2d195c'],
    [1, '#4c267a'],
  ]);

  // Nebula wisps
  drawRadialGlow(ctx, WIDTH * 0.25, HEIGHT * 0.34, 460, 'rgba(192,132,252,0.34)', 'rgba(192,132,252,0)');
  drawRadialGlow(ctx, WIDTH * 0.76, HEIGHT * 0.38, 440, 'rgba(56,189,248,0.28)', 'rgba(56,189,248,0)');
  drawRadialGlow(ctx, WIDTH * 0.5, HEIGHT * 0.78, 520, 'rgba(168,85,247,0.32)', 'rgba(168,85,247,0)');
  drawStars(ctx, rand, 240, HEIGHT * 0.85, '#f5f3ff');

  // Ringed planet top-right
  ctx.save();
  const px = 1230;
  const py = 235;
  const planetG = ctx.createRadialGradient(px - 35, py - 35, 16, px, py, 108);
  planetG.addColorStop(0, '#f0abfc');
  planetG.addColorStop(0.55, '#8b5cf6');
  planetG.addColorStop(1, '#312e81');
  ctx.fillStyle = planetG;
  ctx.beginPath();
  ctx.arc(px, py, 105, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(px, py);
  ctx.rotate(-0.28);
  ctx.strokeStyle = 'rgba(224,231,255,0.68)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(0, 0, 195, 42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Moon left
  drawRadialGlow(ctx, 270, 220, 110, 'rgba(165,243,252,0.35)', 'rgba(165,243,252,0)');
  ctx.fillStyle = '#bae6fd';
  ctx.beginPath();
  ctx.arc(270, 220, 44, 0, Math.PI * 2);
  ctx.fill();

  // Jagged asteroid horizon
  drawMountainBand(ctx, 735, 95, 3.2, 0.5, '#1d1240', 0.55);
  drawMountainBand(ctx, 800, 72, 4.1, 1.9, '#120b2c', 0.5);

  // Glowing crystal spires left/right
  const spires = [130, 210, 1380, 1465];
  for (const sx of spires) {
    const sh = 120 + rand() * 80;
    ctx.fillStyle = 'rgba(103, 232, 249, 0.55)';
    ctx.beginPath();
    ctx.moveTo(sx, 830);
    ctx.lineTo(sx - 24, 830);
    ctx.lineTo(sx - 4, 830 - sh);
    ctx.lineTo(sx + 22, 830);
    ctx.closePath();
    ctx.fill();
  }
  drawStageHaze(ctx, 'rgba(91, 33, 182, 0.45)', 0.25);
}

function paintSwamp(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#101d19'],
    [0.45, '#20382e'],
    [0.78, '#3f5a47'],
    [1, '#627c60'],
  ]);
  drawRadialGlow(ctx, WIDTH * 0.28, HEIGHT * 0.24, 240, 'rgba(236,253,205,0.68)', 'rgba(163,230,53,0)');
  ctx.fillStyle = '#ecfccb';
  ctx.beginPath();
  ctx.arc(WIDTH * 0.28, HEIGHT * 0.24, 48, 0, Math.PI * 2);
  ctx.fill();

  drawMountainBand(ctx, 630, 75, 2.2, 0.3, '#253b2f', 0.25);

  // Crumbling stone witch tower silhouette right
  ctx.fillStyle = '#1d2d23';
  ctx.fillRect(1240, 355, 76, 360);
  ctx.beginPath();
  ctx.moveTo(1224, 358);
  ctx.lineTo(1278, 250);
  ctx.lineTo(1332, 358);
  ctx.closePath();
  ctx.fill();

  drawRollingHills(ctx, 710, 40, 2.5, 1.1, '#1a2b20');
  drawRollingHills(ctx, 800, 32, 3.0, 2.3, '#101c14');

  // Fireflies
  for (let i = 0; i < 42; i++) {
    const fx = rand() * WIDTH;
    const fy = 260 + rand() * 540;
    drawRadialGlow(ctx, fx, fy, 16, 'rgba(217,249,157,0.85)', 'rgba(217,249,157,0)');
  }
  drawStageHaze(ctx, 'rgba(190, 242, 100, 0.26)', 0.28);
}

function paintGarden(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#7dd3fc'],
    [0.42, '#bae6fd'],
    [0.75, '#fef3c7'],
    [1, '#dcfce7'],
  ]);
  drawRadialGlow(ctx, WIDTH * 0.72, HEIGHT * 0.24, 380, 'rgba(255,251,235,0.92)', 'rgba(254,243,199,0)');
  drawCloudPuff(ctx, 320, 170, 175, '#ffffff', 0.75);
  drawCloudPuff(ctx, 1190, 145, 185, '#ffffff', 0.75);

  drawRollingHills(ctx, 645, 58, 2.0, 0.8, '#86efac');
  drawRollingHills(ctx, 730, 52, 2.6, 2.2, '#4ade80');
  drawRollingHills(ctx, 810, 36, 3.0, 0.4, '#22c55e');

  // Oversized flower silhouettes at left & right borders
  const flowerSpots = [
    [110, 560, 48, '#f472b6'],
    [235, 620, 38, '#facc15'],
    [1365, 600, 44, '#fb7185'],
    [1485, 535, 54, '#f472b6'],
  ] as const;
  for (const [fx, fy, fr, fc] of flowerSpots) {
    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.quadraticCurveTo(fx + 14, fy + 160, fx - 6, 900);
    ctx.stroke();

    ctx.fillStyle = fc;
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(fx + Math.cos(a) * fr * 0.75, fy + Math.sin(a) * fr * 0.75, fr * 0.45, fr * 0.26, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pollen & petals
  for (let i = 0; i < 36; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(251,207,232,0.85)' : 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(rand() * WIDTH, rand() * HEIGHT * 0.85, 6, 3.5, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  drawStageHaze(ctx, 'rgba(240, 253, 244, 0.65)', 0.25);
}

function paintCastle(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#130c24'],
    [0.45, '#2c1747'],
    [0.78, '#582252'],
    [1, '#7c2d4a'],
  ]);
  drawStars(ctx, rand, 130, HEIGHT * 0.6, '#fde68a');
  drawRadialGlow(ctx, WIDTH * 0.52, HEIGHT * 0.26, 260, 'rgba(254,243,199,0.72)', 'rgba(254,243,199,0)');
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(WIDTH * 0.52, HEIGHT * 0.26, 74, 0, Math.PI * 2);
  ctx.fill();

  drawMountainBand(ctx, 645, 95, 2.8, 0.2, '#241438', 0.45);

  // Gothic castle battlements & spires left & right
  ctx.fillStyle = '#180d29';
  const castleTowers = [
    [110, 340, 80, 420],
    [210, 420, 120, 340],
    [1250, 390, 110, 370],
    [1380, 310, 88, 450],
  ];
  for (const [cx, cy, cw, ch] of castleTowers) {
    ctx.fillRect(cx, cy, cw, ch);
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy);
    ctx.lineTo(cx + cw / 2, cy - 105);
    ctx.lineTo(cx + cw + 10, cy);
    ctx.closePath();
    ctx.fill();
    // Lit warm gothic window
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.roundRect(cx + cw * 0.36, cy + 48, cw * 0.28, 34, [12, 12, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#180d29';
  }

  drawMountainBand(ctx, 760, 62, 3.6, 1.4, '#12091f', 0.35);
  drawStageHaze(ctx, 'rgba(88, 28, 135, 0.4)', 0.26);
}

function paintNeon(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#09061f'],
    [0.42, '#240b4c'],
    [0.72, '#6d166e'],
    [1, '#b8257b'],
  ]);
  drawStars(ctx, rand, 120, HEIGHT * 0.48, '#e0f2fe');

  // Retro synthwave sun behind horizon
  const sx = WIDTH * 0.5;
  const sy = HEIGHT * 0.54;
  drawRadialGlow(ctx, sx, sy, 320, 'rgba(244,114,182,0.52)', 'rgba(244,114,182,0)');
  const sunG = ctx.createLinearGradient(0, sy - 160, 0, sy + 140);
  sunG.addColorStop(0, '#fde047');
  sunG.addColorStop(0.55, '#fb7185');
  sunG.addColorStop(1, '#c026d3');
  ctx.fillStyle = sunG;
  ctx.beginPath();
  ctx.arc(sx, sy, 155, 0, Math.PI * 2);
  ctx.fill();

  // Horizontal scan slices over lower half of sun
  ctx.fillStyle = '#4c115b';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(sx - 165, sy + 18 + i * 22, 330, 5 + i * 1.4);
  }

  // City skyline left & right with crisp prism outlines
  const buildings = [
    [40, 370, 95, 420, '#22d3ee'],
    [150, 310, 110, 480, '#e879f9'],
    [275, 415, 85, 375, '#38bdf8'],
    [1220, 405, 92, 385, '#e879f9'],
    [1330, 295, 115, 495, '#22d3ee'],
    [1460, 365, 100, 425, '#f472b6'],
  ] as const;
  for (const [bx, by, bw, bh, edge] of buildings) {
    ctx.fillStyle = '#120a2e';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx, by, bw, bh);
  }

  // Perspective floor & subtle glowing grid
  const floorG = ctx.createLinearGradient(0, 680, 0, HEIGHT);
  floorG.addColorStop(0, '#1e0b3a');
  floorG.addColorStop(1, '#0d061f');
  ctx.fillStyle = floorG;
  ctx.fillRect(0, 680, WIDTH, HEIGHT - 680);

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.38)';
  ctx.lineWidth = 1.5;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(WIDTH * 0.5 + i * 48, 680);
    ctx.lineTo(WIDTH * 0.5 + i * 220, HEIGHT);
    ctx.stroke();
  }
  for (let r = 0; r < 6; r++) {
    const ry = 695 + r * r * 7.5;
    ctx.beginPath();
    ctx.moveTo(0, ry);
    ctx.lineTo(WIDTH, ry);
    ctx.stroke();
  }
}

function paintCyberpunk(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#07131f'],
    [0.45, '#0f283b'],
    [0.78, '#1a3a4a'],
    [1, '#284552'],
  ]);
  drawRadialGlow(ctx, WIDTH * 0.25, HEIGHT * 0.35, 360, 'rgba(34,211,238,0.22)', 'rgba(34,211,238,0)');
  drawRadialGlow(ctx, WIDTH * 0.78, HEIGHT * 0.42, 340, 'rgba(250,204,21,0.18)', 'rgba(250,204,21,0)');

  // Layered megacity silhouettes
  for (let i = 0; i < 24; i++) {
    const bw = 55 + rand() * 95;
    const bh = 220 + rand() * 390;
    const bx = i * 70 - 20;
    const by = HEIGHT - bh;
    if (bx > 530 && bx < 1010) {
      // Lower central skyline to keep center character clear
      const shortH = 120 + rand() * 140;
      ctx.fillStyle = '#0c1c29';
      ctx.fillRect(bx, HEIGHT - shortH, bw, shortH);
      continue;
    }
    ctx.fillStyle = i % 2 === 0 ? '#0b1824' : '#102232';
    ctx.fillRect(bx, by, bw, bh);

    // Lit window strips
    ctx.fillStyle = i % 3 === 0 ? 'rgba(34,211,238,0.62)' : i % 3 === 1 ? 'rgba(250,204,21,0.56)' : 'rgba(244,63,94,0.48)';
    for (let wy = by + 24; wy < HEIGHT - 90; wy += 24) {
      if (rand() > 0.35) {
        ctx.fillRect(bx + 12, wy, bw - 24, 4);
      }
    }
  }

  // Soft rain streaks
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.16)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 80; i++) {
    const rx = rand() * WIDTH;
    const ry = rand() * HEIGHT;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx - 8, ry + 36);
    ctx.stroke();
  }
  drawStageHaze(ctx, 'rgba(14, 116, 144, 0.36)', 0.25);
}

function paintLava(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#1c1012'],
    [0.35, '#451412'],
    [0.72, '#9a2815'],
    [1, '#ea580c'],
  ]);
  drawRadialGlow(ctx, WIDTH * 0.5, HEIGHT * 0.72, 540, 'rgba(251,146,60,0.68)', 'rgba(251,146,60,0)');

  // Distant volcanic peaks
  drawMountainBand(ctx, 595, 165, 2.3, 0.4, '#361310', 0.45);
  drawMountainBand(ctx, 685, 130, 3.1, 1.8, '#230d0b', 0.42);

  // Glowing lava rivers snaking down slopes
  ctx.strokeStyle = '#fb923c';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(295, 455);
  ctx.bezierCurveTo(320, 560, 265, 640, 345, 820);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(1275, 445);
  ctx.bezierCurveTo(1250, 550, 1310, 640, 1230, 820);
  ctx.stroke();

  // Foreground dark basalt ridge
  drawMountainBand(ctx, 795, 68, 3.8, 0.9, '#160908', 0.48);

  // Rising glowing embers
  for (let i = 0; i < 65; i++) {
    const ex = rand() * WIDTH;
    const ey = 120 + rand() * 720;
    const er = 3 + rand() * 7;
    drawRadialGlow(ctx, ex, ey, er * 2.4, 'rgba(253,224,71,0.85)', 'rgba(249,115,22,0)');
  }
  drawStageHaze(ctx, 'rgba(234, 88, 12, 0.34)', 0.22);
}

function paintIce(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#0c2340'],
    [0.36, '#155e75'],
    [0.72, '#7dd3fc'],
    [1, '#e0f2fe'],
  ]);

  // Sweeping Aurora Borealis ribbons
  ctx.save();
  for (let r = 0; r < 3; r++) {
    const g = ctx.createLinearGradient(0, 110 + r * 45, WIDTH, 260 + r * 40);
    g.addColorStop(0, 'rgba(52,211,153,0)');
    g.addColorStop(0.35, 'rgba(52,211,153,0.34)');
    g.addColorStop(0.65, 'rgba(56,189,248,0.34)');
    g.addColorStop(1, 'rgba(167,139,250,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 210 + r * 35);
    ctx.bezierCurveTo(420, 90 + r * 30, 1080, 280 + r * 20, WIDTH, 140 + r * 35);
    ctx.lineTo(WIDTH, 250 + r * 35);
    ctx.bezierCurveTo(1080, 370 + r * 20, 420, 190 + r * 30, 0, 300 + r * 35);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  drawMountainBand(ctx, 630, 175, 2.7, 0.6, '#93c5fd', 0.58);
  drawMountainBand(ctx, 705, 130, 3.4, 2.1, '#bae6fd', 0.52);
  drawRollingHills(ctx, 795, 42, 2.2, 0.7, '#f0f9ff');

  // Translucent glacier crystals on edges
  const icePeaks = [
    [70, 820, 130, 260],
    [185, 830, 95, 190],
    [1345, 830, 105, 210],
    [1465, 820, 135, 275],
  ];
  for (const [ix, iy, iw, ih] of icePeaks) {
    ctx.fillStyle = 'rgba(125, 211, 252, 0.72)';
    ctx.beginPath();
    ctx.moveTo(ix - iw / 2, iy);
    ctx.lineTo(ix, iy - ih);
    ctx.lineTo(ix + iw / 2, iy);
    ctx.closePath();
    ctx.fill();
  }

  drawStars(ctx, rand, 70, HEIGHT * 0.85, '#ffffff');
  drawStageHaze(ctx, 'rgba(240, 249, 255, 0.8)', 0.25);
}

function paintDesert(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#4b86b4'],
    [0.36, '#9ec5d6'],
    [0.68, '#f6bd72'],
    [1, '#fde68a'],
  ]);
  drawRadialGlow(ctx, WIDTH * 0.54, HEIGHT * 0.44, 380, 'rgba(255,248,220,0.9)', 'rgba(251,191,36,0)');

  // Distant sandstone mesas
  ctx.fillStyle = 'rgba(180, 98, 52, 0.48)';
  ctx.beginPath();
  ctx.moveTo(90, 620);
  ctx.lineTo(140, 490);
  ctx.lineTo(310, 490);
  ctx.lineTo(360, 620);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(1180, 620);
  ctx.lineTo(1235, 465);
  ctx.lineTo(1430, 465);
  ctx.lineTo(1490, 620);
  ctx.closePath();
  ctx.fill();

  // Golden sweeping sand dunes
  drawRollingHills(ctx, 645, 55, 1.8, 0.5, '#eab364');
  drawRollingHills(ctx, 725, 48, 2.3, 2.1, '#d98c3e');
  drawRollingHills(ctx, 810, 38, 2.9, 0.9, '#c26f27');

  // Warm floating dust sparkles
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = 'rgba(254, 243, 199, 0.6)';
    ctx.beginPath();
    ctx.arc(rand() * WIDTH, 360 + rand() * 480, 1.5 + rand() * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  drawStageHaze(ctx, 'rgba(254, 243, 199, 0.68)', 0.24);
}

function paintCandy(ctx: CanvasRenderingContext2D, rand: () => number) {
  fillSky(ctx, [
    [0, '#f9a8d4'],
    [0.36, '#fbcfe8'],
    [0.68, '#ddd6fe'],
    [1, '#ccfbf1'],
  ]);

  // Pastel rainbow arc
  ctx.save();
  ctx.globalAlpha = 0.28;
  const rainbow = ['#fb7185', '#fbbf24', '#4ade80', '#38bdf8', '#c084fc'];
  rainbow.forEach((c, idx) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(WIDTH * 0.5, HEIGHT * 0.86, 560 - idx * 14, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  });
  ctx.restore();

  drawCloudPuff(ctx, 250, 195, 190, '#fff5fa', 0.86);
  drawCloudPuff(ctx, 1340, 185, 210, '#fff5fa', 0.86);

  // Frosted hills
  drawRollingHills(ctx, 650, 58, 2.0, 0.5, '#f9a8d4');
  drawRollingHills(ctx, 735, 48, 2.7, 1.9, '#f472b6');
  drawRollingHills(ctx, 810, 36, 3.1, 0.4, '#6ee7b7');

  // Giant lollipops on sides
  const pops = [
    [145, 500, 56, '#f43f5e'],
    [255, 580, 42, '#38bdf8'],
    [1345, 565, 46, '#a855f7'],
    [1465, 490, 58, '#fb7185'],
  ] as const;
  for (const [lx, ly, lr, lc] of pops) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(lx - 5, ly, 10, 340);
    ctx.fillStyle = lc;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(lx, ly, lr * 0.58, 0, Math.PI * 1.5);
    ctx.stroke();
  }

  drawStars(ctx, rand, 45, HEIGHT * 0.7, '#ffffff');
  drawStageHaze(ctx, 'rgba(255, 241, 248, 0.72)', 0.25);
}

function paintBackrooms(ctx: CanvasRenderingContext2D, _rand: () => number) {
  fillSky(ctx, [
    [0, '#4f4627'],
    [0.45, '#8c7e4c'],
    [0.82, '#695c34'],
    [1, '#3d351d'],
  ]);

  // Architectural corridor vanishing toward center-top
  const vx = WIDTH * 0.5;
  const vy = HEIGHT * 0.46;

  // Side walls converging in perspective
  ctx.fillStyle = '#a89962';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(vx - 260, vy - 140);
  ctx.lineTo(vx - 260, vy + 180);
  ctx.lineTo(0, HEIGHT);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(WIDTH, 0);
  ctx.lineTo(vx + 260, vy - 140);
  ctx.lineTo(vx + 260, vy + 180);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();

  // Wallpaper vertical stripes
  ctx.strokeStyle = 'rgba(72, 62, 32, 0.22)';
  ctx.lineWidth = 3;
  for (let x = 40; x < WIDTH; x += 44) {
    if (x > vx - 250 && x < vx + 250) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }

  // Fluorescent ceiling panels
  const lights = [
    [WIDTH * 0.26, 75, 180, 46],
    [WIDTH * 0.5, 95, 160, 42],
    [WIDTH * 0.74, 75, 180, 46],
    [WIDTH * 0.5, 200, 108, 28],
  ];
  for (const [lx, ly, lw, lh] of lights) {
    drawRadialGlow(ctx, lx, ly + lh / 2, lw * 1.1, 'rgba(255,247,205,0.45)', 'rgba(255,247,205,0)');
    ctx.fillStyle = '#fef9c3';
    ctx.fillRect(lx - lw / 2, ly, lw, lh);
  }

  // Far hallway archway silhouettes
  ctx.fillStyle = '#5c502b';
  ctx.fillRect(vx - 260, vy - 140, 520, 320);
  ctx.fillStyle = '#332c16';
  ctx.fillRect(vx - 95, vy - 75, 190, 255);

  drawStageHaze(ctx, 'rgba(66, 58, 30, 0.58)', 0.3);
}

const PAINTERS: Record<ThemeId, (ctx: CanvasRenderingContext2D, rand: () => number) => void> = {
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

export function getBiomeBackdropUrl(theme: ThemeId): string {
  const cached = BACKDROP_CACHE.get(theme);
  if (cached) return cached;

  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  let seed = 1337;
  for (let i = 0; i < theme.length; i++) {
    seed = (seed * 31 + theme.charCodeAt(i)) | 0;
  }
  const rand = mulberry32(seed);
  const paint = PAINTERS[theme] ?? paintCozy;
  paint(ctx, rand);
  drawSubtleGrain(ctx, rand, 0.025);

  const url = canvas.toDataURL('image/jpeg', 0.9);
  BACKDROP_CACHE.set(theme, url);
  return url;
}
