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

  return {
    grass: grassTex,
    stone: stoneTex,
    wood: woodTex,
    mushroomCap: mushroomTex,
    cloud: cloudTex,
    shadow: shadowTex,
    leaf: leafTex,
  };
}
