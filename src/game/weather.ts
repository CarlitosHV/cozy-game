/**
 * Atmospheric Weather & Particle Simulation
 * Procedural particles (Rain, Sakura Petals, Golden Pollen, Night Fireflies)
 * paired with harmonious Fog, Key light, and Hemisphere fill.
 */
import * as THREE from 'three';
import { WeatherType } from '../audio/SoundtrackSynthesizer';
import { ProceduralTextures } from './textures';
import { BackgroundCloudsSystem } from './clouds';

export interface WeatherPreset {
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
}

export const WEATHER_PRESETS: Record<WeatherType, WeatherPreset> = {
  golden_hour: {
    skyColor: 0xffecd1,
    fogColor: 0xffd8b4,
    fogDensity: 0.0075,
    sunColor: 0xffa45c,
    sunIntensity: 2.2,
    hemiSkyColor: 0xffd29d,
    hemiGroundColor: 0x5c715e,
    hemiIntensity: 1.1,
  },
  cozy_rain: {
    skyColor: 0x8a9ba8,
    fogColor: 0x9fb1be,
    fogDensity: 0.014,
    sunColor: 0xd6e2ea,
    sunIntensity: 1.1,
    hemiSkyColor: 0xa9bcc6,
    hemiGroundColor: 0x47555e,
    hemiIntensity: 0.9,
  },
  sakura_breeze: {
    skyColor: 0xffebf0,
    fogColor: 0xffd6e0,
    fogDensity: 0.008,
    sunColor: 0xffadc6,
    sunIntensity: 2.0,
    hemiSkyColor: 0xffcad4,
    hemiGroundColor: 0x606c38,
    hemiIntensity: 1.2,
  },
  aero_day: {
    // Frutiger Aero: saturated glossy sky blue, crisp white sun, lush green bounce light
    skyColor: 0x6cc8f5,
    fogColor: 0xb8e6ff,
    fogDensity: 0.0045,
    sunColor: 0xfffaf0,
    sunIntensity: 2.15,
    hemiSkyColor: 0xcdefff,
    hemiGroundColor: 0x4caf50,
    hemiIntensity: 1.1,
  },
  cosmic: {
    // Deep space: indigo void, cool starlight, violet bounce light
    skyColor: 0x0a0720,
    fogColor: 0x1b1240,
    fogDensity: 0.0035,
    sunColor: 0xdfe6ff,
    sunIntensity: 1.9,
    hemiSkyColor: 0x8b7cf6,
    hemiGroundColor: 0x1e1038,
    hemiIntensity: 0.95,
  },
  swamp_mist: {
    // Dark fantasy swamp: thick green-grey fog and a pale sickly moon
    skyColor: 0x1d2a24,
    fogColor: 0x2c3a31,
    fogDensity: 0.022,
    sunColor: 0xb8d4b0,
    sunIntensity: 1.25,
    hemiSkyColor: 0x5d7a68,
    hemiGroundColor: 0x1a1f17,
    hemiIntensity: 0.8,
  },
  starlit_night: {
    skyColor: 0x0d1321,
    fogColor: 0x1d2d44,
    fogDensity: 0.009,
    sunColor: 0x748cab,
    sunIntensity: 0.8,
    hemiSkyColor: 0x3e5c76,
    hemiGroundColor: 0x1b263b,
    hemiIntensity: 0.6,
  },
};

export class WeatherSystem {
  public currentWeather: WeatherType = 'golden_hour';
  public targetWeather: WeatherType = 'golden_hour';
  public sourceWeather: WeatherType = 'golden_hour';
  public isTransitioning: boolean = false;
  public transitionProgress: number = 1.0; // 0 to 1
  public transitionDuration: number = 3.2; // seconds
  private transitionElapsed: number = 0;

  // Snapshot of atmospheric state when transition begins
  private fromSnapshot: WeatherPreset;
  private readonly _tempColorA: THREE.Color = new THREE.Color();
  private readonly _tempColorB: THREE.Color = new THREE.Color();

  private scene: THREE.Scene;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private fog: THREE.FogExp2;
  public cloudsSystem: BackgroundCloudsSystem;

  // Particle systems
  private rainParticles: THREE.Points;
  private rainGeom: THREE.BufferGeometry;
  private sakuraParticles: THREE.InstancedMesh;
  private sakuraTransforms: { pos: THREE.Vector3; rot: THREE.Euler; speed: THREE.Vector3; rotSpeed: THREE.Vector3 }[] = [];
  private pollenParticles: THREE.Points;
  private fireflyParticles: THREE.Points;
  private fireflyCount = 120;
  private fireflyPositions: Float32Array;

