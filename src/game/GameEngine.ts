/**
 * Central Three.js Game Engine for Cozy Parkour World
 * Full WebGL PBR setup, RoomEnvironment reflection, soft shadows,
 * damped third-person camera, input buffering, and software WebGL guard.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { soundManager, WeatherType } from '../audio/SoundtrackSynthesizer';
import { buildCozyParkourWorld, WorldBuildResult } from './levels';
import type { LevelHazardStatus } from './levels';
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
import { LEVELS, markLevelComplete, isDevMode, isCompanionUnlocked, isLevelUnlocked, maxPlayableLevel, themeForLevel, ThemeId, COMPANION_UNLOCKS, levelInfo, isBossLevel, levelKind, getDevLevelPick, setDevLevelPick, DevLevelPick } from './progress';

/** Developer level picks shared with the party: world kind and theme as event numbers */
const DEV_KINDS: DevLevelPick['kind'][] = ['sandbox', 'boss', 'backrooms'];
const DEV_THEMES: ThemeId[] = ['cozy', 'cosmic', 'swamp', 'aero', 'garden', 'castle', 'backrooms'];
import { buildBackroomsWorld, buildSkinwalkerArena } from './levelBackrooms';
import { generateLevel } from './levelGen';
import { generateParkourLevel } from './levelParkourGen';
import { generateBossArena } from './bossArena';
import { BOSS_SYNC_MARK, CombatStatus, CombatSystem } from './combat';
import { PuzzleSystem } from './puzzles';
import { DungeonContext, DungeonSystem } from './dungeon';
import { AmbientDecor, Quality } from './ambience';
import { computeRating, LevelRating, saveRating } from './rating';
import { CompanionStyle } from './character';
import { recordMissionEvent } from './dailyMissions';
import { RemotePlayersManager } from './RemotePlayersManager';
import {
  multiplayerClient,
  RoomPlayerFinishedPayload,
  RoomAllFinishedPayload,
  RoomLevelChangedPayload,
  SpectateStartedPayload,
  SpectateSwitchedPayload,
} from '../services/multiplayerClient';
import { apiClient } from '../services/apiClient';

/** First number of a waiting-room message on the party's snapshot channel */
const LOBBY_MARK = -7778;

export { LEVELS };

/** Per-theme atmosphere: base weather and the sky shown on victory. */
const THEME_ATMOS: Record<ThemeId, { weather: WeatherType; title: string; victoryWeather: WeatherType; victoryTitle: string; victoryDesc: string }> = {
  cozy: { weather: 'golden_hour', title: 'Hora Dorada', victoryWeather: 'starlit_night', victoryTitle: 'Noche Estrellada', victoryDesc: '¡Cima alcanzada!' },
  cosmic: { weather: 'cosmic', title: 'Ruta Cósmica', victoryWeather: 'starlit_night', victoryTitle: 'Lluvia de Estrellas', victoryDesc: '¡Llegaste al Observatorio Estelar!' },
  swamp: { weather: 'swamp_mist', title: 'Pantano Sombrío', victoryWeather: 'starlit_night', victoryTitle: 'Noche de Luciérnagas', victoryDesc: '¡Llegaste al Santuario de las Luciérnagas!' },
  aero: { weather: 'aero_day', title: 'Valle Aero', victoryWeather: 'golden_hour', victoryTitle: 'Atardecer Aero', victoryDesc: '¡Llegaste a la Plaza del Globo!' },
  garden: { weather: 'garden_day', title: 'Jardín Gigante', victoryWeather: 'golden_hour', victoryTitle: 'Tarde en el Jardín', victoryDesc: '¡Llegaste al Girasol Gigante!' },
  castle: { weather: 'castle_night', title: 'Castillo Embrujado', victoryWeather: 'starlit_night', victoryTitle: 'Noche Estrellada', victoryDesc: '¡Llegaste a la Torre del Vampiro!' },
  neon: { weather: 'neon_night', title: 'Ciudad Neón', victoryWeather: 'starlit_night', victoryTitle: 'Horizonte Synth', victoryDesc: '¡Conquistaste la Torre Prisma Neón!' },
  cyberpunk: { weather: 'cyber_storm', title: 'Cyberpunk', victoryWeather: 'neon_night', victoryTitle: 'Cielo Eléctrico', victoryDesc: '¡Alcanzaste la Azotea Corporativa!' },
  lava: { weather: 'lava_ash', title: 'Volcán Infernal', victoryWeather: 'golden_hour', victoryTitle: 'Cima Volcánica', victoryDesc: '¡Dominaste el Volcán Infernal!' },
  ice: { weather: 'blizzard', title: 'Cumbre Glacial', victoryWeather: 'starlit_night', victoryTitle: 'Noche Boreal', victoryDesc: '¡Conquistaste la Cumbre Glacial!' },
  desert: { weather: 'desert_sun', title: 'Dunas Doradas', victoryWeather: 'golden_hour', victoryTitle: 'Ocaso en el Oasis', victoryDesc: '¡Llegaste al Templo del Sol!' },
  candy: { weather: 'candy_sky', title: 'Reino Dulce', victoryWeather: 'sakura_breeze', victoryTitle: 'Brisa de Algodón', victoryDesc: '¡Conquistaste el Palacio del Azúcar!' },
  backrooms: { weather: 'backrooms', title: 'Los Backrooms', victoryWeather: 'backrooms', victoryTitle: 'SALIDA', victoryDesc: '¡Escapaste de los Backrooms!' },
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
  onCheckpointChange: (name: string, index: number, total?: number) => void;
  onCollectiblesChange: (collected: number, total: number) => void;
  onWeatherChange: (weather: WeatherType, isTransitioning?: boolean) => void;
  onWeatherNotice?: (notice: WeatherNotice) => void;
  onModeChange?: (mode: GameMode) => void;
  onTimeTrialTick?: (timeRemaining: number, bonusNotice?: { seconds: number; reason: string }) => void;
  onStalkerProximity?: (distance: number, warningLevel: 'none' | 'caution' | 'danger') => void;
  onEasterEgg?: (egg?: NonNullable<WorldBuildResult['easterEgg']>) => void;
  onSpectateChange?: (
    isSpectating: boolean,
    targetUserId: string | null,
    targetName: string,
    rank?: number,
    timeSeconds?: number
  ) => void;
  onRoomPlayerFinished?: (payload: RoomPlayerFinishedPayload) => void;
  onRoomAllFinished?: (payload: RoomAllFinishedPayload) => void;
  onRoomLevelChanged?: (payload: RoomLevelChangedPayload) => void;
  /** Deaths in this run (falls, caught by the Stalker, fainting in a boss fight) */
  onDeathsChange?: (deaths: number) => void;
  /** Party: seconds left to reach the goal after a friend finished (null = no timer) */
  onPartyTimer?: (secondsLeft: number | null) => void;
  /** Actual rendered frames per second update */
  onFpsUpdate?: (fps: number) => void;
  /** Player sprint stamina bar updates */
  onStaminaChange?: (stamina: number, maxStamina: number, exhausted: boolean) => void;
  /** Emitted when current level or dev-picked biome theme changes */
  onLevelThemeChange?: (level: number, theme: ThemeId) => void;
}

/** Seconds the rest of the party has to reach the goal once someone finished */
export const PARTY_FINISH_SECONDS = 90;

export type FpsLimit = '30' | '60' | '120' | 'unlimited';
export type RenderDistancePercent = 50 | 70 | 100;

export class GameEngine {
  private container: HTMLElement;
  private callbacks: GameEngineCallbacks;
  public currentFps: number = 60;
  public onFps?: (fps: number) => void;
  public reTriggerLoop?: () => void;

  public fpsLimit: FpsLimit = (() => {
    try {
      const saved = localStorage.getItem('cozy_fps_limit');
      if (saved === '30' || saved === '60' || saved === '120' || saved === 'unlimited') return saved as FpsLimit;
      return 'unlimited';
    } catch {
      return 'unlimited';
    }
  })();

  public renderDistance: RenderDistancePercent = (() => {
    try {
      const saved = localStorage.getItem('cozy_render_distance');
      if (saved === '50' || saved === '70' || saved === '100') return Number(saved) as RenderDistancePercent;
      return 100;
    } catch {
      return 100;
    }
  })();

  public setFpsLimit(limit: FpsLimit) {
    this.fpsLimit = limit;
    try {
      localStorage.setItem('cozy_fps_limit', limit);
    } catch {}
    if (limit === '30') {
      this.currentFps = 30;
      this.callbacks.onFpsUpdate?.(30);
      this.onFps?.(30);
    } else if (limit === '60') {
      this.currentFps = 60;
      this.callbacks.onFpsUpdate?.(60);
      this.onFps?.(60);
    } else if (limit === '120') {
      this.currentFps = 120;
      this.callbacks.onFpsUpdate?.(120);
      this.onFps?.(120);
    }
    this.reTriggerLoop?.();
  }

  public setRenderDistance(percent: RenderDistancePercent) {
    this.renderDistance = percent;
    try {
      localStorage.setItem('cozy_render_distance', String(percent));
    } catch {}
    this.applyRenderDistance();
  }

  public applyRenderDistance() {
    if (!this.camera) return;
    const pct = this.renderDistance;
    if (pct === 50) {
      this.camera.far = 75;
    } else if (pct === 70) {
      this.camera.far = 135;
    } else {
      this.camera.far = 260;
    }
    this.camera.updateProjectionMatrix();

    if (this.scene && this.scene.fog && 'density' in this.scene.fog) {
      const fog = this.scene.fog as THREE.FogExp2;
      const base = 0.008;
      if (pct === 50) {
        fog.density = 0.022;
      } else if (pct === 70) {
        fog.density = 0.013;
      } else {
        fog.density = base;
      }
    }

    this.updatePlatformCulling(true);
  }

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
  /** Guardian arenas and basement trapdoors of generated levels */
  private dungeonSystem = new DungeonSystem();
  /** Extra decor (particles, birds, far islands, flowers) that grows with the graphics quality */
  private ambience!: AmbientDecor;
  /** 3D online multiplayer avatars */
  public remotePlayers!: RemotePlayersManager;
  private hasAppliedRoomSpawn = false;
  /** Boss fights: life bar, tools, the boss itself (null on other levels) */
  public combat: CombatSystem | null = null;
  private lookRaise = 0;
  private lookBack = 0;
  /** How dark the level is right now (blackouts): the Backrooms mist creeps in with it */
  private levelDarkness = 0;
  private darkBase: { dir: number; hemi: number; fogDensity: number; fogColor: THREE.Color; exposure: number } | null = null;

  // Levels
  public currentLevel: number = (() => {
    try {
      const saved = localStorage.getItem('cozy_last_level');
      const parsed = saved ? parseInt(saved, 10) : maxPlayableLevel();
      return parsed >= 1 && isLevelUnlocked(parsed) ? parsed : maxPlayableLevel();
    } catch {
      return maxPlayableLevel();
    }
  })();
  private levelRoot!: THREE.Group;
  private lobbyShadowDisc!: THREE.Mesh;
  /** Companion unlocked by the last victory (shown on the victory screen) */
  public lastUnlocked: CompanionStyle | null = null;
  private easterEggFound = false;
  // The level's companion waiting at the summit
  private showcase: THREE.Object3D | null = null;
  private showcaseBase = new THREE.Vector3();

