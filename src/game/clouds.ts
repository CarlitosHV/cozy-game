/**
 * Procedural Animated Background Clouds System
 * Multi-tiered cloud layers (Deep Cloud Sea below, mid-drift cumulus, high soaring cirrus)
 * moving at varying procedural speeds with subtle organic undulating bobbing,
 * providing immense height sensation and floating atmosphere.
 */
import * as THREE from 'three';
import { WeatherType } from '../audio/SoundtrackSynthesizer';

type CloudLayer = 'low_sea' | 'mid_drift' | 'high_sky';

interface CloudPuffDef {
  lx: number;
  ly: number;
  lz: number;
  sx: number;
  sy: number;
  sz: number;
  rotY: number;
}

interface CloudInstance {
  x: number;
  y: number;
  z: number;
  baseY: number;
  speedX: number;
  speedZ: number;
  bobFreq: number;
  bobAmp: number;
  bobPhase: number;
  puffAnimSpeed: number;
  boundRadius: number;
  layer: CloudLayer;
  puffs: CloudPuffDef[];
}

export class BackgroundCloudsSystem {
  public scene: THREE.Scene;
  private clouds: CloudInstance[] = [];
  private sharedGeom: THREE.SphereGeometry;
  private layerMaterials: Record<CloudLayer, THREE.MeshLambertMaterial>;
  private layerMeshes: Record<CloudLayer, THREE.InstancedMesh>;
  private isVisible = true;

  // Pre-allocated scratch objects for zero-GC animation & culling
  private readonly _colA = new THREE.Color();
  private readonly _colB = new THREE.Color();
  private readonly _mat4 = new THREE.Matrix4();
  private readonly _pos = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler();
  private readonly _scale = new THREE.Vector3();
  private readonly _cullSphere = new THREE.Sphere();

  // Bounding box for infinite wrap-around
  private bounds = {
    minX: -110,
    maxX: 120,
    minZ: -70,
    maxZ: 190,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.sharedGeom = new THREE.SphereGeometry(1, 7, 5);
    this.layerMaterials = {
      low_sea: new THREE.MeshLambertMaterial({ color: 0xfafcff, transparent: true, opacity: 0.85, flatShading: true }),
      mid_drift: new THREE.MeshLambertMaterial({ color: 0xfafcff, transparent: true, opacity: 0.92, flatShading: true }),
      high_sky: new THREE.MeshLambertMaterial({ color: 0xfafcff, transparent: true, opacity: 0.88, flatShading: true }),
    };

    // Max 8 puffs per cloud -> allocate exact capacity per layer
    const maxLow = 14 * 8;
    const maxMid = 18 * 8;
    const maxHigh = 12 * 8;
    this.layerMeshes = {
      low_sea: new THREE.InstancedMesh(this.sharedGeom, this.layerMaterials.low_sea, maxLow),
      mid_drift: new THREE.InstancedMesh(this.sharedGeom, this.layerMaterials.mid_drift, maxMid),
      high_sky: new THREE.InstancedMesh(this.sharedGeom, this.layerMaterials.high_sky, maxHigh),
    };

    for (const key of ['low_sea', 'mid_drift', 'high_sky'] as CloudLayer[]) {
      const im = this.layerMeshes[key];
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false; // We cull per-cloud before writing active instances into the buffer
      im.castShadow = false;
      im.receiveShadow = false;
      im.count = 0;
      this.scene.add(im);
    }

    this.createCloudLayers();
  }

  private createCloudLayers() {
    // 1. Low Cloud Sea (below archipelago: Y = -28 to -16)
    for (let i = 0; i < 14; i++) {
      const x = THREE.MathUtils.randFloat(this.bounds.minX, this.bounds.maxX);
      const z = THREE.MathUtils.randFloat(this.bounds.minZ, this.bounds.maxZ);
      const y = THREE.MathUtils.randFloat(-28, -16);
      const scale = THREE.MathUtils.randFloat(2.6, 4.2);
      const speedX = THREE.MathUtils.randFloat(0.4, 0.9);
      const speedZ = THREE.MathUtils.randFloat(0.2, 0.6);
      this.spawnCloud(x, y, z, scale, speedX, speedZ, 'low_sea');
    }

    // 2. Mid-Altitude Drifters (Y = 4 to 34)
    for (let i = 0; i < 18; i++) {
      const x = THREE.MathUtils.randFloat(this.bounds.minX, this.bounds.maxX);
      const z = THREE.MathUtils.randFloat(this.bounds.minZ, this.bounds.maxZ);
      const y = THREE.MathUtils.randFloat(4, 34);
      const scale = THREE.MathUtils.randFloat(1.2, 2.2);
      const speedX = THREE.MathUtils.randFloat(1.2, 2.4);
      const speedZ = THREE.MathUtils.randFloat(0.5, 1.4);
      this.spawnCloud(x, y, z, scale, speedX, speedZ, 'mid_drift');
    }

    // 3. High Sky Soaring Clouds (Y = 52 to 85)
    for (let i = 0; i < 12; i++) {
      const x = THREE.MathUtils.randFloat(this.bounds.minX, this.bounds.maxX);
      const z = THREE.MathUtils.randFloat(this.bounds.minZ, this.bounds.maxZ);
      const y = THREE.MathUtils.randFloat(52, 85);
      const scale = THREE.MathUtils.randFloat(2.8, 4.8);
      const speedX = THREE.MathUtils.randFloat(2.5, 4.5);
      const speedZ = THREE.MathUtils.randFloat(1.0, 2.2);
      this.spawnCloud(x, y, z, scale, speedX, speedZ, 'high_sky');
    }
  }

