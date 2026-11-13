/**
 * Procedural Canvas-based Textures for Cozy Parkour World
 * Zero external images - 100% generated in-memory.
 */
import * as THREE from 'three';

export interface ProceduralTextures {
  grass: THREE.CanvasTexture;
  stone: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  mushroomCap: THREE.CanvasTexture;
  cloud: THREE.CanvasTexture;
  shadow: THREE.CanvasTexture;
  leaf: THREE.CanvasTexture;
  particleGlow: THREE.CanvasTexture;
  cracked: THREE.CanvasTexture;
}

export function createProceduralTextures(maxAnisotropy: number = 4): ProceduralTextures {
  // 1. Stylized Grassy Knolls Texture
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 512;
  grassCanvas.height = 512;
  const gCtx = grassCanvas.getContext('2d')!;
  
  // Base vibrant soft green gradient
  const gGrad = gCtx.createLinearGradient(0, 0, 512, 512);
  gGrad.addColorStop(0, '#78ba57');
  gGrad.addColorStop(0.5, '#6cad4b');
  gGrad.addColorStop(1, '#5d9e3d');
  gCtx.fillStyle = gGrad;
  gCtx.fillRect(0, 0, 512, 512);

  // Soft moss dappling
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 8;
    gCtx.fillStyle = Math.random() > 0.5 ? 'rgba(146, 219, 107, 0.45)' : 'rgba(74, 128, 48, 0.35)';
    gCtx.beginPath();
    gCtx.arc(x, y, r, 0, Math.PI * 2);
    gCtx.fill();
  }

  // Cute tiny pastel clover/daisy flowers
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * 512;
    const cy = Math.random() * 512;
    const flowerColor = Math.random() > 0.4 ? '#fff8dc' : '#ffd1dc';
    gCtx.fillStyle = flowerColor;
    for (let p = 0; p < 5; p++) {
      const angle = (p * Math.PI * 2) / 5;
      const px = cx + Math.cos(angle) * 3.5;
      const py = cy + Math.sin(angle) * 3.5;
      gCtx.beginPath();
      gCtx.arc(px, py, 2, 0, Math.PI * 2);
      gCtx.fill();
    }
    // Center dot
    gCtx.fillStyle = '#ffb703';
    gCtx.beginPath();
    gCtx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    gCtx.fill();
  }

  const grassTex = new THREE.CanvasTexture(grassCanvas);
  grassTex.wrapS = THREE.RepeatWrapping;
  grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.anisotropy = maxAnisotropy;

  // 2. Weathered Warm Stone Pavers
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 512;
  stoneCanvas.height = 512;
  const sCtx = stoneCanvas.getContext('2d')!;
  sCtx.fillStyle = '#9e978e';
  sCtx.fillRect(0, 0, 512, 512);

  // Stone tiles
  const tileSize = 64;
  sCtx.strokeStyle = '#686057';
  sCtx.lineWidth = 4;
  for (let y = 0; y < 512; y += tileSize) {
    const xOffset = ((y / tileSize) % 2) * (tileSize / 2);
    for (let x = -tileSize; x < 512 + tileSize; x += tileSize) {
      sCtx.fillStyle = (x + y) % 128 === 0 ? '#b2aaa0' : '#8e867d';
      sCtx.fillRect(x + xOffset + 2, y + 2, tileSize - 4, tileSize - 4);
      sCtx.strokeRect(x + xOffset + 2, y + 2, tileSize - 4, tileSize - 4);

      // Subtle moss patch on some edges
      if ((x * 7 + y * 13) % 5 === 0) {
        sCtx.fillStyle = 'rgba(108, 173, 75, 0.4)';
        sCtx.beginPath();
        sCtx.arc(x + xOffset + 12, y + 12, 10, 0, Math.PI * 2);
        sCtx.fill();
      }
    }
  }

  const stoneTex = new THREE.CanvasTexture(stoneCanvas);
  stoneTex.wrapS = THREE.RepeatWrapping;
  stoneTex.wrapT = THREE.RepeatWrapping;
  stoneTex.colorSpace = THREE.SRGBColorSpace;
  stoneTex.anisotropy = maxAnisotropy;

  // 3. Cozy Wood Plank Texture
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 512;
  woodCanvas.height = 512;
  const wCtx = woodCanvas.getContext('2d')!;
  wCtx.fillStyle = '#b07946';
  wCtx.fillRect(0, 0, 512, 512);

  const plankHeight = 64;
  for (let y = 0; y < 512; y += plankHeight) {
    // Plank tint
    wCtx.fillStyle = y % 128 === 0 ? '#bc834f' : '#a26d3b';
    wCtx.fillRect(0, y + 2, 512, plankHeight - 4);

    // Wood grain lines
    wCtx.strokeStyle = 'rgba(74, 44, 20, 0.25)';
    wCtx.lineWidth = 1.5;
    for (let l = 0; l < 6; l++) {
      const lineY = y + 8 + l * 8 + Math.sin(l) * 3;
      wCtx.beginPath();
      wCtx.moveTo(0, lineY);
      wCtx.bezierCurveTo(150, lineY + 4, 350, lineY - 4, 512, lineY + 2);
      wCtx.stroke();
    }

    // Groove border
    wCtx.fillStyle = '#5c3818';
    wCtx.fillRect(0, y, 512, 3);

    // Nails
    wCtx.fillStyle = '#3a2310';
    wCtx.beginPath();
    wCtx.arc(24, y + plankHeight / 2, 3, 0, Math.PI * 2);
    wCtx.arc(488, y + plankHeight / 2, 3, 0, Math.PI * 2);
    wCtx.fill();
  }

  const woodTex = new THREE.CanvasTexture(woodCanvas);
  woodTex.wrapS = THREE.RepeatWrapping;
  woodTex.wrapT = THREE.RepeatWrapping;
  woodTex.colorSpace = THREE.SRGBColorSpace;
  woodTex.anisotropy = maxAnisotropy;

  // 4. Mushroom Cap with Polka Dots
  const mushCanvas = document.createElement('canvas');
  mushCanvas.width = 256;
  mushCanvas.height = 256;
  const mCtx = mushCanvas.getContext('2d')!;
  
  // Warm coral-red base with gradient
  const mGrad = mCtx.createRadialGradient(128, 128, 10, 128, 128, 128);
  mGrad.addColorStop(0, '#ff7070');
  mGrad.addColorStop(0.7, '#f04343');
  mGrad.addColorStop(1, '#cb2c2c');
  mCtx.fillStyle = mGrad;
  mCtx.fillRect(0, 0, 256, 256);

  // Soft cream polka dots
  mCtx.fillStyle = '#fffdf5';
  const dots = [
    [128, 128, 22],
    [64, 64, 16],
    [192, 64, 15],
    [64, 192, 17],
    [192, 192, 16],
    [128, 50, 14],
    [128, 206, 14],
    [50, 128, 14],
    [206, 128, 14],
  ];
  for (const [dx, dy, dr] of dots) {
    mCtx.beginPath();
    mCtx.arc(dx, dy, dr, 0, Math.PI * 2);
    mCtx.fill();
  }

  const mushroomTex = new THREE.CanvasTexture(mushCanvas);
  mushroomTex.colorSpace = THREE.SRGBColorSpace;

  // 5. Cloud Puffs Texture
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 256;
  cloudCanvas.height = 256;
  const cCtx = cloudCanvas.getContext('2d')!;
  const cGrad = cCtx.createRadialGradient(128, 128, 0, 128, 128, 128);
  cGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  cGrad.addColorStop(0.6, 'rgba(240, 246, 255, 0.7)');
  cGrad.addColorStop(1, 'rgba(230, 240, 255, 0)');
  cCtx.fillStyle = cGrad;
  cCtx.fillRect(0, 0, 256, 256);

  const cloudTex = new THREE.CanvasTexture(cloudCanvas);

  // 6. Radial Soft Contact Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const shCtx = shadowCanvas.getContext('2d')!;
  const shGrad = shCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  shGrad.addColorStop(0, 'rgba(30, 25, 45, 0.65)');
  shGrad.addColorStop(0.5, 'rgba(30, 25, 45, 0.3)');
  shGrad.addColorStop(1, 'rgba(30, 25, 45, 0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 128, 128);

  const shadowTex = new THREE.CanvasTexture(shadowCanvas);

  // 7. Stylized Leaf Texture
  const leafCanvas = document.createElement('canvas');
  leafCanvas.width = 64;
  leafCanvas.height = 64;
  const lCtx = leafCanvas.getContext('2d')!;
  lCtx.fillStyle = 'rgba(255, 182, 193, 0.9)'; // Sakura petal
  lCtx.beginPath();
  lCtx.ellipse(32, 32, 14, 26, Math.PI / 4, 0, Math.PI * 2);
  lCtx.fill();

  const leafTex = new THREE.CanvasTexture(leafCanvas);
  leafTex.colorSpace = THREE.SRGBColorSpace;

  // 8. Soft Circular Particle Glow Texture (weather motes, pollen, fireflies, sparks)
  const partCanvas = document.createElement('canvas');
  partCanvas.width = 64;
  partCanvas.height = 64;
  const pCtx = partCanvas.getContext('2d')!;
  const pGrad = pCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
  pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  pGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.9)');
  pGrad.addColorStop(0.55, 'rgba(255, 255, 255, 0.45)');
  pGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.12)');
  pGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 64, 64);

  const particleGlowTex = new THREE.CanvasTexture(partCanvas);

  // 9. Cracked / Fractured Overlay Texture for fragile crumbling platforms
  const crackCanvas = document.createElement('canvas');
  crackCanvas.width = 512;
  crackCanvas.height = 512;
  const kCtx = crackCanvas.getContext('2d')!;
  kCtx.clearRect(0, 0, 512, 512);

  // Deterministic pseudo-random generator for clean, repeatable cracks
  let seed = 7919;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Subtle dusty fracture wash around fault lines
  kCtx.lineCap = 'round';
  kCtx.lineJoin = 'round';

  const drawJaggedCrack = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number,
    depth: number,
    highlight = true
  ) => {
    const segs = Math.max(4, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 24));
    const pts: [number, number][] = [[x1, y1]];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const jitter = (rand() - 0.5) * 26 * (1 - Math.abs(t - 0.5) * 0.6);
      pts.push([x1 + dx * t + nx * jitter, y1 + dy * t + ny * jitter]);
    }
    pts.push([x2, y2]);

    const strokePath = (ox: number, oy: number, w: number, color: string) => {
      kCtx.strokeStyle = color;
      kCtx.lineWidth = w;
      kCtx.beginPath();
      kCtx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
      for (let i = 1; i < pts.length; i++) {
        kCtx.lineTo(pts[i][0] + ox, pts[i][1] + oy);
      }
      kCtx.stroke();
    };

    if (highlight) {
      // Crisp pale chipped bevel beside main crack so fractures pop on dark AND bright surfaces
      strokePath(2.0, 2.0, width + 1.4, 'rgba(255, 245, 226, 0.42)');
    }
    strokePath(0, 0, width, 'rgba(22, 15, 11, 0.92)');

    // Spawn secondary branching hairline cracks
    if (depth > 0) {
      for (let i = 1; i < pts.length - 1; i++) {
        if (rand() < 0.58) {
          const [bx, by] = pts[i];
          const baseAng = Math.atan2(dy, dx) + (rand() > 0.5 ? 1 : -1) * (0.55 + rand() * 0.75);
          const bLen = (35 + rand() * 75) * (depth === 2 ? 1.0 : 0.65);
          drawJaggedCrack(
            bx,
            by,
            bx + Math.cos(baseAng) * bLen,
            by + Math.sin(baseAng) * bLen,
            Math.max(1.4, width * 0.55),
            depth - 1,
            depth === 2
          );
        }
      }
    }
  };

  // Primary fracture hubs radiating across the platform surface
  const hubs: [number, number][] = [
    [145, 155],
    [355, 185],
    [250, 355],
    [110, 405],
    [405, 395],
  ];

  // Cross-fault lines connecting hubs and breaking out to borders
  drawJaggedCrack(20, 45, 145, 155, 5.2, 2);
  drawJaggedCrack(145, 155, 355, 185, 5.5, 2);
  drawJaggedCrack(355, 185, 495, 110, 4.8, 2);
  drawJaggedCrack(145, 155, 250, 355, 5.0, 2);
  drawJaggedCrack(355, 185, 250, 355, 4.6, 1);
  drawJaggedCrack(250, 355, 405, 395, 5.0, 2);
  drawJaggedCrack(250, 355, 110, 405, 4.6, 2);
  drawJaggedCrack(110, 405, 18, 488, 4.2, 1);
  drawJaggedCrack(405, 395, 492, 482, 4.4, 1);
  drawJaggedCrack(255, 14, 240, 168, 4.0, 1);

  // Chipped triangular pits at main fracture junctions
  for (const [hx, hy] of hubs) {
    kCtx.fillStyle = 'rgba(18, 12, 9, 0.88)';
    kCtx.beginPath();
    const sides = 5;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2 + rand() * 0.4;
      const r = 6 + rand() * 8;
      const px = hx + Math.cos(a) * r;
      const py = hy + Math.sin(a) * r;
      if (s === 0) kCtx.moveTo(px, py);
      else kCtx.lineTo(px, py);
    }
    kCtx.closePath();
    kCtx.fill();
  }

  // Scattered small debris flecks / chipped crumbs
  for (let i = 0; i < 65; i++) {
    const cx = 18 + rand() * 476;
    const cy = 18 + rand() * 476;
    const sz = 1.6 + rand() * 3.8;
    kCtx.fillStyle = rand() > 0.35 ? 'rgba(26, 18, 13, 0.72)' : 'rgba(255, 242, 218, 0.38)';
    kCtx.fillRect(cx, cy, sz, sz * (0.6 + rand() * 0.8));
  }

  // Subtle chipped edge framing so players spot fragile borders from a distance
  kCtx.strokeStyle = 'rgba(24, 16, 12, 0.48)';
  kCtx.lineWidth = 6;
  kCtx.strokeRect(4, 4, 504, 504);

  const crackedTex = new THREE.CanvasTexture(crackCanvas);
  crackedTex.wrapS = THREE.RepeatWrapping;
  crackedTex.wrapT = THREE.RepeatWrapping;
  crackedTex.colorSpace = THREE.SRGBColorSpace;
  crackedTex.anisotropy = maxAnisotropy;

  return {
    grass: grassTex,
    stone: stoneTex,
    wood: woodTex,
    mushroomCap: mushroomTex,
    cloud: cloudTex,
    shadow: shadowTex,
    leaf: leafTex,
    particleGlow: particleGlowTex,
    cracked: crackedTex,
  };
}

