/**
 * Level Design and Floating Island World Generation
 * Stages, platforms, checkpoints, collectibles, and interactive parkour elements.
 * Features solid physical colliders for trees, checkpoint shrines, bells, and obstacles,
 * and perfectly tuned reachable jump trajectories.
 */
import * as THREE from 'three';
import { EnemyManager } from './enemies';
import {
  BouncyMushroomModel,
  CheckpointShrineModel,
  CollectibleModel,
  createBouncyMushroom,
  createCheckpointShrine,
  createCollectible,
  createCozyTree,
  createRollingWoolBall,
  createRotatingBalanceLog,
  createRotatingPinwheel,
  createSporeSteamVent,
  createSwingingObstacle,
  createUpdraftVortex,
  RollingWoolBallModel,
  RotatingBalanceLogModel,
  RotatingPinwheelModel,
  SporeSteamVentModel,
  SwingingObstacleModel,
  UpdraftVortexModel,
} from './models';
import { ProceduralTextures } from './textures';

export interface PlatformItem {
  id: string;
  type: 'static' | 'moving' | 'bouncy' | 'updraft' | 'crumbling';
  position: THREE.Vector3;
  size: THREE.Vector3;
  mesh: THREE.Object3D;
  movement?: {
    axis: 'x' | 'y' | 'z';
    amplitude: number;
    speed: number;
    offset: number;
  };
  initialPos?: THREE.Vector3;
  bouncyModel?: BouncyMushroomModel;
  updraftModel?: UpdraftVortexModel;
  isCrumbling?: boolean;
  crumbleTimer?: number;
  originalY?: number;
}

export interface CheckpointItem {
  id: number;
  name: string;
  spawnPos: THREE.Vector3;
  shrine: CheckpointShrineModel;
}

export interface SolidObstacleCollider {
  name: string;
  type: 'cylinder' | 'box';
  position: THREE.Vector3;
  radius?: number;
  height?: number;
  halfSize?: THREE.Vector3;
  bottomY: number;
  topY: number;
}

export interface WorldBuildResult {
  platforms: PlatformItem[];
  checkpoints: CheckpointItem[];
  collectibles: CollectibleModel[];
  obstacles: SwingingObstacleModel[];
  rollingBalls: RollingWoolBallModel[];
  pinwheels: RotatingPinwheelModel[];
  balanceLogs: RotatingBalanceLogModel[];
  steamVents: SporeSteamVentModel[];
  solidObstacles: SolidObstacleCollider[];
  decorativeMeshes: THREE.Object3D[];
  summitPosition: THREE.Vector3;
  enemyManager: EnemyManager;
}