  // Rain droplet positions
  private rainCount = 1500;
  private rainPositions: Float32Array;

  public onTransitionChange?: (target: WeatherType, progress: number, finished: boolean) => void;

  constructor(
    scene: THREE.Scene,
    dirLight: THREE.DirectionalLight,
    hemiLight: THREE.HemisphereLight,
    textures: ProceduralTextures
  ) {
    this.scene = scene;
    this.dirLight = dirLight;
    this.hemiLight = hemiLight;

    // Background clouds system (multi-speed procedural cloud layers)
    this.cloudsSystem = new BackgroundCloudsSystem(this.scene);

    // Initial fog
    const initial = WEATHER_PRESETS.golden_hour;
    this.fog = new THREE.FogExp2(initial.fogColor, initial.fogDensity);
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(initial.skyColor);

    this.fromSnapshot = { ...initial };

    // 1. Cozy Rain Streaks (Lines/Points)
    this.rainGeom = new THREE.BufferGeometry();
    this.rainPositions = new Float32Array(this.rainCount * 3);
    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 60;
      this.rainPositions[i * 3 + 1] = Math.random() * 35;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    this.rainGeom.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const rainMat = new THREE.PointsMaterial({
      color: 0xc4dded,
      size: 0.18,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.rainParticles = new THREE.Points(this.rainGeom, rainMat);
    this.scene.add(this.rainParticles);

    // 2. Sakura Petals (Instanced fluttering planes)
    const sakuraCount = 200;
    const petGeom = new THREE.PlaneGeometry(0.18, 0.12);
    const petMat = new THREE.MeshBasicMaterial({
      color: 0xffb7c5,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.sakuraParticles = new THREE.InstancedMesh(petGeom, petMat, sakuraCount);
    this.sakuraParticles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < sakuraCount; i++) {
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 50,
        Math.random() * 25,
        (Math.random() - 0.5) * 50
      );
      const rot = new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      const speed = new THREE.Vector3(
        0.5 + Math.random() * 0.8,
        -(0.8 + Math.random() * 0.6),
        0.4 + Math.random() * 0.6
      );
      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );

      this.sakuraTransforms.push({ pos, rot, speed, rotSpeed });
      dummy.position.copy(pos);
      dummy.rotation.copy(rot);
      dummy.updateMatrix();
      this.sakuraParticles.setMatrixAt(i, dummy.matrix);
    }
    this.sakuraParticles.instanceMatrix.needsUpdate = true;
    this.scene.add(this.sakuraParticles);

    // 3. Golden Dust Pollen
    const pollenCount = 300;
    const pollenGeom = new THREE.BufferGeometry();
    const pollenPos = new Float32Array(pollenCount * 3);
    for (let i = 0; i < pollenCount; i++) {
      pollenPos[i * 3] = (Math.random() - 0.5) * 50;
      pollenPos[i * 3 + 1] = Math.random() * 20;
      pollenPos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    pollenGeom.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
    const pollenMat = new THREE.PointsMaterial({
      color: 0xffd166,
      size: 0.15,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    this.pollenParticles = new THREE.Points(pollenGeom, pollenMat);
    this.scene.add(this.pollenParticles);

    // 4. Starlit Fireflies
    const fireflyGeom = new THREE.BufferGeometry();
    this.fireflyPositions = new Float32Array(this.fireflyCount * 3);
    for (let i = 0; i < this.fireflyCount; i++) {
      this.fireflyPositions[i * 3] = (Math.random() - 0.5) * 45;
      this.fireflyPositions[i * 3 + 1] = 0.5 + Math.random() * 15;
      this.fireflyPositions[i * 3 + 2] = (Math.random() - 0.5) * 45;
    }
    fireflyGeom.setAttribute('position', new THREE.BufferAttribute(this.fireflyPositions, 3));
    const fireflyMat = new THREE.PointsMaterial({
      color: 0x90e0ef,
      size: 0.28,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.fireflyParticles = new THREE.Points(fireflyGeom, fireflyMat);
    this.scene.add(this.fireflyParticles);
  }

  /**
   * Initiate a smooth mathematical transition to target weather preset.
   * Interpolates sky, fog, sunlight, ambient hemisphere and cross-fades particle layers over duration.
   */
  public transitionTo(weather: WeatherType, duration: number = 3.2) {
    if (this.currentWeather === weather && !this.isTransitioning) return;
    if (this.targetWeather === weather && this.isTransitioning) return;

    // Snapshot currently interpolated visual parameters for zero pop
    this.fromSnapshot = {
      skyColor: (this.scene.background as THREE.Color).getHex(),
      fogColor: this.fog.color.getHex(),
      fogDensity: this.fog.density,
      sunColor: this.dirLight.color.getHex(),
      sunIntensity: this.dirLight.intensity,
      hemiSkyColor: this.hemiLight.color.getHex(),
      hemiGroundColor: this.hemiLight.groundColor.getHex(),
      hemiIntensity: this.hemiLight.intensity,
    };

    this.sourceWeather = this.currentWeather;
    this.targetWeather = weather;
    this.transitionDuration = Math.max(0.2, duration);
    this.transitionElapsed = 0;
    this.transitionProgress = 0;
    this.isTransitioning = true;

    if (this.onTransitionChange) {
      this.onTransitionChange(this.targetWeather, 0, false);
    }
  }

  public setWeather(weather: WeatherType, duration: number = 3.2) {
    this.transitionTo(weather, duration);
  }

  /**
   * Computes the current influence weight [0..1] of a given weather preset
   */
  public getWeatherWeight(weather: WeatherType): number {
    if (!this.isTransitioning) {
      return this.currentWeather === weather ? 1.0 : 0.0;
    }
    let weight = 0;
    if (this.targetWeather === weather) {
      weight += this.transitionProgress;
    }
    if (this.sourceWeather === weather) {
      weight += 1.0 - this.transitionProgress;
    }
    return Math.max(0, Math.min(1, weight));
  }

  public update(dt: number, playerCenter: THREE.Vector3, time?: number) {
    const animTime = time !== undefined ? time : performance.now() * 0.001;

    // Smooth transition tick
    if (this.isTransitioning) {
      this.transitionElapsed += dt;
      const rawT = Math.min(1.0, this.transitionElapsed / this.transitionDuration);
      // Hermite smoothstep curve for natural organic celestial blending
      const t = rawT * rawT * (3 - 2 * rawT);
      this.transitionProgress = t;

      const targetPreset = WEATHER_PRESETS[this.targetWeather];

      // 1. Sky Color
      this._tempColorA.setHex(this.fromSnapshot.skyColor);
      this._tempColorB.setHex(targetPreset.skyColor);
      (this.scene.background as THREE.Color).copy(this._tempColorA.lerp(this._tempColorB, t));

      // 2. Fog Color & Density
      this._tempColorA.setHex(this.fromSnapshot.fogColor);
      this._tempColorB.setHex(targetPreset.fogColor);
      this.fog.color.copy(this._tempColorA.lerp(this._tempColorB, t));
      this.fog.density = THREE.MathUtils.lerp(this.fromSnapshot.fogDensity, targetPreset.fogDensity, t);

      // 3. Directional Sun Light
      this._tempColorA.setHex(this.fromSnapshot.sunColor);
      this._tempColorB.setHex(targetPreset.sunColor);
      this.dirLight.color.copy(this._tempColorA.lerp(this._tempColorB, t));
      this.dirLight.intensity = THREE.MathUtils.lerp(this.fromSnapshot.sunIntensity, targetPreset.sunIntensity, t);

      // 4. Hemisphere Ambient Light
      this._tempColorA.setHex(this.fromSnapshot.hemiSkyColor);
      this._tempColorB.setHex(targetPreset.hemiSkyColor);
      this.hemiLight.color.copy(this._tempColorA.lerp(this._tempColorB, t));

      this._tempColorA.setHex(this.fromSnapshot.hemiGroundColor);
      this._tempColorB.setHex(targetPreset.hemiGroundColor);
      this.hemiLight.groundColor.copy(this._tempColorA.lerp(this._tempColorB, t));

      this.hemiLight.intensity = THREE.MathUtils.lerp(this.fromSnapshot.hemiIntensity, targetPreset.hemiIntensity, t);

      if (rawT >= 1.0) {
        this.isTransitioning = false;
        this.currentWeather = this.targetWeather;
        this.transitionProgress = 1.0;
        if (this.onTransitionChange) {
          this.onTransitionChange(this.currentWeather, 1.0, true);
        }
      } else if (this.onTransitionChange) {
        this.onTransitionChange(this.targetWeather, t, false);
      }
    }

    // Animate procedural background clouds with synchronized speed & color blend
    this.cloudsSystem.animate(
      dt,
      animTime,
      this.currentWeather,
      this.isTransitioning ? this.targetWeather : undefined,
      this.transitionProgress
    );

    // Keep particles centered around player area
    this.rainParticles.position.x = playerCenter.x;
    this.rainParticles.position.z = playerCenter.z;
    this.sakuraParticles.position.x = playerCenter.x;
    this.sakuraParticles.position.z = playerCenter.z;
    this.pollenParticles.position.x = playerCenter.x;
    this.pollenParticles.position.z = playerCenter.z;
    this.fireflyParticles.position.x = playerCenter.x;
    this.fireflyParticles.position.z = playerCenter.z;

    // Calculate dynamic weather blend weights for particles
    const rainWeight = this.getWeatherWeight('cozy_rain');
    const sakuraWeight = this.getWeatherWeight('sakura_breeze');
    const goldenWeight = this.getWeatherWeight('golden_hour');
    const nightWeight = this.getWeatherWeight('starlit_night');

    // 1. Update Rain
    const rainMat = this.rainParticles.material as THREE.PointsMaterial;
    const targetRainOpacity = rainWeight * 0.78;
    rainMat.opacity = THREE.MathUtils.damp(rainMat.opacity, targetRainOpacity, 5.0, dt);

    if (rainMat.opacity > 0.01) {
      const pos = this.rainPositions;
      for (let i = 0; i < this.rainCount; i++) {
        pos[i * 3 + 1] -= dt * 26; // rapid vertical fall
        pos[i * 3] += dt * 3.5;    // gentle wind angle
        if (pos[i * 3 + 1] < -2) {
          pos[i * 3 + 1] = 32;
          pos[i * 3] = (Math.random() - 0.5) * 60;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
        }
      }
      this.rainGeom.attributes.position.needsUpdate = true;
    }

    // 2. Update Sakura Petals
    const sakuraMat = this.sakuraParticles.material as THREE.MeshBasicMaterial;
    const targetSakuraOpacity = sakuraWeight * 0.88;
    sakuraMat.opacity = THREE.MathUtils.damp(sakuraMat.opacity, targetSakuraOpacity, 5.0, dt);

    if (sakuraMat.opacity > 0.01) {
      const dummy = new THREE.Object3D();
      for (let i = 0; i < this.sakuraTransforms.length; i++) {
        const item = this.sakuraTransforms[i];
        item.pos.x += item.speed.x * dt;
        item.pos.y += item.speed.y * dt;
        item.pos.z += item.speed.z * dt;

        item.rot.x += item.rotSpeed.x * dt;
        item.rot.y += item.rotSpeed.y * dt;
        item.rot.z += item.rotSpeed.z * dt;

        if (item.pos.y < -2) {
          item.pos.y = 24;
          item.pos.x = (Math.random() - 0.5) * 50 - 10;
          item.pos.z = (Math.random() - 0.5) * 50;
        }

        dummy.position.copy(item.pos);
        dummy.rotation.copy(item.rot);
        dummy.updateMatrix();
        this.sakuraParticles.setMatrixAt(i, dummy.matrix);
      }
      this.sakuraParticles.instanceMatrix.needsUpdate = true;
    }

    // 3. Update Golden Pollen
    const pollenMat = this.pollenParticles.material as THREE.PointsMaterial;
    const targetPollenOpacity = goldenWeight * 0.75 + sakuraWeight * 0.15;
    pollenMat.opacity = THREE.MathUtils.damp(pollenMat.opacity, targetPollenOpacity, 5.0, dt);

    // 4. Update Starlit Fireflies
    const fireflyMat = this.fireflyParticles.material as THREE.PointsMaterial;
    const targetFireflyOpacity = nightWeight * 0.88;
    fireflyMat.opacity = THREE.MathUtils.damp(fireflyMat.opacity, targetFireflyOpacity, 5.0, dt);

    if (fireflyMat.opacity > 0.01) {
      const time = performance.now() * 0.001;
      const pos = this.fireflyPositions;
      for (let i = 0; i < this.fireflyCount; i++) {
        pos[i * 3] += Math.sin(time + i) * dt * 0.4;
        pos[i * 3 + 1] += Math.cos(time * 0.8 + i) * dt * 0.3;
        pos[i * 3 + 2] += Math.sin(time * 0.6 + i * 2) * dt * 0.4;
      }
      this.fireflyParticles.geometry.attributes.position.needsUpdate = true;
    }
  }

  public dispose() {
    this.cloudsSystem.dispose();
    this.rainGeom.dispose();
    (this.rainParticles.material as THREE.Material).dispose();
    this.sakuraParticles.dispose();
    this.pollenParticles.geometry.dispose();
    (this.pollenParticles.material as THREE.Material).dispose();
    this.fireflyParticles.geometry.dispose();
    (this.fireflyParticles.material as THREE.Material).dispose();
  }
}