  // Game state & modes
  public gameState: GameState = 'title';
  /** Why the run ended when it wasn't the clock (e.g. a boss fight lost); null = time ran out */
  public gameOverReason: string | null = null;
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
  /** Point the camera orbits while mouse look is on (follows the player smoothly) */
  private camPivot = new THREE.Vector3();
  private isMouseDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private lastHoverMouseX: number = 0;
  private lastHoverMouseY: number = 0;
  private hasHoverMousePos: boolean = false;
  private lastTouchEndTime: number = 0;

  // Mobile / Touchscreen Auto-Follow Camera
  public isTouchDevice: boolean = false;
  public autoChaseCamera: boolean = true;
  /**
   * Mouse look: while playing on a computer the game takes the cursor (pointer lock), so moving
   * the mouse turns the camera without clicking. Esc frees the cursor and pauses; menus free it too.
   */
  public mouseLook: boolean = (() => {
    try {
      return localStorage.getItem('cozy_mouse_look') !== 'false';
    } catch {
      return true;
    }
  })();
  private pointerLocked = false;
  public isUIModalOpen: boolean = false;
  /** When true, Escape will not toggle pause (HUD overlays handle Esc first). */
  public pauseToggleBlocked: boolean = false;
  /** Private party room from invite:result (`party_*`). Null = public level room. */
  public partyRoomId: string | null = null;
  public levelStartTime: number = typeof performance !== 'undefined' ? performance.now() : Date.now();
  /** Deaths in this run: they lower the level rating */
  public deaths = 0;
  /** Rating of the last finished run (shown on the victory screen) */
  public lastRating: LevelRating | null = null;
  /** Party: when (performance.now ms) the time to reach the goal runs out, null = no timer */
  public partyDeadline: number | null = null;
  private partyTimerShown = -1;
  /** Party members who already finished this level */
  private partyFinishedIds = new Set<string>();
  /** Spectator mode: latest enemy snapshot of every friend still playing */
  private spectateSnaps = new Map<string, { d: number[]; t: number }>();
  private snapSendT = 0;
  private bossSyncT = 0;
  /** Waiting room: what each friend last told us (ready? still in the room?) */
  private lobbyPeers = new Map<string, { ready: boolean; inLobby: boolean; at: number }>();

  // Spectator Mode in Party Rooms
  public isSpectating: boolean = false;
  public spectateTargetUserId: string | null = null;
  public spectateTargetName: string = '';
  public spectateRank: number = 1;
  public spectateTimeSeconds: number = 0;
  public spectateSummary: RoomAllFinishedPayload | null = null;

  private reverseRunTimer: number = 0;
  private directionTurnCooldown: number = 0;
  private lastInputVector = new THREE.Vector2();
  private lastReportedStamina: number = 100;
  private lastReportedExhausted: boolean = false;

