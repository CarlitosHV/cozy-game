/**
 * Central Three.js Game Engine for Cozy Parkour World
 * Full WebGL PBR setup, RoomEnvironment reflection, soft shadows,
 * damped third-person camera, input buffering, and software WebGL guard.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { soundManager, WeatherType } from '../audio/SoundtrackSynthesizer';
import { buildCozyParkourWorld, WorldBuildResult } from './levels';
import { createPlayerCharacter, disposePlayerCharacter, PlayerCharacterModel } from './models';
import { CharacterAppearance, loadAppearance, saveAppearance } from './character';
import { ParkourPhysics, PlayerInput } from './physics';
import { createProceduralTextures, ProceduralTextures } from './textures';
import { WeatherSystem } from './weather';
import { AetherStalker } from './enemies';
import { CompanionPowerSystem } from './companionPowers';
import { ItemSystem, ItemType, ItemUseContext, ITEM_INFO } from './items';
import { buildAeroWorld } from './levelAero';
import { buildCosmicWorld } from './levelCosmic';
import { buildSwampWorld } from './levelSwamp';
import { makeGlowTexture } from './levelKit';
import { LEVELS, markLevelComplete, isCompanionUnlocked, isLevelUnlocked, themeForLevel, ThemeId, COMPANION_UNLOCKS, levelInfo, isBossLevel } from './progress';
import { generateLevel } from './levelGen';
import { generateBossArena } from './bossArena';
import { CombatStatus, CombatSystem } from './combat';
import { PuzzleSystem } from './puzzles';
import { CompanionStyle } from './character';
import { RemotePlayersManager } from './RemotePlayersManager';
import { multiplayerClient } from '../services/multiplayerClient';
import { apiClient } from '../services/apiClient';

export { LEVELS };

/** Per-theme atmosphere: base weather and the sky shown on victory. */
const THEME_ATMOS: Record<ThemeId, { weather: WeatherType; title: string; victoryWeather: WeatherType; victoryTitle: string; victoryDesc: string }> = {
  cozy: { weather: 'golden_hour', title: 'Hora Dorada', victoryWeather: 'starlit_night', victoryTitle: 'Noche Estrellada', victoryDesc: '¡Cima alcanzada!' },
  cosmic: { weather: 'cosmic', title: 'Ruta Cósmica', victoryWeather: 'starlit_night', victoryTitle: 'Lluvia de Estrellas', victoryDesc: '¡Llegaste al Observatorio Estelar!' },
  swamp: { weather: 'swamp_mist', title: 'Pantano Sombrío', victoryWeather: 'starlit_night', victoryTitle: 'Noche de Luciérnagas', victoryDesc: '¡Llegaste al Santuario de las Luciérnagas!' },
  aero: { weather: 'aero_day', title: 'Valle Aero', victoryWeather: 'golden_hour', victoryTitle: 'Atardecer Aero', victoryDesc: '¡Llegaste a la Plaza del Globo!' },
  garden: { weather: 'garden_day', title: 'Jardín Gigante', victoryWeather: 'golden_hour', victoryTitle: 'Tarde en el Jardín', victoryDesc: '¡Llegaste al Girasol Gigante!' },
  castle: { weather: 'castle_night', title: 'Castillo Embrujado', victoryWeather: 'starlit_night', victoryTitle: 'Noche Estrellada', victoryDesc: '¡Llegaste a la Torre del Vampiro!' },
};
const atmos = (level: number) => THEME_ATMOS[themeForLevel(level)];

export type GameMode = 'free' | 'time_trial' | 'chase';
export type GameState = 'title' | 'playing' | 'paused' | 'victory' | 'photo_mode' | 'game_over';
export type CharacterPreviewFocus = 'full' | 'head' | 'torso' | 'feet' | 'companion';

const PREVIEW_FOCUS: Record<
  CharacterPreviewFocus,
  { lookY: number; camY: number; dist: number; pitch: number }
> = {
  full: { lookY: 0.7, camY: 0.95, dist: 2.55, pitch: 0.08 },
  head: { lookY: 1.0, camY: 1.08, dist: 1.35, pitch: 0.18 },
  torso: { lookY: 0.58, camY: 0.82, dist: 2.05, pitch: 0.05 },
  feet: { lookY: 0.18, camY: 0.48, dist: 1.65, pitch: -0.12 },
  companion: { lookY: 1.12, camY: 1.2, dist: 1.9, pitch: 0.16 },
};

export interface WeatherNotice {
  weather: WeatherType;
  title: string;
  desc: string;
  reason: 'milestone' | 'manual';
}

export interface GameEngineCallbacks {
  onStateChange: (state: GameState) => void;
  onCheckpointChange: (name: string, index: number) => void;
  onCollectiblesChange: (collected: number, total: number) => void;
  onWeatherChange: (weather: WeatherType, isTransitioning?: boolean) => void;
  onWeatherNotice?: (notice: WeatherNotice) => void;
  onModeChange?: (mode: GameMode) => void;
  onTimeTrialTick?: (timeRemaining: number, bonusNotice?: { seconds: number; reason: string }) => void;
  onStalkerProximity?: (distance: number, warningLevel: 'none' | 'caution' | 'danger') => void;
  onEasterEgg?: () => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;

  // Three.js core
  public renderer!: THREE.WebGLRenderer;
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private clock!: THREE.Timer;
  private isSoftwareGl: boolean = false;

  // Systems
  public textures!: ProceduralTextures;
  public world!: WorldBuildResult;
  public playerModel!: PlayerCharacterModel;
  public physics!: ParkourPhysics;
  public weatherSystem!: WeatherSystem;
  public companionPowers!: CompanionPowerSystem;
  public itemSystem!: ItemSystem;
  private itemCtx!: ItemUseContext;
  /** Push blocks, doors, key carriers and sentinels */
  public puzzleSystem: PuzzleSystem = new PuzzleSystem();
  /** 3D online multiplayer avatars */
  public remotePlayers!: RemotePlayersManager;
  /** Boss fights: life bar, tools, the boss itself (null on other levels) */
  public combat: CombatSystem | null = null;
  private lookRaise = 0;
  private lookBack = 0;
  private darkBase: { dir: number; hemi: number; fogDensity: number; fogColor: THREE.Color; exposure: number } | null = null;

  // Levels
  public currentLevel: number = 1;
  private levelRoot!: THREE.Group;
  /** Companion unlocked by the last victory (shown on the victory screen) */
  public lastUnlocked: CompanionStyle | null = null;
  private easterEggFound = false;
  // The level's companion waiting at the summit
  private showcase: THREE.Object3D | null = null;
  private showcaseBase = new THREE.Vector3();

  // Game state & modes
  public gameState: GameState = 'title';
  public gameMode: GameMode = 'free';
  public timeRemaining: number = 90;
  public stalker: AetherStalker | null = null;
  private frameId: number = 0;
  private isDisposed: boolean = false;
  private lastWallTime: number = typeof performance !== 'undefined' ? performance.now() : Date.now();


  // Camera Orbit & Follow
  public cameraYaw: number = 0;
  public cameraPitch: number = 0.28; // slight downward angle
  public cameraDistance: number = 5.8;
  private targetCameraPos = new THREE.Vector3();
  private targetLookAt = new THREE.Vector3();
  private isMouseDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Mobile / Touchscreen Auto-Follow Camera
  public isTouchDevice: boolean = false;
  public autoChaseCamera: boolean = true;
  public isUIModalOpen: boolean = false;
  /** When true, Escape will not toggle pause (HUD overlays handle Esc first). */
  public pauseToggleBlocked: boolean = false;
  /** Private party room from invite:result (`party_*`). Null = public level room. */
  private partyRoomId: string | null = null;
  private reverseRunTimer: number = 0;
  private directionTurnCooldown: number = 0;
  private lastInputVector = new THREE.Vector2();

  // Character Creator preview (close-up turntable camera on the title screen)
  public playerAppearance: CharacterAppearance = loadAppearance();
  public characterPreview: boolean = false;
  private previewBlend: number = 0;
  private previewYaw: number = 0;
  private previewPitch: number = 0.08;
  private previewPitchUser: number = 0;
  private previewZoom: number = 1;
  private previewFocus: CharacterPreviewFocus = 'full';
  private previewLookY: number = PREVIEW_FOCUS.full.lookY;
  private previewCamY: number = PREVIEW_FOCUS.full.camY;
  private previewBaseDistance: number = PREVIEW_FOCUS.full.dist;
  private previewTargetLookY: number = PREVIEW_FOCUS.full.lookY;
  private previewTargetCamY: number = PREVIEW_FOCUS.full.camY;
  private previewTargetDist: number = PREVIEW_FOCUS.full.dist;
  private previewTargetPitch: number = PREVIEW_FOCUS.full.pitch;
  private previewIdleSpin: boolean = true;
  private previewSpinResumeAt: number = 0;
  private viewOffsetActive: boolean = false;
  private _orbitPos = new THREE.Vector3();
  private _orbitLook = new THREE.Vector3();
  private _previewPos = new THREE.Vector3();
  private _previewLook = new THREE.Vector3();

  // Photo Mode State
  public photoModePaused: boolean = false;
  public photoFov: number = 55;
  public photoElevation: number = 0;
  public photoDistance: number = 5.0;
  public photoYaw: number = 0;
  public photoPitch: number = 0.25;
  public photoRoll: number = 0;
  public photoTarget = new THREE.Vector3();