  private spawnCloud(
    x: number,
    y: number,
    z: number,
    scale: number,
    speedX: number,
    speedZ: number,
    layer: CloudLayer
  ) {
    const puffCount = THREE.MathUtils.randInt(5, 8);
    const puffs: CloudPuffDef[] = [];

    // Central puff
    const cr = 1.8 * scale;
    puffs.push({
      lx: 0,
      ly: 0,
      lz: 0,
      sx: cr * 1.2,
      sy: cr * 0.65,
      sz: cr,
      rotY: 0,
    });

    // Flanking billowing puffs
    for (let p = 0; p < puffCount - 1; p++) {
      const puffScale = scale * THREE.MathUtils.randFloat(0.7, 1.3);
      const pr = 1.4 * puffScale;
      const angle = (p / (puffCount - 1)) * Math.PI * 2 + Math.random() * 0.4;
      const dist = scale * THREE.MathUtils.randFloat(1.0, 2.4);
      puffs.push({
        lx: Math.cos(angle) * dist,
        ly: THREE.MathUtils.randFloat(-0.3, 0.5) * scale,
        lz: Math.sin(angle) * dist * 0.7,
        sx: pr * 1.1,
        sy: pr * 0.7,
        sz: pr,
        rotY: Math.random() * Math.PI,
      });
    }

    this.clouds.push({
      x,
      y,
      z,
      baseY: y,
      speedX,
      speedZ,
      bobFreq: THREE.MathUtils.randFloat(0.4, 0.9),
      bobAmp: THREE.MathUtils.randFloat(0.3, 1.2),
      bobPhase: Math.random() * Math.PI * 2,
      puffAnimSpeed: THREE.MathUtils.randFloat(0.3, 0.8),
      boundRadius: scale * 4.5,
      layer,
      puffs,
    });
  }

  private static getTintHex(w: WeatherType): number {
    switch (w) {
      case 'golden_hour':
        return 0xffe9d6;
      case 'cozy_rain':
        return 0xa4b7c6;
      case 'sakura_breeze':
        return 0xffeef3;
      case 'starlit_night':
        return 0x223249;
      case 'cosmic':
        return 0x3a2d6b;
      case 'swamp_mist':
        return 0x4a5a4e;
      case 'castle_night':
        return 0x3b2a5c;
      case 'neon_night':
        return 0x4a1d7a;
      case 'cyber_storm':
        return 0x163038;
      case 'lava_ash':
        return 0x5c2b24;
      case 'blizzard':
        return 0xf0f9ff;
      case 'desert_sun':
        return 0xfff3d6;
      case 'candy_sky':
        return 0xffd6ec;
      case 'garden_day':
      case 'aero_day':
      default:
        return 0xffffff;
    }
  }

  private static getSpeedFactor(w: WeatherType): number {
    if (w === 'cozy_rain' || w === 'cyber_storm' || w === 'blizzard') return 1.55;
    if (w === 'sakura_breeze' || w === 'neon_night' || w === 'lava_ash') return 1.25;
    return 1.0;
  }

