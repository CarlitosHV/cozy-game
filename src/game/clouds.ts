/**
 * Procedural Animated Background Clouds System
 * Multi-tiered cloud layers (Deep Cloud Sea below, mid-drift cumulus, high soaring cirrus)
 * moving at varying procedural speeds with subtle organic undulating bobbing,
 * providing immense height sensation and floating atmosphere.
 */
import * as THREE from 'three';
import { WeatherType } from '../audio/SoundtrackSynthesizer';

interface CloudInstance {
  group: THREE.Group;
  puffs: THREE.Mesh[];
  baseY: number;
  speedX: number;
  speedZ: number;
  bobFreq: number;
  bobAmp: number;
  bobPhase: number;
  puffAnimSpeed: number;
  layer: 'low_sea' | 'mid_drift' | 'high_sky';
}

export class BackgroundCloudsSystem {
  public scene: THREE.Scene;
  private clouds: CloudInstance[] = [];
  private cloudMaterials: THREE.MeshStandardMaterial[] = [];

  // Bounding box for infinite wrap-around
  private bounds = {
    minX: -110,
    maxX: 120,
    minZ: -70,
    maxZ: 190,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createCloudLayers();
  }

  private createCloudLayers() {
    // 1. Low Cloud Sea (below archipelago: Y = -30 to -16)
    // 14 large, expansive, slow-rolling cloud banks
    for (let i = 0; i < 14; i++) {
      const x = THREE.MathUtils.randFloat(this.bounds.minX, this.bounds.maxX);
      const z = THREE.MathUtils.randFloat(this.bounds.minZ, this.bounds.maxZ);
      const y = THREE.MathUtils.randFloat(-28, -16);
      const scale = THREE.MathUtils.randFloat(2.6, 4.2);
      // Low clouds drift slowly and majestically
      const speedX = THREE.MathUtils.randFloat(0.4, 0.9);
      const speedZ = THREE.MathUtils.randFloat(0.2, 0.6);

      this.spawnCloud(x, y, z, scale, speedX, speedZ, 'low_sea', 0.85);
    }

    // 2. Mid-Altitude Drifters (Y = 4 to 34)
    // 18 medium stylized fluffy clouds passing close to and around the islands
    for (let i = 0; i < 18; i++) {
      const x = THREE.MathUtils.randFloat(this.bounds.minX, this.bounds.maxX);
      const z = THREE.MathUtils.randFloat(this.bounds.minZ, this.bounds.maxZ);
      const y = THREE.MathUtils.randFloat(4, 34);
      const scale = THREE.MathUtils.randFloat(1.2, 2.2);
      // Medium speed
      const speedX = THREE.MathUtils.randFloat(1.2, 2.4);
      const speedZ = THREE.MathUtils.randFloat(0.5, 1.4);

      this.spawnCloud(x, y, z, scale, speedX, speedZ, 'mid_drift', 0.92);
    }

    // 3. High Sky Soaring Clouds (Y = 52 to 85)
    // 12 lofty distant clouds sailing across the upper troposphere
    for (let i = 0; i < 12; i++) {
      const x = THREE.MathUtils.randFloat(this.bounds.minX, this.bounds.maxX);
      const z = THREE.MathUtils.randFloat(this.bounds.minZ, this.bounds.maxZ);
      const y = THREE.MathUtils.randFloat(52, 85);
      const scale = THREE.MathUtils.randFloat(2.8, 4.8);
      // Higher clouds move faster due to upper winds
      const speedX = THREE.MathUtils.randFloat(2.5, 4.5);
      const speedZ = THREE.MathUtils.randFloat(1.0, 2.2);

      this.spawnCloud(x, y, z, scale, speedX, speedZ, 'high_sky', 0.88);
    }
  }

  private spawnCloud(
    x: number,
    y: number,
    z: number,
    scale: number,
    speedX: number,
    speedZ: number,
    layer: 'low_sea' | 'mid_drift' | 'high_sky',
    opacity: number
  ) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Shared material per layer for batch efficiency
    const mat = new THREE.MeshStandardMaterial({
      color: 0xfafcff,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: opacity,
      flatShading: true,
    });
    this.cloudMaterials.push(mat);

    // Procedural composite cloud: 5 to 8 overlapping soft flattened spheres
    const puffCount = THREE.MathUtils.randInt(5, 8);
    const puffs: THREE.Mesh[] = [];

    // Central puff
    const centerGeom = new THREE.SphereGeometry(1.8 * scale, 8, 7);
    centerGeom.scale(1.2, 0.65, 1.0);
    const centerPuff = new THREE.Mesh(centerGeom, mat);
    centerPuff.castShadow = layer === 'mid_drift';
    group.add(centerPuff);
    puffs.push(centerPuff);

    // Flanking billowing puffs
    for (let p = 0; p < puffCount - 1; p++) {
      const puffScale = scale * THREE.MathUtils.randFloat(0.7, 1.3);
      const pGeom = new THREE.SphereGeometry(1.4 * puffScale, 7, 6);
      pGeom.scale(1.1, 0.7, 1.0);
      const puff = new THREE.Mesh(pGeom, mat);

      const angle = (p / (puffCount - 1)) * Math.PI * 2 + Math.random() * 0.4;
      const dist = scale * THREE.MathUtils.randFloat(1.0, 2.4);
      puff.position.set(
        Math.cos(angle) * dist,
        THREE.MathUtils.randFloat(-0.3, 0.5) * scale,
        Math.sin(angle) * dist * 0.7
      );
      puff.rotation.y = Math.random() * Math.PI;
      group.add(puff);
      puffs.push(puff);
    }