  // Input state
  private rawKeys: Record<string, boolean> = {};
  public virtualInput: PlayerInput = {
    forward: 0,
    right: 0,
    jump: false,
    sprint: false,
    crouch: false,
  };
  public currentInput: PlayerInput = {
    forward: 0,
    right: 0,
    jump: false,
    sprint: false,
    crouch: false,
  };

  constructor(container: HTMLElement, callbacks: GameEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.init();
  }

  private init() {
    if (typeof window !== 'undefined') {
      this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 850;
    }

    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      250
    );
    this.clock = new THREE.Timer();
    this.clock.connect(document);

    // 4. Procedural Studio Environment Reflection
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {
      // fallback
    }

    // 5. Lighting Rig
    this.dirLight = new THREE.DirectionalLight(0xffa45c, 2.2);
    this.dirLight.position.set(25, 45, 20);
    this.dirLight.castShadow = !this.isSoftwareGl;
    if (this.dirLight.castShadow) {
      this.dirLight.shadow.mapSize.width = 1024;
      this.dirLight.shadow.mapSize.height = 1024;
      this.dirLight.shadow.camera.near = 0.5;
      this.dirLight.shadow.camera.far = 120;
      const d = 25;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(0xffd29d, 0x5c715e, 1.1);
    this.scene.add(this.hemiLight);

    // 6. Textures & World Build
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAnisotropy);

    this.levelRoot = new THREE.Group();
    this.scene.add(this.levelRoot);
    this.world = this.buildLevel(this.currentLevel);
    this.addCompanionShowcase();
    this.playerModel = createPlayerCharacter(this.textures, this.playerAppearance);
    this.scene.add(this.playerModel.group);

    // 7. Physics Controller
    this.physics = new ParkourPhysics(this.world, this.playerModel);

    // 7b. Companion Powers (key G) & companion snacks around the islands
    this.companionPowers = new CompanionPowerSystem(this.scene);
    this.companionPowers.setCompanion(this.playerAppearance.companion, this.physics);
    this.companionPowers.reset(this.physics);

    // 7c. Backpack items (berries, walnuts…) — 5 slots, keys 1-5
    this.itemSystem = new ItemSystem(this.scene);
    this.itemSystem.loadSpots(this.world.itemSpots);
    this.puzzleSystem.load(this.world.puzzles, this.world.platforms);
    this.itemCtx = {
      feedCompanion: () => this.companionPowers.feed(),
      setJumpMultiplier: (m: number) => {
        this.physics.jumpMultiplier = m;
      },
      tool: (type: ItemType) => {
        if (this.combat) return this.combat.tool(type);
        this.itemSystem.notify(`${ITEM_INFO[type].name}: sirve en las luchas contra jefes`);
        return 'none';
      },
    };

    // 8. Weather System
    this.weatherSystem = new WeatherSystem(this.scene, this.dirLight, this.hemiLight, this.textures);
    this.weatherSystem.onTransitionChange = (target, progress, finished) => {
      this.callbacks.onWeatherChange(target, !finished);
    };

    // 8b. Online Multiplayer Remote Players Manager
    this.remotePlayers = new RemotePlayersManager(this.scene, this.textures);
    // Shared puzzle progress inside a party: orbs found and rocks pushed by anyone count for everyone
    multiplayerClient.onWorldState = (data) => {
      if (data.levelId === this.currentLevel) this.applySharedWorld(data);
    };
    multiplayerClient.onWorldOrb = (data) => {
      if (data.levelId !== this.currentLevel) return;
      this.puzzleSystem.collectOrbRemote(data.orbIndex, data.username || 'Tu equipo', this.itemSystem);
    };
    multiplayerClient.onWorldBlock = (data) => {
      if (data.levelId !== this.currentLevel) return;
      this.puzzleSystem.setBlockRemote(data.blockIndex, data.x, data.y, data.z);
    };
    multiplayerClient.onWorldEvent = (data) => {
      if (data.levelId !== this.currentLevel || !this.combat) return;
      this.combat.onEvent(data.kind, data.i ?? 0, data.v ?? 0, data.target, data.userId ?? '', false);
    };
    this.resetCombat();
    if (this.partyRoomId) {
      multiplayerClient.joinLevel(this.currentLevel, this.partyRoomId);
    }

    // 9. Input & Window Listeners
    this.setupListeners();

    // Initial compile to pre-warm shaders
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Report initial state
    this.callbacks.onCollectiblesChange(0, this.physics.totalCollectibles);
    this.callbacks.onCheckpointChange('Pradera del Amanecer', 1);