export function buildCozyParkourWorld(
  scene: THREE.Scene,
  textures: ProceduralTextures
): WorldBuildResult {
  const platforms: PlatformItem[] = [];
  const checkpoints: CheckpointItem[] = [];
  const collectibles: CollectibleModel[] = [];
  const obstacles: SwingingObstacleModel[] = [];
  const rollingBalls: RollingWoolBallModel[] = [];
  const pinwheels: RotatingPinwheelModel[] = [];
  const balanceLogs: RotatingBalanceLogModel[] = [];
  const steamVents: SporeSteamVentModel[] = [];
  const solidObstacles: SolidObstacleCollider[] = [];
  const decorativeMeshes: THREE.Object3D[] = [];

  // Reusable materials
  const grassMat = new THREE.MeshStandardMaterial({
    map: textures.grass,
    roughness: 0.8,
    metalness: 0.05,
  });
  textures.grass.repeat.set(2, 2);

  const stoneMat = new THREE.MeshStandardMaterial({
    map: textures.stone,
    roughness: 0.85,
    metalness: 0.1,
  });
  textures.stone.repeat.set(1.5, 1.5);

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    roughness: 0.7,
    metalness: 0.1,
  });

  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xf0f7ff,
    roughness: 0.95,
    metalness: 0.0,
    transparent: true,
    opacity: 0.92,
  });

  // Helper to create a composite grassy floating island
  function createIsland(
    id: string,
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    h: number = 2.0,
    surface: 'grass' | 'stone' | 'wood' | 'cloud' = 'grass'
  ): PlatformItem {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    let mat = grassMat;
    if (surface === 'stone') mat = stoneMat;
    if (surface === 'wood') mat = woodMat;
    if (surface === 'cloud') mat = cloudMat;

    if (surface === 'cloud') {
      // Billowing 3D Cloud Cluster (organic pillowy clouds)
      const puffRadius = Math.min(w, d) * 0.36;
      const cols = Math.max(3, Math.ceil(w / 1.6));
      const rows = Math.max(3, Math.ceil(d / 1.6));

      // 1. Deck Puffs: Flattened soft spheres creating a pillowy walking mattress flush at Y = 0
      for (let ix = 0; ix < cols; ix++) {
        for (let iz = 0; iz < rows; iz++) {
          const u = (ix / (cols - 1) - 0.5) * (w - puffRadius * 0.7);
          const v = (iz / (rows - 1) - 0.5) * (d - puffRadius * 0.7);
          const pScale = 0.9 + Math.sin(ix * 2.5 + iz * 4.2) * 0.18;
          const r = puffRadius * pScale;
          const deckPuffGeom = new THREE.SphereGeometry(r, 10, 8);
          deckPuffGeom.scale(1.15, 0.55, 1.15);

          const deckPuff = new THREE.Mesh(deckPuffGeom, cloudMat);
          deckPuff.position.set(u, -r * 0.55, v);
          deckPuff.castShadow = true;
          deckPuff.receiveShadow = true;
          group.add(deckPuff);
        }
      }

      // 2. Billowing Perimeter Curves
      const perimeterCount = Math.max(8, Math.floor((w + d) * 1.5));
      for (let i = 0; i < perimeterCount; i++) {
        const angle = (i / perimeterCount) * Math.PI * 2;
        const radX = (w * 0.48) + Math.sin(angle * 3.5) * (w * 0.08);
        const radZ = (d * 0.48) + Math.cos(angle * 2.8) * (d * 0.08);
        const px = Math.cos(angle) * radX;
        const pz = Math.sin(angle) * radZ;
        const pRadius = puffRadius * (0.85 + Math.sin(i * 3.1) * 0.3);

        const edgePuffGeom = new THREE.SphereGeometry(pRadius, 8, 6);
        edgePuffGeom.scale(1.0, 0.65, 1.0);
        const edgePuff = new THREE.Mesh(edgePuffGeom, cloudMat);
        edgePuff.position.set(px, -pRadius * 0.4, pz);
        edgePuff.castShadow = true;
        edgePuff.receiveShadow = true;
        group.add(edgePuff);
      }

      // 3. Fluffy bottom underbelly
      const underCount = Math.max(3, Math.floor((w + d) * 0.7));
      for (let j = 0; j < underCount; j++) {
        const ang = (j / underCount) * Math.PI * 2 + 0.3;
        const dist = Math.min(w, d) * 0.25 * (0.6 + Math.sin(j * 4) * 0.4);
        const ux = Math.cos(ang) * dist;
        const uz = Math.sin(ang) * dist;
        const uRadius = puffRadius * (1.1 + Math.cos(j * 2.2) * 0.35);

        const underGeom = new THREE.SphereGeometry(uRadius, 8, 6);
        const underPuff = new THREE.Mesh(underGeom, cloudMat);
        underPuff.position.set(ux, -h * 0.65 - uRadius * 0.4, uz);
        underPuff.castShadow = true;
        underPuff.receiveShadow = true;
        group.add(underPuff);
      }
    } else {
      // Solid grassy or stone island box
      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = -h / 2; // top surface aligns exactly with y
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      group.add(mesh);
    }

    scene.add(group);

    const platform: PlatformItem = {
      id,
      type: 'static',
      position: new THREE.Vector3(x, y, z),
      size: new THREE.Vector3(w, h, d),
      mesh: group,
      originalY: y,
    };
    platforms.push(platform);
    return platform;
  }

  // Helper to add solid cylinder collider (trees, pillars, bells, posts)
  function registerCylinderCollider(
    name: string,
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number
  ) {
    solidObstacles.push({
      name,
      type: 'cylinder',
      position: new THREE.Vector3(x, y, z),
      radius,
      height,
      bottomY: y,
      topY: y + height,
    });
  }

  // Helper to register shrine colliders (Torii pillars + sacred bell)
  function registerShrineColliders(shrineName: string, pos: THREE.Vector3) {
    // Left pillar
    registerCylinderCollider(`${shrineName}_pillar_left`, pos.x + 0.65, pos.y, pos.z, 0.22, 2.5);
    // Right pillar
    registerCylinderCollider(`${shrineName}_pillar_right`, pos.x - 0.65, pos.y, pos.z, 0.22, 2.5);
    // Bell & Altar Center
    registerCylinderCollider(`${shrineName}_bell_altar`, pos.x, pos.y, pos.z, 0.42, 2.0);
  }

  // Helper to build overhead wooden frame for swinging pendulums
  function createPendulumGallows(x: number, yGround: number, z: number, span: number = 3.5, height: number = 4.8) {
    const frame = new THREE.Group();
    frame.position.set(x, yGround, z);

    // Left post
    const postGeom = new THREE.CylinderGeometry(0.12, 0.14, height, 8);
    postGeom.translate(0, height / 2, 0);
    const p1 = new THREE.Mesh(postGeom, woodMat);
    p1.position.x = -span / 2;
    p1.castShadow = true;
    frame.add(p1);

    // Right post
    const p2 = p1.clone();
    p2.position.x = span / 2;
    frame.add(p2);

    // Top beam
    const beamGeom = new THREE.BoxGeometry(span + 0.4, 0.25, 0.25);
    beamGeom.translate(0, height, 0);
    const beam = new THREE.Mesh(beamGeom, woodMat);
    beam.castShadow = true;
    frame.add(beam);

    scene.add(frame);
    decorativeMeshes.push(frame);

    // Register side post colliders
    registerCylinderCollider('gallows_post_left', x - span / 2, yGround, z, 0.2, height);
    registerCylinderCollider('gallows_post_right', x + span / 2, yGround, z, 0.2, height);
  }

  // ==========================================
  // ZONE 1: SUNRISE MEADOW (Warmup & Learning)
  // ==========================================
  // 1. Starting Sanctuary Island
  createIsland('start_island', 0, 0, 0, 14, 14, 2.5, 'grass');

  // Checkpoint 1: Shrine at start
  const shrine1 = createCheckpointShrine(textures);
  shrine1.group.position.set(0, 0, -3.5);
  shrine1.activate(); // Starting shrine is active
  scene.add(shrine1.group);
  checkpoints.push({
    id: 1,
    name: 'Sunrise Meadow',
    spawnPos: new THREE.Vector3(0, 0.2, 0),
    shrine: shrine1,
  });
  registerShrineColliders('shrine_1', new THREE.Vector3(0, 0, -3.5));

  // Trees on start island with solid trunk colliders
  const tree1 = createCozyTree('sakura', 1.1, textures);
  tree1.position.set(-4.5, 0, -4.0);
  const tree2 = createCozyTree('autumn', 0.95, textures);
  tree2.position.set(4.5, 0, -3.5);
  scene.add(tree1, tree2);
  decorativeMeshes.push(tree1, tree2);
  registerCylinderCollider('tree_start_sakura', -4.5, 0, -4.0, 0.42, 3.5);
  registerCylinderCollider('tree_start_autumn', 4.5, 0, -3.5, 0.38, 3.2);

  // Collectibles on start island
  collectibles.push(
    createCollectible('c1', 'golden_acorn', new THREE.Vector3(4.0, 1.2, 3.5)),
    createCollectible('c2', 'golden_acorn', new THREE.Vector3(-4.0, 1.2, 3.5))
  );

  // Stepping stones leading forward (comfortably spaced)
  createIsland('step_1', 0, 0.4, 9.5, 3.2, 3.2, 1.0, 'stone');
  createIsland('step_2', 2.5, 0.9, 13.5, 3.0, 3.0, 1.0, 'stone');
  collectibles.push(createCollectible('c3', 'sun_crystal', new THREE.Vector3(2.5, 2.1, 13.5)));

  // Bouncy Mushroom Island 1
  createIsland('mush_isle_1', 0, 1.4, 18.0, 5.0, 5.0, 1.5, 'grass');
  const bouncyMush1 = createBouncyMushroom(1.3, textures);
  bouncyMush1.group.position.set(0, 1.4, 18.0);
  scene.add(bouncyMush1.group);
  platforms.push({
    id: 'bouncy_mush_1',
    type: 'bouncy',
    position: new THREE.Vector3(0, 1.4 + 1.1, 18.0),
    size: new THREE.Vector3(2.6, 0.8, 2.6),
    mesh: bouncyMush1.group,
    bouncyModel: bouncyMush1,
  });

  // High Wooden Vault Target (Y = 4.8, perfectly caught by bouncy mushroom launch!)
  createIsland('arch_target', 0, 4.8, 24.5, 5.0, 6.0, 1.2, 'wood');
  collectibles.push(createCollectible('c4', 'sun_crystal', new THREE.Vector3(0, 6.0, 24.5)));

  // Stepping stones towards Zone 2
  createIsland('step_3', -3.2, 5.4, 30.0, 3.4, 3.4, 1.0, 'stone');

  // Step 4 with Floral Pinwheel obstacle standing cleanly on top of platform
  createIsland('step_4', -0.5, 6.0, 35.0, 4.0, 4.0, 1.0, 'stone');
  const pinwheel1 = createRotatingPinwheel(2.2, 1.2, 'z', textures);
  pinwheel1.group.position.set(-0.5, 6.0, 35.0);
  scene.add(pinwheel1.group);
  pinwheels.push(pinwheel1);
  registerCylinderCollider('pinwheel_1_post', -0.5, 6.0, 35.0, 0.35, 3.4);

  // Intermediate stepping stone to bridge effortlessly to Checkpoint 2
  createIsland('step_5', 2.2, 6.6, 39.5, 3.2, 3.2, 1.0, 'wood');

  // ==========================================
  // ZONE 2: WINDY CANOPY & CLOUD STEPPES
  // ==========================================
  // Checkpoint 2 Island
  createIsland('cp2_island', 5.0, 7.2, 45.0, 10.0, 10.0, 2.0, 'grass');
  const shrine2 = createCheckpointShrine(textures);
  shrine2.group.position.set(5.0, 7.2, 42.0);
  scene.add(shrine2.group);
  checkpoints.push({
    id: 2,
    name: 'Windy Canopy',
    spawnPos: new THREE.Vector3(5.0, 7.4, 44.5),
    shrine: shrine2,
  });
  registerShrineColliders('shrine_2', new THREE.Vector3(5.0, 7.2, 42.0));

  const autumnTree = createCozyTree('autumn', 1.2, textures);
  autumnTree.position.set(8.0, 7.2, 47.0);
  scene.add(autumnTree);
  decorativeMeshes.push(autumnTree);
  registerCylinderCollider('tree_autumn_cp2', 8.0, 7.2, 47.0, 0.45, 4.0);

  collectibles.push(createCollectible('c5', 'golden_acorn', new THREE.Vector3(8.0, 8.4, 43.0)));

  // Rotating Balance Log bridge connecting towards moving clouds
  // Seated securely on the island edge and bridging out towards the clouds
  const balanceLog1 = createRotatingBalanceLog(5.2, 0.55, 1.15, 'x', new THREE.Vector3(8.5, 7.4, 49.5), textures);
  scene.add(balanceLog1.group);
  balanceLogs.push(balanceLog1);

  // Register physical walkable platform so the player NEVER falls through the balance log!
  platforms.push({
    id: 'balance_log_1_plat',
    type: 'static',
    position: new THREE.Vector3(8.5, 7.4 + 0.55, 49.5),
    size: new THREE.Vector3(5.2, 1.1, 1.4),
    mesh: balanceLog1.group,
  });

  // Moving Cloud 1 (horizontal sway left-right with gentle amplitude)
  const cloud1 = createIsland('moving_cloud_1', 13.5, 7.8, 53.5, 4.5, 4.5, 1.2, 'cloud');
  cloud1.type = 'moving';
  cloud1.initialPos = new THREE.Vector3(13.5, 7.8, 53.5);
  cloud1.movement = { axis: 'x', amplitude: 1.5, speed: 0.9, offset: 0 };

  // Intermediate Cloud Stepping Stone: guarantees effortless crossing to Cloud 2
  createIsland('cloud_step_mid', 13.5, 8.8, 58.5, 3.8, 3.8, 1.2, 'cloud');

  // Moving Cloud 2 (gentle vertical lift up-down)
  const cloud2 = createIsland('moving_cloud_2', 11.0, 9.6, 63.5, 4.5, 4.5, 1.2, 'cloud');
  cloud2.type = 'moving';
  cloud2.initialPos = new THREE.Vector3(11.0, 9.6, 63.5);
  cloud2.movement = { axis: 'y', amplitude: 0.9, speed: 0.8, offset: Math.PI / 2 };
  collectibles.push(createCollectible('c6', 'sun_crystal', new THREE.Vector3(11.0, 11.2, 63.5)));

  // Resting Island with Overhead Gallows Swinging Chime, Rolling Yarn Ball & Spore Steam Vent
  createIsland('bridge_perch', 4.5, 10.4, 68.0, 6.5, 8.0, 1.5, 'wood');

  // Overhead gallows structure holding the swinging pendulum
  createPendulumGallows(4.5, 10.4, 68.0, 4.2, 4.6);
  const pendulum1 = createSwingingObstacle(3.2, 0.75, 2.8, textures);
  pendulum1.group.position.set(4.5, 10.4 + 4.6, 68.0);
  scene.add(pendulum1.group);
  obstacles.push(pendulum1);

  // Dynamic rolling physics yarn ball rolling along the bridge deck
  const woolBall1 = createRollingWoolBall(
    0.6,
    new THREE.Vector3(3.5, 10.4, 68.0),
    { minX: 2.2, maxX: 6.8, minZ: 65.5, maxZ: 70.5 },
    0xf4a261, // warm apricot yarn
    textures
  );
  scene.add(woolBall1.group);
  rollingBalls.push(woolBall1);

  // Cozy bubbling Steam Vent firmly on top of the perch deck
  const steamVent1 = createSporeSteamVent(0.9, 3.2, new THREE.Vector3(2.5, 10.4, 65.5), textures);
  scene.add(steamVent1.group);
  steamVents.push(steamVent1);
  registerCylinderCollider('steam_vent_1_stone', 2.5, 10.4, 65.5, 0.65, 0.9);

  // Updraft Thermal Geyser (lifts player skyward to +16 meters into the clouds!)
  createIsland('geyser_pad', -1.5, 10.6, 74.0, 5.5, 5.5, 1.5, 'stone');
  const updraft1 = createUpdraftVortex(2.4, 15.0);
  updraft1.group.position.set(-1.5, 10.6, 74.0);
  scene.add(updraft1.group);
  platforms.push({
    id: 'updraft_1',
    type: 'updraft',
    position: new THREE.Vector3(-1.5, 10.6, 74.0),
    size: new THREE.Vector3(5.0, 15.0, 5.0),
    mesh: updraft1.group,
    updraftModel: updraft1,
  });

  // Intermediate Cloud Stepping & Gliding Pad
  createIsland('cloud_glide_step', -1.5, 16.0, 79.5, 4.8, 4.8, 1.2, 'cloud');
  collectibles.push(createCollectible('c_glide', 'golden_acorn', new THREE.Vector3(-1.5, 17.3, 79.5)));

  // Spacious High Air Catch Platform (enlarged deck for smooth landing)
  createIsland('high_catch', -1.5, 18.0, 84.5, 5.5, 5.5, 1.4, 'wood');
  collectibles.push(createCollectible('c7', 'golden_acorn', new THREE.Vector3(-1.5, 19.3, 84.5)));

  // Bouncy Double-Hop: Mushroom 2 & Stepping Stone & Mushroom 3
  createIsland('mush_isle_2', -6.0, 18.2, 89.5, 4.5, 4.5, 1.2, 'grass');
  const bouncyMush2 = createBouncyMushroom(1.2, textures);
  bouncyMush2.group.position.set(-6.0, 18.2, 89.5);
  scene.add(bouncyMush2.group);
  platforms.push({
    id: 'bouncy_mush_2',
    type: 'bouncy',
    position: new THREE.Vector3(-6.0, 18.2 + 1.1, 89.5),
    size: new THREE.Vector3(2.5, 0.8, 2.5),
    mesh: bouncyMush2.group,
    bouncyModel: bouncyMush2,
  });

  // Intermediate stepping pad between mushrooms to make the jump 100% reliable
  createIsland('stepping_pad_mush', -9.5, 19.5, 93.5, 3.5, 3.5, 1.0, 'stone');

  createIsland('mush_isle_3', -13.0, 20.8, 97.5, 4.5, 4.5, 1.2, 'grass');
  const bouncyMush3 = createBouncyMushroom(1.25, textures);
  bouncyMush3.group.position.set(-13.0, 20.8, 97.5);
  scene.add(bouncyMush3.group);
  platforms.push({
    id: 'bouncy_mush_3',
    type: 'bouncy',
    position: new THREE.Vector3(-13.0, 20.8 + 1.1, 97.5),
    size: new THREE.Vector3(2.5, 0.8, 2.5),
    mesh: bouncyMush3.group,
    bouncyModel: bouncyMush3,
  });
  collectibles.push(createCollectible('c8', 'sun_crystal', new THREE.Vector3(-13.0, 22.2, 97.5)));

  // ==========================================
  // ZONE 3: CELESTIAL SPIRE & SUMMIT
  // ==========================================
  // Checkpoint 3 Island (height adjusted so Mushroom 3 bounce lands smoothly!)
  createIsland('cp3_island', -17.5, 24.5, 105.0, 11.0, 11.0, 2.5, 'stone');
  const shrine3 = createCheckpointShrine(textures);
  shrine3.group.position.set(-17.5, 24.5, 102.0);
  scene.add(shrine3.group);
  checkpoints.push({
    id: 3,
    name: 'Celestial Spire',
    spawnPos: new THREE.Vector3(-17.5, 24.7, 105.0),
    shrine: shrine3,
  });
  registerShrineColliders('shrine_3', new THREE.Vector3(-17.5, 24.5, 102.0));

  const sakuraTree2 = createCozyTree('sakura', 1.3, textures);
  sakuraTree2.position.set(-21.0, 24.5, 103.0);
  scene.add(sakuraTree2);
  decorativeMeshes.push(sakuraTree2);
  registerCylinderCollider('tree_sakura_cp3', -21.0, 24.5, 103.0, 0.48, 4.5);

  // Pinwheel 2 firmly planted on Checkpoint 3 stone pavement
  const pinwheel2 = createRotatingPinwheel(2.4, 1.3, 'x', textures);
  pinwheel2.group.position.set(-17.5, 24.5, 109.0);
  scene.add(pinwheel2.group);
  pinwheels.push(pinwheel2);
  registerCylinderCollider('pinwheel_2_post', -17.5, 24.5, 109.0, 0.35, 3.4);

  // Moving Cloud 3 (gentle Z-axis sway)
  const cloud3 = createIsland('moving_cloud_3', -17.5, 25.8, 114.0, 4.5, 4.5, 1.2, 'cloud');
  cloud3.type = 'moving';
  cloud3.initialPos = new THREE.Vector3(-17.5, 25.8, 114.0);
  cloud3.movement = { axis: 'z', amplitude: 1.4, speed: 1.0, offset: 0 };

  // Rotating Gear / Windmill Bridge
  const rotPad1 = createIsland('rotating_gear_1', -17.5, 27.2, 120.5, 4.0, 6.5, 0.8, 'wood');
  rotPad1.type = 'moving';

  // Ring Stepping Stone 1 with Steam Vent 2 planted firmly on its center
  createIsland('ring_step_1', -12.0, 28.5, 126.5, 3.6, 3.6, 1.0, 'stone');
  const steamVent2 = createSporeSteamVent(1.0, 3.4, new THREE.Vector3(-12.0, 28.5, 126.5), textures);
  scene.add(steamVent2.group);
  steamVents.push(steamVent2);
  registerCylinderCollider('steam_vent_2_stone', -12.0, 28.5, 126.5, 0.65, 0.9);
  collectibles.push(createCollectible('c9', 'sun_crystal', new THREE.Vector3(-12.0, 30.0, 126.5)));

  // Crumbling stone lilypad platform with overhead gallows pendulum
  const crumblePad = createIsland('ring_step_2', -6.5, 29.8, 128.5, 3.6, 3.6, 1.0, 'wood');
  crumblePad.type = 'crumbling';
  crumblePad.crumbleTimer = 1.6;
  crumblePad.isCrumbling = false;

  createPendulumGallows(-6.5, 29.8, 128.5, 3.4, 4.4);
  const pendulum2 = createSwingingObstacle(3.0, 0.8, 2.5, textures);
  pendulum2.group.position.set(-6.5, 29.8 + 4.4, 128.5);
  scene.add(pendulum2.group);
  obstacles.push(pendulum2);

  // Ring Step 3 with Rolling Wool Ball 2
  createIsland('ring_step_3', -1.0, 31.0, 127.5, 3.6, 3.6, 1.0, 'stone');
  const woolBall2 = createRollingWoolBall(
    0.6,
    new THREE.Vector3(-1.0, 31.0, 127.5),
    { minX: -2.3, maxX: 0.3, minZ: 126.0, maxZ: 129.0 },
    0x9b5de5, // soft lavender yarn
    textures
  );
  scene.add(woolBall2.group);
  rollingBalls.push(woolBall2);
  collectibles.push(createCollectible('c10', 'golden_acorn', new THREE.Vector3(-1.0, 32.5, 127.5)));

  // Bridge Step 4 leading to Summit Lift
  createIsland('ring_step_4', 3.5, 32.2, 125.5, 3.5, 3.5, 1.0, 'stone');

  // Final Updraft Lift straight up to the Summit!
  createIsland('summit_lift_pad', 8.0, 33.5, 123.0, 5.0, 5.0, 1.5, 'stone');
  const summitUpdraft = createUpdraftVortex(2.0, 13.0);
  summitUpdraft.group.position.set(8.0, 33.5, 123.0);
  scene.add(summitUpdraft.group);
  platforms.push({
    id: 'summit_updraft',
    type: 'updraft',
    position: new THREE.Vector3(8.0, 33.5, 123.0),
    size: new THREE.Vector3(4.2, 13.0, 4.2),
    mesh: summitUpdraft.group,
    updraftModel: summitUpdraft,
  });

  // ==========================================
  // THE GRAND SUMMIT GAZEBO (VICTORY HAVEN)
  // ==========================================
  const summitY = 42.0;
  createIsland('summit_haven', 18.0, summitY, 123.0, 18.0, 18.0, 3.0, 'grass');
  const summitPos = new THREE.Vector3(18.0, summitY + 0.2, 123.0);

  // Gazebo Pavilion Structure
  const gazeboGroup = new THREE.Group();
  gazeboGroup.position.set(18.0, summitY, 123.0);

  // Wooden deck plinth
  const deckGeom = new THREE.CylinderGeometry(5.2, 5.4, 0.4, 6);
  deckGeom.translate(0, 0.2, 0);
  const deck = new THREE.Mesh(deckGeom, woodMat);
  deck.receiveShadow = true;
  gazeboGroup.add(deck);

  // 6 Wooden Pillars
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const px = Math.cos(angle) * 4.4;
    const pz = Math.sin(angle) * 4.4;
    const pilGeom = new THREE.CylinderGeometry(0.14, 0.16, 3.2, 8);
    pilGeom.translate(0, 1.6 + 0.4, 0);
    const pil = new THREE.Mesh(pilGeom, woodMat);
    pil.position.set(px, 0, pz);
    pil.castShadow = true;
    gazeboGroup.add(pil);

    // Register solid pillar collider
    registerCylinderCollider(`gazebo_pillar_${i}`, 18.0 + px, summitY, 123.0 + pz, 0.22, 3.5);
  }

  // Pagoda roof
  const roofGeom = new THREE.ConeGeometry(5.8, 2.2, 6);
  roofGeom.translate(0, 3.6 + 1.1, 0);
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x9b2226, // warm cozy crimson pagoda roof
    roughness: 0.7,
    metalness: 0.1,
  });
  const roof = new THREE.Mesh(roofGeom, roofMat);
  roof.castShadow = true;
  gazeboGroup.add(roof);

  // Warm hanging lantern chandelier in center
  const chanGeom = new THREE.SphereGeometry(0.35, 12, 12);
  const chanMat = new THREE.MeshBasicMaterial({ color: 0xffe8a1 });
  const chan = new THREE.Mesh(chanGeom, chanMat);
  chan.position.set(0, 3.2, 0);
  gazeboGroup.add(chan);

  // Picnic table & cozy cushions
  const tableGeom = new THREE.CylinderGeometry(1.2, 1.2, 0.5, 12);
  tableGeom.translate(0, 0.65, 0);
  const table = new THREE.Mesh(tableGeom, woodMat);
  table.castShadow = true;
  gazeboGroup.add(table);
  registerCylinderCollider('summit_table', 18.0, summitY, 123.0, 1.3, 1.1);

  // Cute teapot on table
  const potGeom = new THREE.SphereGeometry(0.2, 10, 10);
  const potMat = new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.3 });
  const pot = new THREE.Mesh(potGeom, potMat);
  pot.position.set(0, 0.95 + 0.1, 0);
  gazeboGroup.add(pot);

  // Telescope pointing into the starry horizon
  const scopeGeom = new THREE.CylinderGeometry(0.1, 0.07, 1.2, 8);
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xdfb15b, metalness: 0.9, roughness: 0.2 });
  const scope = new THREE.Mesh(scopeGeom, brassMat);
  scope.position.set(3.8, 1.5, 0);
  scope.rotation.z = -0.55;
  scope.rotation.y = 0.4;
  gazeboGroup.add(scope);

  scene.add(gazeboGroup);
  decorativeMeshes.push(gazeboGroup);

  // Master Sun Crystal atop the gazebo
  collectibles.push(
    createCollectible('c_master', 'sun_crystal', new THREE.Vector3(18.0, summitY + 6.2, 123.0))
  );

  // Twin Pine and Sakura trees at the summit garden
  const summitTree1 = createCozyTree('sakura', 1.2, textures);
  summitTree1.position.set(12.5, summitY, 117.0);
  const summitTree2 = createCozyTree('autumn', 1.1, textures);
  summitTree2.position.set(23.5, summitY, 129.0);
  scene.add(summitTree1, summitTree2);
  decorativeMeshes.push(summitTree1, summitTree2);
  registerCylinderCollider('tree_summit_sakura', 12.5, summitY, 117.0, 0.45, 4.0);
  registerCylinderCollider('tree_summit_autumn', 23.5, summitY, 129.0, 0.42, 3.8);

  // Add all collectibles to scene
  collectibles.forEach((c) => scene.add(c.group));

  // ==========================================
  // COZY ENEMIES (Sproutlings & Zephyr Puffs)
  // ==========================================
  const enemyManager = new EnemyManager(scene, textures);

  // 1. Zone 1 - Sproutling 1: Waddles on the high stone arch vault target
  enemyManager.spawnSproutling('sproutling_1', new THREE.Vector3(0, 4.8, 24.5), 'x', 1.6);

  // 2. Zone 2 - Zephyr Puff 1: Floats between moving cloud platforms blowing gusts
  enemyManager.spawnZephyrPuff('zephyr_1', new THREE.Vector3(12.5, 9.2, 56.0), 'x', 2.2);

  // 3. Zone 2 - Sproutling 2: Waddles along the bridge perch near swinging pendulum
  enemyManager.spawnSproutling('sproutling_2', new THREE.Vector3(4.5, 10.4, 68.0), 'z', 2.2);

  // 4. Zone 3 - Zephyr Puff 2: Floats beside the celestial spire ascent
  enemyManager.spawnZephyrPuff('zephyr_2', new THREE.Vector3(-14.5, 26.5, 117.0), 'z', 2.4);

  // 5. Zone 3 - Sproutling 3: Guards the Celestial Spire courtyard
  enemyManager.spawnSproutling('sproutling_3', new THREE.Vector3(-17.5, 24.5, 107.0), 'x', 2.8);

  return {
    platforms,
    checkpoints,
    collectibles,
    obstacles,
    rollingBalls,
    pinwheels,
    balanceLogs,
    steamVents,
    solidObstacles,
    decorativeMeshes,
    summitPosition: summitPos,
    enemyManager,
  };
}