    this.scene.add(group);

    this.clouds.push({
      group,
      puffs,
      baseY: y,
      speedX,
      speedZ,
      bobFreq: THREE.MathUtils.randFloat(0.4, 0.9),
      bobAmp: THREE.MathUtils.randFloat(0.3, 1.2),
      bobPhase: Math.random() * Math.PI * 2,
      puffAnimSpeed: THREE.MathUtils.randFloat(0.3, 0.8),
      layer,
    });
  }

  /**
   * Procedural animation loop to move background clouds at varying speeds,
   * with harmonic vertical undulation, puff breathing, and seamless coordinate wrapping.
   * Smoothly interpolates cloud tint, roughness, and wind speeds during weather transitions.
   */
  public animate(
    dt: number,
    time: number,
    currentWeather: WeatherType,
    targetWeather?: WeatherType,
    transitionProgress: number = 1.0
  ) {
    const isTrans = targetWeather !== undefined && targetWeather !== currentWeather && transitionProgress < 1.0;

    const getSpeedFactor = (w: WeatherType) => (w === 'cozy_rain' ? 1.5 : w === 'sakura_breeze' ? 1.25 : 1.0);
    const speedFactorA = getSpeedFactor(currentWeather);
    const speedFactorB = targetWeather ? getSpeedFactor(targetWeather) : speedFactorA;
    const weatherSpeedFactor = isTrans
      ? THREE.MathUtils.lerp(speedFactorA, speedFactorB, transitionProgress)
      : speedFactorA;

    // Adjust cloud tint dynamically to fit the ambient weather lighting
    const getTint = (w: WeatherType): { color: number; roughness: number } => {
      switch (w) {
        case 'golden_hour':
          return { color: 0xffe9d6, roughness: 0.95 }; // Warm golden peach sunset tint
        case 'cozy_rain':
          return { color: 0xa4b7c6, roughness: 0.8 }; // Soft slate silver rain clouds
        case 'sakura_breeze':
          return { color: 0xffeef3, roughness: 0.95 }; // Delicate pastel cherry blossom blush
        case 'starlit_night':
          return { color: 0x223249, roughness: 0.95 }; // Deep moonlit indigo night clouds
        case 'cosmic':
          return { color: 0x3a2d6b, roughness: 0.9 }; // Faint violet nebula puffs
        case 'swamp_mist':
          return { color: 0x4a5a4e, roughness: 0.95 }; // Murky swamp fog banks
        case 'aero_day':
        default:
          return { color: 0xffffff, roughness: 0.6 }; // Bright glossy white Aero clouds
      }
    };

    const tintA = getTint(currentWeather);
    const tintB = targetWeather ? getTint(targetWeather) : tintA;

    const colObjA = new THREE.Color(tintA.color);
    const colObjB = new THREE.Color(tintB.color);
    const blendedColor = isTrans ? colObjA.lerp(colObjB, transitionProgress) : colObjA;
    const blendedRoughness = isTrans
      ? THREE.MathUtils.lerp(tintA.roughness, tintB.roughness, transitionProgress)
      : tintA.roughness;

    for (const mat of this.cloudMaterials) {
      mat.color.lerp(blendedColor, dt * 3.0);
      mat.roughness = THREE.MathUtils.lerp(mat.roughness, blendedRoughness, dt * 3.0);
    }

    const { minX, maxX, minZ, maxZ } = this.bounds;
    const widthX = maxX - minX;
    const widthZ = maxZ - minZ;

    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];

      // 1. Procedural translation with varying individual speeds & wind multiplier
      c.group.position.x += c.speedX * weatherSpeedFactor * dt;
      c.group.position.z += c.speedZ * weatherSpeedFactor * dt;

      // 2. Harmonic vertical bobbing for floating buoyancy sensation
      c.group.position.y = c.baseY + Math.sin(time * c.bobFreq + c.bobPhase) * c.bobAmp;

      // 3. Subtle organic puff breathing (slow gentle scale pulse)
      const puffPulse = 1.0 + Math.sin(time * c.puffAnimSpeed + c.bobPhase) * 0.04;
      c.group.scale.set(puffPulse, 1.0 + Math.cos(time * c.puffAnimSpeed + c.bobPhase) * 0.03, puffPulse);

      // 4. Seamless coordinate wrapping around world boundaries
      if (c.group.position.x > maxX) {
        c.group.position.x -= widthX;
      } else if (c.group.position.x < minX) {
        c.group.position.x += widthX;
      }

      if (c.group.position.z > maxZ) {
        c.group.position.z -= widthZ;
      } else if (c.group.position.z < minZ) {
        c.group.position.z += widthZ;
      }
    }
  }

  public dispose() {
    for (const c of this.clouds) {
      this.scene.remove(c.group);
      c.puffs.forEach((p) => {
        p.geometry.dispose();
      });
    }
    for (const mat of this.cloudMaterials) {
      mat.dispose();
    }
    this.clouds = [];
    this.cloudMaterials = [];
  }
}
