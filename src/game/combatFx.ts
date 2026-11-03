/**
 * Small visual effects for boss fights: telegraph circles on the ground (where an attack
 * will land), expanding shockwave rings, puffs, explosions and the aim reticle.
 * Effects are plain objects the combat system ticks every frame until they finish.
 */
import * as THREE from 'three';
import { makeGlowTexture } from './levelKit';

export interface Effect {
  obj: THREE.Object3D;
  t: number;
  dur: number;
  /** k goes 0 → 1 over the effect's life */
  tick: (k: number, dt: number) => void;
}

/** A red disc that fills up until the attack lands. Call `set(k)` with 0 → 1. */
export interface Telegraph {
  group: THREE.Group;
  set: (k: number) => void;
}

export function makeTelegraph(radius: number, color = 0xef4444): Telegraph {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.9, radius, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const fillMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false });
  const fill = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.9, 40), fillMat);
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.01;
  group.add(fill);
  group.renderOrder = 2;
  return {
    group,
    set: (k: number) => {
      const s = Math.max(0.02, Math.min(1, k));
      fill.scale.setScalar(s);
      fillMat.opacity = 0.2 + 0.35 * s;
    },
  };
}

/** Flat ring mesh used by shockwaves (scaled to the wave radius). */
export function makeWaveRing(color: number, height = 0.6): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, height, 48, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  m.geometry.translate(0, height / 2, 0);
  return m;
}

/** Expanding glow ball that fades (puffs, explosions, hit sparks). */
export function puffEffect(root: THREE.Object3D, pos: THREE.Vector3, color: string, size: number, dur = 0.5): Effect {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makeGlowTexture(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  sprite.position.copy(pos);
  sprite.scale.setScalar(size * 0.3);
  root.add(sprite);
  return {
    obj: sprite,
    t: 0,
    dur,
    tick: (k) => {
      sprite.scale.setScalar(size * (0.3 + 0.7 * k));
      sprite.material.opacity = 1 - k;
    },
  };
}

/** Bits flying outwards (shattered clones, bones, rocks). */
export function burstEffect(root: THREE.Object3D, pos: THREE.Vector3, material: THREE.Material, count = 10, size = 0.18, speed = 5, dur = 0.9): Effect {
  const group = new THREE.Group();
  group.position.copy(pos);
  const parts: { m: THREE.Mesh; v: THREE.Vector3 }[] = [];
  const geo = new THREE.BoxGeometry(size, size, size);
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, material);
    const a = (i / count) * Math.PI * 2;
    const v = new THREE.Vector3(Math.cos(a) * speed * (0.6 + Math.random() * 0.6), speed * (0.6 + Math.random()), Math.sin(a) * speed * (0.6 + Math.random() * 0.6));
    group.add(m);
    parts.push({ m, v });
  }
  root.add(group);
  return {
    obj: group,
    t: 0,
    dur,
    tick: (k, dt) => {
      for (const p of parts) {
        p.v.y -= 18 * dt;
        p.m.position.addScaledVector(p.v, dt);
        p.m.rotation.x += dt * 8;
        p.m.rotation.y += dt * 6;
        p.m.scale.setScalar(Math.max(0.05, 1 - k));
      }
    },
  };
}

/** The aim marker drawn on the target the next throw will go to. */
export function makeReticle(color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = color;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(64, 64, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 7;
  for (const [x0, y0, x1, y1] of [
    [64, 4, 64, 30],
    [64, 98, 64, 124],
    [4, 64, 30, 64],
    [98, 64, 124, 64],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(64, 64, 7, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.renderOrder = 20;
  s.visible = false;
  return s;
}

/** Floating text label (e.g. "¡Ayuda!" over a grabbed friend). */
export function makeLabel(text: string, bg = 'rgba(220,38,38,0.92)'): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 56, 28);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(1.6, 0.4, 1);
  s.renderOrder = 15;
  return s;
}