/**
 * Attaches a crisp procedural broken/cracked visual overlay onto any crumbling platform.
 * Keeps each theme's base material while clearly telegraphing fragile falling platforms.
 */
export function applyCrumblingTexture(
  plat: { size: THREE.Vector3; mesh: THREE.Object3D; crumbleOverlayMat?: THREE.MeshStandardMaterial },
  textures: ProceduralTextures
) {
  if (plat.mesh.userData.hasCrumbleVisual) return;
  plat.mesh.userData.hasCrumbleVisual = true;

  const w = plat.size.x;
  const h = plat.size.y;
  const d = plat.size.z;
  const bandH = Math.min(Math.max(h + 0.015, 0.2), 0.44);

  const shellGeo = new THREE.BoxGeometry(w + 0.04, bandH, d + 0.04);
  // Tile UVs softly proportional to platform footprint without cloning the shared CanvasTexture
  const uv = shellGeo.getAttribute('uv') as THREE.BufferAttribute;
  const norm = shellGeo.getAttribute('normal') as THREE.BufferAttribute;
  const repX = Math.max(1, Math.round(w / 2.6));
  const repZ = Math.max(1, Math.round(d / 2.6));
  for (let i = 0; i < uv.count; i++) {
    const ny = Math.abs(norm.getY(i));
    if (ny > 0.5) {
      uv.setXY(i, uv.getX(i) * repX, uv.getY(i) * repZ);
    } else {
      const nx = Math.abs(norm.getX(i));
      uv.setXY(i, uv.getX(i) * (nx > 0.5 ? repZ : repX), uv.getY(i) * 0.55);
    }
  }
  uv.needsUpdate = true;

  const crackMat = new THREE.MeshStandardMaterial({
    map: textures.cracked,
    transparent: true,
    opacity: 0.96,
    roughness: 0.95,
    metalness: 0.0,
    emissive: new THREE.Color(0xff5a1f),
    emissiveIntensity: 0,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
    depthWrite: false,
  });

  const overlay = new THREE.Mesh(shellGeo, crackMat);
  overlay.position.y = -bandH / 2 + 0.015;
  overlay.renderOrder = 2;
  plat.mesh.add(overlay);
  plat.crumbleOverlayMat = crackMat;
}
