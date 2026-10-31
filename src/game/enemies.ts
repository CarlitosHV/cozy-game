/**
 * Cozy Enemies System:
 * 1. "Sproutling" (Acorn Moss-Sprite): Waddles along platforms, spins its acorn leaf propeller,
 *    can be bopped on the head like a trampoline for a high vault or pushes player on side bump.
 * 2. "Zephyr Puff" (Wind Wisp Cloud): Floats near gap bridges, inhales with puffed cheeks (telegraph),
 *    and blows a gentle breeze gust that tests player parkour timing.
 */
import * as THREE from 'three';
import { soundManager } from '../audio/SoundtrackSynthesizer';
import { ProceduralTextures } from './textures';

export type EnemyType = 'sproutling' | 'zephyr_puff' | 'chaser' | 'hopper' | 'shooter' | 'diver' | 'walker' | 'flyer';

/** Pushes the player: direction (XZ), horizontal force and upward speed. */
export type KnockFn = (dir: THREE.Vector3, force: number, up: number) => void;

interface Projectile {
  mesh: THREE.Object3D;
  velocity: THREE.Vector3;
  life: number;
  radius: number;
  force: number;
}

export interface CozyEnemy {
  id: string;
  type: EnemyType;
  group: THREE.Group;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  radius: number;
  height: number;
  isSquashed: boolean;
  squashTimer: number;
  // AI Patrol & Telegraph
  patrolAxis: 'x' | 'z';
  minBound: number;
  maxBound: number;
  direction: number; // 1 or -1
  speed: number;
  telegraphTimer: number;
  isTelegraphing: boolean;
  isBlowing: boolean;
  // Sub-mesh animation parts
  animParts: {
    body: THREE.Mesh;
    propeller?: THREE.Group;
    cheeks?: THREE.Group;
    wings?: THREE.Group;
    feet?: THREE.Group;
    windCone?: THREE.Mesh;
  };
  update: (dt: number, time: number, playerPos: THREE.Vector3) => void;
  bop: () => void;
  /** Extra hit logic for special enemies (shockwaves, dives…). Return true if the player was hit. */
  onCheck?: (playerPos: THREE.Vector3, playerVel: THREE.Vector3, playerRadius: number, knock: KnockFn) => boolean;
  /** When false the standard body-contact push is skipped (e.g. turrets only hurt with projectiles) */
  bodyContact?: boolean;
  /** Called when the player stomps on it (used by enemies that carry items) */
  onBopped?: () => void;
}

export class EnemyManager {
  public enemies: CozyEnemy[] = [];
  private scene: THREE.Object3D;
  private textures: ProceduralTextures;

  // Reusable collision vectors
  private _playerPush = new THREE.Vector3();

  /** Chispa's lure: while set, enemies stop to stare at it and don't push the player */
  public distractTarget: THREE.Vector3 | null = null;

  /**
   * 0 → 1: how aggressive enemies are. Grows with the level number: faster walkers,
   * wider detection, more frequent gusts/shots/dives and stronger knockbacks.
   */
  public hostility: number = 0;

  private projectiles: Projectile[] = [];