  // Character Creator & Lobby preview (close-up turntable camera on the title screen)
  public playerAppearance: CharacterAppearance = loadAppearance();
  public characterPreview: boolean = false;
  public lobbyCameraMode: 'lobby_center' | 'lobby_shop' | 'creator' | 'orbit' = 'lobby_center';
  private tempPreviewAppearance: CharacterAppearance | null = null;
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
  private previewViewOffsetX: number = 0;
  private previewViewOffsetY: number = 0;
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
      alpha: true,
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
    this.ambience = new AmbientDecor(this.scene);
    {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem('cozy_graphics_quality');
      } catch {
        /* storage unavailable */
      }
      const q: Quality = saved === 'high' || saved === 'medium' || saved === 'low' ? saved : this.isSoftwareGl ? 'low' : 'high';
      this.ambience.setQuality(q);
      this.ambience.build(this.world, this.currentLevel, themeForLevel(this.currentLevel));
    }
    this.addCompanionShowcase();
    this.playerModel = createPlayerCharacter(this.textures, this.playerAppearance);
    this.scene.add(this.playerModel.group);

    // Subtle ground contact shadow beneath character in image-backed lobby
    this.lobbyShadowDisc = this.createLobbyShadowDisc();
    this.lobbyShadowDisc.visible = false;
    this.scene.add(this.lobbyShadowDisc);

    // 7. Physics Controller
    this.physics = new ParkourPhysics(this.world, this.playerModel);
    this.physics.onFallDeath = () => this.countDeath();

    // 7b. Companion Powers (key G) & companion snacks around the islands
    this.companionPowers = new CompanionPowerSystem(this.scene);
    // Hombre Polilla: in boss fights turning time back also gives you back the life you had
    this.companionPowers.rewindExtra = {
      get: () => (this.combat ? this.combat.hp : null),
      set: (v) => {
        if (this.combat) this.combat.hp = Math.min(this.combat.maxHp, Math.max(this.combat.hp, v));
      },
      blocked: () => (this.isSpectating ? 'Estás mirando a tu equipo' : this.combat?.isDown ? 'Estás desmayado…' : this.combat?.grab ? '¡Primero suéltate!' : null),
    };
    this.companionPowers.setCompanion(this.playerAppearance.companion, this.physics);
    this.companionPowers.reset(this.physics);

    // 7c. Backpack items (berries, walnuts…) — 5 slots, keys 1-5
    this.itemSystem = new ItemSystem(this.scene);
    this.itemSystem.onPickup = (itemType) => {
      if (this.gameState === 'playing' && !this.isSpectating) {
        recordMissionEvent({
          type: 'item_collected',
          itemType,
          level: this.currentLevel,
          theme: themeForLevel(this.currentLevel),
        });
      }
    };
    this.itemSystem.loadSpots(this.world.itemSpots);
    this.puzzleSystem.load(this.world.puzzles, this.world.platforms);
    this.dungeonSystem.load(this.world.dungeon);
    this.itemCtx = {
      feedCompanion: () => this.companionPowers.feed(),
      setJumpMultiplier: (m: number) => {
        this.physics.jumpMultiplier = m;
      },
      tool: (type: ItemType) => {
        if (this.combat) return this.combat.tool(type);
        const r = this.world.hazards?.useItem?.(type) ?? 'none';
        // (in the Backrooms the bat, the slingshot and the light orbs work: they say why if not)
        if (r !== 'none' || (this.world.hazards?.useItem && (type === 'bate' || type === 'resortera' || type === 'luz'))) return r;
        this.itemSystem.notify(`${ITEM_INFO[type].name}: sirve en las luchas contra jefes`);
        return 'none';
      },
    };

    // 8. Weather System
    this.weatherSystem = new WeatherSystem(this.scene, this.dirLight, this.hemiLight, this.textures);
    this.weatherSystem.onTransitionChange = (target, progress, finished) => {
      this.callbacks.onWeatherChange(target, !finished);
    };
    this.applyRenderDistance();

    // 8b. Online Multiplayer Remote Players Manager
    this.remotePlayers = new RemotePlayersManager(this.scene, this.textures);
    // Only show party members who are on the same level as us
    this.remotePlayers.setLevelGetter(() => this.currentLevel);
    multiplayerClient.setLocalLook(this.playerAppearance);
    // Shared puzzle progress inside a party: orbs found and rocks pushed by anyone count for everyone
    multiplayerClient.addWorldStateListener((data) => {
      if (data.levelId === this.currentLevel) this.applySharedWorld(data);
    });
    multiplayerClient.addWorldOrbListener((data) => {
      if (data.levelId !== this.currentLevel) return;
      this.puzzleSystem.collectOrbRemote(data.orbIndex, data.username || 'Tu equipo', this.itemSystem);
    });
    multiplayerClient.addWorldBlockListener((data) => {
      if (data.levelId !== this.currentLevel) return;
      this.puzzleSystem.setBlockRemote(data.blockIndex, data.x, data.y, data.z);
    });
    multiplayerClient.addWorldEventListener((data) => {
      if (data.levelId !== this.currentLevel) return;
      if (data.kind === 'devpick') {
        if (data.userId) this.devPickBook().set(data.userId, { i: data.i ?? 3, v: data.v ?? 0 });
        this.followDevPick(data.username);
        return;
      }
      if (data.kind === 'minihit' || data.kind === 'trapopen') {
        this.dungeonSystem.onEvent(data.kind, data.i ?? 0, data.v ?? 0, this.gameState === 'playing' ? this.dungeonCtx() : null);
        return;
      }
      if (!this.combat) return;
      this.combat.onEvent(data.kind, data.i ?? 0, data.v ?? 0, data.target, data.userId ?? '', false);
    });
    multiplayerClient.addRoomStateListener((_players, raw) => {
      if (
        !this.hasAppliedRoomSpawn &&
        this.gameState === 'playing' &&
        raw?.yourSpawn &&
        Number.isFinite(raw.yourSpawn.x) &&
        Number.isFinite(raw.yourSpawn.y) &&
        Number.isFinite(raw.yourSpawn.z)
      ) {
        this.hasAppliedRoomSpawn = true;
        // The server's spawn is only a slot number in practice (levels start in different
        // places): stand next to the others at the level's start, unless already on the way.
        const start = this.world.checkpoints[0]?.spawnPos;
        if (start && this.physics.position.distanceTo(start) < 4) {
          this.physics.respawnAtCheckpoint(0, false, this.getPartySpawnOffset());
        }
      }
      // Levels that split the party up: once we know our place in the group, go to our own corner
      // (only if we haven't started walking yet)
      if (this.world.partySpawns && this.gameState === 'playing' && this.physics.position.distanceTo(this.spawnedAt) < 3) {
        const off = this.getPartySpawnOffset();
        const start = this.world.checkpoints[0]?.spawnPos;
        if (off && start && Math.hypot(start.x + off.x - this.physics.position.x, start.z + off.z - this.physics.position.z) > 1) {
          this.physics.respawnAtCheckpoint(0, false, off);
          this.spawnedAt.copy(this.physics.position);
        }
      }
    });

    // Spectator and synchronized room progression listeners
    multiplayerClient.addSpectateStartedListener((payload) => {
      this.isSpectating = true;
      this.spectateRank = payload.rank ?? this.spectateRank;
      this.spectateTimeSeconds = payload.timeSeconds ?? this.spectateTimeSeconds;
      if (payload.targetUserId) {
        this.spectateTargetUserId = payload.targetUserId;
        const ent = this.remotePlayers?.getPlayerEntity(payload.targetUserId);
        this.spectateTargetName = ent?.username || 'Compañero';
      } else if (!this.spectateTargetUserId) {
        const next = this.remotePlayers?.getNextSpectateTarget(null);
        if (next) {
          this.spectateTargetUserId = next.userId;
          this.spectateTargetName = next.username;
        }
      }
      this.physics.isMovementLocked = true;
      this.physics.velocity.set(0, 0, 0);
      this.callbacks.onSpectateChange?.(
        true,
        this.spectateTargetUserId,
        this.spectateTargetName,
        this.spectateRank,
        this.spectateTimeSeconds
      );
    });

    multiplayerClient.addPlayerFinishedNoticeListener((payload) => {
      this.callbacks.onRoomPlayerFinished?.(payload);
      const who = payload.userId || payload.id;
      if (who) this.partyFinishedIds.add(who);
      // A friend reached the goal: the rest have a limited time to finish too
      const me = apiClient.getCurrentUser()?._id;
      if (who && who !== me && !payload.forfeited && this.partyDeadline === null && !this.isSpectating && this.gameState === 'playing') {
        this.partyDeadline = performance.now() + PARTY_FINISH_SECONDS * 1000;
        this.partyTimerShown = -1;
        this.itemSystem.notify(`¡Un compañero llegó a la meta! Tienes ${PARTY_FINISH_SECONDS} s para terminar o pasarás con calificación 0`);
      }
      if (
        this.isSpectating &&
        this.spectateTargetUserId &&
        (payload.userId === this.spectateTargetUserId || payload.id === this.spectateTargetUserId)
      ) {
        this.cycleSpectateTarget(1);
      }
    });

    multiplayerClient.addSpectateSnapListener((payload) => {
      if (payload.levelId !== this.currentLevel) return;
      // Waiting room: who is still reading the brief and who is ready
      if (payload.d?.[0] === LOBBY_MARK) {
        this.lobbyPeers.set(payload.userId, { ready: payload.d[1] === 1, inLobby: payload.d[2] === 1, at: performance.now() });
        return;
      }
      // Not a spectator snapshot: the party host's boss (everybody sees the same Skinwalker)
      if (payload.d?.[0] === BOSS_SYNC_MARK) {
        this.combat?.applyBossSync(payload.userId, payload.d);
        return;
      }
      this.spectateSnaps.set(payload.userId, { d: payload.d, t: performance.now() });
    });

    multiplayerClient.addSpectateSwitchedListener((payload) => {
      this.spectateTargetUserId = payload.targetUserId;
      const ent = this.remotePlayers?.getPlayerEntity(payload.targetUserId);
      this.spectateTargetName = ent?.username || this.spectateTargetName || 'Compañero';
      this.callbacks.onSpectateChange?.(
        true,
        this.spectateTargetUserId,
        this.spectateTargetName,
        this.spectateRank,
        this.spectateTimeSeconds
      );
    });

    multiplayerClient.addRoomAllFinishedListener((payload) => {
      this.spectateSummary = payload;
      this.callbacks.onRoomAllFinished?.(payload);
      soundManager.playVictory();
    });

    multiplayerClient.addRoomLevelChangedListener((payload) => {
      this.stopSpectating();
      this.resetRunStats();
      this.callbacks.onRoomLevelChanged?.(payload);
      if (payload.levelId && payload.levelId !== this.currentLevel) {
        this.loadLevel(payload.levelId);
        this.beginRun(this.gameMode, true);
      }
    });

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
    const cp0 = this.world.checkpoints[0];
    this.callbacks.onCheckpointChange(cp0 ? cp0.name : 'Pradera del Amanecer', 1, this.world.checkpoints.length || 3);
    this.callbacks.onLevelThemeChange?.(this.currentLevel, this.getActiveTheme());

    // Start render loop
    this.startLoop();
  }

  public getActiveTheme(): ThemeId {
    return getDevLevelPick()?.theme ?? themeForLevel(this.currentLevel);
  }

  private createLobbyShadowDisc(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      grad.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
      grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.18)');
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geom = new THREE.PlaneGeometry(2.6, 2.6);
    geom.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
    });
    return new THREE.Mesh(geom, mat);
  }

  /** Time trial budget: open-world & 2x longer Only-Up parkour courses get proportionally more time. */
  private timeTrialStart(): number {
    if (this.world?.boss) return 240;
    const orbs = this.world?.puzzles?.orbs.length ?? 0;
    if (orbs > 0) return 100 + orbs * 25;
    const platCount = this.world?.platforms.length ?? 0;
    if (platCount > 40) {
      return Math.round(80 + Math.min(210, platCount * 1.45));
    }
    return 90;
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
   * Called live by the Character Creator and Lobby Shop.
   */
  public setPlayerAppearance(
    appearance: CharacterAppearance,
    persist: boolean = true,
    bypassLocks: boolean = false
  ) {
    this.tempPreviewAppearance = null;
    this.playerAppearance = { ...appearance };
    if (!bypassLocks && !isCompanionUnlocked(this.playerAppearance.companion)) {
      this.playerAppearance.companion = 'ninguno';
    }
    this.rebuildPlayerModel(this.playerAppearance, !bypassLocks);
    if (persist) {
      saveAppearance(this.playerAppearance);
      if (apiClient.isAuthenticated()) {
        apiClient.updateAppearance(this.playerAppearance).catch(() => {});
      }
    }
  }

  /** Temporarily renders a shop cosmetic on the 3D lobby character without saving. */
  public setTempPreviewAppearance(temp: CharacterAppearance | null) {
    if (!temp) {
      if (!this.tempPreviewAppearance) return;
      this.tempPreviewAppearance = null;
      this.rebuildPlayerModel(this.playerAppearance, false);
      return;
    }
    this.tempPreviewAppearance = { ...temp };
    this.rebuildPlayerModel(this.tempPreviewAppearance, false);
  }

  private rebuildPlayerModel(look: CharacterAppearance, syncMultiplayer: boolean) {
    if (syncMultiplayer) {
      multiplayerClient.setLocalLook(look);
    }
    const old = this.playerModel;
    const next = createPlayerCharacter(this.textures, look);
    next.group.position.copy(old.group.position);
    next.group.rotation.copy(old.group.rotation);
    this.scene.remove(old.group);
    disposePlayerCharacter(old);
    this.scene.add(next.group);
    this.playerModel = next;
    this.physics.playerModel = next;
    this.companionPowers.setCompanion(look.companion, this.physics);
  }

  private frontFacingPreviewYaw(): number {
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerModel.group.quaternion);
    return Math.atan2(fwd.x, fwd.z) + 0.16;
  }

  /** Controls the 3D Lobby camera framing (center hero, shop preview, creator, or orbit). */
  public setLobbyCameraMode(mode: 'lobby_center' | 'lobby_shop' | 'creator' | 'orbit') {
    const prevMode = this.lobbyCameraMode;
    this.lobbyCameraMode = mode;
    if (mode === 'orbit') {
      this.characterPreview = false;
      return;
    }
    const wasOff = !this.characterPreview;
    this.characterPreview = true;
    if (wasOff || prevMode === 'orbit' || mode === 'lobby_center' || mode === 'lobby_shop') {
      if (wasOff || prevMode === 'orbit') {
        this.previewYaw = this.frontFacingPreviewYaw();
      }
      this.previewZoom = 1;
      this.previewIdleSpin = mode === 'creator';
      if (mode === 'lobby_center') {
        this.previewTargetLookY = 0.78;
        this.previewTargetCamY = 0.96;
        this.previewTargetDist = 3.05;
        this.previewTargetPitch = 0.06;
        this.previewPitchUser = 0;
        if (wasOff) {
          this.previewLookY = 0.78;
          this.previewCamY = 0.96;
          this.previewBaseDistance = 3.05;
          this.previewPitch = 0.06;
        }
      } else if (mode === 'lobby_shop') {
        this.previewTargetLookY = 0.76;
        this.previewTargetCamY = 0.94;
        this.previewTargetDist = 2.65;
        this.previewTargetPitch = 0.07;
        this.previewPitchUser = 0;
      } else {
        this.setCharacterPreviewFocus('full', wasOff);
      }
    }
  }

  /** Toggles the close-up turntable camera used while the Character Creator is open. */
  public setCharacterPreview(enabled: boolean) {
    if (enabled) {
      this.setLobbyCameraMode('creator');
    } else {
      this.characterPreview = false;
      this.lobbyCameraMode = 'orbit';
    }
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

  /** Manual zoom for the creator/shop preview (wheel / pinch / UI buttons). */
  public adjustCharacterPreviewZoom(delta: number) {
    this.previewZoom = THREE.MathUtils.clamp(this.previewZoom + delta, 0.6, 1.85);
    if (this.lobbyCameraMode === 'creator') {
      this.previewIdleSpin = false;
      this.previewSpinResumeAt = performance.now() + 2200;
    }
  }

  /** Uses the companion's temporary power (key G or the HUD button). */
  public activateCompanionPower() {
    if (this.gameState !== 'playing') return;
    // Boss fights: each companion has its own special move against each boss
    if (this.combat && this.combat.useCompanionAction()) return;
    const used = this.companionPowers.activate(this.physics, this.stalker ? this.stalker.position : null);
    // Hombre Polilla in a boss fight: rewinding you also stops the boss's time for a moment
    if (used && this.combat && this.playerAppearance.companion === 'polilla') this.combat.freezeBoss(4);
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
    this.setTempPreviewAppearance(null);
    this.characterPreview = false;
    this.lobbyCameraMode = 'orbit';
    this.previewBlend = 0;
    this.previewViewOffsetX = 0;
    this.previewViewOffsetY = 0;
    if (this.viewOffsetActive) {
      this.camera.clearViewOffset();
      this.viewOffsetActive = false;
    }
  }

  private buildLevel(level: number): WorldBuildResult {
    // Levels 15, 25, 35…: the Backrooms (25, 45, 65…: the Skinwalker's hall)
    if (level > 4 && themeForLevel(level) === 'backrooms') {
      return isBossLevel(level)
        ? buildSkinwalkerArena(level, this.levelRoot, this.textures)
        : buildBackroomsWorld(level, this.levelRoot, this.textures);
    }
    switch (level) {
      case 2:
        return buildCosmicWorld(this.levelRoot, this.textures);
      case 3:
        return buildSwampWorld(this.levelRoot, this.textures);
      case 4:
        return buildAeroWorld(this.levelRoot, this.textures);
      case 1:
        return buildCozyParkourWorld(this.levelRoot, this.textures);
      case 5:
        return generateLevel(level, this.levelRoot, this.textures);
      default:
        // Level 6 and beyond: bosses every 10 levels, complex non-linear parkour, or open sandbox zones
        if (isBossLevel(level)) return generateBossArena(level, this.levelRoot, this.textures);
        if (levelKind(level) === 'parkour') return generateParkourLevel(level, this.levelRoot, this.textures);
        return generateLevel(level, this.levelRoot, this.textures);
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
  /** Boss fights: the companion flies around the boss and gives a tip (key I). False outside fights. */
  public askCompanionTip(): boolean {
    if (!this.combat || this.gameState !== 'playing') return false;
    this.combat.askTip();
    return true;
  }

  /** Rebuild a level even when it is the one already loaded (the developer panel changed what it is). */
  public reloadLevel(level: number) {
    this.currentLevel = -1;
    this.loadLevel(level);
  }

  public loadLevel(level: number) {
    level = Math.max(1, Math.floor(level));
    // In a party you go wherever the group is, even to a level you haven't unlocked yet
    if (level === this.currentLevel || (!isLevelUnlocked(level) && !this.partyRoomId)) return;

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
    this.ambience.build(this.world, level, themeForLevel(level));
    this.applyHostility();
    this.addCompanionShowcase();
    this.physics = new ParkourPhysics(this.world, this.playerModel);
    this.physics.onFallDeath = () => this.countDeath();
    this.physics.jumpMultiplier = this.itemSystem.superJumpLeft > 0 ? 1.4 : 1;
    this.companionPowers.reset(this.physics);
    this.itemSystem.loadSpots(this.world.itemSpots);
    // Keys only open doors of their own level
    this.itemSystem.removeAllOfType('llave');
    this.puzzleSystem.load(this.world.puzzles, this.world.platforms);
    this.dungeonSystem.load(this.world.dungeon);
    this.reapplySharedWorld();
    this.resetCombat();

    this.callbacks.onCollectiblesChange(0, this.physics.totalCollectibles);
    const cp0 = this.world.checkpoints[0];
    this.callbacks.onCheckpointChange(cp0 ? cp0.name : '', 1, this.world.checkpoints.length || 3);
    // New world: switch the sky almost instantly
    this.weatherSystem.setWeather(this.levelWeather(), 0.2);
    soundManager.setWeather(this.levelWeather(), 1.5);
    this.callbacks.onWeatherChange(this.levelWeather(), true);
    this.callbacks.onLevelThemeChange?.(this.currentLevel, this.getActiveTheme());
    this.applyRenderDistance();
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  /** From the victory screen: travel to the next level (every level starts with an empty backpack). */
  public goToNextLevel() {
    const next = this.currentLevel + 1;
    if (this.partyRoomId) {
      multiplayerClient.emitAdvanceLevel();
      return;
    }
    if (!isLevelUnlocked(next)) return;
    this.loadLevel(next);
    this.beginRun(this.gameMode, true);
  }

  public startSpectating(targetUserId?: string, rank?: number, timeSeconds?: number) {
    this.isSpectating = true;
    if (typeof rank === 'number') this.spectateRank = rank;
    if (typeof timeSeconds === 'number') this.spectateTimeSeconds = timeSeconds;
    this.physics.isMovementLocked = true;
    this.physics.velocity.set(0, 0, 0);
    this.currentInput.forward = 0;
    this.currentInput.right = 0;
    this.currentInput.jump = false;
    this.currentInput.sprint = false;
    this.currentInput.crouch = false;

    if (targetUserId) {
      this.spectateTargetUserId = targetUserId;
      const ent = this.remotePlayers?.getPlayerEntity(targetUserId);
      this.spectateTargetName = ent?.username || 'Compañero';
    } else {
      const next = this.remotePlayers?.getNextSpectateTarget(null);
      if (next) {
        this.spectateTargetUserId = next.userId;
        this.spectateTargetName = next.username;
      }
    }

    this.callbacks.onSpectateChange?.(
      true,
      this.spectateTargetUserId,
      this.spectateTargetName,
      this.spectateRank,
      this.spectateTimeSeconds
    );
  }

  public setSpectateTarget(targetUserId: string) {
    if (!this.isSpectating) return;
    this.spectateTargetUserId = targetUserId;
    const ent = this.remotePlayers?.getPlayerEntity(targetUserId);
    this.spectateTargetName = ent?.username || 'Compañero';
    multiplayerClient.emitSpectateSwitch(targetUserId);
    this.callbacks.onSpectateChange?.(
      true,
      this.spectateTargetUserId,
      this.spectateTargetName,
      this.spectateRank,
      this.spectateTimeSeconds
    );
  }

  public cycleSpectateTarget(dir: 1 | -1 = 1) {
    if (!this.isSpectating) return;
    const next = this.remotePlayers?.getNextSpectateTarget(this.spectateTargetUserId, dir);
    if (!next) return;
    this.spectateTargetUserId = next.userId;
    this.spectateTargetName = next.username;
    multiplayerClient.emitSpectateSwitch(next.userId);
    this.callbacks.onSpectateChange?.(
      true,
      this.spectateTargetUserId,
      this.spectateTargetName,
      this.spectateRank,
      this.spectateTimeSeconds
    );
  }

  public stopSpectating() {
    this.isSpectating = false;
    this.spectateTargetUserId = null;
    this.spectateTargetName = '';
    this.spectateSummary = null;
    this.physics.isMovementLocked = false;
    this.callbacks.onSpectateChange?.(false, null, '');
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
    this.syncPointerLock();
    if (this.partyRoomId) {
      multiplayerClient.joinLevel(this.currentLevel, this.partyRoomId);
    } else {
      multiplayerClient.leaveRoom();
      this.remotePlayers?.clearAll();
    }
  }

  public getPartySpawnOffset(customIndex?: number): { x: number; z: number } | undefined {
    if (!this.partyRoomId) return undefined;
    // Some levels split the party up (the Skinwalker's maze: everyone starts in another corner)
    const offsets: Array<{ x: number; z: number }> = this.world.partySpawns ?? [
      { x: -0.9, z: 0 },
      { x: 0.9, z: 0 },
      { x: 0, z: 1.2 },
      { x: 0, z: -1.2 },
      { x: -1.2, z: 1.1 },
      { x: 1.2, z: 1.1 },
      { x: -1.2, z: -1.1 },
      { x: 1.2, z: -1.1 },
      { x: -1.8, z: 0 },
      { x: 1.8, z: 0 },
    ];
    if (typeof customIndex === 'number' && customIndex >= 0) {
      return offsets[customIndex % offsets.length];
    }
    const self = multiplayerClient.getSelf();
    const selfId = self?.userId || self?.id;
    const players = multiplayerClient.getPartyPlayers();
    if (selfId && players.length > 0) {
      const idx = players.findIndex((p) => (p.userId || p.id) === selfId);
      if (idx >= 0) return offsets[idx % offsets.length];
    }
    const isHost = multiplayerClient.isPartyHostRole();
    return isHost ? offsets[0] : offsets[1];
  }

  private camRay = new THREE.Raycaster();
  private eyeW = [new THREE.Vector3(), new THREE.Vector3()];
  private eyeRay = new THREE.Raycaster();

  /**
   * (HUD) The Skinwalker's eyeshine on screen, in CSS pixels, so it can be drawn over the darkness.
   * Null when there's nothing to show, it's behind you, or a wall is in the way.
   */
  public getEyeShine(): { pts: { x: number; y: number }[]; op: number; red: boolean; size: number } | null {
    if (!this.combat || this.isUIModalOpen) return null;
    const s = this.combat.eyeShine(this.eyeW);
    if (!s) return null;
    const cam = this.camera.position;
    const mid = this.eyeW[0].clone().add(this.eyeW[1]).multiplyScalar(0.5);
    const dist = mid.distanceTo(cam);
    const colliders = this.world.cameraColliders;
    if (colliders?.length) {
      this.eyeRay.set(cam, mid.clone().sub(cam).normalize());
      this.eyeRay.far = Math.max(0.1, dist - 0.35);
      if (this.eyeRay.intersectObjects(colliders, false).length) return null;
    }
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    const pts: { x: number; y: number }[] = [];
    for (const p of this.eyeW) {
      const v = p.clone().project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return null;
      pts.push({ x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h });
    }
    return { pts, op: s.op, red: s.red, size: THREE.MathUtils.clamp((h * 0.4) / Math.max(dist, 1), 3, 8) };
  }
  /** Where this run started (to know if the player already walked away from the spawn) */
  private spawnedAt = new THREE.Vector3();
  /** Pulls the camera in front of the first wall/ceiling between it and the player. */
  private keepCameraInside(followPos: THREE.Vector3) {
    const colliders = this.world.cameraColliders!;
    const pivot = new THREE.Vector3(followPos.x, followPos.y + 1.1, followPos.z);
    const cam = this.camera.position;
    const dir = cam.clone().sub(pivot);
    const dist = dir.length();
    if (dist < 0.3) return;
    dir.divideScalar(dist);
    // A fat ray: the center and four rays around it (the camera's view has a width, so a thin ray
    // let its edges slip into a wall or above the ceiling, and that wall vanished from view)
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const R = 0.28;
    let safe = dist;
    for (const [a, b] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const from = pivot.clone().addScaledVector(right, a * R).addScaledVector(up, b * R);
      this.camRay.set(from, dir);
      this.camRay.far = dist + 0.4;
      const hit = this.camRay.intersectObjects(colliders, false)[0];
      if (hit) safe = Math.min(safe, hit.distance - 0.4);
    }
    cam.copy(pivot).addScaledVector(dir, Math.max(0.3, safe));
    // A wall right behind you (a corner, your back to the wall): instead of sliding into your head
    // (all you saw was the inside of the cap), the camera rises over you and looks down
    if (safe < 1.6) {
      this.camRay.set(pivot, new THREE.Vector3(0, 1, 0));
      this.camRay.far = 4;
      const roof = this.camRay.intersectObjects(colliders, false)[0];
      const room = roof ? roof.distance - 0.45 : 4;
      const lift = Math.max(0, Math.min(room, (1.6 - Math.max(0, safe)) * 1.3 + 0.35));
      cam.y += lift;
    }
    // Still too close to a wall or the ceiling (e.g. sliding along a wall)? Push it away a little
    const MARGIN = 0.38;
    const horiz = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    const side = new THREE.Vector3(-horiz.z, 0, horiz.x);
    for (const d of [right, right.clone().negate(), new THREE.Vector3(0, 1, 0), dir, horiz, side, side.clone().negate(), new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)]) {
      this.camRay.set(cam, d);
      this.camRay.far = MARGIN;
      const hit = this.camRay.intersectObjects(colliders, false)[0];
      if (hit) cam.addScaledVector(d, -(MARGIN - hit.distance));
    }
    // No room at all (low ceiling and walls all around): hide your character while the camera is
    // that close, so it never shows the inside of the head
    this.hidePlayerForCamera(!this.isSpectating && cam.distanceTo(pivot) < 0.8);
  }

  private camHidPlayer = false;
  private hidePlayerForCamera(hide: boolean) {
    const g = this.physics.playerModel.group;
    if (hide && !this.camHidPlayer) {
      g.visible = false;
      this.camHidPlayer = true;
    } else if (!hide && this.camHidPlayer) {
      g.visible = true;
      this.camHidPlayer = false;
    }
  }

  /** New attempt at the level: no deaths, no rating, no party timer. */
  private resetRunStats() {
    this.deaths = 0;
    this.lastRating = null;
    this.partyDeadline = null;
    this.partyTimerShown = -1;
    this.partyFinishedIds.clear();
    this.spectateSnaps.clear();
    this.callbacks.onDeathsChange?.(0);
    this.callbacks.onPartyTimer?.(null);
  }

  /** Falling into the void, being caught by the Stalker or fainting in a boss fight. */
  private countDeath() {
    if (this.gameState !== 'playing' || this.isSpectating) return;
    this.deaths++;
    this.callbacks.onDeathsChange?.(this.deaths);
  }

  /** Rates the run that just ended (forfeited = the party timer ran out) and keeps the best. */
  private rateRun(forfeited: boolean): LevelRating {
    const timeSeconds = Math.max(1, Number(((performance.now() - this.levelStartTime) / 1000).toFixed(2)));
    const rating = computeRating({
      levelId: this.currentLevel,
      timeSeconds,
      deaths: this.deaths,
      relics: this.physics.collectedCount,
      totalRelics: this.physics.totalCollectibles,
      forfeited,
    });
    this.lastRating = rating;
    this.partyDeadline = null;
    this.callbacks.onPartyTimer?.(null);
    if (!isDevMode()) saveRating(this.currentLevel, rating);
    return rating;
  }

  /** Party timer: counts down and, when it runs out, the player passes the level with rating 0. */
  private updatePartyTimer() {
    if (this.partyDeadline === null) return;
    if (!this.partyRoomId || this.isSpectating || this.gameState !== 'playing') {
      if (this.isSpectating || !this.partyRoomId) {
        this.partyDeadline = null;
        this.callbacks.onPartyTimer?.(null);
      }
      return;
    }
    const left = Math.max(0, (this.partyDeadline - performance.now()) / 1000);
    const shown = Math.ceil(left);
    if (shown !== this.partyTimerShown) {
      this.partyTimerShown = shown;
      this.callbacks.onPartyTimer?.(shown);
    }
    if (left > 0) return;
    // Time's up: pass automatically, but with rating 0
    this.lastUnlocked = isDevMode() ? null : markLevelComplete(this.currentLevel);
    const rating = this.rateRun(true);
    this.physics.hasReachedSummit = true;
    multiplayerClient.emitPlayerFinish(this.currentLevel, rating.timeSeconds, this.physics.collectedCount, rating);
    this.startSpectating(undefined, undefined, rating.timeSeconds);
    this.itemSystem.notify('¡Se acabó el tiempo! Pasas al siguiente nivel con calificación 0');
    soundManager.playGameOver();
  }

  // ---------------- Spectator mode: everyone sees the same enemies ----------------

  /** Moving things whose position is simulated on each computer (enemies, bosses, the Stalker). */
  private syncTargets(): { obj: THREE.Object3D; pos?: THREE.Vector3 }[] {
    const out: { obj: THREE.Object3D; pos?: THREE.Vector3 }[] = [];
    const em = this.world.enemyManager;
    if (em) for (const e of em.enemies) out.push({ obj: e.group, pos: e.position });
    for (const mb of this.dungeonSystem.miniBosses) out.push({ obj: mb.group, pos: mb.pos });
    if (this.combat) for (const o of this.combat.syncObjects()) out.push({ obj: o });
    if (this.stalker) out.push({ obj: this.stalker.group, pos: this.stalker.position });
    if (this.world.hazards) out.push(...this.world.hazards.syncObjects());
    return out;
  }

  /** Waiting room: tell the party if we're ready (the HUD calls this twice a second while it's open). */
  public announceLobby(ready: boolean, inLobby: boolean) {
    if (!this.partyRoomId) return;
    multiplayerClient.sendSpectateSnap(this.currentLevel, [LOBBY_MARK, ready ? 1 : 0, inLobby ? 1 : 0]);
  }

  /**
   * Waiting room: everyone else in the party and what they're doing — ready, still reading,
   * already playing this level, or still loading (on another screen or level).
   */
  public getLobbyRoster(): { userId: string; name: string; status: 'ready' | 'waiting' | 'playing' | 'loading' }[] {
    if (!this.partyRoomId) return [];
    const me = apiClient.getCurrentUser()?._id;
    const here = new Set((this.remotePlayers?.getPlayersInfo() ?? []).map((r) => r.userId));
    const now = performance.now();
    const out: { userId: string; name: string; status: 'ready' | 'waiting' | 'playing' | 'loading' }[] = [];
    for (const p of multiplayerClient.getPartyPlayers()) {
      const id = p.userId || p.id;
      if (!id || id === me) continue;
      const name = p.displayName || p.username || 'Explorador';
      const peer = this.lobbyPeers.get(id);
      const fresh = peer && now - peer.at < 2500;
      const status = fresh && peer!.inLobby ? (peer!.ready ? 'ready' : 'waiting') : here.has(id) ? 'playing' : 'loading';
      out.push({ userId: id, name, status });
    }
    return out;
  }

  /** Waiting room look: the Skinwalker's, the Backrooms' or the cozy one. */
  public getLobbyStyle(): 'skinwalker' | 'backrooms' | 'cozy' {
    if (this.combat?.setup.kind === 'skinwalker') return 'skinwalker';
    if (this.levelWeather() === 'backrooms') return 'backrooms';
    return 'cozy';
  }

  /** Party host in a boss fight: stream the boss (where it is, what it's doing) ten times a second. */
  private sendBossSync(dt: number) {
    if (!this.partyRoomId || !this.combat || this.gameState !== 'playing') return;
    this.bossSyncT -= dt;
    if (this.bossSyncT > 0) return;
    this.bossSyncT = 0.1;
    if (!this.isPartyHost() || !this.remotePlayers?.getPlayersInfo().length) return;
    const d = this.combat.bossSyncPayload();
    if (d) multiplayerClient.sendSpectateSnap(this.currentLevel, d);
  }

  /** While friends watch us (they already finished), stream what we see a few times a second. */
  private sendSpectateSnap(dt: number) {
    if (!this.partyRoomId || this.isSpectating || this.gameState !== 'playing') return;
    const me = apiClient.getCurrentUser()?._id;
    if (![...this.partyFinishedIds].some((id) => id !== me)) return;
    this.snapSendT -= dt;
    if (this.snapSendT > 0) return;
    this.snapSendT = 0.2;
    const d: number[] = [];
    for (const { obj } of this.syncTargets().slice(0, 200)) {
      const r = (n: number) => Math.round(n * 100) / 100;
      d.push(r(obj.position.x), r(obj.position.y), r(obj.position.z), r(obj.rotation.y), r(obj.scale.y), obj.visible ? 1 : 0);
    }
    multiplayerClient.sendSpectateSnap(this.currentLevel, d);
  }

  /** Spectating: move our copy of the enemies to where the watched friend sees them. */
  private applySpectateSnap(dt: number) {
    if (!this.isSpectating || !this.spectateTargetUserId) return;
    const snap = this.spectateSnaps.get(this.spectateTargetUserId);
    if (!snap || performance.now() - snap.t > 1500) return;
    const targets = this.syncTargets();
    const k = 1 - Math.exp(-dt * 12);
    for (let i = 0; i < targets.length && i * 6 + 5 < snap.d.length; i++) {
      const { obj, pos } = targets[i];
      const d = snap.d;
      const o = i * 6;
      const offX = pos ? obj.position.x - pos.x : 0;
      const offY = pos ? obj.position.y - pos.y : 0;
      const offZ = pos ? obj.position.z - pos.z : 0;
      const far = Math.hypot(obj.position.x - d[o], obj.position.z - d[o + 2]) > 6;
      const f = far ? 1 : k;
      obj.position.x += (d[o] - obj.position.x) * f;
      obj.position.y += (d[o + 1] - obj.position.y) * f;
      obj.position.z += (d[o + 2] - obj.position.z) * f;
      let dy = d[o + 3] - obj.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      obj.rotation.y += dy * f;
      if (d[o + 4] > 0.01) obj.scale.y += (d[o + 4] - obj.scale.y) * f;
      obj.visible = d[o + 5] > 0;
      if (pos) pos.set(obj.position.x - offX, obj.position.y - offY, obj.position.z - offZ);
    }
  }

  private beginRun(mode: GameMode | undefined, freshBackpack: boolean) {
    this.gameOverReason = null;
    this.resetRunStats();
    this.stopSpectating();
    this.levelStartTime = performance.now();
    this.lastUnlocked = null;
    this.clearPreviewCamera();
    this.resetCompanionPowers();
    this.physics.resetCollectibles();
    this.callbacks.onCollectiblesChange(0, this.physics.totalCollectibles);
    this.itemSystem.resetPickups();
    if (freshBackpack) this.itemSystem.clearInventory(this.itemCtx);
    this.itemSystem.removeAllOfType('llave');
    this.puzzleSystem.reset();
    this.dungeonSystem.reset(this.partySize());
    this.world.hazards?.reset();
    this.reapplySharedWorld();
    this.resetCombat();
    this.physics.respawnAtCheckpoint(0, false, this.getPartySpawnOffset());
    this.spawnedAt.copy(this.physics.position);
    this.lastReportedStamina = this.physics.stamina;
    this.lastReportedExhausted = this.physics.isStaminaExhausted;
    this.callbacks.onStaminaChange?.(this.physics.stamina, this.physics.maxStamina, this.physics.isStaminaExhausted);
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
    this.hasHoverMousePos = false;
    this.physics.isMovementLocked = paused || this.isUIModalOpen;
    if (paused) {
      this.isMouseDragging = false;
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
    this.syncPointerLock();
  }

  public setUIModalOpen(open: boolean) {
    this.isUIModalOpen = open;
    this.hasHoverMousePos = false;
    this.physics.isMovementLocked =
      open || this.gameState === 'paused' || this.gameState === 'victory' || this.gameState === 'game_over';
    if (open) {
      this.isMouseDragging = false;
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
    this.syncPointerLock();
  }

  /** Multiplayer: apply the party's shared progress (orbs found, rock positions) to this level. */
  private applySharedWorld(data: {
    orbs: number[];
    blocks: { index: number; x: number; y: number; z: number }[];
    events?: { kind: string; i?: number; v?: number; target?: string; userId?: string }[];
  }) {
    for (const i of data.orbs) this.puzzleSystem.collectOrbRemote(i, null, null);
    for (const b of data.blocks) this.puzzleSystem.setBlockRemote(b.index, b.x, b.y, b.z, true);
    // Developer mode: everybody plays the same world on this level (the one the party agreed on)
    if (this.partyRoomId) {
      const book = this.devPickBook();
      for (const e of data.events ?? []) if (e.kind === 'devpick' && e.userId) book.set(e.userId, { i: e.i ?? 3, v: e.v ?? 0 });
      const me = apiClient.getCurrentUser()?._id ?? 'me';
      const mine = getDevLevelPick();
      const mineHere = mine && mine.level === this.currentLevel ? mine : null;
      if (this.devPickDirty && mineHere) {
        // Just chosen in the developer panel: it wins (newer than any other pick here)
        const seq = 1 + Math.max(0, ...[...book.values()].map((p) => Math.floor(p.v / 8)));
        this.devPickDirty = false;
        this.announceDevPick(seq);
      } else if (mineHere && !book.has(me)) {
        this.announceDevPick(0);
      }
      this.devPickDirty = false;
      if (this.followDevPick(null)) return; // rebuilt: the state comes again
    }
    if (data.events) {
      for (const e of data.events) {
        if (e.kind === 'devpick') continue;
        if (e.kind === 'minihit' || e.kind === 'trapopen') this.dungeonSystem.onEvent(e.kind, e.i ?? 0, e.v ?? 0, null);
        else if (this.combat) this.combat.onEvent(e.kind, e.i ?? 0, e.v ?? 0, e.target, e.userId ?? '', true);
      }
    }
  }

  /** The developer panel changed the world of this level: tell the party when we (re)join it. */
  private devPickDirty = false;
  public markDevPickChanged() {
    this.devPickDirty = true;
  }

  /** Developer picks of each party member for the level being played (latest one of each) */
  private devPicks: { level: number; byUser: Map<string, { i: number; v: number }> } = { level: -1, byUser: new Map() };
  private devPickBook() {
    if (this.devPicks.level !== this.currentLevel) this.devPicks = { level: this.currentLevel, byUser: new Map() };
    return this.devPicks.byUser;
  }

  /** Tells the party which world we picked for this level number (with how recent the pick is). */
  private announceDevPick(seq: number) {
    if (!this.partyRoomId) return;
    const pick = getDevLevelPick();
    if (!pick || pick.level !== this.currentLevel) return;
    const i = DEV_KINDS.indexOf(pick.kind);
    const v = Math.max(0, DEV_THEMES.indexOf(pick.theme)) + 8 * Math.min(120, seq);
    this.devPickBook().set(apiClient.getCurrentUser()?._id ?? 'me', { i, v });
    multiplayerClient.sendEvent(this.currentLevel, 'devpick', i, v);
  }

  /**
   * Plays the world the party agreed on for this level number: the newest developer pick
   * (ties: the lowest user id), or the normal world if nobody picked one. Rebuilds the level if
   * needed; returns true when it did.
   */
  private followDevPick(from: string | null | undefined): boolean {
    let best: { id: string; i: number; v: number } | null = null;
    for (const [id, p] of this.devPickBook()) {
      if (p.i < 0 || p.i >= DEV_KINDS.length) continue;
      if (!best || Math.floor(p.v / 8) > Math.floor(best.v / 8) || (Math.floor(p.v / 8) === Math.floor(best.v / 8) && id < best.id)) best = { id, ...p };
    }
    const want: DevLevelPick | null = best ? { level: this.currentLevel, kind: DEV_KINDS[best.i], theme: DEV_THEMES[best.v % 8] ?? 'cozy' } : null;
    const cur = getDevLevelPick();
    const curHere = cur && cur.level === this.currentLevel ? cur : null;
    const same = (!want && !curHere) || (want && curHere && want.kind === curHere.kind && want.theme === curHere.theme);
    if (same) return false;
    setDevLevelPick(want);
    const wasPlaying = this.gameState === 'playing';
    this.reloadLevel(this.currentLevel);
    if (wasPlaying) this.beginRun(this.gameMode, true);
    this.itemSystem.notify(`Se cargó el mismo mundo que ${from ? `eligió ${from}` : 'tiene tu grupo'} en este nivel (modo desarrollador)`);
    return true;
  }

  /** You + the friends on this level */
  private partySize(): number {
    return 1 + (this.partyRoomId && this.remotePlayers ? this.remotePlayers.getPlayersInfo().length : 0);
  }

  private dungeonCtx(): DungeonContext {
    const ph = this.physics;
    return {
      position: ph.position,
      velocity: ph.velocity,
      isGrounded: ph.isGrounded,
      items: this.itemSystem,
      partySize: this.partySize(),
      send: (kind, i, v) => {
        if (this.partyRoomId) multiplayerClient.sendEvent(this.currentLevel, kind, i, v);
      },
      teleport: (to, yaw) => {
        ph.position.copy(to);
        ph.velocity.set(0, 0, 0);
        ph.lastSafePos.copy(to);
        this.cameraYaw = yaw;
      },
      knock: (vx, vy, vz) => {
        if (this.isSpectating) return;
        ph.velocity.set(vx, vy, vz);
        ph.isGrounded = false;
        ph.knockbackTimer = 0.35;
      },
      onCellarFall: () => this.countDeath(),
      onEnterCellar: (blockIndex) => {
        const pos = this.puzzleSystem.resetBlock(blockIndex);
        if (pos && this.partyRoomId) multiplayerClient.sendBlock(this.currentLevel, blockIndex, pos.x, pos.y, pos.z, true);
      },
    };
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
      lose: (reason) => {
        if (this.gameState !== 'playing') return;
        this.gameOverReason = reason;
        this.gameState = 'game_over';
        this.callbacks.onStateChange('game_over');
        soundManager.playGameOver();
      },
      unlockMovement: () => {
        this.physics.isMovementLocked =
          this.isUIModalOpen ||
          this.gameState === 'paused' ||
          this.gameState === 'victory' ||
          this.gameState === 'game_over';
      },
      onDeath: () => this.countDeath(),
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
      this.itemSystem.notify(this.combat || this.world.hazards ? 'No tienes bate: búscalo en el nivel' : 'El bate sirve en las luchas contra jefes');
      return;
    }
    this.itemSystem.use(slot, this.itemCtx);
  }

  /** HUD info of levels with their own rules (the Backrooms: hearts, key, levers). */
  public getLevelStatus(): LevelHazardStatus | null {
    if (this.gameState !== 'playing' || this.isSpectating) return null;
    return this.world.hazards?.status?.() ?? null;
  }

  /** Moves the player and the camera together (the endless corridor), so nothing seems to jump. */
  private shiftView(o: THREE.Vector3) {
    this.physics.position.add(o);
    this.physics.playerModel.group.position.copy(this.physics.position);
    this.camera.position.add(o);
    this.camPivot.add(o);
    this.targetCameraPos.add(o);
    this.targetLookAt.add(o);
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
    this.hasAppliedRoomSpawn = false;
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
    this.stopSpectating();
    this.resetCombat();
    multiplayerClient.leaveRoom();
    this.partyRoomId = null;
    this.remotePlayers?.clearAll();
    this.gameState = 'title';
    this.hasHoverMousePos = false;
    this.isMouseDragging = false;
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
      backrooms: {
        title: 'Los Backrooms',
        desc: 'Zumbido de lámparas y alfombra húmeda',
      },
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
      neon_night: {
        title: 'Noche de Neón',
        desc: 'Horizonte retrowave entre láseres y palmeras luminosas',
      },
      cyber_storm: {
        title: 'Tormenta Cyberpunk',
        desc: 'Lluvia eléctrica sobre rascacielos y hologramas',
      },
      lava_ash: {
        title: 'Cenizas Volcánicas',
        desc: 'Brasas ascendentes y calor del cráter',
      },
      blizzard: {
        title: 'Ventisca Glacial',
        desc: 'Nieve suave bajo auroras boreales',
      },
      desert_sun: {
        title: 'Sol del Desierto',
        desc: 'Cálida brisa dorada entre dunas y obeliscos',
      },
      candy_sky: {
        title: 'Cielo de Algodón',
        desc: 'Pétalos de caramelo sobre nubes pastel',
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
    this.gameOverReason = null;
    this.resetRunStats();
    this.levelStartTime = performance.now();
    if (mode) {
      this.setGameMode(mode);
    }
    this.physics.respawnAtCheckpoint(0, true, this.getPartySpawnOffset());
    this.spawnedAt.copy(this.physics.position);
    this.resetCompanionPowers();
    this.physics.resetCollectibles();
    this.callbacks.onCollectiblesChange(0, this.physics.totalCollectibles);
    this.itemSystem.resetPickups();
    this.itemSystem.clearInventory(this.itemCtx);
    this.itemSystem.removeAllOfType('llave');
    this.puzzleSystem.reset();
    this.dungeonSystem.reset(this.partySize());
    this.world.hazards?.reset();
    this.reapplySharedWorld();
    this.resetCombat();
    this.gameState = 'playing';
    this.syncPointerLock();
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
      this.callbacks.onCheckpointChange(this.world.checkpoints[index].name, index + 1, this.world.checkpoints.length || 3);
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
    this.hasHoverMousePos = false;
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
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);
    dom.addEventListener('mousedown', this.handleMouseDown);
    dom.addEventListener('mouseleave', this.handleMouseLeave);
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
    this.hasHoverMousePos = false;
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
    if (e.code !== 'Escape' && !this.pointerLocked && this.wantsPointerLock()) this.syncPointerLock();

    if (this.gameState === 'title') {
      if (this.characterPreview || this.lobbyCameraMode !== 'orbit') return;
      if (e.code === 'Space' || e.code === 'Enter') {
        this.startGame();
      }
      return;
    }

    if (this.isSpectating) {
      if (e.code === 'KeyE' || e.code === 'Tab' || e.code === 'Space') {
        e.preventDefault();
        this.cycleSpectateTarget(e.shiftKey ? -1 : 1);
        return;
      }
      if (e.code === 'KeyQ') {
        e.preventDefault();
        this.cycleSpectateTarget(-1);
        return;
      }
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

  // ---------------- Mouse look (pointer lock) ----------------
  /** Fingers actually touched the screen (phones, tablets, touch laptops being used by touch) */
  private usedTouch = false;

  /** A computer with a real mouse (not a phone or tablet). Small windows and touch laptops count. */
  private hasFinePointer(): boolean {
    if (this.usedTouch) return false;
    try {
      return window.matchMedia('(any-pointer: fine)').matches;
    } catch {
      return !this.isTouchDevice;
    }
  }

  /** The cursor should be captured right now: playing, no menu open, not watching others. */
  private wantsPointerLock(): boolean {
    return this.mouseLook && this.gameState === 'playing' && !this.isUIModalOpen && !this.isSpectating && this.hasFinePointer();
  }

  /**
   * Takes the cursor when it should (only works from a click or key press — browsers require it)
   * and gives it back when a menu opens or the game pauses.
   */
  public syncPointerLock() {
    const dom = this.renderer.domElement;
    if (this.wantsPointerLock()) {
      if (document.pointerLockElement !== dom && dom.requestPointerLock) {
        try {
          const r = dom.requestPointerLock() as unknown as Promise<void> | undefined;
          r?.catch?.(() => {});
        } catch {
          // not allowed right now (no click/key yet): the next one will take it
        }
      }
    } else if (document.pointerLockElement === dom) {
      this.releasingPointer = true;
      document.exitPointerLock();
    }
  }

  public setMouseLook(on: boolean) {
    this.mouseLook = on;
    this.hasHoverMousePos = false;
    try {
      localStorage.setItem('cozy_mouse_look', String(on));
    } catch {
      // ignore
    }
    if (on) {
      this.syncPointerLock();
    } else if (document.pointerLockElement === this.renderer.domElement) {
      this.releasingPointer = true;
      document.exitPointerLock();
    }
  }

  private releasingPointer = false;

  private handlePointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    const wasLocked = this.pointerLocked;
    this.pointerLocked = locked;
    this.hasHoverMousePos = false;
    if (locked) {
      this.isMouseDragging = false;
      return;
    }
    // Esc (or switching window) freed the cursor in the middle of the game: pause so the
    // menu can be used; "Continuar" takes the cursor back
    if (wasLocked && !this.releasingPointer && this.gameState === 'playing' && !this.isUIModalOpen) {
      this.pauseToggleBlocked = true;
      window.setTimeout(() => (this.pauseToggleBlocked = false), 250);
      this.setPaused(true);
    }
    this.releasingPointer = false;
  };

  private handlePointerLockError = () => {
    this.releasingPointer = false;
    this.hasHoverMousePos = false;
  };

  private handleMouseLeave = () => {
    this.hasHoverMousePos = false;
  };

  private isTouchEmulatedMouse(e: MouseEvent): boolean {
    const caps = (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities;
    if (caps?.firesTouchEvents) return true;
    return this.touchId !== null || performance.now() - this.lastTouchEndTime <= 700;
  }

  private handleMouseDown = (e: MouseEvent) => {
    if (this.isTouchEmulatedMouse(e)) return;
    this.usedTouch = false;
    // While playing, a click on the game takes the cursor (if it was freed)
    if (e.button === 0 && this.wantsPointerLock() && !this.pointerLocked) {
      this.syncPointerLock();
    }
    if (e.button === 0 || e.button === 2) {
      this.isMouseDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.pointerLocked) {
      // Cursor captured: the mouse turns the camera directly
      if (this.gameState !== 'playing' || this.isUIModalOpen) return;
      const mx = THREE.MathUtils.clamp(e.movementX || 0, -120, 120);
      const my = THREE.MathUtils.clamp(e.movementY || 0, -120, 120);
      this.cameraYaw -= mx * 0.0032;
      this.cameraPitch = Math.max(0.08, Math.min(1.2, this.cameraPitch + my * 0.0026));
      return;
    }

    if (!this.isTouchEmulatedMouse(e)) {
      this.usedTouch = false;
    }

    if (!this.isMouseDragging) {
      // Seamless free mouse-look fallback when pointer lock is unavailable/rejected (e.g. iframe or before click)
      if (!this.wantsPointerLock()) {
        this.hasHoverMousePos = false;
        return;
      }
      if (e.target !== this.renderer.domElement) {
        this.hasHoverMousePos = false;
        return;
      }
      if (!this.hasHoverMousePos) {
        this.lastHoverMouseX = e.clientX;
        this.lastHoverMouseY = e.clientY;
        this.hasHoverMousePos = true;
        return;
      }
      const dx = THREE.MathUtils.clamp(e.clientX - this.lastHoverMouseX, -120, 120);
      const dy = THREE.MathUtils.clamp(e.clientY - this.lastHoverMouseY, -120, 120);
      this.lastHoverMouseX = e.clientX;
      this.lastHoverMouseY = e.clientY;
      this.cameraYaw -= dx * 0.0045;
      this.cameraPitch = Math.max(0.08, Math.min(1.2, this.cameraPitch + dy * 0.0035));
      return;
    }

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
    this.usedTouch = true;
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
    this.lastTouchEndTime = performance.now();
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

    let lastRenderTime = performance.now();
    let fpsFrames = 0;
    let fpsLastTime = performance.now();

    const scheduleNext = (cb: () => void) => {
      if (this.isSoftwareGl) {
        afterDraw(cb);
      } else if (this.fpsLimit === '120') {
        this.frameId = window.setTimeout(cb, 7);
      } else if (this.fpsLimit === 'unlimited') {
        this.frameId = window.setTimeout(cb, 0);
      } else {
        this.frameId = requestAnimationFrame(cb);
      }
    };

    this.reTriggerLoop = () => {
      window.cancelAnimationFrame(this.frameId);
      window.clearTimeout(this.frameId);
      lastRenderTime = performance.now();
      scheduleNext(tick);
    };

    const tick = () => {
      if (this.isDisposed) return;

      const now = performance.now();

      // Precise pacing
      if (this.fpsLimit === '30') {
        const elapsed = now - lastRenderTime;
        // Skip frames under 30.0ms to guarantee strictly 30 FPS without fluctuating to 45
        if (elapsed < 30.0) {
          scheduleNext(tick);
          return;
        }
        lastRenderTime = now;
      } else if (this.fpsLimit === '60') {
        const elapsed = now - lastRenderTime;
        // Skip sub-frame jitter under 14.5ms on 120Hz/144Hz displays to strictly lock to 60 FPS
        if (elapsed < 14.5) {
          scheduleNext(tick);
          return;
        }
        lastRenderTime = now;
      } else if (this.fpsLimit === '120') {
        const elapsed = now - lastRenderTime;
        if (elapsed < 7.2) {
          scheduleNext(tick);
          return;
        }
        lastRenderTime = now;
      } else {
        lastRenderTime = now;
      }

      this.clock.update();
      const rawDt = this.clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsedTime = this.clock.getElapsed();

      const wallDt = Math.min(Math.max(0, (now - this.lastWallTime) / 1000), 2.0);
      this.lastWallTime = now;

      this.update(dt, elapsedTime, wallDt);
      if (this.gameState === 'title') {
        this.levelRoot.visible = false;
        this.ambience.setVisible(false);
        this.weatherSystem.cloudsSystem.setVisible(false);
        this.itemSystem.setVisible(false);
        const sp = this.physics.position;
        this.lobbyShadowDisc.position.set(sp.x, sp.y + 0.015, sp.z);
        this.lobbyShadowDisc.visible = true;

        const prevBg = this.scene.background;
        const prevFog = this.scene.fog;
        this.scene.background = null;
        this.scene.fog = null;
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);
        this.scene.background = prevBg;
        this.scene.fog = prevFog;
      } else {
        this.levelRoot.visible = true;
        this.ambience.setVisible(true);
        this.weatherSystem.cloudsSystem.setVisible(true);
        this.itemSystem.setVisible(true);
        this.lobbyShadowDisc.visible = false;
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.render(this.scene, this.camera);
      }

      // Real rendered game frames measurement
      fpsFrames++;
      if (now >= fpsLastTime + 350) {
        this.currentFps = Math.max(1, Math.round((fpsFrames * 1000) / (now - fpsLastTime)));
        fpsFrames = 0;
        fpsLastTime = now;
        this.callbacks.onFpsUpdate?.(this.currentFps);
        this.onFps?.(this.currentFps);
      }

      scheduleNext(tick);
    };

    scheduleNext(tick);
  }

  private update(dt: number, time: number, wallDt: number) {
    // Give the cursor back as soon as we're not playing (title, victory, game over, photo mode…)
    if (this.pointerLocked && !this.wantsPointerLock()) this.syncPointerLock();
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

      // Character Creator & Lobby Hero framing: blend smoothly into close-up turntable around the player
      this.previewBlend = THREE.MathUtils.damp(this.previewBlend, this.characterPreview ? 1 : 0, 5.0, dt);
      if (this.previewBlend > 0.001) {
        if (
          this.lobbyCameraMode === 'creator' &&
          !this.previewIdleSpin &&
          performance.now() >= this.previewSpinResumeAt &&
          !this.isMouseDragging
        ) {
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
        const h = (this.tempPreviewAppearance ?? this.playerAppearance).height;
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

        let targetOffX = 0;
        let targetOffY = 0;
        if (this.characterPreview) {
          if (this.lobbyCameraMode === 'creator') {
            if (portrait) targetOffY = hgt * 0.27;
            else targetOffX = w * 0.18;
          } else if (this.lobbyCameraMode === 'lobby_shop') {
            if (portrait) targetOffY = hgt * 0.24;
            else targetOffX = -w * 0.25;
          } else if (this.lobbyCameraMode === 'lobby_center') {
            targetOffX = 0;
            targetOffY = portrait ? -hgt * 0.04 : -hgt * 0.02;
          }
        }
        this.previewViewOffsetX = THREE.MathUtils.damp(this.previewViewOffsetX, targetOffX, 6.5, dt);
        this.previewViewOffsetY = THREE.MathUtils.damp(this.previewViewOffsetY, targetOffY, 6.5, dt);

        if (Math.abs(this.previewViewOffsetX * e) > 0.5 || Math.abs(this.previewViewOffsetY * e) > 0.5) {
          this.camera.setViewOffset(
            w,
            hgt,
            this.previewViewOffsetX * e,
            this.previewViewOffsetY * e,
            w,
            hgt
          );
          this.viewOffsetActive = true;
        } else if (this.viewOffsetActive) {
          this.camera.clearViewOffset();
          this.viewOffsetActive = false;
        }
      } else {
        this.camera.position.copy(this._orbitPos);
        this.camera.lookAt(this._orbitLook);
        if (this.viewOffsetActive) {
          this.camera.clearViewOffset();
          this.viewOffsetActive = false;
        }
      }

      this.playerModel.updateAnimation(0, true, dt, time);
      this.weatherSystem.update(dt, this.physics.position, time);
      this.world.levelUpdate?.(dt, time);
      this.updateShowcase(time);
      return;
    }

    if (
      this.gameState === 'paused' ||
      this.gameState === 'victory' ||
      this.gameState === 'game_over' ||
      this.isUIModalOpen
    ) {
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
        // Keep telling the party where we are (reading the level intro, a menu, paused…),
        // otherwise they'd see us at the server's default spot until we move
        const p = this.physics.position;
        multiplayerClient.syncPlayer(p.x, p.y, p.z, this.playerModel.group.rotation.y, 'idle');
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
        this.callbacks.onEasterEgg?.(egg);
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
        this.countDeath();
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
    const onCheckpoint = (cpName: string) => {
      const cpIdx = this.physics.currentCheckpointIndex;
      this.callbacks.onCheckpointChange(cpName, cpIdx + 1, this.world.checkpoints.length || 3);
      if (cpIdx > 0 && !this.isSpectating) {
        recordMissionEvent({
          type: 'checkpoint_reached',
          level: this.currentLevel,
          theme: themeForLevel(this.currentLevel),
        });
      }

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
    };

    const onSummit = () => {
      // Milestone: Summit Victory! (finishing a level unlocks its companion)
      // Developer mode never touches the saved progress
      this.lastUnlocked = isDevMode() ? null : markLevelComplete(this.currentLevel);
      if (this.stalker) {
        this.stalker.isStunned = true;
        this.stalker.stunTimer = 999;
      }
      const theme = atmos(this.currentLevel);
      this.transitionWeather(theme.victoryWeather, 4.5, 'milestone', theme.victoryTitle, theme.victoryDesc);

      const rating = this.rateRun(false);
      recordMissionEvent({
        type: 'level_completed',
        level: this.currentLevel,
        kind: levelKind(this.currentLevel),
        theme: themeForLevel(this.currentLevel),
        mode: this.gameMode,
        deaths: this.deaths,
        timeSeconds: rating.timeSeconds,
        relicsFound: this.physics.collectedCount,
      });
      if (this.partyRoomId) {
        multiplayerClient.emitPlayerFinish(this.currentLevel, rating.timeSeconds, this.physics.collectedCount, rating);
        this.startSpectating(undefined, 1, rating.timeSeconds);
        soundManager.playVictory();
      } else {
        this.gameState = 'victory';
        this.callbacks.onStateChange('victory');
        soundManager.playVictory();
      }
    };

    if (dt > 0.022) {
      const halfDt = dt * 0.5;
      this.physics.update(halfDt, this.currentInput, this.cameraYaw, onCheckpoint, onSummit);
      this.physics.update(halfDt, this.currentInput, this.cameraYaw, onCheckpoint, onSummit);
    } else {
      this.physics.update(dt, this.currentInput, this.cameraYaw, onCheckpoint, onSummit);
    }

    if (
      Math.abs(this.physics.stamina - this.lastReportedStamina) >= 0.4 ||
      this.physics.isStaminaExhausted !== this.lastReportedExhausted ||
      ((this.physics.stamina === 0 || this.physics.stamina === this.physics.maxStamina) &&
        this.physics.stamina !== this.lastReportedStamina)
    ) {
      this.lastReportedStamina = this.physics.stamina;
      this.lastReportedExhausted = this.physics.isStaminaExhausted;
      this.callbacks.onStaminaChange?.(this.physics.stamina, this.physics.maxStamina, this.physics.isStaminaExhausted);
    }

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
          if (!this.isSpectating) {
            recordMissionEvent({
              type: 'orb_collected',
              level: this.currentLevel,
              theme: themeForLevel(this.currentLevel),
            });
          }
          if (this.partyRoomId) multiplayerClient.sendOrb(this.currentLevel, index);
        },
        onBlockMoved: (index, pos, final) => {
          if (this.partyRoomId) multiplayerClient.sendBlock(this.currentLevel, index, pos.x, pos.y, pos.z, final);
        },
        shared: Boolean(this.partyRoomId),
      });
    }

    // 6b2. Guardian arenas and basement trapdoors
    if (this.world.dungeon && this.gameState === 'playing') {
      this.dungeonSystem.update(dt, time, this.dungeonCtx());
    }

    // 6b3. The level's own monsters (the Backrooms)
    if (this.world.hazards && this.gameState === 'playing') {
      this.world.hazards.update(dt, time, {
        position: this.physics.position,
        yaw: this.physics.playerModel.group.rotation.y,
        camera: this.camera,
        lure: this.companionPowers.lureTarget,
        spectating: this.isSpectating,
        caught: (text) => {
          this.physics.respawnAtCheckpoint();
          this.countDeath();
          this.itemSystem.notify(`${text} Vuelves al último punto de control`);
          soundManager.playGameOver();
        },
        notify: (text) => this.itemSystem.notify(text),
        hurt: (from) => {
          const ph = this.physics;
          const dx = ph.position.x - from.x;
          const dz = ph.position.z - from.z;
          const d = Math.hypot(dx, dz) || 1;
          ph.velocity.set((dx / d) * 6.5, 5.5, (dz / d) * 6.5);
          ph.knockbackTimer = 0.35;
          ph.isGrounded = false;
        },
        consume: (type) => this.itemSystem.consume(type),
        has: (type) => this.itemSystem.has(type),
        shift: (o) => this.shiftView(o),
        guarding: this.companionPowers.isGuarding,
      });
    }

    // 6c. Boss fight (life, tools, the boss) — after physics so it can hold a grabbed player
    if (this.combat && this.gameState === 'playing') {
      this.combat.update(dt, time, this.currentInput);
      this.sendBossSync(dt);
    }

    if (this.physics.collectedCount !== prevCollectibles) {
      const gained = Math.max(0, this.physics.collectedCount - prevCollectibles);
      this.callbacks.onCollectiblesChange(
        this.physics.collectedCount,
        this.physics.totalCollectibles
      );
      if (this.gameMode === 'time_trial') {
        this.addTimeTrialBonus(8, 'Reliquia (+8s)');
      }
      if (gained > 0 && !this.isSpectating) {
        const theme = themeForLevel(this.currentLevel);
        for (let i = 0; i < gained; i++) {
          recordMissionEvent({ type: 'relic_collected', level: this.currentLevel, theme });
        }
      }
    }

    // 7. Update Weather & Background Clouds
    this.weatherSystem.update(dt, this.physics.position, time);
    this.levelDarkness = Math.max(this.combat?.darkness ?? 0, this.world.hazards?.darkness ?? 0);
    this.applyDarkness(this.levelDarkness);

    // 7b. Mobile / Touchscreen: Camera smoothly follows behind character.
    // Only for the on-screen joystick: with the keyboard (WASD) the camera is yours (mouse or Q/E),
    // otherwise both fight each other and the view swings around.
    const inputMagnitude = Math.hypot(this.currentInput.forward, this.currentInput.right);
    const isVirtualMove = Math.hypot(this.virtualInput.forward, this.virtualInput.right) > 0.05;
    // Never with the keyboard: the camera only turns when you move the mouse or press Q/E
    const isTouchActive = isVirtualMove && this.autoChaseCamera && !this.pointerLocked;
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
    let followPos = this.physics.position;
    if (this.isSpectating) {
      let spectateEntity = this.spectateTargetUserId
        ? this.remotePlayers?.getPlayerEntity(this.spectateTargetUserId)
        : undefined;

      if (!spectateEntity) {
        const fallback = this.remotePlayers?.getNextSpectateTarget(null);
        if (fallback) {
          this.spectateTargetUserId = fallback.userId;
          this.spectateTargetName = fallback.username;
          spectateEntity = this.remotePlayers?.getPlayerEntity(fallback.userId);
        }
      }

      if (spectateEntity) {
        followPos = spectateEntity.currentPos;
      }
    }

    // Boss fights: when the boss is high above (bird on its tower, the UFO…) pull the camera back
    // and tilt it up a little — never so much that you lose sight of yourself and the ground
    // around you, where the warnings for falling rocks and lasers appear.
    let raise = 0;
    let back = 0;
    const focus = this.combat?.focus;
    if (focus) {
      const dy = focus.y + 1.5 - (followPos.y + 1.1);
      const dxz = Math.hypot(focus.x - followPos.x, focus.z - followPos.z);
      if (dy > 2 && dxz < 40) {
        const fade = THREE.MathUtils.clamp((40 - dxz) / 10, 0, 1);
        raise = THREE.MathUtils.clamp(dy * 0.12, 0, 1.1) * fade;
        back = THREE.MathUtils.clamp(dy * 0.22, 0, 2.6) * fade;
      }
    }
    // Slow, smooth changes so the view doesn't bob around while dodging
    this.lookRaise = THREE.MathUtils.damp(this.lookRaise, raise, 1.2, dt);
    this.lookBack = THREE.MathUtils.damp(this.lookBack, back, 1.2, dt);
    this.targetLookAt.set(followPos.x, followPos.y + 1.1 + this.lookRaise, followPos.z);

    const camDist = Math.min(14, this.cameraDistance + this.lookBack);
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const offsetX = Math.sin(this.cameraYaw) * cosPitch * camDist;
    const offsetZ = Math.cos(this.cameraYaw) * cosPitch * camDist;
    const offsetY = sinPitch * camDist;

    this.targetCameraPos.set(
      followPos.x - offsetX,
      followPos.y + 1.1 + offsetY,
      followPos.z - offsetZ
    );

    if (this.pointerLocked && this.gameState === 'playing') {
      // Mouse look: turn around the player on a sphere (smoothing only the follow), so fast
      // mouse turns don't cut through the middle and make the camera zoom in and wobble
      this.camPivot.x = THREE.MathUtils.damp(this.camPivot.x, followPos.x, 12, dt);
      this.camPivot.y = THREE.MathUtils.damp(this.camPivot.y, followPos.y, 12, dt);
      this.camPivot.z = THREE.MathUtils.damp(this.camPivot.z, followPos.z, 12, dt);
      this.camera.position.set(this.camPivot.x - offsetX, this.camPivot.y + 1.1 + offsetY, this.camPivot.z - offsetZ);
      this.targetLookAt.set(this.camPivot.x, this.camPivot.y + 1.1 + this.lookRaise, this.camPivot.z);
    } else {
      // Exponential camera damping for buttery smooth motion
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this.targetCameraPos.x, 10.0, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this.targetCameraPos.y, 10.0, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this.targetCameraPos.z, 10.0, dt);
      this.camPivot.copy(followPos);
    }

    // Closed rooms (the Backrooms): keep the camera on this side of walls and ceilings
    if (this.world.cameraColliders?.length) this.keepCameraInside(followPos);
    else this.hidePlayerForCamera(false);

    this.camera.up.set(0, 1, 0);
    // (squeezed right onto the point it looks at: look ahead instead of spinning around)
    if (this.camera.position.distanceTo(this.targetLookAt) < 0.5) this.camera.lookAt(this.targetLookAt.x + Math.sin(this.cameraYaw) * 2, this.targetLookAt.y - 0.3, this.targetLookAt.z + Math.cos(this.cameraYaw) * 2);
    else this.camera.lookAt(this.targetLookAt);

    // Fade out foliage or trees that block the camera view of the player
    this.updateTreeOcclusion(dt);
    this.updatePlatformCulling();

    this.ambience.update(dt, time, followPos, this.camera.position, this.levelDarkness);

    // Follow light with player or spectated friend
    this.dirLight.position.set(followPos.x + 25, followPos.y + 45, followPos.z + 20);
    this.dirLight.target.position.copy(followPos);
    this.dirLight.target.updateMatrixWorld();

    // 8. Online Multiplayer Sync & Remote Players update
    if (this.remotePlayers) {
      this.remotePlayers.update(dt);
    }
    this.updatePartyTimer();
    this.sendSpectateSnap(dt);
    this.applySpectateSnap(dt);

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
        this.physics.position.x,
        this.physics.position.y,
        this.physics.position.z,
        this.playerModel.group.rotation.y,
        anim
      );
    }
  }

  private lastCullCheck = 0;
  private _camFwd = new THREE.Vector3();

  /**
   * Distance and frustum culling:
   * Hides distant platforms according to renderDistance setting (50%, 70%, 100%)
   * and culls platforms that are behind the camera outside the player's immediate circle.
   */
  public updatePlatformCulling(force = false) {
    if (!this.world || !this.world.platforms || !this.camera) return;
    const now = performance.now();
    if (!force && now - this.lastCullCheck < 40) return;
    this.lastCullCheck = now;

    const pct = this.renderDistance;
    // 50% = ~46m, 70% = ~76m, 100% = ~145m
    const maxDist = pct === 50 ? 46 : pct === 70 ? 76 : 145;
    const maxDistSq = maxDist * maxDist;

    const camPos = this.camera.position;
    const playerPos = this.physics.position;
    this.camera.getWorldDirection(this._camFwd);

    const platforms = this.world.platforms;
    const currentPlatform = this.physics.currentPlatform;
    const len = platforms.length;

    for (let i = 0; i < len; i++) {
      const p = platforms[i];
      if (!p.mesh) continue;

      // Never cull the platform the player is actively standing on
      if (p === currentPlatform) {
        if (!p.mesh.visible) p.mesh.visible = true;
        continue;
      }

      // Big floors, walls and ceilings (the Backrooms) have their center far away: measure to the
      // closest point of the box, not to its center, or the floor vanished in the middle of a jump
      // (while you're in the air it's no longer "the platform you stand on")
      const sz = p.size;
      const rot = p.mesh.rotation.y;
      const turned = Math.abs(Math.sin(rot * 2)) > 0.01;
      const hx = sz ? (turned ? Math.hypot(sz.x, sz.z) / 2 : (Math.abs(Math.cos(rot)) > 0.5 ? sz.x : sz.z) / 2) : 0;
      const hz = sz ? (turned ? hx : (Math.abs(Math.cos(rot)) > 0.5 ? sz.z : sz.x) / 2) : 0;
      const hy = sz ? sz.y : 0;

      // 1. Distance check from player (squared distance for maximum performance)
      const dx = Math.max(0, Math.abs(p.position.x - playerPos.x) - hx);
      const dy = Math.max(0, Math.abs(p.position.y - playerPos.y) - hy) * 0.7;
      const dz = Math.max(0, Math.abs(p.position.z - playerPos.z) - hz);
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq > maxDistSq) {
        if (p.mesh.visible) p.mesh.visible = false;
        continue;
      }

      // 2. Behind camera check ("ni hacia atrás")
      // Only cull if outside the 8-meter safety circle around player/camera, and only if no part of
      // the box is in front of the camera
      const cx = Math.max(0, Math.abs(p.position.x - camPos.x) - hx);
      const cy = Math.max(0, Math.abs(p.position.y - camPos.y) - hy);
      const cz = Math.max(0, Math.abs(p.position.z - camPos.z) - hz);
      if (cx * cx + cy * cy + cz * cz > 64) {
        // The box's corner furthest along the view direction
        const fx = p.position.x + Math.sign(this._camFwd.x) * hx - camPos.x;
        const fy = p.position.y + Math.sign(this._camFwd.y) * hy - camPos.y;
        const fz = p.position.z + Math.sign(this._camFwd.z) * hz - camPos.z;
        const fl = Math.hypot(fx, fy, fz) || 1;
        const dot = (fx * this._camFwd.x + fy * this._camFwd.y + fz * this._camFwd.z) / fl;
        if (dot < -0.15) {
          if (p.mesh.visible) p.mesh.visible = false;
          continue;
        }
      }

      if (!p.mesh.visible) p.mesh.visible = true;
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
    // More decor, background life and animations the higher it goes
    this.ambience?.setQuality(quality);
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
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
    if (this.pointerLocked) document.exitPointerLock?.();
    dom.removeEventListener('mousedown', this.handleMouseDown);
    dom.removeEventListener('mouseleave', this.handleMouseLeave);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mouseup', this.handleMouseUp);
    dom.removeEventListener('wheel', this.handleWheel);
    dom.removeEventListener('touchstart', this.handleTouchStart);
    window.removeEventListener('touchmove', this.handleTouchMove);
    window.removeEventListener('touchend', this.handleTouchEnd);

    this.disposeCombat();
    this.remotePlayers?.dispose();
    multiplayerClient.disconnect();
    this.stalker?.dispose();
    this.companionPowers?.dispose();
    this.itemSystem?.dispose();
    this.world.enemyManager?.dispose();
    this.weatherSystem.dispose();
    this.ambience?.dispose();
    this.clock.dispose();
    this.renderer.dispose();
    if (dom.parentElement) {
      dom.parentElement.removeChild(dom);
    }
  }
}