  /**
   * Procedural animation loop to move background clouds at varying speeds,
   * with harmonic vertical undulation, puff breathing, seamless coordinate wrapping,
   * and per-cloud frustum + distance culling when frustum/camera are provided.
   */
  public animate(
    dt: number,
    time: number,
    currentWeather: WeatherType,
    targetWeather?: WeatherType,
    transitionProgress: number = 1.0,
    frustum?: THREE.Frustum | null,
    camPos?: THREE.Vector3 | null,
    maxDistSq?: number
  ) {
    const isTrans = targetWeather !== undefined && targetWeather !== currentWeather && transitionProgress < 1.0;

    const speedFactorA = BackgroundCloudsSystem.getSpeedFactor(currentWeather);
    const speedFactorB = targetWeather ? BackgroundCloudsSystem.getSpeedFactor(targetWeather) : speedFactorA;
    const weatherSpeedFactor = isTrans
      ? THREE.MathUtils.lerp(speedFactorA, speedFactorB, transitionProgress)
      : speedFactorA;

    this._colA.setHex(BackgroundCloudsSystem.getTintHex(currentWeather));
    if (isTrans && targetWeather) {
      this._colB.setHex(BackgroundCloudsSystem.getTintHex(targetWeather));
      this._colA.lerp(this._colB, transitionProgress);
    }

    const lerpRate = Math.min(1, dt * 3.0);
    this.layerMaterials.low_sea.color.lerp(this._colA, lerpRate);
    this.layerMaterials.mid_drift.color.lerp(this._colA, lerpRate);
    this.layerMaterials.high_sky.color.lerp(this._colA, lerpRate);

    const { minX, maxX, minZ, maxZ } = this.bounds;
    const widthX = maxX - minX;
    const widthZ = maxZ - minZ;

    let lowIdx = 0;
    let midIdx = 0;
    let highIdx = 0;

    const doCull = this.isVisible && frustum != null && camPos != null && maxDistSq !== undefined;

    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];

      // 1. Procedural translation with varying individual speeds & wind multiplier
      c.x += c.speedX * weatherSpeedFactor * dt;
      c.z += c.speedZ * weatherSpeedFactor * dt;

      // 2. Seamless coordinate wrapping around world boundaries
      if (c.x > maxX) c.x -= widthX;
      else if (c.x < minX) c.x += widthX;

      if (c.z > maxZ) c.z -= widthZ;
      else if (c.z < minZ) c.z += widthZ;

      // Skip GPU matrix writes if clouds are hidden (e.g. title lobby)
      if (!this.isVisible) continue;

      // 3. Harmonic vertical bobbing
      c.y = c.baseY + Math.sin(time * c.bobFreq + c.bobPhase) * c.bobAmp;

      // 4. Distance + frustum culling: do not emit polygons for off-screen / out-of-range clouds
      if (doCull) {
        const dx = c.x - camPos.x;
        const dy = c.y - camPos.y;
        const dz = c.z - camPos.z;
        const maxR = Math.sqrt(maxDistSq) + c.boundRadius + 30;
        if (dx * dx + dy * dy + dz * dz > maxR * maxR) continue;

        this._cullSphere.center.set(c.x, c.y, c.z);
        this._cullSphere.radius = c.boundRadius;
        if (!frustum.intersectsSphere(this._cullSphere)) continue;
      }

      const puffPulse = 1.0 + Math.sin(time * c.puffAnimSpeed + c.bobPhase) * 0.04;
      const puffY = 1.0 + Math.cos(time * c.puffAnimSpeed + c.bobPhase) * 0.03;
      const targetMesh = this.layerMeshes[c.layer];

      for (let p = 0; p < c.puffs.length; p++) {
        const pf = c.puffs[p];
        this._pos.set(c.x + pf.lx * puffPulse, c.y + pf.ly * puffY, c.z + pf.lz * puffPulse);
        this._quat.setFromEuler(this._euler.set(0, pf.rotY, 0));
        this._scale.set(pf.sx * puffPulse, pf.sy * puffY, pf.sz * puffPulse);
        this._mat4.compose(this._pos, this._quat, this._scale);

        if (c.layer === 'low_sea') targetMesh.setMatrixAt(lowIdx++, this._mat4);
        else if (c.layer === 'mid_drift') targetMesh.setMatrixAt(midIdx++, this._mat4);
        else targetMesh.setMatrixAt(highIdx++, this._mat4);
      }
    }

    if (this.isVisible) {
      this.layerMeshes.low_sea.count = lowIdx;
      this.layerMeshes.low_sea.visible = lowIdx > 0;
      if (lowIdx > 0) this.layerMeshes.low_sea.instanceMatrix.needsUpdate = true;

      this.layerMeshes.mid_drift.count = midIdx;
      this.layerMeshes.mid_drift.visible = midIdx > 0;
      if (midIdx > 0) this.layerMeshes.mid_drift.instanceMatrix.needsUpdate = true;

      this.layerMeshes.high_sky.count = highIdx;
      this.layerMeshes.high_sky.visible = highIdx > 0;
      if (highIdx > 0) this.layerMeshes.high_sky.instanceMatrix.needsUpdate = true;
    }
  }

  public setVisible(visible: boolean) {
    this.isVisible = visible;
    if (!visible) {
      this.layerMeshes.low_sea.visible = false;
      this.layerMeshes.mid_drift.visible = false;
      this.layerMeshes.high_sky.visible = false;
    }
  }

  public dispose() {
    for (const key of ['low_sea', 'mid_drift', 'high_sky'] as CloudLayer[]) {
      this.scene.remove(this.layerMeshes[key]);
      this.layerMeshes[key].dispose();
      this.layerMaterials[key].dispose();
    }
    this.sharedGeom.dispose();
    this.clouds = [];
  }
}