  /** Helpers for enemy factories living in other modules */
  public addObject(o: THREE.Object3D) {
    this.scene.add(o);
  }
  public removeObject(o: THREE.Object3D) {
    this.scene.remove(o);
  }
  public registerEnemy(e: CozyEnemy) {
    this.enemies.push(e);
  }
  /** Removes enemy projectiles near a point (Jade's guardian power). Returns how many. */
  public clearProjectilesNear(pos: THREE.Vector3, radius: number): number {
    let n = 0;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (pr.mesh.position.distanceTo(pos) < radius) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
        n++;
      }
    }
    return n;
  }
  public spawnProjectile(mesh: THREE.Object3D, from: THREE.Vector3, velocity: THREE.Vector3, force: number, radius = 0.3, life = 4) {
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, velocity: velocity.clone(), life, radius, force });
  }

  constructor(scene: THREE.Object3D, textures: ProceduralTextures) {
    this.scene = scene;
    this.textures = textures;
  }

  // --- 1. Sproutling Factory ---
  public spawnSproutling(
    id: string,
    spawnPos: THREE.Vector3,
    patrolAxis: 'x' | 'z',
    range: number = 4.0
  ): CozyEnemy {
    const mgr = this;
    const group = new THREE.Group();
    group.position.copy(spawnPos);

    // Materials
    const mossMat = new THREE.MeshStandardMaterial({
      color: 0x6ca34e, // vibrant cozy moss green
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true,
    });

    const acornMat = new THREE.MeshStandardMaterial({
      color: 0x77492c, // warm acorn cup wood
      roughness: 0.75,
      metalness: 0.1,
    });

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x95d55a, // bright sprout green
      roughness: 0.6,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1f1915,
      roughness: 0.1,
      metalness: 0.2,
    });

    const bootMat = new THREE.MeshStandardMaterial({
      color: 0x4a3222,
      roughness: 0.8,
      metalness: 0.05,
    });

    // 1. Primary: Round Moss Body
    const bodyGeom = new THREE.SphereGeometry(0.36, 12, 10);
    bodyGeom.scale(1.1, 0.95, 1.1);
    const body = new THREE.Mesh(bodyGeom, mossMat);
    body.position.y = 0.38;
    body.castShadow = true;
    group.add(body);

    // 2. Acorn Cap Helmet
    const helmetGeom = new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.48);
    const helmet = new THREE.Mesh(helmetGeom, acornMat);
    helmet.position.set(0, 0.58, -0.02);
    helmet.rotation.x = -0.15;
    helmet.castShadow = true;
    group.add(helmet);

    // Helmet acorn stem
    const stemGeom = new THREE.CylinderGeometry(0.03, 0.04, 0.12, 6);
    const stem = new THREE.Mesh(stemGeom, acornMat);
    stem.position.set(0, 0.76, -0.03);
    group.add(stem);

    // 3. Spinning Twin-Leaf Propeller on stem
    const propeller = new THREE.Group();
    propeller.position.set(0, 0.82, -0.03);

    const leafGeom1 = new THREE.ConeGeometry(0.08, 0.24, 5);
    leafGeom1.rotateZ(Math.PI / 2);
    leafGeom1.scale(1, 0.2, 1);
    const leaf1 = new THREE.Mesh(leafGeom1, leafMat);
    leaf1.position.x = 0.12;

    const leaf2 = leaf1.clone();
    leaf2.position.x = -0.12;
    leaf2.rotation.z = Math.PI;
    propeller.add(leaf1, leaf2);
    group.add(propeller);

    // 4. Eyes & Highlights
    const eyeGeom = new THREE.SphereGeometry(0.04, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(0.12, 0.42, 0.32);
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(-0.12, 0.42, 0.32);

    const hlGeom = new THREE.SphereGeometry(0.015, 6, 6);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const leftHl = new THREE.Mesh(hlGeom, hlMat);
    leftHl.position.set(0.13, 0.44, 0.35);
    const rightHl = new THREE.Mesh(hlGeom, hlMat);
    rightHl.position.set(-0.11, 0.44, 0.35);
    group.add(leftEye, rightEye, leftHl, rightHl);

    // Rosy Cheeks
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xff9999, transparent: true, opacity: 0.7 });
    const leftCheek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), cheekMat);
    leftCheek.position.set(0.18, 0.36, 0.28);
    const rightCheek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), cheekMat);
    rightCheek.position.set(-0.18, 0.36, 0.28);
    group.add(leftCheek, rightCheek);

    // 5. Wobbly Wooden Shoes / Feet
    const feet = new THREE.Group();
    const footGeom = new THREE.CapsuleGeometry(0.07, 0.12, 6, 6);
    footGeom.rotateX(Math.PI / 2);
    const leftFoot = new THREE.Mesh(footGeom, bootMat);
    leftFoot.position.set(0.14, 0.08, 0.05);
    leftFoot.castShadow = true;

    const rightFoot = new THREE.Mesh(footGeom, bootMat);
    rightFoot.position.set(-0.14, 0.08, 0.05);
    rightFoot.castShadow = true;
    feet.add(leftFoot, rightFoot);
    group.add(feet);

    // 6. Contact Shadow
    const shadowGeom = new THREE.PlaneGeometry(0.8, 0.8);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.shadow,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    group.add(shadow);

    this.scene.add(group);

    const minBound = spawnPos[patrolAxis] - range;
    const maxBound = spawnPos[patrolAxis] + range;

    const enemy: CozyEnemy = {
      id,
      type: 'sproutling',
      group,
      position: spawnPos.clone(),
      velocity: new THREE.Vector3(),
      radius: 0.42,
      height: 0.85,
      isSquashed: false,
      squashTimer: 0,
      patrolAxis,
      minBound,
      maxBound,
      direction: 1,
      speed: 1.8,
      telegraphTimer: 0,
      isTelegraphing: false,
      isBlowing: false,
      animParts: {
        body,
        propeller,
        feet,
      },
      bop() {
        this.isSquashed = true;
        this.squashTimer = 4.0;
        soundManager.playEnemyBoop();
      },
      update(dt: number, time: number, playerPos: THREE.Vector3) {
        if (this.isSquashed) {
          this.squashTimer -= dt;
          // Flattened pancake squash animation
          this.group.scale.set(1.4, 0.22, 1.4);
          if (this.squashTimer <= 0) {
            this.isSquashed = false;
            this.group.scale.set(1, 1, 1);
          }
          return;
        }

        // Distance to player for cute telegraph excitement
        const distToPlayer = this.position.distanceTo(playerPos);
        const seesPlayer = distToPlayer < 4.5 + 3 * mgr.hostility;

        const currentSpeed = (seesPlayer ? this.speed * 1.5 : this.speed) * (1 + 0.9 * mgr.hostility);

        // Patrol along assigned axis
        this.position[this.patrolAxis] += this.direction * currentSpeed * dt;

        if (this.position[this.patrolAxis] > this.maxBound) {
          this.position[this.patrolAxis] = this.maxBound;
          this.direction = -1;
        } else if (this.position[this.patrolAxis] < this.minBound) {
          this.position[this.patrolAxis] = this.minBound;
          this.direction = 1;
        }

        // Face movement direction
        const targetRotY =
          this.patrolAxis === 'x'
            ? this.direction > 0
              ? Math.PI / 2
              : -Math.PI / 2
            : this.direction > 0
            ? 0
            : Math.PI;
        this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, targetRotY, 12, dt);

        this.group.position.copy(this.position);

        // Animated waddle walk & leaf spin
        const waddleFreq = currentSpeed * 6.5;
        this.animParts.body.position.y = 0.38 + Math.abs(Math.sin(time * waddleFreq)) * 0.06;
        this.animParts.body.rotation.z = Math.sin(time * waddleFreq) * 0.08;

        if (this.animParts.feet) {
          leftFoot.position.z = Math.sin(time * waddleFreq) * 0.12;
          rightFoot.position.z = -Math.sin(time * waddleFreq) * 0.12;
        }

        if (this.animParts.propeller) {
          // Leaf propeller spins happily
          this.animParts.propeller.rotation.y += dt * (seesPlayer ? 18.0 : 8.0);
        }
      },
    };

    this.enemies.push(enemy);
    return enemy;
  }

  // --- 2. Zephyr Puff Factory ---
  public spawnZephyrPuff(
    id: string,
    spawnPos: THREE.Vector3,
    patrolAxis: 'x' | 'z',
    range: number = 3.5
  ): CozyEnemy {
    const mgr = this;
    const group = new THREE.Group();
    group.position.copy(spawnPos);

    // Materials
    const cloudPuffMat = new THREE.MeshStandardMaterial({
      color: 0xf2f7ff, // soft pillowy cloud lavender-white
      roughness: 0.95,
      metalness: 0.05,
      flatShading: false,
    });

    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xe5a93c, // whimsical little brass horn snout
      roughness: 0.3,
      metalness: 0.8,
    });

    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x1a2130,
      roughness: 0.1,
      metalness: 0.2,
    });

    // 1. Primary: Puffy Cloud Body (4 overlapping spheres)
    const body = new THREE.Group();
    const centralGeom = new THREE.SphereGeometry(0.38, 10, 8);
    centralGeom.scale(1.2, 0.9, 1.1);
    const centerMesh = new THREE.Mesh(centralGeom, cloudPuffMat);
    centerMesh.castShadow = true;
    body.add(centerMesh);

    // Billowing cheek puffs
    const cheeks = new THREE.Group();
    const cheekGeom = new THREE.SphereGeometry(0.18, 8, 8);
    const leftCheekPuff = new THREE.Mesh(cheekGeom, cloudPuffMat);
    leftCheekPuff.position.set(0.24, -0.05, 0.18);
    const rightCheekPuff = new THREE.Mesh(cheekGeom, cloudPuffMat);
    rightCheekPuff.position.set(-0.24, -0.05, 0.18);
    cheeks.add(leftCheekPuff, rightCheekPuff);
    body.add(cheeks);

    // 2. Cute Trumpet Snout / Breeze Nozzle
    const snoutGeom = new THREE.CylinderGeometry(0.08, 0.04, 0.16, 8);
    snoutGeom.rotateX(Math.PI / 2);
    const snout = new THREE.Mesh(snoutGeom, brassMat);
    snout.position.set(0, -0.06, 0.38);
    body.add(snout);

    // 3. Sleepy/Mischievous Bead Eyes
    const eyeGeom = new THREE.SphereGeometry(0.035, 6, 6);
    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(0.12, 0.1, 0.36);
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(-0.12, 0.1, 0.36);
    body.add(leftEye, rightEye);

    // Little brow arches
    const browMat = new THREE.MeshBasicMaterial({ color: 0x4a5568 });
    const browGeom = new THREE.BoxGeometry(0.06, 0.015, 0.01);
    const leftBrow = new THREE.Mesh(browGeom, browMat);
    leftBrow.position.set(0.12, 0.16, 0.38);
    leftBrow.rotation.z = -0.15;
    const rightBrow = new THREE.Mesh(browGeom, browMat);
    rightBrow.position.set(-0.12, 0.16, 0.38);
    rightBrow.rotation.z = 0.15;
    body.add(leftBrow, rightBrow);

    // 4. Fluttering Cloud Wings
    const wings = new THREE.Group();
    const wingGeom = new THREE.ConeGeometry(0.12, 0.32, 6);
    wingGeom.scale(1, 0.25, 1);
    const leftWing = new THREE.Mesh(wingGeom, wingMat);
    leftWing.position.set(0.42, 0.1, 0);
    leftWing.rotation.z = -Math.PI / 3;

    const rightWing = new THREE.Mesh(wingGeom, wingMat);
    rightWing.position.set(-0.42, 0.1, 0);
    rightWing.rotation.z = Math.PI / 3;
    wings.add(leftWing, rightWing);
    body.add(wings);

    // 5. Breeze Wind Vortex Cone (Visible when blowing)
    const windConeGeom = new THREE.ConeGeometry(0.65, 2.2, 8, 1, true);
    windConeGeom.rotateX(-Math.PI / 2);
    windConeGeom.translate(0, 0, 1.1);
    const windConeMat = new THREE.MeshBasicMaterial({
      color: 0xcbf3f0,
      transparent: true,
      opacity: 0,
      wireframe: true,
    });
    const windCone = new THREE.Mesh(windConeGeom, windConeMat);
    windCone.position.set(0, -0.06, 0.4);
    body.add(windCone);

    group.add(body);

    // 6. Contact Shadow
    const shadowGeom = new THREE.PlaneGeometry(0.9, 0.9);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: this.textures.shadow,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -spawnPos.y + 0.1; // adjust to platform beneath
    group.add(shadow);

    this.scene.add(group);

    const minBound = spawnPos[patrolAxis] - range;
    const maxBound = spawnPos[patrolAxis] + range;

    const enemy: CozyEnemy = {
      id,
      type: 'zephyr_puff',
      group,
      position: spawnPos.clone(),
      velocity: new THREE.Vector3(),
      radius: 0.5,
      height: 0.8,
      isSquashed: false,
      squashTimer: 0,
      patrolAxis,
      minBound,
      maxBound,
      direction: 1,
      speed: 1.2,
      telegraphTimer: 0,
      isTelegraphing: false,
      isBlowing: false,
      animParts: {
        body: centerMesh,
        cheeks,
        wings,
        windCone,
      },
      bop() {
        this.isSquashed = true;
        this.squashTimer = 4.0;
        this.isBlowing = false;
        if (this.animParts.windCone) {
          (this.animParts.windCone.material as THREE.MeshBasicMaterial).opacity = 0;
        }
        soundManager.playEnemyBoop();
      },
      update(dt: number, time: number, playerPos: THREE.Vector3) {
        if (this.isSquashed) {
          this.squashTimer -= dt;
          this.group.scale.set(1.4, 0.25, 1.4);
          if (this.squashTimer <= 0) {
            this.isSquashed = false;
            this.group.scale.set(1, 1, 1);
          }
          return;
        }

        // Cycle through: Hovering Patrol (3.5s) -> Inhale Telegraph (1.2s) -> Blow Breeze (1.6s)
        this.telegraphTimer += dt * (1 + 0.9 * mgr.hostility);
        const cycle = this.telegraphTimer % 6.5;

        if (cycle < 3.5) {
          // 1. Calm patrol
          this.isTelegraphing = false;
          this.isBlowing = false;
          this.position[this.patrolAxis] += this.direction * this.speed * dt;
          if (this.position[this.patrolAxis] > this.maxBound) {
            this.position[this.patrolAxis] = this.maxBound;
            this.direction = -1;
          } else if (this.position[this.patrolAxis] < this.minBound) {
            this.position[this.patrolAxis] = this.minBound;
            this.direction = 1;
          }

          if (this.animParts.cheeks) {
            this.animParts.cheeks.scale.set(1, 1, 1);
          }
          if (this.animParts.windCone) {
            (this.animParts.windCone.material as THREE.MeshBasicMaterial).opacity = 0;
          }
        } else if (cycle < 4.7) {
          // 2. Inhale Telegraph! Cheeks puff up big, wings flutter excitedly!
          this.isTelegraphing = true;
          this.isBlowing = false;
          const inhaleProgress = (cycle - 3.5) / 1.2;
          const puffScale = 1.0 + Math.sin(inhaleProgress * Math.PI * 0.5) * 0.5;

          if (this.animParts.cheeks) {
            this.animParts.cheeks.scale.set(puffScale, puffScale, puffScale);
          }
        } else {
          // 3. Blow Wind Gust!
          this.isTelegraphing = false;
          if (!this.isBlowing) {
            this.isBlowing = true;
            soundManager.playWindGust();
          }

          if (this.animParts.cheeks) {
            this.animParts.cheeks.scale.set(0.9, 0.9, 0.9);
          }

          // Wind cone visuals
          if (this.animParts.windCone) {
            const windMat = this.animParts.windCone.material as THREE.MeshBasicMaterial;
            windMat.opacity = 0.55 + Math.sin(time * 20) * 0.2;
            this.animParts.windCone.rotation.z += dt * 10;
          }
        }

        // Face movement direction or player when blowing
        const targetRotY =
          this.patrolAxis === 'x'
            ? this.direction > 0
              ? Math.PI / 2
              : -Math.PI / 2
            : this.direction > 0
            ? 0
            : Math.PI;
        this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, targetRotY, 8, dt);

        // Sinusoidal floating height
        this.position.y = spawnPos.y + Math.sin(time * 2.8) * 0.18;
        this.group.position.copy(this.position);

        // Wing flutter
        if (this.animParts.wings) {
          const flutterSpeed = this.isTelegraphing ? 25 : 10;
          leftWing.rotation.x = Math.sin(time * flutterSpeed) * 0.4;
          rightWing.rotation.x = Math.sin(time * flutterSpeed) * 0.4;
        }
      },
    };

    this.enemies.push(enemy);
    return enemy;
  }

  // ==========================================================
  // "Corrupted" skins for the Frutiger Aero level: same AI as the
  // cozy enemies, but they visually BREAK the glossy aesthetic.
  // ==========================================================
  private glitchTexture: THREE.CanvasTexture | null = null;

  private getGlitchTexture(): THREE.CanvasTexture {
    if (this.glitchTexture) return this.glitchTexture;
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d')!;
    const palette = ['#000000', '#000000', '#111111', '#ff00ff', '#00ff66', '#00ffff', '#ffffff', '#ff0033'];
    for (let y = 0; y < 32; y++) {
      // Horizontal "scanline tears"
      const shift = Math.random() < 0.15 ? Math.floor(Math.random() * 6) : 0;
      for (let x = 0; x < 32; x++) {
        ctx.fillStyle = palette[Math.floor(Math.random() * palette.length) * (Math.random() < 0.6 ? 0 : 1)];
        ctx.fillRect((x + shift) % 32, y, 1, 1);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.glitchTexture = tex;
    return tex;
  }

  /** Hides an enemy's original meshes (keeping its contact shadow) and returns a fresh skin group. */
  private replaceSkin(enemy: CozyEnemy, keep: THREE.Object3D[] = []): THREE.Group {
    for (const child of enemy.group.children) {
      const isShadow = (child as THREE.Mesh).isMesh && (child as THREE.Mesh).geometry instanceof THREE.PlaneGeometry;
      if (!isShadow && !keep.includes(child)) child.visible = false;
    }
    const skin = new THREE.Group();
    enemy.group.add(skin);
    return skin;
  }

  /** "Glitch": a corrupted black/magenta pixel cube that waddles like a Sproutling. */
  public spawnGlitchCube(id: string, spawnPos: THREE.Vector3, patrolAxis: 'x' | 'z', range: number = 3.0): CozyEnemy {
    const enemy = this.spawnSproutling(id, spawnPos, patrolAxis, range);
    const skin = this.replaceSkin(enemy);
    const tex = this.getGlitchTexture();
    const coreMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.9,
      metalness: 0.0,
      emissive: 0xffffff,
      emissiveMap: tex,
      emissiveIntensity: 0.35,
    });
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.72, 0.72), coreMat);
    core.position.y = 0.45;
    core.castShadow = true;
    skin.add(core);

    // Angry red scanline "eye"
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.02), new THREE.MeshBasicMaterial({ color: 0xff0033 }));
    eye.position.set(0, 0.55, 0.37);
    skin.add(eye);

    // Dead pixels orbiting & jittering around it
    const pixelMats = [0xff00ff, 0x00ff66, 0x00ffff, 0x000000].map((c) => new THREE.MeshBasicMaterial({ color: c }));
    const pixels: THREE.Mesh[] = [];
    for (let i = 0; i < 7; i++) {
      const px = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), pixelMats[i % pixelMats.length]);
      skin.add(px);
      pixels.push(px);
    }

    const baseUpdate = enemy.update;
    enemy.update = function (this: CozyEnemy, dt: number, time: number, playerPos: THREE.Vector3) {
      baseUpdate.call(this, dt, time, playerPos);
      // Glitchy jitter: random teleport-like offsets and texture tearing
      const glitching = Math.sin(time * 7.3 + spawnPos.x) > 0.6;
      core.position.x = glitching ? (Math.random() - 0.5) * 0.12 : 0;
      core.scale.set(1, glitching && Math.random() < 0.3 ? 0.85 : 1, 1);
      eye.visible = !glitching || Math.random() < 0.5;
      tex.offset.set(Math.floor(time * 12) * 0.137, glitching ? Math.random() : tex.offset.y);
      pixels.forEach((px, i) => {
        const a = time * (1.5 + i * 0.2) + i;
        px.position.set(Math.cos(a) * 0.55, 0.45 + Math.sin(a * 1.7) * 0.35, Math.sin(a) * 0.55);
        if (Math.random() < 0.05) px.position.x += (Math.random() - 0.5) * 0.4;
      });
    };
    return enemy;
  }

  /** "Error window": a grey crash dialog that floats and blasts gusts like a Zephyr Puff. */
  public spawnErrorPopup(id: string, spawnPos: THREE.Vector3, patrolAxis: 'x' | 'z', range: number = 3.0): CozyEnemy {
    const enemy = this.spawnZephyrPuff(id, spawnPos, patrolAxis, range);
    const windCone = enemy.animParts.windCone;
    const skin = this.replaceSkin(enemy);

    // Dialog face drawn on a canvas
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 88;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, 0, 128, 88);
    ctx.fillStyle = '#5a5a6e';
    ctx.fillRect(0, 0, 128, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('ERROR.exe', 5, 12);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(112, 3, 11, 10);
    ctx.fillStyle = '#000';
    ctx.fillText('x', 114, 12);
    // Red stop icon
    ctx.fillStyle = '#e00000';
    ctx.beginPath();
    ctx.arc(26, 46, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(19, 39);
    ctx.lineTo(33, 53);
    ctx.moveTo(33, 39);
    ctx.lineTo(19, 53);
    ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('ERROR', 48, 40);
    ctx.font = '9px monospace';
    ctx.fillText('Archivo', 48, 53);
    ctx.fillText('corrupto', 48, 63);
    // OK button
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(48, 69, 34, 14);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(48, 69, 34, 14);
    ctx.fillStyle = '#000';
    ctx.fillText('OK', 59, 80);
    const faceTex = new THREE.CanvasTexture(c);
    faceTex.magFilter = THREE.NearestFilter;
    faceTex.colorSpace = THREE.SRGBColorSpace;

    const greyMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.95 });
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.95, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.25 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.8, 0.08), [greyMat, greyMat, greyMat, greyMat, faceMat, faceMat]);
    win.castShadow = true;
    skin.add(win);

    // Duplicate "ghost" windows trailing behind (the classic frozen-screen smear)
    const ghostMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, opacity: 0.35, depthWrite: false });
    const ghosts: THREE.Mesh[] = [];
    for (let i = 1; i <= 2; i++) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.8), ghostMat);
      g.position.set(-0.12 * i, 0.08 * i, -0.06 * i);
      skin.add(g);
      ghosts.push(g);
    }

    // Keep the gust cone visible (it lived on the hidden body)
    if (windCone) {
      skin.add(windCone);
      windCone.position.set(0, 0, 0.45);
    }

    const baseUpdate = enemy.update;
    enemy.update = function (this: CozyEnemy, dt: number, time: number, playerPos: THREE.Vector3) {
      baseUpdate.call(this, dt, time, playerPos);
      // Shudder harder while "inhaling" (telegraph) before the gust
      const shake = this.isTelegraphing ? 0.06 : 0.012;
      skin.position.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0);
      const flicker = Math.random() < (this.isTelegraphing ? 0.25 : 0.04);
      win.visible = !flicker;
      ghosts.forEach((g, i) => (g.visible = this.isTelegraphing || Math.sin(time * 3 + i) > 0.3));
    };
    return enemy;
  }

  // ==========================================================
  // Themed skins for the Cosmic level (UFO, alien blob) and the
  // Swamp level (mud creature, wraith). Same AI as the cozy enemies.
  // ==========================================================

  /** Cosmic: little UFO that hovers and fires a "tractor gust" (Zephyr behaviour). */
  public spawnUfo(id: string, spawnPos: THREE.Vector3, patrolAxis: 'x' | 'z', range: number = 3.0): CozyEnemy {
    const enemy = this.spawnZephyrPuff(id, spawnPos, patrolAxis, range);
    const windCone = enemy.animParts.windCone;
    const skin = this.replaceSkin(enemy);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xb8c1d9, roughness: 0.25, metalness: 0.85 });
    const hullGeom = new THREE.SphereGeometry(0.62, 24, 12);
    hullGeom.scale(1, 0.3, 1);
    const hull = new THREE.Mesh(hullGeom, hullMat);
    hull.castShadow = true;
    skin.add(hull);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x9ae6ff, roughness: 0.05, transparent: true, opacity: 0.55 })
    );
    dome.position.y = 0.12;
    skin.add(dome);
    const alien = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 }));
    alien.position.y = 0.2;
    skin.add(alien);
    for (const sx of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      eye.position.set(0.05 * sx, 0.23, 0.11);
      skin.add(eye);
    }
    const lights: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf472b6 : 0xfde047 }));
      l.position.set(Math.cos(a) * 0.56, -0.02, Math.sin(a) * 0.56);
      skin.add(l);
      lights.push(l);
    }
    if (windCone) {
      skin.add(windCone);
      windCone.position.set(0, -0.05, 0.45);
      (windCone.material as THREE.MeshBasicMaterial).color.set(0x86efac);
    }
    const baseUpdate = enemy.update;
    enemy.update = function (this: CozyEnemy, dt: number, time: number, playerPos: THREE.Vector3) {
      baseUpdate.call(this, dt, time, playerPos);
      skin.rotation.z = Math.sin(time * 2.2) * 0.12;
      lights.forEach((l, i) => (l.visible = Math.floor(time * 6 + i) % 2 === 0 || this.isTelegraphing));
    };
    return enemy;
  }

  /** Cosmic: one-eyed jelly blob that waddles like a Sproutling. */
  public spawnAlienBlob(id: string, spawnPos: THREE.Vector3, patrolAxis: 'x' | 'z', range: number = 3.0): CozyEnemy {
    const enemy = this.spawnSproutling(id, spawnPos, patrolAxis, range);
    const skin = this.replaceSkin(enemy);
    const jelly = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 20, 16),
      new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.15, transparent: true, opacity: 0.85, emissive: 0x581c87, emissiveIntensity: 0.4 })
    );
    jelly.scale.set(1, 0.85, 1);
    jelly.position.y = 0.4;
    jelly.castShadow = true;
    skin.add(jelly);
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eyeWhite.position.set(0, 0.5, 0.33);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    pupil.position.set(0, 0.5, 0.47);
    skin.add(eyeWhite, pupil);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 6), new THREE.MeshStandardMaterial({ color: 0xc084fc }));
    stalk.position.set(0, 0.92, 0);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfde047 }));
    bulb.position.set(0, 1.1, 0);
    skin.add(stalk, bulb);
    const baseUpdate = enemy.update;
    enemy.update = function (this: CozyEnemy, dt: number, time: number, playerPos: THREE.Vector3) {
      baseUpdate.call(this, dt, time, playerPos);
      const wob = Math.sin(time * 6 + spawnPos.x);
      jelly.scale.set(1 + wob * 0.06, 0.85 - wob * 0.06, 1 + wob * 0.06);
      bulb.position.x = Math.sin(time * 3) * 0.06;
      // Pupil glances toward the player
      const dx = playerPos.x - this.position.x;
      pupil.position.x = THREE.MathUtils.clamp(dx * 0.02, -0.06, 0.06);
    };
    return enemy;
  }

  /** Swamp: lumpy mud creature with glowing eyes (Sproutling behaviour). */
  public spawnMudling(id: string, spawnPos: THREE.Vector3, patrolAxis: 'x' | 'z', range: number = 3.0): CozyEnemy {
    const enemy = this.spawnSproutling(id, spawnPos, patrolAxis, range);
    const skin = this.replaceSkin(enemy);
    const mudMat = new THREE.MeshStandardMaterial({ color: 0x3b2f22, roughness: 0.95, flatShading: true });
    const body = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 1), mudMat);
    body.scale.set(1.1, 0.85, 1);
    body.position.y = 0.38;
    body.castShadow = true;
    skin.add(body);
    const lumps: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const lump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), mudMat);
      const a = (i / 4) * Math.PI * 2 + 0.4;
      lump.position.set(Math.cos(a) * 0.35, 0.62 + (i % 2) * 0.08, Math.sin(a) * 0.3);
      skin.add(lump);
      lumps.push(lump);
    }
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    for (const sx of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), eyeMat);
      eye.scale.set(1, 0.6, 1);
      eye.position.set(0.15 * sx, 0.5, 0.4);
      skin.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.02), new THREE.MeshBasicMaterial({ color: 0x0b0b0b }));
    mouth.position.set(0, 0.34, 0.45);
    skin.add(mouth);
    const drips: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mudMat);
      skin.add(drip);
      drips.push(drip);
    }
    const baseUpdate = enemy.update;
    enemy.update = function (this: CozyEnemy, dt: number, time: number, playerPos: THREE.Vector3) {
      baseUpdate.call(this, dt, time, playerPos);
      drips.forEach((d, i) => {
        const t = (time * 0.8 + i * 0.33) % 1;
        d.position.set(-0.25 + i * 0.25, 0.45 - t * 0.45, 0.3);
        d.scale.setScalar(1 - t * 0.6);
      });
      lumps.forEach((l, i) => (l.rotation.y = time * (0.5 + i * 0.2)));
    };
    return enemy;
  }

  /** Swamp: hooded wraith that floats and blows a cold gust (Zephyr behaviour). */
  public spawnWraith(id: string, spawnPos: THREE.Vector3, patrolAxis: 'x' | 'z', range: number = 3.0): CozyEnemy {
    const enemy = this.spawnZephyrPuff(id, spawnPos, patrolAxis, range);
    const windCone = enemy.animParts.windCone;
    const skin = this.replaceSkin(enemy);
    const cloakMat = new THREE.MeshStandardMaterial({ color: 0x1e1b2e, roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 10, 1, true), cloakMat);
    cloak.position.y = -0.15;
    skin.add(cloak);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), cloakMat);
    hood.position.y = 0.38;
    skin.add(hood);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), new THREE.MeshBasicMaterial({ color: 0x05040a }));
    face.position.set(0, 0.33, 0.24);
    skin.add(face);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    const eyes: THREE.Mesh[] = [];
    for (const sx of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), eyeMat);
      eye.position.set(0.08 * sx, 0.36, 0.26);
      skin.add(eye);
      eyes.push(eye);
    }
    // Ragged hem strips
    const strips: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.35), cloakMat);
      strip.position.set(Math.sin(a) * 0.44, -0.85, Math.cos(a) * 0.44);
      strip.rotation.y = a;
      skin.add(strip);
      strips.push(strip);
    }
    if (windCone) {
      skin.add(windCone);
      windCone.position.set(0, 0.3, 0.5);
      (windCone.material as THREE.MeshBasicMaterial).color.set(0xa5f3fc);
    }
    const baseUpdate = enemy.update;
    enemy.update = function (this: CozyEnemy, dt: number, time: number, playerPos: THREE.Vector3) {
      baseUpdate.call(this, dt, time, playerPos);
      strips.forEach((s, i) => (s.rotation.x = Math.sin(time * 5 + i) * 0.4));
      const flare = this.isTelegraphing ? 1.8 : 1;
      eyes.forEach((e) => e.scale.setScalar(flare + Math.sin(time * 8) * 0.15));
      skin.position.y = Math.sin(time * 1.7) * 0.08;
    };
    return enemy;
  }

  // --- Collision resolution with Player ---
  public checkPlayerCollisions(
    playerPosition: THREE.Vector3,
    playerVelocity: THREE.Vector3,
    playerRadius: number,
    onPlayerBounce: () => void,
    onPlayerKnockback: (forceDir: THREE.Vector3) => void
  ) {
    const distracted = this.distractTarget !== null;
    const knock: KnockFn = (dir, force, up) => {
      playerVelocity.x = dir.x * force;
      playerVelocity.y = up;
      playerVelocity.z = dir.z * force;
      onPlayerKnockback(dir);
      soundManager.playEnemyBonk();
    };

    // Projectiles (spores, lasers, acid, spam…)
    if (!distracted) {
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const pr = this.projectiles[i];
        const dx = playerPosition.x - pr.mesh.position.x;
        const dy = playerPosition.y + 0.7 - pr.mesh.position.y;
        const dz = playerPosition.z - pr.mesh.position.z;
        if (dx * dx + dy * dy + dz * dz < (pr.radius + playerRadius + 0.25) ** 2) {
          const dir = new THREE.Vector3(pr.velocity.x, 0, pr.velocity.z).normalize();
          knock(dir, pr.force, 5.5);
          this.scene.remove(pr.mesh);
          this.projectiles.splice(i, 1);
        }
      }
    }

    for (const enemy of this.enemies) {
      if (enemy.isSquashed) continue;

      // 1. Zephyr Puff Wind Gust Blast Check
      if (!distracted && enemy.type === 'zephyr_puff' && enemy.isBlowing) {
        const toPlayer = playerPosition.clone().sub(enemy.position);
        const forward = new THREE.Vector3(0, 0, 1).applyEuler(enemy.group.rotation);
        const dist = toPlayer.length();
        const dirToPlayer = toPlayer.clone().normalize();
        const dot = dirToPlayer.dot(forward);

        const gustRange = 4.5 + 1.5 * this.hostility;
        if (dot > 0.45 && dist < gustRange && Math.abs(playerPosition.y - enemy.position.y) < 2.8) {
          // Gale force wind knocks player off bridge!
          const gust = 15.5 * (1 + 0.35 * this.hostility);
          playerVelocity.x = forward.x * gust;
          playerVelocity.y = 4.8;
          playerVelocity.z = forward.z * gust;
          onPlayerKnockback(forward);
          soundManager.playSteamPuff();
          continue;
        }
      }

      // 1b. Special enemies (shockwaves, dives…)
      if (!distracted && enemy.onCheck && enemy.onCheck(playerPosition, playerVelocity, playerRadius, knock)) {
        continue;
      }
      if (enemy.bodyContact === false) continue;

      // 2. Physical Body Contact Check (only when the player is roughly at the enemy's height)
      if (playerPosition.y > enemy.position.y + enemy.height + 0.9 || playerPosition.y + 1.35 < enemy.position.y - 0.2) continue;
      const dx = playerPosition.x - enemy.position.x;
      const dz = playerPosition.z - enemy.position.z;
      const distXZ = Math.hypot(dx, dz);
      const minDist = playerRadius + enemy.radius;

      if (distXZ < minDist) {
        const playerFeetY = playerPosition.y;
        const enemyTopY = enemy.position.y + enemy.height * 0.65;

        // Player jumped on top of enemy's head! -> Bop & Super Trampoline Bounce!
        if (playerFeetY >= enemyTopY - 0.25 && playerVelocity.y <= 0.2) {
          enemy.bop();
          enemy.onBopped?.();
          playerVelocity.y = 13.5; // High joyful bop jump!
          onPlayerBounce();
          soundManager.playMushroomBounce();
          return;
        }

        // Distracted enemies are too busy staring at the lure to push anyone
        if (distracted) continue;

        // Side horizontal collision -> Bonk & forcefully push player OFF the platform!
        this._playerPush.set(dx, 0, dz);
        if (this._playerPush.lengthSq() < 0.001) {
          this._playerPush.set(enemy.patrolAxis === 'x' ? enemy.direction : 0, 0, enemy.patrolAxis === 'z' ? enemy.direction : 1);
        }
        this._playerPush.normalize();
        this._playerPush.y = 0.35;
        this._playerPush.normalize();

        // Strong knockback impulse flinging player away and off platform ledge
        playerVelocity.x = this._playerPush.x * 14.8;
        playerVelocity.y = 5.2;
        playerVelocity.z = this._playerPush.z * 14.8;

        onPlayerKnockback(this._playerPush);
        soundManager.playEnemyBonk();
      }
    }
  }

  public update(dt: number, time: number, playerPos: THREE.Vector3) {
    // Move projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.mesh.position.addScaledVector(pr.velocity, dt);
      pr.mesh.rotation.y += dt * 6;
      if (pr.life <= 0) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    const lure = this.distractTarget;
    for (const enemy of this.enemies) {
      if (lure && !enemy.isSquashed) {
        // Mesmerized: stop patrolling, turn toward the glowing lure and sway happily
        const targetYaw = Math.atan2(lure.x - enemy.position.x, lure.z - enemy.position.z);
        let diff = targetYaw - enemy.group.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        enemy.group.rotation.y += diff * Math.min(1, dt * 6);
        enemy.group.rotation.z = Math.sin(time * 4 + enemy.position.x) * 0.12;
        enemy.isBlowing = false;
        enemy.isTelegraphing = false;
        if (enemy.animParts.windCone) {
          (enemy.animParts.windCone.material as THREE.MeshBasicMaterial).opacity = 0;
        }
        if (enemy.animParts.cheeks) enemy.animParts.cheeks.scale.set(1, 1, 1);
        continue;
      }
      if (enemy.group.rotation.z !== 0) enemy.group.rotation.z = 0;
      enemy.update(dt, time, playerPos);
    }
  }

  public dispose() {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.group);
    }
    this.enemies = [];
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
  }
}

