/**
 * Level Kit: shared helpers to build platforming levels quickly and consistently
 * (platform registration, checkpoints, moving/crumbling pads, updrafts, trampolines,
 * collectibles and per-frame decor animators). Used by the cosmic and swamp levels.
 */
import * as THREE from 'three';
import { EnemyManager } from './enemies';
import {
  BouncyMushroomModel,
  CollectibleModel,
  createCheckpointShrine,
  createCollectible,
  createUpdraftVortex,
  createVictoryPortal,
  VictoryPortalModel,
} from './models';
import { applyCrumblingTexture, ProceduralTextures } from './textures';
import { CheckpointItem, PlatformItem, SolidObstacleCollider, WorldBuildResult } from './levels';
import { ItemSpot } from './items';

export type Animator = (dt: number, time: number) => void;

/** Recolors every basic (unlit) material inside an object — used to tint updraft swirls etc. */
export function tintBasicMaterials(obj: THREE.Object3D, color: number) {
  obj.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    const mats = Array.isArray(m) ? m : m ? [m] : [];
    for (const mat of mats) {
      if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial || (mat as THREE.PointsMaterial).isPointsMaterial) {
        (mat as THREE.MeshBasicMaterial).color.set(color);
      }
    }
  });
}

/** Simple radial-gradient canvas texture (glows, nebulae, halos). */
export function makeGlowTexture(inner: string, outer: string = 'rgba(0,0,0,0)', size = 128): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft vertical gradient for light beams: fades to 0 at bottom and top to avoid hard clipping. */
export function makeVerticalGradientTexture(colorHex: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const col = new THREE.Color(colorHex);
  const r = Math.round(col.r * 255);
  const g = Math.round(col.g * 255);
  const b = Math.round(col.b * 255);
  const grad = ctx.createLinearGradient(0, 256, 0, 0); // bottom to top
  grad.addColorStop(0.0, `rgba(${r},${g},${b},0)`);
  grad.addColorStop(0.08, `rgba(${r},${g},${b},0.45)`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},0.35)`);
  grad.addColorStop(0.75, `rgba(${r},${g},${b},0.12)`);
  grad.addColorStop(1.0, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLevelKit(root: THREE.Object3D, textures: ProceduralTextures) {
  const platforms: PlatformItem[] = [];
  const checkpoints: CheckpointItem[] = [];
  const collectibles: CollectibleModel[] = [];
  const solidObstacles: SolidObstacleCollider[] = [];
  const decorativeMeshes: THREE.Object3D[] = [];
  const animators: Animator[] = [];

  function registerCylinder(name: string, x: number, y: number, z: number, radius: number, height: number) {
    solidObstacles.push({ name, type: 'cylinder', position: new THREE.Vector3(x, y, z), radius, height, bottomY: y, topY: y + height });
  }

  function addCheckpoint(id: number, name: string, shrinePos: THREE.Vector3, spawn: THREE.Vector3, active = false) {
    const shrine = createCheckpointShrine(textures);
    shrine.group.position.copy(shrinePos);
    if (active) shrine.activate();
    root.add(shrine.group);
    checkpoints.push({ id, name, spawnPos: spawn, shrine });
    registerCylinder(`shrine_${id}_pl`, shrinePos.x + 0.65, shrinePos.y, shrinePos.z, 0.22, 2.5);
    registerCylinder(`shrine_${id}_pr`, shrinePos.x - 0.65, shrinePos.y, shrinePos.z, 0.22, 2.5);
    registerCylinder(`shrine_${id}_bell`, shrinePos.x, shrinePos.y, shrinePos.z, 0.42, 2.0);
  }

  /**
   * Registers a walkable box (top surface at y). `build` adds the visuals to a group placed at the top center.
   */
  function addPlatform(
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number,
    build: (g: THREE.Group, w: number, d: number, h: number) => void
  ): PlatformItem {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    build(group, w, d, h);
    root.add(group);
    const plat: PlatformItem = {
      id,
      type: 'static',
      position: new THREE.Vector3(x, y, z),
      size: new THREE.Vector3(w, h, d),
      mesh: group,
      originalY: y,
    };
    platforms.push(plat);
    return plat;
  }

  function makeMoving(plat: PlatformItem, axis: 'x' | 'y' | 'z', amplitude: number, speed: number, offset = 0) {
    plat.type = 'moving';
    plat.initialPos = plat.position.clone();
    plat.movement = { axis, amplitude, speed, offset };
  }

  function makeCrumbling(plat: PlatformItem) {
    plat.type = 'crumbling';
    plat.crumbleTimer = 1.6;
    plat.isCrumbling = false;
    applyCrumblingTexture(plat, textures);
  }

  function addUpdraft(id: string, x: number, y: number, z: number, height: number, size: number, tint?: number) {
    const vortex = createUpdraftVortex(size * 0.48, height);
    vortex.group.position.set(x, y, z);
    if (tint !== undefined) tintBasicMaterials(vortex.group, tint);
    root.add(vortex.group);
    platforms.push({
      id,
      type: 'updraft',
      position: new THREE.Vector3(x, y, z),
      size: new THREE.Vector3(size, height, size),
      mesh: vortex.group,
      updraftModel: vortex,
    });
  }

  /** A trampoline whose top sits 1.1 above the island surface at y (same tuning as the mushrooms). */
  function addBouncy(id: string, model: BouncyMushroomModel, x: number, y: number, z: number) {
    model.group.position.set(x, y, z);
    root.add(model.group);
    platforms.push({
      id,
      type: 'bouncy',
      position: new THREE.Vector3(x, y + 1.1, z),
      size: new THREE.Vector3(2.6, 0.8, 2.6),
      mesh: model.group,
      bouncyModel: model,
    });
  }

  function addCollectible(id: string, type: 'sun_crystal' | 'golden_acorn', x: number, y: number, z: number) {
    const c = createCollectible(id, type, new THREE.Vector3(x, y, z));
    collectibles.push(c);
    root.add(c.group);
  }

  function addDecor(obj: THREE.Object3D) {
    root.add(obj);
    decorativeMeshes.push(obj);
  }

  function finish(summitPosition: THREE.Vector3, enemyManager: EnemyManager, itemSpots: ItemSpot[], showcasePos?: THREE.Vector3): WorldBuildResult {
    const portal = createVictoryPortal(textures, summitPosition.clone(), 0x38bdf8);
    root.add(portal.group);

    return {
      platforms,
      checkpoints,
      collectibles,
      obstacles: [],
      rollingBalls: [],
      pinwheels: [],
      balanceLogs: [],
      steamVents: [],
      solidObstacles,
      decorativeMeshes,
      summitPosition,
      victoryPortal: portal,
      enemyManager,
      itemSpots,
      companionShowcasePos: showcasePos,
      levelUpdate: (dt, time) => {
        portal.update(dt, time);
        for (const a of animators) a(dt, time);
      },
    };
  }

  return {
    root,
    textures,
    platforms,
    animators,
    solidObstacles,
    registerCylinder,
    addCheckpoint,
    addPlatform,
    makeMoving,
    makeCrumbling,
    addUpdraft,
    addBouncy,
    addCollectible,
    addDecor,
    finish,
  };
}

export type LevelKit = ReturnType<typeof createLevelKit>;