    // Start render loop
    this.startLoop();
  }

  /** Time trial budget: open-world levels with orbs are bigger, so they get more time. */
  private timeTrialStart(): number {
    if (this.world?.boss) return 240;
    const orbs = this.world?.puzzles?.orbs.length ?? 0;
    return orbs > 0 ? 100 + orbs * 25 : 90;
  }

  public setGameMode(mode: GameMode) {
    this.gameMode = mode;
    if (mode === 'time_trial') {
      this.timeRemaining = this.timeTrialStart();
      if (this.stalker) {
        this.stalker.dispose();
        this.stalker = null;
      }
      this.callbacks.onTimeTrialTick?.(this.timeRemaining);
    } else if (mode === 'chase') {
      if (!this.stalker) {
        this.stalker = new AetherStalker(this.scene, this.physics.position);
      } else {
        this.stalker.resetPosition(this.physics.position);
      }
    } else {
      if (this.stalker) {
        this.stalker.dispose();
        this.stalker = null;
      }
    }
    this.callbacks.onModeChange?.(mode);
  }

  /**
   * Rebuilds the player's 3D model with a new look, keeping its place in the world.
   * Called live by the Character Creator for every change.
   */
  public setPlayerAppearance(appearance: CharacterAppearance, persist: boolean = true) {
    this.playerAppearance = { ...appearance };
    if (!isCompanionUnlocked(this.playerAppearance.companion)) this.playerAppearance.companion = 'ninguno';
    const old = this.playerModel;
    const next = createPlayerCharacter(this.textures, this.playerAppearance);
    next.group.position.copy(old.group.position);
    next.group.rotation.copy(old.group.rotation);
    this.scene.remove(old.group);
    disposePlayerCharacter(old);
    this.scene.add(next.group);
    this.playerModel = next;
    this.physics.playerModel = next;
    this.companionPowers.setCompanion(this.playerAppearance.companion, this.physics);
    if (persist) {
      saveAppearance(this.playerAppearance);
      if (apiClient.isAuthenticated()) {
        apiClient.updateAppearance(this.playerAppearance).catch(() => {});
      }
    }
  }

  /** Toggles the close-up turntable camera used while the Character Creator is open. */
  public setCharacterPreview(enabled: boolean) {
    if (enabled && !this.characterPreview) {
      this.previewYaw = this.playerModel.group.rotation.y + Math.PI + 0.35;
      this.previewZoom = 1;
      this.previewIdleSpin = true;
      this.setCharacterPreviewFocus('full', true);
    }
    this.characterPreview = enabled;
  }

  /** Frames a body region while customizing (head, clothes, boots, companion…). */
  public setCharacterPreviewFocus(focus: CharacterPreviewFocus, instant: boolean = false) {
    this.previewFocus = focus;
    const preset = PREVIEW_FOCUS[focus];
    this.previewTargetLookY = preset.lookY;
    this.previewTargetCamY = preset.camY;
    this.previewTargetDist = preset.dist;
    this.previewTargetPitch = preset.pitch;
    this.previewPitchUser = 0;
    if (instant) {
      this.previewLookY = preset.lookY;
      this.previewCamY = preset.camY;
      this.previewBaseDistance = preset.dist;
      this.previewPitch = preset.pitch;
      this.previewZoom = 1;
    } else {
      this.previewZoom = THREE.MathUtils.clamp(this.previewZoom, 0.8, 1.25);
    }
  }

  /** Manual zoom for the creator (wheel / pinch / UI buttons). */
  public adjustCharacterPreviewZoom(delta: number) {
    this.previewZoom = THREE.MathUtils.clamp(this.previewZoom + delta, 0.6, 1.85);
    this.previewIdleSpin = false;
    this.previewSpinResumeAt = performance.now() + 2200;
  }

  /** Uses the companion's temporary power (key G or the HUD button). */
  public activateCompanionPower() {
    if (this.gameState !== 'playing') return;
    this.companionPowers.activate(this.physics, this.stalker ? this.stalker.position : null);
    multiplayerClient.triggerCompanionPower(this.playerAppearance.companion);
  }

  /** Fresh run: power ready, snacks restored, companion back to normal size. */
  private resetCompanionPowers() {
    this.companionPowers.reset(this.physics);
    const sprite = this.playerModel.companionSprite;
    sprite.visible = this.playerAppearance.companion !== 'ninguno';
    sprite.scale.setScalar(1);
  }

  private clearPreviewCamera() {
    this.characterPreview = false;
    this.previewBlend = 0;
    if (this.viewOffsetActive) {
      this.camera.clearViewOffset();
      this.viewOffsetActive = false;
    }
  }

  private buildLevel(level: number): WorldBuildResult {
    switch (level) {
      case 2:
        return buildCosmicWorld(this.levelRoot, this.textures);
      case 3:
        return buildSwampWorld(this.levelRoot, this.textures);
      case 4:
        return buildAeroWorld(this.levelRoot, this.textures);
      case 1:
        return buildCozyParkourWorld(this.levelRoot, this.textures);
      default:
        // Level 5 and beyond: generated — an open sandbox zone or a boss arena (random per level)
        return isBossLevel(level) ? generateBossArena(level, this.levelRoot, this.textures) : generateLevel(level, this.levelRoot, this.textures);
    }
  }

  /** Enemies get more hostile as you advance: 0 on level 1 → 1 on level 41+. */
  public get hostility(): number {
    return Math.min(1, Math.max(0, (this.currentLevel - 1) / 40));
  }

  private applyHostility() {
    if (this.world.enemyManager) this.world.enemyManager.hostility = this.hostility;
  }

  /** Display name of the current level. */
  public get levelName(): string {
    return this.world.levelName ?? levelInfo(this.currentLevel).name;
  }

  private levelWeather(): WeatherType {
    return atmos(this.currentLevel).weather;
  }

  /** On the levels that award a companion (10, 20, 30, 40) it waits for you at the summit. */
  private addCompanionShowcase() {
    this.showcase = null;
    const reward = COMPANION_UNLOCKS.find((u) => u.level === this.currentLevel);
    if (!reward) return;
    const temp = createPlayerCharacter(this.textures, { ...this.playerAppearance, companion: reward.companion });
    const sprite = temp.companionSprite;
    temp.group.remove(sprite);
    disposePlayerCharacter(temp);
    sprite.visible = true;
    sprite.scale.setScalar(3.2);
    const pos = this.world.companionShowcasePos ?? this.world.summitPosition.clone().add(new THREE.Vector3(-4, 3, 0));
    sprite.position.copy(pos);
    this.showcaseBase.copy(pos);
    // Soft glow behind it
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: makeGlowTexture('rgba(255,247,214,0.85)'), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    glow.scale.setScalar(0.9);
    sprite.add(glow);
    this.levelRoot.add(sprite);
    this.showcase = sprite;
  }

  private updateShowcase(time: number) {
    if (!this.showcase) return;
    this.showcase.position.y = this.showcaseBase.y + Math.sin(time * 1.6) * 0.5;
    this.showcase.rotation.y = time * 0.6;
  }

  /** Unloads the current level and builds another one (keeps player, companion & backpack). */
  public loadLevel(level: number) {
    level = Math.max(1, Math.floor(level));
    if (level === this.currentLevel || !isLevelUnlocked(level)) return;

    // Tear down the old world
    this.disposeCombat();
    if (this.stalker) {
      this.stalker.dispose();
      this.stalker = null;
    }
    this.world.enemyManager?.dispose();
    this.scene.remove(this.levelRoot);
    const shared = new Set<THREE.Texture>(Object.values(this.textures).filter((t): t is THREE.Texture => t instanceof THREE.Texture));
    this.levelRoot.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        const map = (m as THREE.MeshStandardMaterial).map;
        if (map && !shared.has(map)) map.dispose();
        m.dispose();
      }
    });

    // Build the new one
    this.currentLevel = level;
    this.remotePlayers?.clearAll();
    if (this.partyRoomId) {
      multiplayerClient.joinLevel(level, this.partyRoomId);
    } else {
      multiplayerClient.leaveRoom();
    }
    this.levelRoot = new THREE.Group();
    this.scene.add(this.levelRoot);
    this.world = this.buildLevel(level);
    this.applyHostility();
    this.addCompanionShowcase();
    this.physics = new ParkourPhysics(this.world, this.playerModel);
    this.physics.jumpMultiplier = this.itemSystem.superJumpLeft > 0 ? 1.4 : 1;
    this.companionPowers.reset(this.physics);
    this.itemSystem.loadSpots(this.world.itemSpots);
    // Keys only open doors of their own level
    this.itemSystem.removeAllOfType('llave');
    this.puzzleSystem.load(this.world.puzzles, this.world.platforms);
    this.reapplySharedWorld();
    this.resetCombat();

    this.callbacks.onCollectiblesChange(0, this.physics.totalCollectibles);
    const cp0 = this.world.checkpoints[0];
    this.callbacks.onCheckpointChange(cp0 ? cp0.name : '', 1);
    // New world: switch the sky almost instantly
    this.weatherSystem.setWeather(this.levelWeather(), 0.2);
    soundManager.setWeather(this.levelWeather(), 1.5);
    this.callbacks.onWeatherChange(this.levelWeather(), true);
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  /** From the victory screen: travel to the next level keeping your backpack. */
  public goToNextLevel() {
    const next = this.currentLevel + 1;
    if (!isLevelUnlocked(next)) return;
    this.loadLevel(next);
    this.beginRun(this.gameMode, false);
  }

  /** Uses the backpack item in a slot (0-4). */
  public useItem(slot: number) {
    if (this.gameState !== 'playing') return;
    this.itemSystem.use(slot, this.itemCtx);
  }

  public discardItem(slot: number) {
    return this.itemSystem.discard(slot);
  }

  public restoreItem(slot: number, type: ItemType) {
    return this.itemSystem.restore(slot, type);
  }

  public useAllItemsOfType(type: ItemType) {
    if (this.gameState !== 'playing') return 0;
    return this.itemSystem.useAllOfType(type, this.itemCtx);
  }

  public discardAllOfType(type: ItemType) {
    return this.itemSystem.discardAllOfType(type);
  }

  public restoreItems(entries: { slot: number; type: ItemType }[]) {
    return this.itemSystem.restoreMany(entries);
  }

  public startGame(mode?: GameMode, level?: number) {
    if (level !== undefined) this.loadLevel(level);
    this.beginRun(mode, true);
    if (this.partyRoomId) {
      multiplayerClient.joinLevel(this.currentLevel, this.partyRoomId);
    } else {
      multiplayerClient.leaveRoom();
      this.remotePlayers?.clearAll();
    }
  }

  public getPartySpawnOffset(): { x: number; z: number } | undefined {
    if (!this.partyRoomId) return undefined;
    const isHost = multiplayerClient.isPartyHostRole();
    return isHost ? { x: -0.9, z: 0 } : { x: 0.9, z: 0 };
  }

  private beginRun(mode: GameMode | undefined, freshBackpack: boolean) {
    this.lastUnlocked = null;
    this.clearPreviewCamera();
    this.resetCompanionPowers();
    this.physics.resetCollectibles();
    this.callbacks.onCollectiblesChange(0, this.physics.totalCollectibles);
    this.itemSystem.resetPickups();
    if (freshBackpack) this.itemSystem.clearInventory(this.itemCtx);
    this.itemSystem.removeAllOfType('llave');
    this.puzzleSystem.reset();
    this.reapplySharedWorld();
    this.resetCombat();
    this.physics.respawnAtCheckpoint(0, false, this.getPartySpawnOffset());
    soundManager.init();
    soundManager.resume();
    if (mode) {
      this.setGameMode(mode);
    }
    this.gameState = 'playing';
    this.lastWallTime = performance.now();
    this.physics.hasReachedSummit = false;
    this.callbacks.onStateChange('playing');
    if (this.gameMode === 'time_trial') {
      this.timeRemaining = this.timeTrialStart();
      this.callbacks.onTimeTrialTick?.(this.timeRemaining);
    } else if (this.gameMode === 'chase') {
      if (!this.stalker) {
        this.stalker = new AetherStalker(this.scene, this.physics.position);
      } else {
        this.stalker.resetPosition(this.physics.position);
      }
    }
    if (this.weatherSystem.currentWeather !== this.levelWeather()) {
      if (this.currentLevel === 1) {
        this.transitionWeather('golden_hour', 2.5, 'milestone', 'Hora Dorada', 'Prado del Amanecer');
      } else {
        const theme = atmos(this.currentLevel);
        this.transitionWeather(theme.weather, 2.5, 'milestone', theme.title, this.world.checkpoints[0]?.name ?? '');
      }
    }
  }

  public setPaused(paused: boolean) {
    if (this.gameState === 'title' || this.gameState === 'victory' || this.gameState === 'game_over') return;
    this.gameState = paused ? 'paused' : 'playing';
    this.physics.isMovementLocked = paused || this.isUIModalOpen;
    if (paused) {
      this.currentInput.forward = 0;
      this.currentInput.right = 0;
      this.currentInput.jump = false;
      this.currentInput.sprint = false;
      this.currentInput.crouch = false;
      this.virtualInput.forward = 0;
      this.virtualInput.right = 0;
      this.physics.velocity.x = 0;
      this.physics.velocity.z = 0;
    } else {
      this.lastWallTime = performance.now();
    }
    this.callbacks.onStateChange(this.gameState);
  }

  public setUIModalOpen(open: boolean) {
    this.isUIModalOpen = open;
    this.physics.isMovementLocked = open || this.gameState === 'paused' || this.gameState === 'victory';
    if (open) {
      this.currentInput.forward = 0;
      this.currentInput.right = 0;
      this.currentInput.jump = false;
      this.currentInput.sprint = false;
      this.currentInput.crouch = false;
      this.virtualInput.forward = 0;
      this.virtualInput.right = 0;
      this.physics.velocity.x = 0;
      this.physics.velocity.z = 0;
    } else {
      this.lastWallTime = performance.now();
    }
  }

  /** Multiplayer: apply the party's shared progress (orbs found, rock positions) to this level. */
  private applySharedWorld(data: {
    orbs: number[];
    blocks: { index: number; x: number; y: number; z: number }[];
    events?: { kind: string; i?: number; v?: number; target?: string; userId?: string }[];
  }) {
    for (const i of data.orbs) this.puzzleSystem.collectOrbRemote(i, null, null);
    for (const b of data.blocks) this.puzzleSystem.setBlockRemote(b.index, b.x, b.y, b.z, true);
    if (this.combat && data.events) {
      for (const e of data.events) this.combat.onEvent(e.kind, e.i ?? 0, e.v ?? 0, e.target, e.userId ?? '', true);
    }
  }

  // ---------------------------------------------------------------- Boss fights
  private disposeCombat() {
    if (!this.combat) return;
    this.combat.dispose();
    this.combat = null;
    this.remotePlayers?.clearCombatMarks();
    this.applyDarkness(0);
  }

  /** (Re)starts the boss fight of the current level, keeping what the party already did. */
  private resetCombat() {
    this.disposeCombat();
    const setup = this.world.boss;
    if (!setup) return;
    // Start looking at the boss
    this.cameraYaw = Math.atan2(setup.home.x - setup.spawn.x, setup.home.z - setup.spawn.z);
    this.combat = new CombatSystem(setup, {
      root: this.levelRoot,
      textures: this.textures,
      items: this.itemSystem,
      physics: () => this.physics,
      playerModel: () => this.playerModel,
      appearance: () => this.playerAppearance,
      cameraYaw: () => this.cameraYaw,
      notify: (text) => this.itemSystem.notify(text),
      send: (kind, i, v, target) => {
        if (this.partyRoomId) multiplayerClient.sendEvent(this.currentLevel, kind, i, v, target);
      },
      isHost: () => this.isPartyHost(),
      myId: () => apiClient.getCurrentUser()?._id ?? null,
      remotes: () => (this.partyRoomId ? this.remotePlayers.getPlayersInfo() : []),
      setRemoteGrabbed: (userId, on) => this.remotePlayers.setGrabbed(userId, on),
      setRemoteDown: (userId, on) => this.remotePlayers.setDown(userId, on),
      openPortal: () => {
        this.world.victoryPortal = setup.portal;
        this.world.summitPosition = setup.portalPos.clone();
      },
      closePortal: () => {
        this.world.victoryPortal = undefined;
        this.world.summitPosition = new THREE.Vector3(0, -999, 0);
      },
      unlockMovement: () => {
        this.physics.isMovementLocked = this.isUIModalOpen || this.gameState === 'paused' || this.gameState === 'victory';
      },
    });
    if (this.partyRoomId) {
      const ws = multiplayerClient.getWorldState(this.currentLevel);
      if (ws?.events) for (const e of ws.events) this.combat.onEvent(e.kind, e.i ?? 0, e.v ?? 0, e.target, e.userId ?? '', true);
    }
  }

  /** In a party, the player with the smallest id decides shared random events (cow abductions…). */
  private isPartyHost(): boolean {
    if (!this.partyRoomId) return true;
    const me = apiClient.getCurrentUser()?._id;
    if (!me) return true;
    const ids = this.remotePlayers.getPlayersInfo().map((p) => p.userId);
    return ids.every((id) => me <= id);
  }

  /** Life bar, boss bar and hint for the HUD (null outside boss fights). */
  public getCombatStatus(): CombatStatus | null {
    return this.combat ? this.combat.getStatus() : null;
  }

  /** Key V / HUD button: swing the bat if you carry one. */
  public quickAttack() {
    if (this.gameState !== 'playing') return;
    const slot = this.itemSystem.slotOf('bate');
    if (slot === -1) {
      this.itemSystem.notify(this.combat ? 'No tienes bate: búscalo en la arena' : 'El bate sirve en las luchas contra jefes');
      return;
    }
    this.itemSystem.use(slot, this.itemCtx);
  }

  /** Dracula's darkness: dims the sun, sky light and fog towards black. */
  private applyDarkness(d: number) {
    const fog = this.scene.fog as THREE.FogExp2 | null;
    if (d <= 0.002) {
      if (this.darkBase) {
        this.dirLight.intensity = this.darkBase.dir;
        this.hemiLight.intensity = this.darkBase.hemi;
        if (fog) {
          fog.density = this.darkBase.fogDensity;
          fog.color.copy(this.darkBase.fogColor);
        }
        this.renderer.toneMappingExposure = this.darkBase.exposure;
        this.darkBase = null;
      }
      return;
    }
    if (!this.darkBase) {
      this.darkBase = {
        dir: this.dirLight.intensity,
        hemi: this.hemiLight.intensity,
        fogDensity: fog?.density ?? 0,
        fogColor: fog ? fog.color.clone() : new THREE.Color(0),
        exposure: this.renderer.toneMappingExposure,
      };
    }
    const b = this.darkBase;
    this.dirLight.intensity = b.dir * (1 - 0.92 * d);
    this.hemiLight.intensity = b.hemi * (1 - 0.88 * d);
    if (fog) {
      fog.density = b.fogDensity + 0.03 * d;
      fog.color.copy(b.fogColor).lerp(new THREE.Color(0x05030a), d);
    }
    this.renderer.toneMappingExposure = b.exposure * (1 - 0.35 * d);
  }

  /** After a restart or a level load, keep what the party already achieved. */
  private reapplySharedWorld() {
    if (!this.partyRoomId) return;
    const ws = multiplayerClient.getWorldState(this.currentLevel);
    if (ws) this.applySharedWorld(ws);
  }

  public setPartyRoom(roomId: string | null, joinNow = true) {
    this.partyRoomId = roomId;
    if (!roomId) {
      multiplayerClient.leaveRoom();
      this.remotePlayers?.clearAll();
      return;
    }
    multiplayerClient.setPartyRoomId(roomId);
    if (joinNow) {
      multiplayerClient.joinLevel(this.currentLevel, roomId);
    }
  }

  public returnToTitle() {
    this.resetCombat();
    multiplayerClient.leaveRoom();
    this.partyRoomId = null;
    this.remotePlayers?.clearAll();
    this.gameState = 'title';
    this.physics.respawnAtCheckpoint(0, true);
    this.resetCompanionPowers();
    if (this.stalker) {
      this.stalker.dispose();
      this.stalker = null;
    }
    this.callbacks.onStateChange('title');
  }

  /**
   * Smoothly transitions weather over duration seconds, synchronizing lighting,
   * sky color, fog, clouds, particles, and Web Audio synthesizer soundtrack.
   */
  public transitionWeather(
    weather: WeatherType,
    duration: number = 3.2,
    reason: 'milestone' | 'manual' = 'manual',
    customTitle?: string,
    customDesc?: string
  ) {
    this.weatherSystem.transitionTo(weather, duration);
    soundManager.setWeather(weather, duration);
    this.callbacks.onWeatherChange(weather, true);

    const descriptions: Record<WeatherType, { title: string; desc: string }> = {
      golden_hour: {
        title: 'Hora Dorada',
        desc: 'Luz ámbar cálida y polen resplandeciente',
      },
      sakura_breeze: {
        title: 'Brisa de Sakura',
        desc: 'Danza de pétalos al viento en el Dosel Ventoso',
      },
      cozy_rain: {
        title: 'Lluvia Acogedora',
        desc: 'Gotas suaves y niebla fresca en la Aguja Celestial',
      },
      starlit_night: {
        title: 'Noche Estrellada',
        desc: 'Cielo índigo cósmico y luciérnagas mágicas',
      },
      aero_day: {
        title: 'Día Aero',
        desc: 'Cielo azul brillante, cristal y burbujas',
      },
      cosmic: {
        title: 'Noche Cósmica',
        desc: 'Estrellas, planetas y nebulosas',
      },
      swamp_mist: {
        title: 'Bruma del Pantano',
        desc: 'Niebla espesa y luces fantasmales',
      },
      garden_day: {
        title: 'Mañana en el Jardín',
        desc: 'Sol tibio entre flores y hojas gigantes',
      },
      castle_night: {
        title: 'Noche Embrujada',
        desc: 'Luna enorme sobre las torres del castillo',
      },
    };

    const info = descriptions[weather];
    if (this.callbacks.onWeatherNotice) {
      this.callbacks.onWeatherNotice({
        weather,
        title: customTitle || info.title,
        desc: customDesc || info.desc,
        reason,
      });
    }
  }

  public setWeather(weather: WeatherType) {
    this.transitionWeather(weather, 3.2, 'manual');
  }

  public addTimeTrialBonus(seconds: number, reason: string) {
    if (this.gameMode !== 'time_trial') return;
    this.timeRemaining += seconds;
    soundManager.playTimeBonus();
    this.callbacks.onTimeTrialTick?.(this.timeRemaining, { seconds, reason });
  }

  public restartLevel() {
    this.restartGame(this.gameMode);
  }

  public restartGame(mode?: GameMode) {
    if (mode) {
      this.setGameMode(mode);
    }
    this.physics.respawnAtCheckpoint(0, true, this.getPartySpawnOffset());
    this.resetCompanionPowers();
    this.physics.resetCollectibles();
    this.callbacks.onCollectiblesChange(0, this.physics.totalCollectibles);
    this.itemSystem.resetPickups();
    this.itemSystem.clearInventory(this.itemCtx);
    this.itemSystem.removeAllOfType('llave');
    this.puzzleSystem.reset();
    this.reapplySharedWorld();
    this.resetCombat();
    this.gameState = 'playing';
    this.lastWallTime = performance.now();
    this.physics.hasReachedSummit = false;
    this.callbacks.onStateChange('playing');
    if (this.gameMode === 'time_trial') {
      this.timeRemaining = this.timeTrialStart();
      this.callbacks.onTimeTrialTick?.(this.timeRemaining);
    } else if (this.gameMode === 'chase') {
      if (!this.stalker) {
        this.stalker = new AetherStalker(this.scene, this.physics.position);
      } else {
        this.stalker.resetPosition(this.physics.position);
      }
    }
    if (this.currentLevel === 1) {
      this.transitionWeather('golden_hour', 2.5, 'milestone', 'Hora Dorada', 'Comienzo en el Prado del Amanecer');
    } else {
      const theme = atmos(this.currentLevel);
      this.transitionWeather(theme.weather, 2.5, 'milestone', theme.title, `De vuelta a ${this.world.checkpoints[0]?.name ?? 'el inicio'}`);
    }
  }

  public warpToCheckpoint(index: number) {
    this.physics.respawnAtCheckpoint(index, true);
    if (this.world.checkpoints[index]) {
      this.callbacks.onCheckpointChange(this.world.checkpoints[index].name, index + 1);
    }
    if (this.gameMode === 'chase' && this.stalker) {
      this.stalker.resetPosition(this.physics.position);
      this.stalker.setCheckpointSpeed(index + 1);
    }
    // Smoothly transition weather to match target zone milestone
    if (this.currentLevel !== 1) {
      const theme = atmos(this.currentLevel);
      this.transitionWeather(theme.weather, 2.0, 'milestone', theme.title, this.world.checkpoints[index]?.name ?? '');
    } else if (index === 0) {
      this.transitionWeather('golden_hour', 2.8, 'milestone', 'Hora Dorada', 'Retorno al Prado del Amanecer');
    } else if (index === 1) {
      this.transitionWeather('sakura_breeze', 2.8, 'milestone', 'Brisa de Sakura', 'Viaje al Dosel Ventoso');
    } else if (index === 2) {
      this.transitionWeather('cozy_rain', 2.8, 'milestone', 'Lluvia Acogedora', 'Viaje a la Aguja Celestial');
    }
    if (this.gameState === 'paused' || this.gameState === 'photo_mode' || this.gameState === 'game_over') {
      this.gameState = 'playing';
      this.callbacks.onStateChange('playing');
    }
  }

  // --- Photo Mode API ---
  public enterPhotoMode() {
    if (this.gameState === 'title') return;
    this.gameState = 'photo_mode';
    this.photoYaw = this.cameraYaw;
    this.photoPitch = this.cameraPitch;
    this.photoDistance = 5.2;
    this.photoFov = 55;
    this.photoRoll = 0;
    this.photoElevation = 0;
    this.photoTarget.copy(this.physics.position).add(new THREE.Vector3(0, 1.1, 0));
    this.camera.fov = this.photoFov;
    this.camera.updateProjectionMatrix();
    this.callbacks.onStateChange('photo_mode');
  }

  public exitPhotoMode() {
    if (this.gameState !== 'photo_mode') return;
    this.gameState = 'playing';
    this.camera.fov = 60;
    this.camera.up.set(0, 1, 0);
    this.camera.rotation.set(0, 0, 0);
    this.photoRoll = 0;
    this.camera.updateProjectionMatrix();
    this.callbacks.onStateChange('playing');
  }

  public setPhotoModePaused(paused: boolean) {
    this.photoModePaused = paused;
  }

  public setPhotoFov(fov: number) {
    this.photoFov = fov;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  public setPhotoDistance(dist: number) {
    this.photoDistance = Math.max(1.8, Math.min(16.0, dist));
  }

  public setPhotoElevation(elevation: number) {
    this.photoElevation = elevation;
  }

  public setPhotoRoll(roll: number) {
    this.photoRoll = roll;
  }

  public adjustPhotoYawPitch(dYaw: number, dPitch: number) {
    this.photoYaw += dYaw;
    this.photoPitch = Math.max(-0.45, Math.min(1.25, this.photoPitch + dPitch));
  }

  public panPhotoTarget(dx: number, dz: number) {
    const cosYaw = Math.cos(this.photoYaw);
    const sinYaw = Math.sin(this.photoYaw);
    this.photoTarget.x += cosYaw * dx - sinYaw * dz;
    this.photoTarget.z += sinYaw * dx + cosYaw * dz;
  }

  public captureScreenshot(): string {
    this.renderer.render(this.scene, this.camera);
    soundManager.playCameraShutter();
    return this.renderer.domElement.toDataURL('image/png');
  }

  // --- Input Management ---
  private setupListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);

    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    const dom = this.renderer.domElement;
    dom.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mouseup', this.handleMouseUp);
    dom.addEventListener('wheel', this.handleWheel, { passive: true });

    // Touch support
    dom.addEventListener('touchstart', this.handleTouchStart, { passive: true });
    window.addEventListener('touchmove', this.handleTouchMove, { passive: true });
    window.addEventListener('touchend', this.handleTouchEnd);
  }

  private resetAllInputs() {
    this.rawKeys = {};
    this.currentInput.forward = 0;
    this.currentInput.right = 0;
    this.currentInput.jump = false;
    this.currentInput.sprint = false;
    this.currentInput.crouch = false;
    this.virtualInput.forward = 0;
    this.virtualInput.right = 0;
    this.virtualInput.jump = false;
    this.virtualInput.sprint = false;
    this.virtualInput.crouch = false;
    this.isMouseDragging = false;
    this.touchId = null;
    if (this.physics) {
      this.physics.velocity.x = 0;
      this.physics.velocity.z = 0;
    }
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Typing in a text field (e.g. the character name) must not move or start the game
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
      return;
    }
    soundManager.resume();
    this.rawKeys[e.code] = true;

    if (this.gameState === 'title') {
      if (this.characterPreview) return;
      if (e.code === 'Space' || e.code === 'Enter') {
        this.startGame();
      }
      return;
    }

    if (e.code === 'Escape') {
      if (this.gameState === 'photo_mode') {
        this.exitPhotoMode();
        return;
      }
      if (this.pauseToggleBlocked) return;
      if (this.gameState === 'playing' || this.gameState === 'paused') {
        this.setPaused(this.gameState !== 'paused');
      }
    }
    if (e.code === 'KeyP') {
      if (this.gameState === 'photo_mode') {
        this.exitPhotoMode();
      } else if (this.gameState === 'playing') {
        this.enterPhotoMode();
      }
    }
    if (e.code === 'KeyR') {
      if (this.gameState !== 'playing') return;
      this.physics.respawnAtCheckpoint();
    }
    if (e.code === 'KeyG' && !e.repeat) {
      this.activateCompanionPower();
    }
    if (e.code === 'KeyV' && !e.repeat) {
      this.quickAttack();
    }
    const slotMatch = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
    if (slotMatch && !e.repeat && !e.shiftKey) {
      this.useItem(parseInt(slotMatch[1], 10) - 1);
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.rawKeys[e.code] = false;
  };

  private handleBlur = () => {
    this.resetAllInputs();
  };

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.resetAllInputs();
    }
  };

  public handleResize = () => {
    if (!this.container || this.isDisposed) return;
    this.resetAllInputs();

    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    // In portrait orientation (w < h), widen FOV so mobile players have wide visibility of platforms
    if (w < h) {
      this.camera.fov = 74;
    } else {
      this.camera.fov = 60;
    }
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public rotateCamera(deltaYaw: number) {
    this.cameraYaw += deltaYaw;
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      this.isMouseDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isMouseDragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;

    if (this.gameState === 'title' && this.characterPreview) {
      this.previewYaw -= dx * 0.008;
      this.previewPitchUser = THREE.MathUtils.clamp(this.previewPitchUser - dy * 0.004, -0.4, 0.45);
      this.previewIdleSpin = false;
      this.previewSpinResumeAt = performance.now() + 2200;
      return;
    }

    if (this.gameState === 'photo_mode') {
      this.photoYaw += dx * 0.006;
      this.photoPitch = Math.max(-0.45, Math.min(1.25, this.photoPitch - dy * 0.005));
      return;
    }

    this.cameraYaw -= dx * 0.006;
    this.cameraPitch = Math.max(0.08, Math.min(1.2, this.cameraPitch + dy * 0.005));
  };

  private handleMouseUp = () => {
    this.isMouseDragging = false;
  };

  private handleWheel = (e: WheelEvent) => {
    if (this.gameState === 'title' && this.characterPreview) {
      this.adjustCharacterPreviewZoom(e.deltaY * 0.0012);
      return;
    }
    if (this.gameState === 'photo_mode') {
      this.photoDistance = Math.max(1.8, Math.min(16.0, this.photoDistance + e.deltaY * 0.005));
      return;
    }
    this.cameraDistance = Math.max(3.0, Math.min(12.0, this.cameraDistance + e.deltaY * 0.005));
  };

  private touchId: number | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private initialPinchDist = 0;

  private handleTouchStart = (e: TouchEvent) => {
    this.isTouchDevice = true;
    if (e.touches.length === 2) {
      // Two-finger pinch to zoom camera
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.initialPinchDist = Math.hypot(dx, dy);
      return;
    }

    // Touch camera look: only on right portion of viewport or upper half
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      // Avoid bottom-left zone reserved for virtual joystick (unless in photo mode)
      if (this.gameState === 'photo_mode' || this.gameState === 'title' || t.clientX > window.innerWidth * 0.35 || t.clientY < window.innerHeight * 0.5) {
        this.touchId = t.identifier;
        this.touchStartX = t.clientX;
        this.touchStartY = t.clientY;
        this.isMouseDragging = true;
        break;
      }
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    // Handle pinch zoom
    if (e.touches.length === 2 && this.initialPinchDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const pinchDelta = (this.initialPinchDist - dist) * 0.02;
      if (this.gameState === 'title' && this.characterPreview) {
        this.adjustCharacterPreviewZoom(pinchDelta * 0.08);
      } else if (this.gameState === 'photo_mode') {
        this.photoDistance = Math.max(1.8, Math.min(16.0, this.photoDistance + pinchDelta));
      } else {
        this.cameraDistance = Math.max(3.0, Math.min(12.0, this.cameraDistance + pinchDelta));
      }
      this.initialPinchDist = dist;
      return;
    }

    if (!this.isMouseDragging) return;
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      if (t.identifier === this.touchId) {
        const dx = t.clientX - this.touchStartX;
        const dy = t.clientY - this.touchStartY;
        this.touchStartX = t.clientX;
        this.touchStartY = t.clientY;

        if (this.gameState === 'title' && this.characterPreview) {
          this.previewYaw -= dx * 0.009;
          this.previewPitchUser = THREE.MathUtils.clamp(this.previewPitchUser - dy * 0.005, -0.4, 0.45);
          this.previewIdleSpin = false;
          this.previewSpinResumeAt = performance.now() + 2200;
        } else if (this.gameState === 'photo_mode') {
          this.photoYaw += dx * 0.007;
          this.photoPitch = Math.max(-0.45, Math.min(1.25, this.photoPitch - dy * 0.006));
        } else {
          this.cameraYaw -= dx * 0.007;
          this.cameraPitch = Math.max(0.08, Math.min(1.2, this.cameraPitch + dy * 0.005));
        }
        break;
      }
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      this.initialPinchDist = 0;
    }
    if (e.touches.length === 0) {
      this.isMouseDragging = false;
      this.touchId = null;
    }
  };

  // Allow virtual joystick or HUD buttons to feed input smoothly
  public setVirtualInput(input: Partial<PlayerInput>) {
    this.isTouchDevice = true;
    Object.assign(this.virtualInput, input);
  }

  private updateCombinedInput() {
    const k = this.rawKeys;
    let kForward = 0;
    let kRight = 0;

    if (k['KeyW'] || k['ArrowUp']) kForward += 1;
    if (k['KeyS'] || k['ArrowDown']) kForward -= 1;
    if (k['KeyD'] || k['ArrowRight']) kRight += 1;
    if (k['KeyA'] || k['ArrowLeft']) kRight -= 1;

    // Smooth keyboard camera rotation (Q/E)
    if (k['KeyQ']) this.cameraYaw += 0.04;
    if (k['KeyE']) this.cameraYaw -= 0.04;

    const hasKeyboardMove = kForward !== 0 || kRight !== 0;

    // Blend keyboard with analog mobile thumbstick
    this.currentInput.forward = hasKeyboardMove ? kForward : this.virtualInput.forward;
    this.currentInput.right = hasKeyboardMove ? kRight : this.virtualInput.right;
    this.currentInput.jump = Boolean(k['Space']) || this.virtualInput.jump;
    this.currentInput.sprint = Boolean(k['ShiftLeft'] || k['ShiftRight']) || this.virtualInput.sprint;
    this.currentInput.crouch = Boolean(k['KeyC']) || this.virtualInput.crouch;
  }

  // --- Render Loop ---
  private startLoop() {
    let frameId = 0;

    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.isDisposed) return;

      this.clock.update();
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsedTime = this.clock.getElapsed();

      const now = performance.now();
      const wallDt = Math.min(Math.max(0, (now - this.lastWallTime) / 1000), 2.0);
      this.lastWallTime = now;

      this.update(dt, elapsedTime, wallDt);
      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      afterDraw(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private update(dt: number, time: number, wallDt: number) {
    // 1. Title Screen live-world camera pan
    if (this.gameState === 'title') {
      // The character waits at the level start (generated levels don't start at the center)
      const sp = this.physics.position;
      this.playerModel.group.position.copy(sp);
      this.cameraYaw = time * 0.15;
      const camX = Math.sin(this.cameraYaw) * 12.0;
      const camZ = Math.cos(this.cameraYaw) * 12.0;
      this._orbitPos.set(sp.x + camX, sp.y + 4.0, sp.z + camZ);
      this._orbitLook.set(sp.x, sp.y + 1.2, sp.z);

      // Character Creator: blend smoothly into a close-up turntable around the player
      this.previewBlend = THREE.MathUtils.damp(this.previewBlend, this.characterPreview ? 1 : 0, 4.0, dt);
      if (this.previewBlend > 0.001) {
        if (!this.previewIdleSpin && performance.now() >= this.previewSpinResumeAt && !this.isMouseDragging) {
          this.previewIdleSpin = true;
        }
        if (this.characterPreview && this.previewIdleSpin && !this.isMouseDragging) {
          this.previewYaw += dt * 0.22;
        }

        this.previewLookY = THREE.MathUtils.damp(this.previewLookY, this.previewTargetLookY, 5.5, dt);
        this.previewCamY = THREE.MathUtils.damp(this.previewCamY, this.previewTargetCamY, 5.5, dt);
        this.previewBaseDistance = THREE.MathUtils.damp(this.previewBaseDistance, this.previewTargetDist, 5.2, dt);
        this.previewPitch = THREE.MathUtils.damp(this.previewPitch, this.previewTargetPitch, 4.2, dt);
        const pitch = this.previewPitch + this.previewPitchUser;

        const p = this.physics.position;
        const h = this.playerAppearance.height;
        const w = this.container.clientWidth;
        const hgt = this.container.clientHeight;
        const portrait = hgt > w;
        const dist = this.previewBaseDistance * this.previewZoom * (portrait ? 1.12 : 1.0);
        const lookY = p.y + this.previewLookY * h;
        const camY = p.y + this.previewCamY * h + Math.sin(pitch) * dist * 0.55;
        const planar = Math.cos(pitch) * dist;

        this._previewPos.set(
          p.x + Math.sin(this.previewYaw) * planar,
          camY,
          p.z + Math.cos(this.previewYaw) * planar
        );
        this._previewLook.set(p.x, lookY, p.z);

        const e = this.previewBlend * this.previewBlend * (3 - 2 * this.previewBlend);
        this.camera.position.lerpVectors(this._orbitPos, this._previewPos, e);
        this.camera.lookAt(this._orbitLook.lerp(this._previewLook, e));

        if (portrait) {
          this.camera.setViewOffset(w, hgt, 0, hgt * 0.27 * e, w, hgt);
        } else {
          this.camera.setViewOffset(w, hgt, w * 0.18 * e, 0, w, hgt);
        }
        this.viewOffsetActive = true;
      } else {
        this.camera.position.copy(this._orbitPos);
        this.camera.lookAt(this._orbitLook);
        if (this.viewOffsetActive) {
          this.camera.clearViewOffset();
          this.viewOffsetActive = false;
        }
      }

      this.playerModel.updateAnimation(0, true, dt, time);
      this.weatherSystem.update(dt, new THREE.Vector3(0, 0, 0), time);
      this.world.levelUpdate?.(dt, time);
      this.updateShowcase(time);
      return;
    }

    if (this.gameState === 'paused' || this.gameState === 'victory' || this.isUIModalOpen) {
      this.lastWallTime = performance.now();
      this.currentInput.forward = 0;
      this.currentInput.right = 0;
      this.currentInput.jump = false;
      this.currentInput.sprint = false;
      this.currentInput.crouch = false;
      this.virtualInput.forward = 0;
      this.virtualInput.right = 0;
      this.physics.velocity.x = 0;
      this.physics.velocity.z = 0;
      this.physics.isMovementLocked = true;
      this.playerModel.updateAnimation(0, true, dt, time);
      this.weatherSystem.update(dt, this.physics.position, time);
      this.world.levelUpdate?.(dt, time);
      if (this.partyRoomId && this.remotePlayers) {
        this.remotePlayers.update(dt);
      }
      return;
    }

    // 1b. Photo Mode Update & Camera Orbit
    if (this.gameState === 'photo_mode') {
      this.lastWallTime = performance.now();
      if (!this.photoModePaused) {
        this.weatherSystem.update(dt, this.photoTarget, time);
        this.physics.updateMovingPlatforms(time, dt);
        for (const obs of this.world.obstacles) obs.update(time);
        if (this.world.pinwheels) for (const pin of this.world.pinwheels) pin.update(time);
        if (this.world.balanceLogs) for (const log of this.world.balanceLogs) log.update(time);
        if (this.world.steamVents) for (const vent of this.world.steamVents) vent.update(dt);
        for (const plat of this.world.platforms) {
          if (plat.bouncyModel) plat.bouncyModel.update(dt);
          if (plat.updraftModel) plat.updraftModel.update(dt);
        }
        for (const cp of this.world.checkpoints) cp.shrine.update(dt);
        for (const col of this.world.collectibles) col.update(dt);
        if (this.world.enemyManager) {
          this.world.enemyManager.update(dt, time, this.physics.position);
        }
        this.playerModel.updateAnimation(0, true, dt, time);
        this.world.levelUpdate?.(dt, time);
        this.updateShowcase(time);
      }

      // Smooth Orbit & Framing Camera
      const cosPitch = Math.cos(this.photoPitch);
      const sinPitch = Math.sin(this.photoPitch);
      const offsetX = Math.sin(this.photoYaw) * cosPitch * this.photoDistance;
      const offsetZ = Math.cos(this.photoYaw) * cosPitch * this.photoDistance;
      const offsetY = sinPitch * this.photoDistance;

      this.targetCameraPos.set(
        this.photoTarget.x - offsetX,
        this.photoTarget.y + this.photoElevation + offsetY,
        this.photoTarget.z - offsetZ
      );

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.targetCameraPos.x, 12.0, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.targetCameraPos.y, 12.0, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.targetCameraPos.z, 12.0, dt);

      this.targetLookAt.set(this.photoTarget.x, this.photoTarget.y + this.photoElevation, this.photoTarget.z);
      this.camera.up.set(0, 1, 0);
      this.camera.lookAt(this.targetLookAt);
      if (Math.abs(this.photoRoll) > 0.001) {
        this.camera.rotateZ(this.photoRoll);
      }

      this.dirLight.position.set(this.photoTarget.x + 25, this.photoTarget.y + 45, this.photoTarget.z + 20);
      this.dirLight.target.position.copy(this.photoTarget);
      this.dirLight.target.updateMatrixWorld();
      return;
    }

    // 2. Poll Input (Keyboard + Mobile Virtual Controls)
    this.updateCombinedInput();

    // 3. Update Moving Platforms & Obstacles
    this.physics.updateMovingPlatforms(time, dt);
    for (const obs of this.world.obstacles) {
      obs.update(time);
    }
    if (this.world.pinwheels) {
      for (const pin of this.world.pinwheels) {
        pin.update(time);
      }
    }
    if (this.world.balanceLogs) {
      for (const log of this.world.balanceLogs) {
        log.update(time);
      }
    }
    if (this.world.steamVents) {
      for (const vent of this.world.steamVents) {
        vent.update(dt);
      }
    }

    // 4. Update Bouncy Mushrooms and Updrafts
    for (const plat of this.world.platforms) {
      if (plat.bouncyModel) {
        plat.bouncyModel.update(dt);
      }
      if (plat.updraftModel) {
        plat.updraftModel.update(dt);
      }
    }

    // 5. Update Shrines & Collectibles
    for (const cp of this.world.checkpoints) {
      cp.shrine.update(dt);
    }
    for (const col of this.world.collectibles) {
      col.update(dt);
    }

    if (!this.easterEggFound && this.world.easterEgg) {
      const egg = this.world.easterEgg;
      if (this.physics.position.distanceTo(egg.position) <= egg.radius) {
        this.easterEggFound = true;
        this.callbacks.onEasterEgg?.();
      }
    }

    // 5b. Game Mode Execution (Time Trial Countdown & Chase Stalker)
    if (this.gameMode === 'time_trial') {
      const prevSec = Math.floor(this.timeRemaining);
      this.timeRemaining = Math.max(0, this.timeRemaining - wallDt);
      const curSec = Math.floor(this.timeRemaining);
      if (prevSec !== curSec && curSec <= 15 && curSec > 0) {
        soundManager.playTimeWarning();
      }
      this.callbacks.onTimeTrialTick?.(this.timeRemaining);
      if (this.timeRemaining <= 0) {
        this.timeRemaining = 0;
        this.gameState = 'game_over';
        this.callbacks.onStateChange('game_over');
        soundManager.playGameOver();
        return;
      }
    } else if (this.gameMode === 'chase') {
      if (!this.stalker) {
        this.stalker = new AetherStalker(this.scene, this.physics.position);
      }
      // The Stalker also speeds up on later levels
      this.stalker.speedScale = 1 + 0.35 * this.hostility;
      // While Chispa's lure glows, the Stalker chases the lure instead of the player
      const lure = this.companionPowers.lureTarget;
      this.stalker.update(dt, time, lure ?? this.physics.position, () => {
        if (lure) return; // it only bumped into the lure
        // Caught by Stalker! Respawn player at checkpoint with warning notice
        this.physics.respawnAtCheckpoint();
        if (this.stalker) {
          this.stalker.resetPosition(this.physics.position);
        }
        this.callbacks.onWeatherNotice?.({
          weather: this.weatherSystem.currentWeather,
          title: '¡Acechador te atrapó!',
          desc: 'La sombra te lanzó al vacío. Reapareces en el santuario.',
          reason: 'manual',
        });
      });
      if (lure) {
        const realDist = this.stalker.position.distanceTo(this.physics.position);
        this.callbacks.onStalkerProximity?.(realDist, realDist < 8 ? 'danger' : realDist < 18 ? 'caution' : 'none');
      } else {
        this.callbacks.onStalkerProximity?.(
          this.stalker.distanceToPlayer,
          this.stalker.warningLevel
        );
      }
    }

    // 5c. Companion powers (float, speed, lure, rescue), backpack pickups & level decor
    this.companionPowers.update(dt, time, this.physics, this.playerModel.companionSprite, { enemies: this.world.enemyManager, stalker: this.stalker });
    this.itemSystem.update(dt, this.physics.position, this.itemCtx);
    this.world.levelUpdate?.(dt, time);
    this.updateShowcase(time);
    if (this.world.enemyManager) {
      this.world.enemyManager.distractTarget = this.companionPowers.lureTarget;
    }

    // 6. Physics Step
    const prevCollectibles = this.physics.collectedCount;
    this.physics.update(
      dt,
      this.currentInput,
      this.cameraYaw,
      (cpName) => {
        const cpIdx = this.physics.currentCheckpointIndex;
        this.callbacks.onCheckpointChange(cpName, cpIdx + 1);

        // Mode specific checkpoint bonuses
        if (this.gameMode === 'time_trial') {
          this.addTimeTrialBonus(15, 'Punto de Control (+15s)');
        } else if (this.gameMode === 'chase' && this.stalker) {
          this.stalker.setCheckpointSpeed(cpIdx + 1);
        }

        // Milestone-triggered smooth weather transitions (level 1 only; Valle Aero stays sunny)
        if (this.currentLevel !== 1) {
          // no weather change
        } else if (cpIdx === 1) {
          // Checkpoint 2: Windy Canopy
          this.transitionWeather(
            'sakura_breeze',
            3.5,
            'milestone',
            'Brisa de Sakura',
            'Pétalos al viento al alcanzar el Dosel Ventoso'
          );
        } else if (cpIdx === 2) {
          // Checkpoint 3: Celestial Spire
          this.transitionWeather(
            'cozy_rain',
            3.5,
            'milestone',
            'Lluvia Acogedora',
            'Gotas suaves y niebla en la Aguja Celestial'
          );
        }
      },
      () => {
        // Milestone: Summit Victory! (finishing a level unlocks its companion)
        this.lastUnlocked = markLevelComplete(this.currentLevel);
        this.gameState = 'victory';
        this.callbacks.onStateChange('victory');
        soundManager.playVictory();
        if (this.stalker) {
          this.stalker.isStunned = true;
          this.stalker.stunTimer = 999;
        }
        const theme = atmos(this.currentLevel);
        this.transitionWeather(theme.victoryWeather, 4.5, 'milestone', theme.victoryTitle, theme.victoryDesc);
      }
    );

    // 6b. Puzzles (push blocks, doors, key carriers, sentinels)
    if (this.world.puzzles && this.gameState === 'playing') {
      this.puzzleSystem.update(dt, time, {
        position: this.physics.position,
        velocity: this.physics.velocity,
        moveDir: this.physics.moveDir,
        platforms: this.world.platforms,
        items: this.itemSystem,
        hostility: this.hostility,
        teleport: (to) => {
          this.physics.position.copy(to);
          this.physics.velocity.set(0, 0, 0);
          this.physics.lastSafePos.copy(to);
        },
        onOrb: (_have, _total, index) => {
          if (this.gameMode === 'time_trial') this.addTimeTrialBonus(20, 'Orbe (+20s)');
          if (this.partyRoomId) multiplayerClient.sendOrb(this.currentLevel, index);
        },
        onBlockMoved: (index, pos, final) => {
          if (this.partyRoomId) multiplayerClient.sendBlock(this.currentLevel, index, pos.x, pos.y, pos.z, final);
        },
        shared: Boolean(this.partyRoomId),
      });
    }

    // 6c. Boss fight (life, tools, the boss) — after physics so it can hold a grabbed player
    if (this.combat && this.gameState === 'playing') {
      this.combat.update(dt, time, this.currentInput);
    }

    if (this.physics.collectedCount !== prevCollectibles) {
      this.callbacks.onCollectiblesChange(
        this.physics.collectedCount,
        this.physics.totalCollectibles
      );
      if (this.gameMode === 'time_trial') {
        this.addTimeTrialBonus(8, 'Reliquia (+8s)');
      }
    }

    // 7. Update Weather & Background Clouds
    this.weatherSystem.update(dt, this.physics.position, time);
    this.applyDarkness(this.combat?.darkness ?? 0);

    // 7b. Mobile / Touchscreen: Camera smoothly follows behind character
    const inputMagnitude = Math.hypot(this.currentInput.forward, this.currentInput.right);
    const isVirtualMove = inputMagnitude > 0.05;
    const isTouchActive = (this.isTouchDevice || isVirtualMove) && this.autoChaseCamera;
    const horizSpeed = Math.hypot(this.physics.velocity.x, this.physics.velocity.z);

    // Track sudden input direction flips (e.g. flicking joystick from left to right or forward to back)
    if (inputMagnitude > 0.25) {
      const curInputX = this.currentInput.right / inputMagnitude;
      const curInputY = this.currentInput.forward / inputMagnitude;
      if (this.lastInputVector.lengthSq() > 0.01) {
        const dot = this.lastInputVector.x * curInputX + this.lastInputVector.y * curInputY;
        if (dot < 0.2) {
          // Sharp direction change (over 78°) -> pause camera auto-chase briefly so camera doesn't jerk
          this.directionTurnCooldown = 0.32;
        }
      }
      this.lastInputVector.set(curInputX, curInputY);
    } else {
      this.lastInputVector.set(0, 0);
    }

    if (this.directionTurnCooldown > 0) {
      this.directionTurnCooldown = Math.max(0, this.directionTurnCooldown - dt);
    }

    if (isTouchActive && !this.isMouseDragging && horizSpeed > 0.4 && this.directionTurnCooldown === 0) {
      // The player's mesh rotation represents the direction the character is facing
      const playerFacing = this.playerModel.group.rotation.y;
      const angleDiff = Math.atan2(
        Math.sin(playerFacing - this.cameraYaw),
        Math.cos(playerFacing - this.cameraYaw)
      );

      // Only auto-follow camera when the player intends to move forward or forward-diagonally.
      // Pure lateral strafing (|right| > 0.45 with forward <= 0.15) should NOT spin the camera in a circle.
      const isForwardIntended = this.currentInput.forward > 0.15;
      const isPureSideways = Math.abs(this.currentInput.right) > 0.45 && this.currentInput.forward <= 0.15;

      if (!isPureSideways && Math.abs(angleDiff) > 0.05) {
        if (Math.abs(angleDiff) < Math.PI * 0.70 && isForwardIntended) {
          // Smooth, non-dizzy forward camera follow behind the character
          this.reverseRunTimer = 0;
          const followSpeed = THREE.MathUtils.lerp(1.8, 3.2, Math.min(1.0, horizSpeed / 5.5));
          const maxStep = 2.2 * dt; // Clamp max turn rate to 2.2 rad/s to prevent jarring rotations
          const step = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff * followSpeed * dt), maxStep);
          this.cameraYaw += step;
        } else if (Math.abs(angleDiff) >= Math.PI * 0.70) {
          // Running backwards toward screen: don't jerk immediately, only rotate if running in reverse persistently
          this.reverseRunTimer += dt;
          if (this.reverseRunTimer > 0.85) {
            const step = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff * 1.8 * dt), 1.6 * dt);
            this.cameraYaw += step;
          }
        }
      }
    }

    // Keep cameraYaw normalized to [-PI, +PI]
    this.cameraYaw = THREE.MathUtils.euclideanModulo(this.cameraYaw + Math.PI, Math.PI * 2) - Math.PI;

    // 8. Damped Third-Person Camera Follow
    const playerPos = this.physics.position;
    // Boss fights: when the boss is high above (bird on its tower, the UFO…) pull the camera back
    // and tilt it up a little — never so much that you lose sight of yourself and the ground
    // around you, where the warnings for falling rocks and lasers appear.
    let raise = 0;
    let back = 0;
    const focus = this.combat?.focus;
    if (focus) {
      const dy = focus.y + 1.5 - (playerPos.y + 1.1);
      const dxz = Math.hypot(focus.x - playerPos.x, focus.z - playerPos.z);
      if (dy > 2 && dxz < 40) {
        const fade = THREE.MathUtils.clamp((40 - dxz) / 10, 0, 1);
        raise = THREE.MathUtils.clamp(dy * 0.12, 0, 1.1) * fade;
        back = THREE.MathUtils.clamp(dy * 0.22, 0, 2.6) * fade;
      }
    }
    // Slow, smooth changes so the view doesn't bob around while dodging
    this.lookRaise = THREE.MathUtils.damp(this.lookRaise, raise, 1.2, dt);
    this.lookBack = THREE.MathUtils.damp(this.lookBack, back, 1.2, dt);
    this.targetLookAt.set(playerPos.x, playerPos.y + 1.1 + this.lookRaise, playerPos.z);

    const camDist = Math.min(14, this.cameraDistance + this.lookBack);
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const offsetX = Math.sin(this.cameraYaw) * cosPitch * camDist;
    const offsetZ = Math.cos(this.cameraYaw) * cosPitch * camDist;
    const offsetY = sinPitch * camDist;

    this.targetCameraPos.set(
      playerPos.x - offsetX,
      playerPos.y + 1.1 + offsetY,
      playerPos.z - offsetZ
    );

    // Exponential camera damping for buttery smooth motion
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.targetCameraPos.x, 10.0, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.targetCameraPos.y, 10.0, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.targetCameraPos.z, 10.0, dt);

    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this.targetLookAt);

    // Fade out foliage or trees that block the camera view of the player
    this.updateTreeOcclusion(dt);

    // Follow light with player
    this.dirLight.position.set(playerPos.x + 25, playerPos.y + 45, playerPos.z + 20);
    this.dirLight.target.position.copy(playerPos);
    this.dirLight.target.updateMatrixWorld();

    // 8. Online Multiplayer Sync & Remote Players update
    if (this.remotePlayers) {
      this.remotePlayers.update(dt);
    }

    if (this.gameState === 'playing' && this.partyRoomId) {
      const speed = Math.hypot(this.physics.velocity.x, this.physics.velocity.z);
      let anim: 'idle' | 'walk' | 'run' | 'jump' | 'fall' = 'idle';
      if (!this.physics.isGrounded) {
        anim = this.physics.velocity.y > 0 ? 'jump' : 'fall';
      } else if (speed > 7.0) {
        anim = 'run';
      } else if (speed > 0.4) {
        anim = 'walk';
      }
      multiplayerClient.syncPlayer(
        playerPos.x,
        playerPos.y,
        playerPos.z,
        this.playerModel.group.rotation.y,
        anim
      );
    }
  }

  private occludedMeshes = new Set<THREE.Mesh>();

  /** Fades out decorative tree foliage/trunks when they block the camera's view of the player. */
  private updateTreeOcclusion(dt: number) {
    if (!this.world || !this.world.decorativeMeshes || this.world.decorativeMeshes.length === 0) return;
    const camPos = this.camera.position;
    const playerPos = this.physics.position;
    const playerY = playerPos.y + 1.1;

    const camToP_x = playerPos.x - camPos.x;
    const camToP_y = playerY - camPos.y;
    const camToP_z = playerPos.z - camPos.z;
    const segLenSq = camToP_x * camToP_x + camToP_y * camToP_y + camToP_z * camToP_z;
    if (segLenSq < 0.25) return;

    const nowOccluded = new Set<THREE.Mesh>();
    const meshPos = new THREE.Vector3();

    for (const rootObj of this.world.decorativeMeshes) {
      rootObj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;

        mesh.getWorldPosition(meshPos);
        const toMesh_x = meshPos.x - camPos.x;
        const toMesh_y = meshPos.y - camPos.y;
        const toMesh_z = meshPos.z - camPos.z;

        // Projection fraction along camera-to-player line
        const proj = (toMesh_x * camToP_x + toMesh_y * camToP_y + toMesh_z * camToP_z) / segLenSq;
        if (proj > 0.12 && proj < 0.88) {
          const closeX = camPos.x + camToP_x * proj;
          const closeY = camPos.y + camToP_y * proj;
          const closeZ = camPos.z + camToP_z * proj;
          const distSq = (meshPos.x - closeX) ** 2 + (meshPos.y - closeY) ** 2 + (meshPos.z - closeZ) ** 2;

          if (distSq < 3.8) {
            nowOccluded.add(mesh);
          }
        }
      });
    }

    for (const mesh of nowOccluded) {
      this.occludedMeshes.add(mesh);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m) {
          m.transparent = true;
          m.opacity = THREE.MathUtils.damp(m.opacity, 0.28, 8.0, dt);
        }
      }
    }

    for (const mesh of this.occludedMeshes) {
      if (!nowOccluded.has(mesh)) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        let restored = true;
        for (const m of mats) {
          if (m) {
            m.opacity = THREE.MathUtils.damp(m.opacity, 1.0, 6.0, dt);
            if (m.opacity < 0.98) restored = false;
            else m.opacity = 1.0;
          }
        }
        if (restored) {
          this.occludedMeshes.delete(mesh);
        }
      }
    }
  }

  public setAutoChaseCamera(enabled: boolean) {
    this.autoChaseCamera = enabled;
  }

  public setGraphicsQuality(quality: 'high' | 'medium' | 'low') {
    if (this.isSoftwareGl || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (quality === 'high') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } else if (quality === 'medium') {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
    } else {
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = false;
    }
    this.renderer.setSize(w, h);
  }

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    const dom = this.renderer.domElement;
    dom.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    dom.removeEventListener('wheel', this.handleWheel);

    this.disposeCombat();
    this.remotePlayers?.clearAll();
    multiplayerClient.disconnect();
    this.stalker?.dispose();
    this.companionPowers?.dispose();
    this.itemSystem?.dispose();
    this.world.enemyManager?.dispose();
    this.weatherSystem.dispose();
    this.clock.dispose();
    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}