// =====================================================================
// Aether Stalker: Relentless parkour pursuer for "Modo Persecución"
// =====================================================================
export class AetherStalker {
  public group: THREE.Group;
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public distanceToPlayer: number = 24.0;
  public warningLevel: 'none' | 'caution' | 'danger' = 'none';
  public isStunned: boolean = false;
  public stunTimer: number = 0;
  public currentSpeed: number = 4.6;
  /** Extra speed on later levels (set from the level's hostility) */
  public speedScale: number = 1;

  private scene: THREE.Scene;
  private coreMesh: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private leftWing: THREE.Group;
  private rightWing: THREE.Group;
  private eyeLight: THREE.PointLight;
  private eyesGroup: THREE.Group;
  private particles: THREE.Points;
  private warningSoundCooldown: number = 0;

  constructor(scene: THREE.Scene, initialPlayerPos: THREE.Vector3) {
    this.scene = scene;
    this.group = new THREE.Group();

    // Spawn ~16m behind player initially
    this.position.copy(initialPlayerPos).add(new THREE.Vector3(-14, 3, -14));
    this.group.position.copy(this.position);

    // 1. Dark Void Core Material
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x140b24,
      roughness: 0.35,
      metalness: 0.85,
      emissive: 0x240d42,
      emissiveIntensity: 0.6,
      flatShading: true,
    });

    const coreGeom = new THREE.DodecahedronGeometry(0.58);
    this.coreMesh = new THREE.Mesh(coreGeom, coreMat);
    this.coreMesh.castShadow = true;
    this.group.add(this.coreMesh);

    // 2. Menacing Curved Horns
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0x090511,
      roughness: 0.2,
      metalness: 0.9,
    });
    const hornGeom = new THREE.ConeGeometry(0.12, 0.55, 6);
    hornGeom.rotateX(-0.35);

    const leftHorn = new THREE.Mesh(hornGeom, hornMat);
    leftHorn.position.set(0.24, 0.48, -0.05);
    leftHorn.rotation.z = -0.35;

    const rightHorn = new THREE.Mesh(hornGeom, hornMat);
    rightHorn.position.set(-0.24, 0.48, -0.05);
    rightHorn.rotation.z = 0.35;
    this.group.add(leftHorn, rightHorn);

    // 3. Piercing Crimson / Violet Eyes
    this.eyesGroup = new THREE.Group();
    const eyeGeom = new THREE.SphereGeometry(0.085, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1e56 });

    const leftEye = new THREE.Mesh(eyeGeom, eyeMat);
    leftEye.position.set(0.17, 0.12, 0.48);
    const rightEye = new THREE.Mesh(eyeGeom, eyeMat);
    rightEye.position.set(-0.17, 0.12, 0.48);
    this.eyesGroup.add(leftEye, rightEye);

    // Menacing Eye PointLight
    this.eyeLight = new THREE.PointLight(0xff1e56, 1.6, 7);
    this.eyeLight.position.set(0, 0.12, 0.5);
    this.eyesGroup.add(this.eyeLight);
    this.group.add(this.eyesGroup);

    // 4. Orbiting Shadow Rune Ring
    const ringGeom = new THREE.TorusGeometry(0.85, 0.035, 8, 28);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.75,
    });
    this.ringMesh = new THREE.Mesh(ringGeom, ringMat);
    this.ringMesh.rotation.x = Math.PI / 2;
    this.group.add(this.ringMesh);

    // 5. Floating Shadow Claws / Wings
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x1f1238,
      roughness: 0.5,
      metalness: 0.5,
      side: THREE.DoubleSide,
    });

    this.leftWing = new THREE.Group();
    this.leftWing.position.set(0.55, 0, 0);
    const wingShape = new THREE.ConeGeometry(0.16, 0.75, 4);
    wingShape.rotateZ(-Math.PI / 2.5);
    const leftWingMesh = new THREE.Mesh(wingShape, wingMat);
    this.leftWing.add(leftWingMesh);

    this.rightWing = new THREE.Group();
    this.rightWing.position.set(-0.55, 0, 0);
    const rightWingShape = new THREE.ConeGeometry(0.16, 0.75, 4);
    rightWingShape.rotateZ(Math.PI / 2.5);
    const rightWingMesh = new THREE.Mesh(rightWingShape, wingMat);
    this.rightWing.add(rightWingMesh);

    this.group.add(this.leftWing, this.rightWing);

    // 6. Ethereal Shadow Particle Aura
    const particleCount = 45;
    const pGeom = new THREE.BufferGeometry();
    const pPositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      pPositions[i] = (Math.random() - 0.5) * 1.8;
      pPositions[i + 1] = (Math.random() - 0.5) * 1.8;
      pPositions[i + 2] = (Math.random() - 0.5) * 1.8;
    }
    pGeom.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x9333ea,
      size: 0.12,
      transparent: true,
      opacity: 0.65,
    });
    this.particles = new THREE.Points(pGeom, pMat);
    this.group.add(this.particles);

    this.scene.add(this.group);
  }

  public update(
    dt: number,
    time: number,
    playerPos: THREE.Vector3,
    onCatchPlayer: () => void
  ) {
    this.warningSoundCooldown -= dt;

    // 1. Stun / Recovery state
    if (this.isStunned) {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.isStunned = false;
      }
      // Floating wobble during stun
      this.position.y += Math.sin(time * 6) * 0.01;
      this.group.position.copy(this.position);
      this.coreMesh.rotation.y += dt * 0.8;
      return;
    }

    // 2. Vector pursuit toward player
    const targetY = playerPos.y + 0.9 + Math.sin(time * 3) * 0.25;
    const target = new THREE.Vector3(playerPos.x, targetY, playerPos.z);
    const toPlayer = new THREE.Vector3().subVectors(target, this.position);
    const dist = toPlayer.length();
    this.distanceToPlayer = dist;

    // Update Proximity Warning Level
    if (dist < 8.0) {
      this.warningLevel = 'danger';
      if (this.warningSoundCooldown <= 0) {
        soundManager.playStalkerWarning();
        this.warningSoundCooldown = 1.8;
      }
    } else if (dist < 18.0) {
      this.warningLevel = 'caution';
    } else {
      this.warningLevel = 'none';
    }

    // Dynamic speed: accelerate if falling too far behind
    let desiredSpeed = this.currentSpeed * this.speedScale;
    if (dist > 35) {
      desiredSpeed = this.currentSpeed * 1.6;
    } else if (dist > 20) {
      desiredSpeed = this.currentSpeed * 1.25;
    }

    // Steering velocity
    const dir = toPlayer.clone().normalize();
    const desiredVel = dir.multiplyScalar(desiredSpeed);
    this.velocity.lerp(desiredVel, Math.min(1.0, dt * 3.2));
    this.position.addScaledVector(this.velocity, dt);
    this.group.position.copy(this.position);

    // Smoothly orient towards player
    this.group.lookAt(playerPos.x, playerPos.y + 0.9, playerPos.z);

    // Animations: core rotation, ring tilt, wing flap
    this.coreMesh.rotation.y = time * 2.5;
    this.coreMesh.rotation.x = Math.sin(time * 1.8) * 0.2;
    this.ringMesh.rotation.z = time * 3.5;

    const flapSpeed = this.warningLevel === 'danger' ? 18 : 9;
    this.leftWing.rotation.z = Math.sin(time * flapSpeed) * 0.45;
    this.rightWing.rotation.z = -Math.sin(time * flapSpeed) * 0.45;

    // Eye light pulse
    this.eyeLight.intensity = 1.4 + Math.sin(time * 8) * 0.6;

    // Particle cloud swirl
    this.particles.rotation.y = time * 1.2;

    // 3. Attack collision check
    if (dist < 1.7) {
      // Caught the player!
      this.isStunned = true;
      this.stunTimer = 3.2;

      // Recoil stalker backward
      this.position.sub(dir.multiplyScalar(7.5));
      this.group.position.copy(this.position);

      soundManager.playEnemyBonk();
      soundManager.playStalkerWarning();
      onCatchPlayer();
    }
  }

  public setCheckpointSpeed(cpIndex: number) {
    if (cpIndex === 1) {
      this.currentSpeed = 4.6;
    } else if (cpIndex === 2) {
      this.currentSpeed = 5.2;
    } else if (cpIndex >= 3) {
      this.currentSpeed = 5.8;
    }
  }

  public resetPosition(playerPos: THREE.Vector3) {
    this.isStunned = false;
    this.stunTimer = 0;
    this.position.copy(playerPos).add(new THREE.Vector3(-14, 3, -14));
    this.velocity.set(0, 0, 0);
    this.group.position.copy(this.position);
  }

  public dispose() {
    this.scene.remove(this.group);
  }
}

