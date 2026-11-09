/**
 * Game HUD & Shell: Title Screen, Low-Occlusion Status Clusters,
 * Collapsible Bottom Control Dock, Pause & Victory Modals,
 * and Ergonomic Mobile Touch Controls (360° Analog Joystick + Jump/Sprint Buttons).
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Bug,
  Lightbulb,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sun,
  CloudRain,
  Flower2,
  Moon,
  Compass,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Award,
  HelpCircle,
  X,
  ArrowUp,
  Zap,
  Smartphone,
  Camera,
  Download,
  Eye,
  EyeOff,
  Sliders,
  Palette,
  Layers,
  Image as ImageIcon,
  Check,
  Maximize,
  Minimize,
  RotateCw,
  Timer,
  Ghost,
  Flame,
  Clock,
  AlertTriangle,
  ShieldAlert,
  UserRound,
  Backpack as BackpackIcon,
  Trash2,
  ArrowRight,
  Trophy,
  LogIn,
  Loader2,
  Search,
  Gem,
  Landmark,
  Heart,
  Skull,
  Users,
  Gamepad2,
  Lock,
  Settings,
  RefreshCw,
  KeyRound,
  ToggleRight,
} from 'lucide-react';
import { GameEngine, GameState, GameMode } from '../game/GameEngine';
import {
  isLevelCompleted,
  isLevelUnlocked,
  levelInfo,
  levelHowTo,
  maxPlayableLevel,
  highestCompleted,
  nextCompanionUnlock,
  ThemeId,
  syncProgressFromBackend,
  isDevMode,
  setDevMode,
  setDevLevelPick,
  getDevLevelPick,
} from '../game/progress';
import { hasDevAccess, setDevAccess } from '../game/devMode';
import { DevPanel, DevPlay } from './DevPanel';
import { AuthModal } from './AuthModal';
import { PartyRoomModal } from './PartyRoomModal';
import { LeaderboardModal } from './LeaderboardModal';
import { SettingsModal } from './SettingsModal';
import { ActionFeedbackBanner } from './ActionFeedback';
import { ConfirmDialog, ConfirmRequest } from './ConfirmDialog';
import { IconAction } from './IconAction';
import { EmptyState, HelpTip, TIPS } from './HelpTip';
import { RecentChips, SuggestionList } from './RecentChips';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { getRecent, pushRecent, RECENT_KEYS } from '../ui/recentMemory';
import { apiClient, User, PlayerProfileData, FriendUser } from '../services/apiClient';
import {
  multiplayerClient,
  InviteReceivedPayload,
  getPlayerDisplayName,
  RoomAllFinishedPayload,
  RoomPlayerFinishedPayload,
} from '../services/multiplayerClient';
import { INVENTORY_SIZE, ITEM_INFO, InventoryStatus, STACK_MAX, DURABILITY } from '../game/items';
import type { CombatStatus } from '../game/combat';
import type { LevelHazardStatus } from '../game/levels';
import type { ItemType } from '../game/items';
import { CharacterCreator, COMPANION_ICONS } from './CharacterCreator';
import { ItemThumb } from './ItemThumb';
import { RatingStars } from './RatingStars';
import { bestRating } from '../game/rating';
import { COMPANION_POWERS, CompanionPowerStatus } from '../game/companionPowers';
import {
  BodyType,
  CharacterAppearance,
  CompanionStyle,
  COMPANIONS,
  loadAppearance,
  loadRoster,
  sanitizeAppearance,
} from '../game/character';
import {
  PHOTO_FILTERS,
  PHOTO_FRAMES,
  type PhotoFilter,
  type PhotoFrame,
} from '../ui/photoStudio';
import { WeatherType, soundManager } from '../audio/SoundtrackSynthesizer';
import { formatClock, friendlyError } from '../utils/locale';
import { UI, BTN } from '../ui/labels';
import { isTypingTarget, POWER_SHORTCUTS } from '../ui/shortcuts';

const THEME_COMPANION: Record<ThemeId, CompanionStyle> = {
  cozy: 'nube',
  cosmic: 'estrella',
  swamp: 'luciernaga',
  aero: 'catarina',
  garden: 'hada',
  castle: 'serpiente',
  backrooms: 'polilla',
};

const VICTORY_TEXT: Record<number, string> = {
  1: 'Has navegado con éxito los jardines flotantes y llegado al Mirador Celestial. Disfruta la vista panorámica de las nubes y las estrellas.',
  2: 'Saltaste entre asteroides y anillos planetarios hasta el Observatorio Estelar. ¡Estelita brilla de alegría!',
  3: 'Cruzaste la bruma del pantano y escalaste la Torre de la Bruja hasta el Santuario de las Luciérnagas.',
  4: 'Cruzaste la pradera, las cascadas y la ciudad de cristal hasta la Plaza del Globo. ¡Nada pudo detenerte!',
};

interface GameHUDProps {
  engine: GameEngine | null;
  gameState: GameState;
  gameMode?: GameMode;
  timeRemaining?: number;
  timeBonus?: { amount: number; reason: string; timestamp: number } | null;
  stalkerDistance?: number;
  stalkerWarningLevel?: 'none' | 'caution' | 'danger';
  checkpointName: string;
  checkpointIndex: number;
  collectedCount: number;
  totalCollectibles: number;
  currentWeather: WeatherType;
  isWeatherTransitioning?: boolean;
  weatherNotice?: {
    weather: WeatherType;
    title: string;
    desc: string;
    reason: 'milestone' | 'manual';
  } | null;
  onDismissWeatherNotice?: () => void;
  isFullscreen?: boolean;
  toggleFullscreen?: () => void | Promise<boolean>;
  isPortrait?: boolean;
  showEasterEgg?: boolean;
  onDismissEasterEgg?: () => void;
  isSpectating?: boolean;
  spectateTargetName?: string;
  spectateRank?: number;
  spectateTime?: number;
  roomSummary?: RoomAllFinishedPayload | null;
  roomFinishNotice?: RoomPlayerFinishedPayload | null;
  onDismissRoomSummary?: () => void;
  /** Deaths in this run (they lower the rating) */
  deaths?: number;
  /** Party: seconds left to reach the goal after a friend finished */
  partyTimer?: number | null;
}

// --- 360° Analog Virtual Joystick for Mobile Devices with Auto-Sprint ---
/** Life as hearts (20 points each), filling from the left; the last one beats when low. */
const HeartRow: React.FC<{ hp: number; maxHp: number; hurt: boolean; compact: boolean }> = ({ hp, maxHp, hurt, compact }) => {
  const per = 20;
  const count = Math.max(1, Math.ceil(maxHp / per));
  const size = compact ? 'w-5 h-5' : 'w-6 h-6';
  const low = hp > 0 && hp <= per;
  return (
    <div
      className={`flex items-center gap-0.5 rounded-full bg-stone-950/45 backdrop-blur-sm px-1.5 py-1 shadow-md ${hurt ? 'animate-[cozy-shake_0.3s_ease-in-out]' : ''}`}
      role="img"
      aria-label={`Vida: ${Math.ceil(hp / per)} de ${count} corazones`}
    >
      {Array.from({ length: count }, (_, i) => {
        const fill = Math.max(0, Math.min(1, (hp - i * per) / per));
        const beating = low && fill > 0;
        return (
          <span key={i} className={`relative inline-block ${size} ${beating ? 'animate-pulse' : ''}`}>
            <Heart className={`absolute inset-0 ${size} text-stone-900/80`} fill="currentColor" strokeWidth={2.2} />
            <Heart className={`absolute inset-0 ${size} text-rose-200/40`} strokeWidth={2.2} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Heart className={`${size} text-rose-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]`} fill="currentColor" strokeWidth={2.2} />
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
};

const VirtualJoystick: React.FC<{
  onMove: (forward: number, right: number, isSprint: boolean) => void;
  compact?: boolean;
}> = ({ onMove, compact = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  const maxRadius = compact ? 34 : 45;

  const updateKnob = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;

    const dist = Math.hypot(dx, dy);

    let clampedX = dx;
    let clampedY = dy;
    if (dist > maxRadius) {
      clampedX = (dx / dist) * maxRadius;
      clampedY = (dy / dist) * maxRadius;
    }

    setKnobPos({ x: clampedX, y: clampedY });

    // Deadzone (12% of maxRadius) eliminates noisy twitching when crossing the center
    const deadZone = maxRadius * 0.12;
    if (dist <= deadZone) {
      setIsSprinting(false);
      onMove(0, 0, false);
      return;
    }

    // Remap remaining distance smoothly from deadzone to 1.0
    const activeRadius = maxRadius - deadZone;
    const magnitude = Math.min(1.0, (dist - deadZone) / activeRadius);
    const normRight = (dx / dist) * magnitude;
    const normForward = (-dy / dist) * magnitude;

    // Automatic Sprint past threshold: pushing the joystick past 68% of range activates sprinting
    const sprint = magnitude >= 0.68;
    setIsSprinting(sprint);
    onMove(normForward, normRight, sprint);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (touchIdRef.current !== null) return;

    const touch = e.changedTouches[0];
    touchIdRef.current = touch.identifier;
    setIsActive(true);
    updateKnob(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        updateKnob(touch.clientX, touch.clientY);
        break;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === touchIdRef.current) {
        touchIdRef.current = null;
        setIsActive(false);
        setIsSprinting(false);
        setKnobPos({ x: 0, y: 0 });
        onMove(0, 0, false);
        break;
      }
    }
  };

  useEffect(() => {
    const handleReset = () => {
      touchIdRef.current = null;
      setIsActive(false);
      setIsSprinting(false);
      setKnobPos({ x: 0, y: 0 });
      onMove(0, 0, false);
    };

    window.addEventListener('resize', handleReset);
    window.addEventListener('blur', handleReset);
    window.addEventListener('orientationchange', handleReset);

    return () => {
      window.removeEventListener('resize', handleReset);
      window.removeEventListener('blur', handleReset);
      window.removeEventListener('orientationchange', handleReset);
      onMove(0, 0, false);
    };
  }, [onMove]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className={`relative rounded-full border-2 transition-all select-none flex items-center justify-center ${
        compact ? 'w-22 h-22 w-[5.5rem] h-[5.5rem]' : 'w-28 h-28 sm:w-32 sm:h-32'
      } ${
        isActive
          ? isSprinting
            ? 'bg-amber-950/50 border-orange-400 shadow-xl shadow-orange-500/30'
            : 'bg-amber-950/40 border-amber-400 shadow-xl shadow-amber-500/20'
          : 'bg-stone-900/55 border-stone-700/60 shadow-lg backdrop-blur-sm'
      }`}
      style={{ touchAction: 'none' }}
    >
      {/* Sprint threshold dashed guide ring */}
      <div
        className={`absolute rounded-full pointer-events-none transition-all ${
          isSprinting
            ? 'border-2 border-orange-400/70 scale-105 shadow-sm shadow-orange-500/30'
            : 'border border-stone-600/30 border-dashed'
        } ${compact ? 'w-[3.8rem] h-[3.8rem]' : 'w-20 h-20 sm:w-22 sm:h-22'}`}
      />

      {!compact && (
        <>
          <span className="absolute top-2 text-[9px] text-stone-500 font-mono">W</span>
          <span className="absolute bottom-2 text-[9px] text-stone-500 font-mono">S</span>
          <span className="absolute left-2 text-[9px] text-stone-500 font-mono">A</span>
          <span className="absolute right-2 text-[9px] text-stone-500 font-mono">D</span>
        </>
      )}

      <div
        className={`rounded-full shadow-md border-2 pointer-events-none flex items-center justify-center transition-all ${
          compact ? 'w-10 h-10' : 'w-12 h-12 sm:w-14 sm:h-14'
        } ${
          isSprinting
            ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-orange-600 border-orange-200 ring-2 ring-orange-400/50 shadow-orange-500/40 scale-105'
            : 'bg-gradient-to-br from-amber-400 to-amber-600 border-amber-200 shadow-amber-900/30'
        }`}
        style={{
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
          transition: isActive ? 'none' : 'transform 0.15s ease-out',
        }}
      >
        {isSprinting ? (
          <Zap className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} text-stone-950 fill-stone-950 animate-pulse`} />
        ) : (
          <div className={`rounded-full bg-amber-100/70 ${compact ? 'w-3 h-3' : 'w-4 h-4'}`} />
        )}
      </div>
    </div>
  );
};

// --- High-Resolution Photo Compositor with Frames and Aesthetic Grading ---
function renderFinalPhotoWithFrame(
  rawImgSrc: string,
  filter: PhotoFilter,
  frame: PhotoFrame,
  checkpointName: string
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      const activeFilterObj = PHOTO_FILTERS.find((f) => f.id === filter);
      const filterCss = activeFilterObj ? activeFilterObj.css : 'none';

      if (frame === 'polaroid') {
        const borderX = Math.round(img.width * 0.05);
        const topY = Math.round(img.height * 0.05);
        const bottomY = Math.round(img.height * 0.18);
        canvas.width = img.width + borderX * 2;
        canvas.height = img.height + topY + bottomY;

        ctx.fillStyle = '#f8f5ee';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.filter = filterCss;
        ctx.drawImage(img, borderX, topY, img.width, img.height);
        ctx.filter = 'none';

        ctx.fillStyle = '#3a2d21';
        ctx.font = `600 ${Math.round(canvas.height * 0.04)}px 'Playfair Display', serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Cozy Leap · ' + checkpointName, canvas.width / 2, canvas.height - bottomY * 0.38);

        resolve(canvas.toDataURL('image/png'));
      } else if (frame === 'cinematic') {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';

        const barHeight = Math.round(canvas.height * 0.12);
        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, canvas.width, barHeight);
        ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

        ctx.fillStyle = '#dfb15b';
        ctx.font = `600 ${Math.round(canvas.height * 0.026)}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('COZY LEAP · ' + checkpointName.toUpperCase(), canvas.width / 2, canvas.height - barHeight * 0.36);

        resolve(canvas.toDataURL('image/png'));
      } else if (frame === 'postcard') {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';

        // Postcard border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.round(canvas.width * 0.018);
        ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);

        // Postal stamp
        const stampW = Math.round(canvas.width * 0.12);
        const stampH = Math.round(canvas.height * 0.14);
        ctx.fillStyle = '#d4a373';
        ctx.fillRect(canvas.width - stampW - 32, 32, stampW, stampH);
        ctx.strokeStyle = '#faedcd';
        ctx.lineWidth = 3;
        ctx.strokeRect(canvas.width - stampW - 32, 32, stampW, stampH);

        ctx.fillStyle = '#2b2118';
        ctx.font = `bold ${Math.round(canvas.height * 0.024)}px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('ISLES', canvas.width - stampW / 2 - 32, 32 + stampH * 0.58);

        resolve(canvas.toDataURL('image/png'));
      } else {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.filter = filterCss;
        ctx.drawImage(img, 0, 0);
        ctx.filter = 'none';
        resolve(canvas.toDataURL('image/png'));
      }
    };
    img.src = rawImgSrc;
  });
}

export const GameHUD: React.FC<GameHUDProps> = ({
  engine,
  gameState,
  gameMode = 'free',
  timeRemaining = 90,
  timeBonus = null,
  stalkerDistance = 999,
  stalkerWarningLevel = 'none',
  checkpointName,
  checkpointIndex,
  collectedCount,
  totalCollectibles,
  currentWeather,
  isWeatherTransitioning = false,
  weatherNotice = null,
  onDismissWeatherNotice,
  isFullscreen = false,
  toggleFullscreen,
  isPortrait = false,
  showEasterEgg = false,
  onDismissEasterEgg,
  isSpectating = false,
  spectateTargetName = '',
  spectateRank = 1,
  spectateTime = 0,
  roomSummary = null,
  roomFinishNotice = null,
  onDismissRoomSummary,
  deaths = 0,
  partyTimer = null,
}) => {
  const [isMuted, setIsMuted] = useState(() => soundManager.getMuted());
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [language, setLanguage] = useState<'es' | 'en'>(() => {
    return (localStorage.getItem('cozy_lang') as 'es' | 'en') || 'es';
  });
  const [largeText, setLargeText] = useState<boolean>(() => {
    return localStorage.getItem('cozy_large_text') === 'true';
  });
  const [showFps, setShowFps] = useState<boolean>(() => {
    return localStorage.getItem('cozy_show_fps') === 'true';
  });
  const [fps, setFps] = useState(60);
  const [pickupAlert, setPickupAlert] = useState<{ text: string; id: number } | null>(null);
  const [helpTab, setHelpTab] = useState<'controls' | 'companions' | 'worlds' | 'modes'>('controls');
  const [showTutorialHint, setShowTutorialHint] = useState<boolean>(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem('cozy_tutorial_seen') !== 'true';
  });

  const [selectedMode, setSelectedMode] = useState<GameMode>('free');
  type TitleStep = 'main' | 'select_level' | 'game_modes' | 'select_character';
  const [titleStep, setTitleStep] = useState<TitleStep>('main');
  const [pendingLevel, setPendingLevel] = useState<number>(() => {
    const saved = localStorage.getItem('cozy_last_level');
    const parsed = saved ? parseInt(saved, 10) : maxPlayableLevel();
    return parsed >= 1 && isLevelUnlocked(parsed) ? parsed : maxPlayableLevel();
  });
  const [pendingMode, setPendingMode] = useState<GameMode>(() => {
    const saved = localStorage.getItem('cozy_last_mode') as GameMode;
    return saved === 'time_trial' || saved === 'chase' || saved === 'free' ? saved : 'free';
  });
  const [previousTitleStep, setPreviousTitleStep] = useState<'main' | 'select_level' | 'game_modes'>('main');
  const [titleDraftReady, setTitleDraftReady] = useState(false);

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLevelBrief, setShowLevelBrief] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardLevelId, setLeaderboardLevelId] = useState(1);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<InviteReceivedPayload | null>(null);
  const [partyMembers, setPartyMembers] = useState<string[]>([]);
  const [rejoinSession, setRejoinSession] = useState<{ roomId: string; levelId: number } | null>(() => {
    try {
      const raw = sessionStorage.getItem('cozy_party_session');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.roomId && parsed?.levelId && Date.now() - (parsed.joinedAt || 0) < 15 * 60 * 1000) {
        return { roomId: parsed.roomId, levelId: parsed.levelId };
      }
    } catch {
      return null;
    }
    return null;
  });
  const [levelListFilter, setLevelListFilter] = useState<'all' | 'done' | 'todo'>('all');
  const [levelSearch, setLevelSearch] = useState('');
  const [recentLevelSearches, setRecentLevelSearches] = useState<string[]>(() =>
    getRecent(RECENT_KEYS.levelSearches)
  );
  const [currentUser, setCurrentUser] = useState<User | null>(() => apiClient.getCurrentUser());
  // Developer panel: user name → "Modo desarrollador" → password (remembered in this browser)
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [devAccess, setDevAccessState] = useState(() => hasDevAccess());
  const [devOn, setDevOn] = useState(() => hasDevAccess() && isDevMode());
  const [submittedRunKey, setSubmittedRunKey] = useState<string | null>(null);
  const runStartTimeRef = useRef<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [dismissPortraitHint, setDismissPortraitHint] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [toastUndo, setToastUndo] = useState<(() => void) | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const creatorSnapshotRef = useRef<CharacterAppearance | null>(null);
  const saveProgressAction = useAsyncAction();
  const photoAction = useAsyncAction();
  const appearanceSaveAction = useAsyncAction();
  const [viewportNarrow, setViewportNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 900 : false
  );
  const briefLevelRef = useRef<number | null>(null);

  useEffect(() => {
    return apiClient.onAuthChange((user) => {
      setCurrentUser(user);
    });
  }, []);

  useEffect(() => {
    const onResize = () => setViewportNarrow(window.innerWidth < 900);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isPortrait) setDismissPortraitHint(false);
  }, [isPortrait]);

  useEffect(() => {
    if (gameState !== 'playing' || !engine) return;
    const lvl = engine.currentLevel;
    if (briefLevelRef.current === lvl) return;
    briefLevelRef.current = lvl;
    setShowLevelBrief(true);
  }, [gameState, engine, engine?.currentLevel]);

  useEffect(() => {
    if (gameState === 'title') {
      briefLevelRef.current = null;
      multiplayerClient.leaveRoom();
      engine?.remotePlayers?.clearAll();
    }
  }, [gameState, engine]);

  useEffect(() => {
    if (titleStep === 'select_character') setTitleDraftReady(true);
  }, [titleStep]);

  // Character Generator
  const [showCreator, setShowCreator] = useState(false);
  const [appearance, setAppearance] = useState<CharacterAppearance>(() => engine?.playerAppearance ?? loadAppearance());

  const openCreator = () => {
    creatorSnapshotRef.current = { ...appearance };
    setShowCreator(true);
    engine?.setCharacterPreview(true);
    engine?.setCharacterPreviewFocus('full', true);
  };

  const cancelCreator = () => {
    const snap = creatorSnapshotRef.current;
    if (snap) {
      setAppearance(snap);
      engine?.setPlayerAppearance(snap);
    }
    creatorSnapshotRef.current = null;
    setShowCreator(false);
    if (titleStep === 'select_character') {
      engine?.setCharacterPreview(true);
    } else {
      engine?.setCharacterPreview(false);
    }
  };

  const closeCreator = () => {
    creatorSnapshotRef.current = null;
    setShowCreator(false);
    if (titleStep === 'select_character') {
      engine?.setCharacterPreview(true);
    } else {
      engine?.setCharacterPreview(false);
    }
    if (apiClient.isAuthenticated()) {
      void appearanceSaveAction
        .run(
          async () => {
            await apiClient.updateAppearance(appearance);
          },
          {
            silentSuccess: true,
            errorMessage: (err) =>
              friendlyError(
                err,
                'No se guardó el aspecto. Revisa tu conexión e inténtalo otra vez.'
              ),
          }
        )
        .then((result) => {
          if (result.ok) {
            showToast('Aspecto guardado', 2200, 'success');
          } else {
            showToast(
              friendlyError(
                result.error,
                'No se guardó el aspecto. Revisa tu conexión e inténtalo otra vez.'
              ),
              2600,
              'error'
            );
          }
        });
    }
  };

  const handleAppearanceChange = (next: CharacterAppearance) => {
    setAppearance(next);
    engine?.setPlayerAppearance(next);
  };

  // Chico / Chica: each keeps its own saved customization
  const handleSwitchBody = (body: BodyType) => {
    const next = loadRoster()[body];
    setAppearance(next);
    engine?.setPlayerAppearance(next);
  };

  // The creator only lives on the title screen
  useEffect(() => {
    if (gameState !== 'title' && showCreator) {
      setShowCreator(false);
      engine?.setCharacterPreview(false);
    }
  }, [gameState, showCreator, engine]);

  const clearToast = () => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastMessage(null);
    setToastUndo(null);
  };

  const showToast = (
    msg: string,
    ms: number = 1200,
    tone: 'neutral' | 'success' | 'error' = 'neutral',
    onUndo?: () => void
  ) => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    setToastTone(tone);
    setToastMessage(msg);
    setToastUndo(onUndo ? () => onUndo : null);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
      setToastUndo(null);
      toastTimerRef.current = null;
    }, ms);
  };

  const discardPhotoCapture = () => {
    const previous = capturedPhotoUrl;
    if (!previous) return;
    setCapturedPhotoUrl(null);
    showToast('Foto archivada', 6000, 'neutral', () => {
      setCapturedPhotoUrl(previous);
    });
  };

  const enterPartyRoom = (levelId: number, roomId: string) => {
    if (!engine) return;
    setShowAuthModal(false);
    setPendingLevel(levelId);
    setPendingMode('free');
    setTitleStep('main');
    setShowCreator(false);
    engine.setCharacterPreview(false);
    engine.setPartyRoom(roomId, false);
    sessionStorage.setItem(
      'cozy_party_session',
      JSON.stringify({ roomId, levelId, joinedAt: Date.now() })
    );
    setElapsedTime(0);
    engine.startGame('free', levelId);
    multiplayerClient.joinLevel(levelId, roomId);
    showToast(`Entraste a la sala · nivel ${levelId}`, 2200, 'success');
  };

  /** Level to invite friends to: the one being played, or the one picked on the title screen. */
  const inviteLevel = () => (engine && engine.gameState !== 'title' ? engine.currentLevel : pendingLevel);

  const handleInviteToPlay = (friend: FriendUser) => {
    const levelId = inviteLevel();
    multiplayerClient.connect();
    const currentRoom = multiplayerClient.getCurrentRoomId();
    multiplayerClient.sendInvite(friend._id, levelId, currentRoom || undefined);
    showToast(
      `Invitando a ${friend.displayName || friend.username} al nivel ${levelId}…`,
      2200,
      'success'
    );
  };

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      multiplayerClient.addRoomStateListener((players) => {
        setPartyMembers(players.map(getPlayerDisplayName).filter(Boolean));
      })
    );

    unsubs.push(
      multiplayerClient.addPlayerJoinedListener((player) => {
        const name = getPlayerDisplayName(player);
        showToast(`¡${name} se unió a la sala!`, 3200, 'success');
        setPartyMembers(
          Array.from(multiplayerClient.getPartyPlayers().values()).map(getPlayerDisplayName)
        );
      })
    );

    unsubs.push(
      // A friend renamed their character: refresh the names of the room
      multiplayerClient.addPlayerProfileListener(() => {
        setPartyMembers(
          Array.from(multiplayerClient.getPartyPlayers().values()).map(getPlayerDisplayName)
        );
      })
    );

    unsubs.push(
      multiplayerClient.addPlayerLeftListener((data) => {
        const name = data.displayName || data.username || 'Un explorador';
        const msg =
          data.reason === 'disconnect'
            ? `${name} se desconectó de la sala`
            : `${name} salió de la sala`;
        showToast(msg, 2600, 'neutral');
        setPartyMembers(
          Array.from(multiplayerClient.getPartyPlayers().values()).map(getPlayerDisplayName)
        );
      })
    );

    unsubs.push(
      multiplayerClient.addInviteReceivedListener((data) => {
        setShowAuthModal(false);
        setIncomingInvite(data);
      })
    );

    unsubs.push(
      multiplayerClient.addInviteSentListener(() => {
        showToast('Invitación enviada. Esperando respuesta (60 s)…', 2800, 'success');
      })
    );

    unsubs.push(
      multiplayerClient.addInviteResultListener((data) => {
        setIncomingInvite((cur) => (cur?.inviteId === data.inviteId ? null : cur));
        if (data.accepted && data.roomId) {
          const me = apiClient.getCurrentUser()?._id;
          const iInvited = Boolean(me && data.fromUserId === me);
          if (multiplayerClient.getCurrentRoomId() === data.roomId && multiplayerClient.isInPartyRoom()) {
            showToast('¡Invitación aceptada! Tu amigo se ha unido a la partida.', 2800, 'success');
          } else if (iInvited && engine && engine.gameState !== 'title' && engine.currentLevel === data.levelId) {
            // You invited from inside the level: keep playing where you are, your friend comes to you
            engine.setPartyRoom(data.roomId, true);
            sessionStorage.setItem(
              'cozy_party_session',
              JSON.stringify({ roomId: data.roomId, levelId: data.levelId, joinedAt: Date.now() })
            );
            showToast('¡Invitación aceptada! Tu amigo viene a tu nivel.', 2800, 'success');
          } else {
            enterPartyRoom(data.levelId, data.roomId);
          }
        } else if (!data.accepted) {
          const reason = (data as { reason?: string }).reason;
          if (reason === 'declined') {
            showToast('Tu amigo rechazó la invitación para jugar.', 2800, 'neutral');
          } else if (reason === 'expired') {
            showToast('La invitación caducó sin respuesta.', 2800, 'neutral');
          } else {
            showToast('La invitación fue rechazada por tu amigo.', 2800, 'neutral');
          }
        }
      })
    );

    unsubs.push(
      multiplayerClient.addSocketErrorListener((err) => {
        const wrapped = new Error(err.message || '');
        (wrapped as Error & { code?: string }).code = err.code;
        showToast(friendlyError(wrapped, 'No se pudo completar la acción multijugador.'), 2800, 'error');
      })
    );

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [engine, gameState, pendingLevel]);

  const runFullscreenToggle = async () => {
    if (!toggleFullscreen) return;
    const result = await toggleFullscreen();
    if (result === false) {
      showToast('No se pudo cambiar la pantalla. Inténtalo otra vez o usa F.', 2200, 'error');
      return;
    }
    showToast(!isFullscreen ? UI.fullscreen : UI.exitFullscreen, 1200, 'success');
  };

  // Companion power status (polled from the engine while playing)
  const [power, setPower] = useState<CompanionPowerStatus | null>(null);
  const lastPowerEventRef = useRef<number>(0);
  useEffect(() => {
    if (!engine || gameState !== 'playing') return;
    const read = () => {
      const st = engine.companionPowers?.getStatus();
      if (!st) return;
      setPower((prev) =>
        prev &&
        prev.state === st.state &&
        prev.companion === st.companion &&
        prev.eventId === st.eventId &&
        Math.abs(prev.timeLeft - st.timeLeft) < 0.1
          ? prev
          : st
      );
      if (st.eventId !== lastPowerEventRef.current) {
        lastPowerEventRef.current = st.eventId;
        if (st.eventText) showToast(st.eventText, 2200);
      }
    };
    read();
    const id = window.setInterval(read, 100);
    return () => window.clearInterval(id);
  }, [engine, gameState]);
  const basePowerInfo = power ? COMPANION_POWERS[power.companion] : undefined;

  // Backpack (5 slots) status, polled with the same rhythm
  // Open-world levels: orbs found / total
  const [orbs, setOrbs] = useState<{ have: number; total: number; summitOpen: boolean }>({ have: 0, total: 0, summitOpen: false });
  useEffect(() => {
    if (!engine || gameState !== 'playing') return;
    const read = () => {
      const st = engine.puzzleSystem?.getOrbStatus();
      if (!st) return;
      setOrbs((prev) => (prev.have === st.have && prev.total === st.total && prev.summitOpen === st.summitOpen ? prev : st));
    };
    read();
    const id = window.setInterval(read, 200);
    return () => window.clearInterval(id);
  }, [engine, gameState]);

  const [inventory, setInventory] = useState<InventoryStatus | null>(null);
  const [showBackpack, setShowBackpack] = useState(false);
  const lastItemEventRef = useRef<number>(0);
  useEffect(() => {
    if (!engine || gameState !== 'playing') return;
    const read = () => {
      const st = engine.itemSystem?.getStatus();
      if (!st) return;
      setInventory((prev) =>
        prev &&
        prev.eventId === st.eventId &&
        prev.slots.every((v, i) => v === st.slots[i]) &&
        prev.counts.every((v, i) => v === st.counts[i]) &&
        Math.ceil(prev.superJumpLeft) === Math.ceil(st.superJumpLeft)
          ? prev
          : st
      );
      if (st.eventId !== lastItemEventRef.current) {
        lastItemEventRef.current = st.eventId;
        if (st.eventText) showToast(st.eventText, 2200);
      }
    };
    read();
    const id = window.setInterval(read, 100);
    return () => window.clearInterval(id);
  }, [engine, gameState]);

  // Levels with their own rules (the Backrooms): hearts, the key, the levers
  const [levelStatus, setLevelStatus] = useState<LevelHazardStatus | null>(null);
  const [levelHurt, setLevelHurt] = useState(false);
  const lastLevelHurtRef = useRef(0);
  useEffect(() => {
    if (!engine || gameState !== 'playing') {
      setLevelStatus(null);
      return;
    }
    const read = () => {
      const st = engine.getLevelStatus();
      setLevelStatus((prev) => {
        if (!st) return null;
        if (
          prev &&
          prev.hearts === st.hearts &&
          prev.key === st.key &&
          prev.levers?.have === st.levers?.have &&
          prev.hurtId === st.hurtId &&
          Math.abs(prev.darkness - st.darkness) < 0.04
        )
          return prev;
        return st;
      });
      if (st && st.hurtId !== lastLevelHurtRef.current) {
        const hurt = st.hurtId > lastLevelHurtRef.current;
        lastLevelHurtRef.current = st.hurtId;
        if (hurt) {
          setLevelHurt(true);
          window.setTimeout(() => setLevelHurt(false), 320);
        }
      }
    };
    read();
    const id = window.setInterval(read, 150);
    return () => window.clearInterval(id);
  }, [engine, gameState]);

  // Boss fights: life bar, boss bar, hint, darkness, hurt flash
  const [combat, setCombat] = useState<CombatStatus | null>(null);
  const [hurtFlash, setHurtFlash] = useState(false);
  const lastHurtRef = useRef<number>(0);
  useEffect(() => {
    if (!engine || gameState !== 'playing') return;
    const read = () => {
      const st = engine.getCombatStatus();
      setCombat((prev) => {
        if (!st) return null;
        if (
          prev &&
          prev.hp === st.hp &&
          prev.bossHp === st.bossHp &&
          prev.hint === st.hint &&
          prev.tip?.text === st.tip?.text &&
          prev.urgent === st.urgent &&
          prev.defeated === st.defeated &&
          prev.portalOpen === st.portalOpen &&
          Math.abs(prev.darkness - st.darkness) < 0.02 &&
          (prev.grabbed?.count ?? -1) === (st.grabbed?.count ?? -1) &&
          prev.action?.name === st.action?.name &&
          Math.ceil(prev.action?.cd ?? 0) === Math.ceil(st.action?.cd ?? 0) &&
          prev.objective?.have === st.objective?.have &&
          prev.bossName === st.bossName
        )
          return prev;
        return st;
      });
      if (st && st.hurtId !== lastHurtRef.current) {
        const hurt = st.hurtId > lastHurtRef.current;
        lastHurtRef.current = st.hurtId;
        if (hurt) {
          setHurtFlash(true);
          window.setTimeout(() => setHurtFlash(false), 280);
        }
      }
    };
    read();
    const id = window.setInterval(read, 100);
    return () => window.clearInterval(id);
  }, [engine, gameState]);

  // Boss fights: the power button is your companion's special move against this boss
  const bossAct = combat?.action ?? null;
  const powerInfo =
    bossAct && basePowerInfo ? { ...basePowerInfo, powerName: bossAct.name, desc: bossAct.desc } : basePowerInfo;
  const shownPower: CompanionPowerStatus | null =
    bossAct && power ? { ...power, state: bossAct.cd > 0 ? 'hungry' : 'ready', timeLeft: bossAct.cd, duration: bossAct.cdMax } : power;

  // Level selection on the title screen (the world behind the menu switches too)
  // Default to the furthest level reached ("continue")
  const [selectedLevel, setSelectedLevel] = useState<number>(() => maxPlayableLevel());
  const pickLevel = (id: number) => {
    setSelectedLevel(id);
    engine?.loadLevel(id);
  };
  // Show the selected level behind the title menu once the engine exists
  useEffect(() => {
    if (engine && gameState === 'title' && engine.currentLevel !== selectedLevel && isLevelUnlocked(selectedLevel)) {
      engine.loadLevel(selectedLevel);
    }
  }, [engine, gameState]);

  // Photo Mode Studio State
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>('natural');
  const [photoFrame, setPhotoFrame] = useState<PhotoFrame>('none');
  const [photoFov, setPhotoFov] = useState(55);
  const [photoDistance, setPhotoDistance] = useState(5.0);
  const [photoElevation, setPhotoElevation] = useState(0);
  const [photoRoll, setPhotoRoll] = useState(0);
  const [isPhotoPaused, setIsPhotoPaused] = useState(false);
  const [hidePhotoUI, setHidePhotoUI] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [photoActiveTab, setPhotoActiveTab] = useState<'camera' | 'filters' | 'frames'>('camera');
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    if (!engine) return;
    const blocks =
      showHelpModal ||
      showLevelBrief ||
      showSettingsModal ||
      showAuthModal ||
      showLeaderboardModal ||
      showCreator ||
      showBackpack ||
      Boolean(confirmRequest) ||
      Boolean(capturedPhotoUrl) ||
      Boolean(incomingInvite);
    engine.pauseToggleBlocked = blocks;
    return () => {
      engine.pauseToggleBlocked = false;
    };
  }, [
    engine,
    showHelpModal,
    showLevelBrief,
    showSettingsModal,
    showAuthModal,
    showLeaderboardModal,
    showCreator,
    showBackpack,
    confirmRequest,
    capturedPhotoUrl,
    incomingInvite,
  ]);

  const isAnyModalOpen =
    showHelpModal ||
    showLevelBrief ||
    showSettingsModal ||
    showEasterEgg ||
    showBackpack ||
    showCreator ||
    showAuthModal ||
    showLeaderboardModal ||
    Boolean(capturedPhotoUrl) ||
    Boolean(incomingInvite) ||
    gameState === 'paused' ||
    gameState === 'victory' ||
    gameState === 'game_over' ||
    gameState === 'photo_mode';

  const submitVictoryRun = async (force: boolean = false) => {
    if (!engine) return;
    // Test runs in developer mode don't go to your profile or the ranking
    if (isDevMode()) return;
    const targetLevel = engine.currentLevel;
    const targetMode = engine.gameMode ?? gameMode;
    const preciseTime = Math.max(4.6, (performance.now() - runStartTimeRef.current) / 1000, elapsedTime);

    const runKey = `${targetLevel}-${targetMode}-${runStartTimeRef.current}`;
    if (!force && submittedRunKey === runKey) return;
    setSubmittedRunKey(runKey);

    void saveProgressAction.run(
      async () => {
        const res = await apiClient.completeLevel({
          levelId: targetLevel,
          timeSeconds: Number(preciseTime.toFixed(2)),
          relicsFound: collectedCount,
          score: engine.lastRating?.score ?? 0,
          stars: engine.lastRating?.stars ?? 0,
          deaths: engine.lastRating?.deaths ?? deaths,
          mode: targetMode,
        });
        if (res?.progress?.maxUnlockedLevel) {
          syncProgressFromBackend(res.progress.maxUnlockedLevel - 1);
        }
        return res;
      },
      {
        successMessage: (res) =>
          (res as { isNewBest?: boolean })?.isNewBest
            ? '¡Nuevo récord personal guardado en el ranking!'
            : '¡Récord y progreso guardados!',
        errorMessage: (err) =>
          friendlyError(
            err,
            'No se guardó el récord en el servidor. Toca Reintentar.'
          ),
      }
    );
  };

  // Submit level completion when logged in, with loading / success / error feedback
  useEffect(() => {
    if (gameState === 'victory' && engine) {
      void submitVictoryRun(false);
    } else if (gameState === 'playing') {
      setSubmittedRunKey(null);
      saveProgressAction.clearFeedback();
    }
  }, [gameState, engine]);

  const handleProfileSynced = (profile: PlayerProfileData) => {
    setCurrentUser(apiClient.getCurrentUser());
    if (profile.appearance && engine) {
      const saved = profile.appearance as Record<string, unknown>;
      // Only a character saved by the game itself is complete; older profiles hold the server's
      // default look and would replace the one you made. In that case upload yours instead.
      const madeInGame = 'sweaterColor' in saved || 'outfitStyle' in saved || 'eyeStyle' in saved;
      if (madeInGame) {
        const fullAppearance = sanitizeAppearance({ ...appearance, ...saved });
        setAppearance(fullAppearance);
        engine.setPlayerAppearance(fullAppearance);
      } else if (apiClient.isAuthenticated()) {
        apiClient.updateAppearance(appearance).catch(() => {});
      }
    }
    if (profile.progress?.maxUnlockedLevel) {
      syncProgressFromBackend(profile.progress.maxUnlockedLevel - 1);
      setSelectedLevel(profile.progress.maxUnlockedLevel);
    }
    if (gameState === 'victory') {
      void submitVictoryRun(true);
    }
    if (profile.inventory?.slots && engine?.itemSystem) {
      engine.itemSystem.setSlots(profile.inventory.slots);
    }
    showToast('¡Listo! Tu cuenta está al día', 2500, 'success');
  };

  const currentHowTo = levelHowTo(
    engine?.currentLevel ?? pendingLevel,
    engine?.gameMode ?? gameMode ?? pendingMode
  );

  useEffect(() => {
    if (engine) {
      engine.setUIModalOpen(isAnyModalOpen);
    }
  }, [engine, isAnyModalOpen]);

  // Auto-detect mobile touch screen based on touch capabilities (not window size)
  const [touchControlsEnabled, setTouchControlsEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      'ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
    );
  });
  const [isTouchDevice] = useState(() =>
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)
  );

  const isMobileUi = touchControlsEnabled || isTouchDevice || viewportNarrow;
  const isPortraitPlay = isPortrait;
  const compactControls = isMobileUi && isPortraitPlay;
  const filledSlots = inventory?.slots.filter(Boolean).length ?? 0;
  /** Small badge with the stack size (piedras ×7) or uses left (bate 9) */
  const slotBadge = (i: number) => {
    const t = inventory?.slots[i];
    if (!t || !inventory) return null;
    const n = inventory.counts[i] ?? 1;
    if (STACK_MAX[t] !== undefined) return `×${n}`;
    if (DURABILITY[t] !== undefined) return `${n}`;
    return null;
  };
  const showPortraitHint =
    isMobileUi &&
    isPortraitPlay &&
    !dismissPortraitHint &&
    !showCreator &&
    (gameState === 'playing' || gameState === 'title');

  // Switch dynamically if user uses touch or keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const gameKeys = [
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Space', 'ShiftLeft', 'ShiftRight',
        'KeyQ', 'KeyE', 'KeyR', 'KeyC', 'KeyG', 'KeyI', 'KeyB', 'KeyV', 'Escape'
      ];
      if (gameKeys.includes(e.code)) {
        if (isTouchDevice) return;
        if (typeof window.matchMedia === 'function' && !window.matchMedia('(pointer: coarse)').matches) {
          setTouchControlsEnabled(false);
        }
      }
    };

    const handleTouchStart = () => {
      setTouchControlsEnabled(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isTouchDevice]);

  // Timer (cleanly pauses when objective panel or any modal is open in single-player, but keeps in sync across party players)
  useEffect(() => {
    const isParty = multiplayerClient.isInPartyRoom();
    if (!isParty && (gameState !== 'playing' || isAnyModalOpen)) return;
    if (isParty && gameState !== 'playing' && gameState !== 'paused') return;
    let lastTick = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const deltaSec = (now - lastTick) / 1000;
      lastTick = now;
      setElapsedTime((prev) => prev + deltaSec);
    }, 200);
    return () => clearInterval(interval);
  }, [gameState, isAnyModalOpen]);

  // Sync mute state with soundManager synthesizer
  useEffect(() => {
    soundManager.onMuteChange = (muted) => setIsMuted(muted);
    setIsMuted(soundManager.getMuted());
  }, []);

  // Floating pickup alert effect
  const prevCollectedRef = useRef(collectedCount);
  useEffect(() => {
    if (gameState === 'playing' && collectedCount > prevCollectedRef.current) {
      setPickupAlert({ text: '+1 Reliquia', id: Date.now() });
      const timer = window.setTimeout(() => setPickupAlert(null), 1400);
      prevCollectedRef.current = collectedCount;
      return () => window.clearTimeout(timer);
    }
    prevCollectedRef.current = collectedCount;
  }, [collectedCount, gameState]);

  // Realtime FPS measurement from GameEngine's actual render loop
  useEffect(() => {
    if (!showFps) return;
    if (engine) {
      if (typeof engine.currentFps === 'number' && engine.currentFps > 0) {
        setFps(engine.currentFps);
      }
      engine.onFps = (val) => setFps(val);
      const interval = setInterval(() => {
        if (typeof engine.currentFps === 'number' && engine.currentFps > 0) {
          setFps(engine.currentFps);
        }
      }, 250);
      return () => {
        clearInterval(interval);
        if (engine.onFps) engine.onFps = undefined;
      };
    }
  }, [showFps, engine]);

  // Live Canvas Filter in Photo Mode
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    if (gameState === 'photo_mode') {
      const activeFilter = PHOTO_FILTERS.find((f) => f.id === photoFilter);
      canvas.style.filter = activeFilter ? activeFilter.css : 'none';
      canvas.style.transition = 'filter 0.25s ease';
    } else {
      canvas.style.filter = 'none';
    }
  }, [gameState, photoFilter]);

  useEffect(() => {
    const cycle = <T,>(list: T[], current: T, delta: number): T => {
      const i = list.indexOf(current);
      const next = (i + delta + list.length) % list.length;
      return list[next]!;
    };

    const handleKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || confirmRequest) return;

      if (e.code === 'Escape') {
        if (incomingInvite) {
          multiplayerClient.respondInvite(incomingInvite.inviteId, false, 'declined');
          setIncomingInvite(null);
          e.preventDefault();
          return;
        }
        if (capturedPhotoUrl) {
          discardPhotoCapture();
          e.preventDefault();
          return;
        }
        if (showSettingsModal) {
          setShowSettingsModal(false);
          e.preventDefault();
          return;
        }
        if (showHelpModal) {
          setShowHelpModal(false);
          e.preventDefault();
          return;
        }
        if (showLevelBrief) {
          setShowLevelBrief(false);
          e.preventDefault();
          return;
        }
        if (showLeaderboardModal) {
          setShowLeaderboardModal(false);
          e.preventDefault();
          return;
        }
        if (showAuthModal) {
          setShowAuthModal(false);
          e.preventDefault();
          return;
        }
        if (showBackpack) {
          setShowBackpack(false);
          e.preventDefault();
          return;
        }
      }

      if (e.key === '?' || e.code === 'F1') {
        e.preventDefault();
        setShowHelpModal((v) => !v);
        return;
      }

      if (e.code === 'KeyF') {
        void runFullscreenToggle();
      }

      if (e.code === 'KeyM') {
        toggleMute();
        return;
      }

      if (e.code === 'KeyI' && gameState === 'playing') {
        // Boss fights: your companion gives you a tip; elsewhere I opens the backpack
        if (!engine?.askCompanionTip()) setShowBackpack((v) => !v);
        return;
      }

      if (e.code === 'KeyB' && gameState === 'playing') {
        setShowBackpack((v) => !v);
        return;
      }

      if (e.code === 'KeyO' && (gameState === 'playing' || gameState === 'paused')) {
        e.preventDefault();
        setShowLevelBrief((prev) => !prev);
        return;
      }

      if (gameState === 'paused' && e.code === 'Enter') {
        e.preventDefault();
        engine?.setPaused(false);
        return;
      }

      if (gameState === 'victory' && e.code === 'Enter') {
        e.preventDefault();
        if (saveProgressAction.busy) return;
        if (engine && isLevelUnlocked(engine.currentLevel + 1)) {
          setElapsedTime(0);
          setSelectedLevel(engine.currentLevel + 1);
          engine.goToNextLevel();
        } else {
          handleReturnToTitle();
        }
        return;
      }

      if (gameState === 'victory' && e.code === 'KeyR') {
        e.preventDefault();
        handleRestart(gameMode);
        return;
      }

      if (gameState === 'game_over' && e.code === 'Enter') {
        e.preventDefault();
        handleRestart(engine?.gameOverReason ? gameMode : 'time_trial');
        return;
      }

      if (gameState === 'game_over' && e.code === 'KeyR') {
        e.preventDefault();
        handleRestart(engine?.gameOverReason ? gameMode : 'time_trial');
        return;
      }

      if (
        gameState === 'title' &&
        titleStep === 'select_level' &&
        !showCreator
      ) {
        const lvlMatch = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
        if (lvlMatch) {
          const lvl = parseInt(lvlMatch[1], 10);
          if (isLevelUnlocked(lvl)) {
            e.preventDefault();
            setPendingLevel(lvl);
            engine?.loadLevel(lvl);
            engine?.setCharacterPreview(true);
            setPreviousTitleStep('select_level');
            setTitleStep('select_character');
          } else {
            e.preventDefault();
            showToast(`El nivel ${lvl} está bloqueado. Completa el nivel ${lvl - 1} para desbloquear.`, 2200, 'neutral');
          }
          return;
        }
      }

      if (gameState === 'playing' && e.shiftKey) {
        const discardMatch = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
        if (discardMatch && !e.repeat) {
          const slot = parseInt(discardMatch[1], 10) - 1;
          const item = inventory?.slots[slot];
          if (item) {
            e.preventDefault();
            performDiscardItem(slot, item);
          }
          return;
        }
      }

      if (gameState === 'photo_mode') {
        if (e.code === 'KeyH') {
          setHidePhotoUI((prev) => !prev);
          return;
        }
        if ((e.code === 'Space' || e.code === 'Enter') && !capturedPhotoUrl) {
          e.preventDefault();
          void handleSnapPhoto();
          return;
        }
        if (e.code === 'BracketLeft') {
          const ids = PHOTO_FILTERS.map((f) => f.id);
          setPhotoFilter(cycle(ids, photoFilter, -1));
          return;
        }
        if (e.code === 'BracketRight') {
          const ids = PHOTO_FILTERS.map((f) => f.id);
          setPhotoFilter(cycle(ids, photoFilter, 1));
          return;
        }
        if (e.code === 'Comma') {
          const ids = PHOTO_FRAMES.map((f) => f.id);
          setPhotoFrame(cycle(ids, photoFrame, -1));
          return;
        }
        if (e.code === 'Period') {
          const ids = PHOTO_FRAMES.map((f) => f.id);
          setPhotoFrame(cycle(ids, photoFrame, 1));
          return;
        }
        if (e.code === 'Digit0' || e.code === 'Numpad0') {
          setPhotoDistance(5);
          setPhotoElevation(0);
          setPhotoFov(55);
          setPhotoRoll(0);
          engine?.setPhotoDistance(5);
          engine?.setPhotoElevation(0);
          engine?.setPhotoFov(55);
          engine?.setPhotoRoll(0);
          showToast('Cámara reiniciada', 1000, 'success');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [
    gameState,
    gameMode,
    titleStep,
    photoFilter,
    photoFrame,
    capturedPhotoUrl,
    isFullscreen,
    toggleFullscreen,
    showHelpModal,
    showLevelBrief,
    showLeaderboardModal,
    showAuthModal,
    showBackpack,
    showCreator,
    confirmRequest,
    incomingInvite,
    inventory,
    engine,
    saveProgressAction.busy,
  ]);

  const handleSnapPhoto = async () => {
    if (!engine || photoAction.busy) return;
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 180);

    const result = await photoAction.run(
      async () => {
        const rawUrl = engine.captureScreenshot();
        if (!rawUrl) {
          throw new Error('No se pudo sacar la foto. Inténtalo otra vez.');
        }
        const finalUrl = await renderFinalPhotoWithFrame(
          rawUrl,
          photoFilter,
          photoFrame,
          checkpointName
        );
        if (!finalUrl) {
          throw new Error(
            'No se pudo terminar la foto. Inténtalo otra vez sin cambiar de pantalla.'
          );
        }
        setCapturedPhotoUrl(finalUrl);
        return finalUrl;
      },
      {
        successMessage: '¡Foto lista!',
        errorMessage: (err) =>
          friendlyError(err, 'No se pudo guardar la foto. Inténtalo otra vez.'),
      }
    );

    if (!result.ok) {
      showToast(
        friendlyError(result.error, 'No se pudo guardar la foto. Inténtalo otra vez.'),
        2400,
        'error'
      );
    }
  };

  const formatTime = (secs: number) => formatClock(secs);

  const toggleMute = () => {
    const next = !soundManager.getMuted();
    soundManager.setMuted(next);
    setIsMuted(next);
    showToast(next ? 'Sonido silenciado' : 'Sonido activado', 1200, 'neutral');
  };

  const handleStartGame = (modeToStart?: GameMode, levelToStart?: number) => {
    const targetMode = modeToStart ?? pendingMode;
    const targetLevel = levelToStart ?? pendingLevel;
    localStorage.setItem('cozy_last_mode', targetMode);
    localStorage.setItem('cozy_last_level', String(targetLevel));
    setTitleDraftReady(false);
    setElapsedTime(0);
    runStartTimeRef.current = performance.now();
    setSubmittedRunKey(null);
    saveProgressAction.clearFeedback();
    if (engine) {
      engine.setCharacterPreview(false);
      engine.startGame(targetMode, targetLevel);
    }
  };

  const resumeTitleDraft = () => {
    engine?.loadLevel(pendingLevel);
    engine?.setCharacterPreview(true);
    setTitleStep('select_character');
  };

  const handleRestart = (modeToRestart?: GameMode) => {
    setElapsedTime(0);
    runStartTimeRef.current = performance.now();
    setSubmittedRunKey(null);
    saveProgressAction.clearFeedback();
    const targetMode = modeToRestart ?? gameMode;
    if (engine) engine.restartGame(targetMode);
  };

  const handleReturnToTitle = () => {
    sessionStorage.removeItem('cozy_party_session');
    setPartyMembers([]);
    setElapsedTime(0);
    setTitleStep('main');
    setTitleDraftReady(false);
    multiplayerClient.leaveRoom();
    if (engine) {
      engine.setCharacterPreview(false);
      engine.returnToTitle();
    }
  };

  const requestReturnToTitle = () => {
    setConfirmRequest({
      title: '¿Ir al menú principal?',
      message: 'Saldrás de esta partida. El avance del nivel actual no se guarda hasta terminarlo.',
      confirmLabel: UI.mainMenu,
      cancelLabel: UI.cancel,
      tone: 'danger',
      onConfirm: handleReturnToTitle,
    });
  };

  const requestRestartRun = (modeToRestart?: GameMode) => {
    setConfirmRequest({
      title: '¿Empezar de nuevo?',
      message: 'Reinicias el nivel desde el principio y pierdes el avance de esta partida.',
      confirmLabel: UI.playAgain,
      cancelLabel: UI.cancel,
      tone: 'danger',
      onConfirm: () => handleRestart(modeToRestart),
    });
  };

  const requestRespawnCheckpoint = () => {
    setConfirmRequest({
      title: '¿Volver al último descanso?',
      message: 'Perderás lo avanzado desde el último punto de descanso.',
      confirmLabel: UI.lastRest,
      cancelLabel: UI.cancel,
      onConfirm: () => {
        engine?.physics.respawnAtCheckpoint();
        engine?.setPaused(false);
      },
    });
  };

  const undoDiscardItem = (slot: number, type: ItemType) => {
    engine?.restoreItem(slot, type);
  };

  const performDiscardItem = (slot: number, type: ItemType) => {
    const removed = engine?.discardItem(slot);
    if (!removed) return;
    showToast(`Tiraste: ${ITEM_INFO[type].name}`, 6000, 'neutral', () => {
      undoDiscardItem(slot, type);
    });
  };

  const requestDiscardItem = (slot: number, itemName: string) => {
    const type = inventory?.slots[slot];
    if (!type) return;
    setConfirmRequest({
      title: `¿Tirar ${itemName}?`,
      message: 'Sale de la mochila. Tendrás unos segundos para deshacerlo desde el aviso.',
      confirmLabel: UI.discardItem,
      cancelLabel: UI.cancel,
      tone: 'danger',
      onConfirm: () => performDiscardItem(slot, type),
    });
  };

  const handleWeatherSelect = (w: WeatherType) => {
    if (engine) engine.setWeather(w);
  };

  const handleWarpCheckpoint = (idx: number) => {
    if (engine) engine.warpToCheckpoint(idx);
  };

  const handleJoystickMove = React.useCallback((forward: number, right: number, sprint?: boolean) => {
    if (engine) {
      engine.setVirtualInput({ forward, right, sprint: Boolean(sprint) });
    }
  }, [engine]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 overflow-hidden font-ui">
      {showPortraitHint && (
        <div className="absolute inset-0 z-[60] pointer-events-auto flex items-end sm:items-center justify-center p-4 pt-safe pb-safe cozy-scrim">
          <div className="w-full max-w-sm rounded-[1.75rem] cozy-panel p-5 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#fff1de] border border-cozy-line flex items-center justify-center text-cozy-accent-deep animate-[tilt-phone_1.6s_ease-in-out_infinite]">
              <Smartphone className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-cozy-ink mb-1">Gira tu dispositivo</h3>
              <p className="text-xs text-cozy-muted leading-relaxed">
                Cozy Leap se ve y se controla mucho mejor en horizontal. Activa la rotación del móvil y gira la pantalla físicamente.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2">
              {toggleFullscreen && (
                <button
                  type="button"
                  onClick={() => {
                    void runFullscreenToggle();
                  }}
                  className={`${BTN.primary} flex items-center justify-center gap-2`}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  {isFullscreen ? UI.exitFullscreen : UI.fullscreen}
                </button>
              )}
              <button
                type="button"
                onClick={() => setDismissPortraitHint(true)}
                className={BTN.secondary}
              >
                {UI.continue}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. TITLE SCREEN OVERLAY                                  */}
      {/* ======================================================== */}
      {gameState === 'title' && showCreator && (
        <CharacterCreator
          appearance={appearance}
          onChange={handleAppearanceChange}
          onSwitchBody={handleSwitchBody}
          onClose={closeCreator}
          onCancel={cancelCreator}
          portrait={isPortrait}
          onFocusChange={(focus) => engine?.setCharacterPreviewFocus(focus)}
          onZoom={(delta) => engine?.adjustCharacterPreviewZoom(delta)}
        />
      )}

      {(toastMessage || (gameState === 'playing' && weatherNotice && !toastMessage)) && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto z-[70] transition-all duration-200 ease-out animate-in fade-in zoom-in-95 max-w-[min(92vw,24rem)]"
        >
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-medium border ${
              toastTone === 'error'
                ? 'bg-cozy-blush-soft border-cozy-line text-[#8a4a52]'
                : toastTone === 'success'
                  ? 'bg-cozy-moss-soft border-cozy-line text-[#2f6a4c]'
                  : 'cozy-chip'
            }`}
          >
            <Sparkles
              className={`w-3.5 h-3.5 shrink-0 ${
                toastTone === 'error'
                  ? 'text-cozy-blush'
                  : toastTone === 'success'
                    ? 'text-cozy-moss'
                    : 'text-amber-400'
              }`}
            />
            <span className="truncate">
              {toastMessage || (weatherNotice ? `${weatherNotice.title}` : '')}
            </span>
            {toastUndo && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const run = toastUndo;
                  clearToast();
                  run();
                }}
                className="ml-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold text-cozy-sky hover:text-cozy-ink bg-white/50 cursor-pointer shrink-0"
              >
                {UI.undo}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (onDismissWeatherNotice) onDismissWeatherNotice();
                clearToast();
              }}
              className="opacity-60 hover:opacity-100 cursor-pointer shrink-0 p-0.5"
              aria-label="Cerrar aviso"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {gameState === 'title' && !showCreator && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto cozy-scrim text-cozy-ink p-3 sm:p-6 pt-safe pb-safe transition-opacity duration-500 overflow-y-auto font-ui">
          {isMobileUi && toggleFullscreen && (
            <div className="absolute top-safe right-0 pt-3 pr-3 pr-safe flex items-center gap-1.5 z-20">
              <IconAction
                label={UI.screenShort}
                title={isFullscreen ? UI.exitFullscreen : UI.fullscreen}
                compact
                className="text-cozy-accent-deep"
                onClick={() => {
                  void runFullscreenToggle();
                }}
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </IconAction>
            </div>
          )}
          <div className="w-full max-w-sm rounded-[1.75rem] cozy-panel p-5 sm:p-6 flex flex-col my-auto transition-all animate-in fade-in zoom-in-95">

            {titleStep === 'main' && (
              <div className="flex flex-col items-center text-center gap-8">
                <div className="space-y-2">
                  <h1 className="font-display font-bold text-3xl sm:text-4xl text-cozy-ink tracking-wide">
                    Cozy Leap
                  </h1>
                  <p className="text-sm text-cozy-muted">
                    Islas cálidas y saltos suaves
                  </p>
                </div>

                {rejoinSession && (
                  <div className="w-full p-3 rounded-2xl bg-[#fff2db] border border-[#f0d4a3] text-stone-900 flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2 text-left min-w-0">
                      <Users className="w-4 h-4 text-amber-700 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">Sala multijugador previa</p>
                        <p className="text-[10px] text-stone-600 truncate">Nivel {rejoinSession.levelId} · ¿Deseas volver a entrar?</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const s = rejoinSession;
                          setRejoinSession(null);
                          enterPartyRoom(s.levelId, s.roomId);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-[11px] cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        Volver
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sessionStorage.removeItem('cozy_party_session');
                          setRejoinSession(null);
                        }}
                        className="p-1 rounded-lg text-stone-500 hover:text-stone-800 cursor-pointer"
                        title="Cerrar aviso"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="w-full flex flex-col gap-5">
                  <button
                    type="button"
                    onClick={() => {
                      const lvl = maxPlayableLevel() > 1 ? maxPlayableLevel() : 1;
                      setPendingLevel(lvl);
                      setPendingMode('free');
                      engine?.loadLevel(lvl);
                      engine?.setCharacterPreview(true);
                      setPreviousTitleStep('main');
                      setTitleStep('select_character');
                    }}
                    className={`${BTN.primary} flex items-center justify-center gap-2`}
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{maxPlayableLevel() > 1 ? UI.continue : UI.start}</span>
                  </button>
                  {maxPlayableLevel() > 1 && (
                    <p className="text-[11px] text-cozy-muted -mt-3">
                      Nivel {maxPlayableLevel()} · {levelInfo(maxPlayableLevel()).name}
                    </p>
                  )}

                  <div className="w-full flex flex-col gap-2 pt-1">
                    {maxPlayableLevel() > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingLevel(1);
                          setPendingMode('free');
                          engine?.loadLevel(1);
                          engine?.setCharacterPreview(true);
                          setPreviousTitleStep('main');
                          setTitleStep('select_character');
                        }}
                        className={BTN.ghost}
                      >
                        {UI.newGame}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setTitleStep('select_level')}
                      className={BTN.ghost}
                    >
                      {UI.selectLevel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTitleStep('game_modes')}
                      className={BTN.ghost}
                    >
                      {UI.gameModes}
                    </button>
                    <button
                      type="button"
                      onClick={openCreator}
                      className={`${BTN.ghost} inline-flex items-center justify-center gap-2`}
                      data-testid="menu-customize"
                    >
                      <UserRound className="w-4 h-4" />
                      Personalizar personaje
                    </button>
                  </div>

                  <div className="w-full pt-4 mt-1 border-t border-cozy-line flex items-center justify-center gap-4 text-xs text-cozy-muted">
                    <button
                      type="button"
                      onClick={() => setShowHelpModal(true)}
                      className="hover:text-cozy-ink cursor-pointer inline-flex items-center gap-1"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      {UI.helpShort}
                    </button>
                    <span className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLeaderboardLevelId(engine?.currentLevel ?? pendingLevel ?? 1);
                          setShowLeaderboardModal(true);
                        }}
                        className="hover:text-cozy-ink cursor-pointer"
                      >
                        {UI.rankingShort}
                      </button>
                      <HelpTip label={TIPS.ranking} />
                    </span>
                    <span className="relative inline-flex">
                      <button
                        type="button"
                        onClick={() => setShowUserMenu((v) => !v)}
                        aria-haspopup="menu"
                        aria-expanded={showUserMenu}
                        className="hover:text-cozy-ink cursor-pointer font-semibold inline-flex items-center gap-1"
                      >
                        {currentUser ? currentUser.displayName || currentUser.username : UI.enter}
                        {devOn && (
                          <span className="px-1 py-px rounded bg-sky-500 text-white text-[9px] font-bold leading-none tracking-wide">DEV</span>
                        )}
                      </button>
                      {showUserMenu && (
                        <>
                          <button
                            type="button"
                            aria-label="Cerrar menú"
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={() => setShowUserMenu(false)}
                          />
                          <div
                            role="menu"
                            className="absolute bottom-full right-0 mb-2 z-50 w-52 rounded-2xl cozy-panel p-1.5 flex flex-col shadow-xl text-left"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setShowUserMenu(false);
                                setShowAuthModal(true);
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-cozy-ink hover:bg-cozy-panel-deep/60 cursor-pointer"
                            >
                              <UserRound className="w-4 h-4 text-cozy-muted" />
                              {currentUser ? 'Mi cuenta' : UI.enter}
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setShowUserMenu(false);
                                setShowDevPanel(true);
                              }}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-cozy-ink hover:bg-cozy-panel-deep/60 cursor-pointer"
                            >
                              <Bug className="w-4 h-4 text-cozy-sky" />
                              Modo desarrollador
                            </button>
                          </div>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {titleStep === 'select_level' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setTitleStep(previousTitleStep === 'game_modes' ? 'game_modes' : 'main')}
                    className={BTN.back}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{UI.back}</span>
                  </button>
                  <span className="text-sm font-bold text-cozy-ink font-display">
                    Elegir nivel · Modo {pendingMode === 'time_trial' ? 'Contrarreloj' : pendingMode === 'chase' ? 'Persecución' : 'Libre'}
                  </span>
                  <span className="w-10" />
                </div>

                {/* Mode Selector pills: let player choose mode directly while picking level */}
                <div className="flex items-center gap-1.5 p-1 bg-cozy-panel-deep rounded-2xl border border-cozy-line">
                  <button
                    type="button"
                    onClick={() => setPendingMode('free')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      pendingMode === 'free' ? 'cozy-tab-active shadow-xs' : 'text-cozy-muted hover:text-cozy-ink'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Libre</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingMode('time_trial')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      pendingMode === 'time_trial' ? 'cozy-tab-active shadow-xs' : 'text-cozy-muted hover:text-cozy-ink'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Contrarreloj</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingMode('chase')}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      pendingMode === 'chase' ? 'cozy-tab-active shadow-xs' : 'text-cozy-muted hover:text-cozy-ink'
                    }`}
                  >
                    <Timer className="w-3.5 h-3.5" />
                    <span>Persecución</span>
                  </button>
                </div>

                {maxPlayableLevel() > 4 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cozy-soft" />
                    <input
                      type="search"
                      value={levelSearch}
                      onChange={(e) => setLevelSearch(e.target.value)}
                      placeholder={UI.searchLevel}
                      className="w-full pl-9 pr-3 py-2 rounded-xl cozy-input text-xs"
                      aria-label={UI.searchLevel}
                    />
                    <SuggestionList
                      query={levelSearch}
                      options={Array.from({ length: maxPlayableLevel() }, (_, i) => {
                        const id = i + 1;
                        const info = levelInfo(id);
                        return `Nivel ${id} · ${info.name}`;
                      })}
                      onPick={(value) => setLevelSearch(value)}
                    />
                  </div>
                )}
                {recentLevelSearches.length > 0 && (
                  <RecentChips
                    label={UI.recentSearches}
                    items={recentLevelSearches}
                    onPick={(value) => setLevelSearch(value)}
                  />
                )}

                <div className="flex items-center gap-2">
                  {(
                    [
                      { id: 'all' as const, label: 'Todos' },
                      { id: 'todo' as const, label: 'Pendientes' },
                      { id: 'done' as const, label: 'Hechos' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setLevelListFilter(f.id)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer ${
                        levelListFilter === f.id ? 'cozy-tab-active' : 'text-cozy-muted hover:text-cozy-ink'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {titleDraftReady && (
                  <button
                    type="button"
                    onClick={resumeTitleDraft}
                    className={`${BTN.secondary} flex items-center justify-center gap-2`}
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>
                      Seguir con nivel {pendingLevel}
                      {pendingMode === 'time_trial'
                        ? ' · Contrarreloj'
                        : pendingMode === 'chase'
                          ? ' · Persecución'
                          : ''}
                    </span>
                  </button>
                )}

                <div className="flex flex-col gap-3 max-h-[48vh] overflow-y-auto pr-1">
                  {(() => {
                    const totalLevelsToShow = Math.max(5, maxPlayableLevel());
                    const levels = Array.from({ length: totalLevelsToShow }, (_, i) => i + 1)
                      .filter((lvl) => {
                        const completed = isLevelCompleted(lvl);
                        if (levelListFilter === 'done') return completed;
                        if (levelListFilter === 'todo') return !completed;
                        return true;
                      })
                      .filter((lvl) => {
                        const q = levelSearch.trim().toLowerCase();
                        if (!q) return true;
                        const info = levelInfo(lvl);
                        return (
                          `nivel ${lvl}`.includes(q) ||
                          String(lvl) === q ||
                          info.name.toLowerCase().includes(q) ||
                          info.desc.toLowerCase().includes(q)
                        );
                      });
                    if (levels.length === 0) {
                      return (
                        <EmptyState
                          title="Nada por aquí"
                          body={
                            levelSearch.trim()
                              ? 'Ningún nivel coincide con tu búsqueda. Prueba otra palabra o limpia el filtro.'
                              : 'Con este filtro no hay niveles. Elige Todos para ver la lista completa.'
                          }
                          actionLabel="Ver todos"
                          onAction={() => {
                            setLevelListFilter('all');
                            setLevelSearch('');
                          }}
                        />
                      );
                    }
                    return levels.map((lvl) => {
                      const info = levelInfo(lvl);
                      const completed = isLevelCompleted(lvl);
                      const unlocked = isLevelUnlocked(lvl);

                      if (!unlocked) {
                        return (
                          <div
                            key={lvl}
                            onClick={() =>
                              showToast(
                                `El nivel ${lvl} está bloqueado. Completa el nivel ${lvl - 1} para desbloquear.`,
                                2200,
                                'neutral'
                              )
                            }
                            className="flex items-center gap-3 p-3.5 rounded-2xl bg-cozy-panel-deep/50 border border-cozy-line/50 text-left opacity-60 cursor-not-allowed group select-none transition-opacity hover:opacity-75"
                          >
                            <span className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 bg-stone-300/30 text-cozy-muted">
                              <Lock className="w-4 h-4 text-cozy-soft" />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-cozy-muted truncate">
                                Nivel {lvl} · {info.name}
                              </div>
                              <div className="text-[10px] text-cozy-soft">
                                Bloqueado · Completa el nivel {lvl - 1} para desbloquear
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={lvl}
                          onClick={() => {
                            const label = `Nivel ${lvl} · ${info.name}`;
                            setRecentLevelSearches(pushRecent(RECENT_KEYS.levelSearches, label));
                            setPendingLevel(lvl);
                            if (getDevLevelPick()) {
                              // Back to the normal levels: forget the world picked in the developer panel
                              setDevLevelPick(null);
                              engine?.reloadLevel(lvl);
                            }
                            engine?.loadLevel(lvl);
                            engine?.setCharacterPreview(true);
                            setPreviousTitleStep('select_level');
                            setTitleStep('select_character');
                          }}
                          className="flex items-center gap-3 p-3.5 rounded-2xl cozy-btn text-left cursor-pointer active:scale-[0.98] group"
                        >
                          <span
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
                            style={{ backgroundColor: `${info.accent}28`, color: info.accent }}
                          >
                            {lvl}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-cozy-ink truncate">{info.name}</div>
                            {completed && (
                              <div className="text-[10px] text-cozy-moss font-semibold">{UI.done}</div>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-cozy-soft shrink-0" />
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {titleStep === 'game_modes' && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setTitleStep('main')}
                    className={BTN.back}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{UI.back}</span>
                  </button>
                  <span className="text-sm font-bold text-cozy-ink font-display">{UI.gameModes}</span>
                  <span className="w-10" />
                </div>

                <div className="flex flex-col gap-4">
                  {titleDraftReady && (
                    <button
                      type="button"
                      onClick={resumeTitleDraft}
                      className={`${BTN.secondary} flex items-center justify-center gap-2`}
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>
                        Seguir con nivel {pendingLevel}
                        {pendingMode === 'time_trial'
                          ? ' · Contrarreloj'
                          : pendingMode === 'chase'
                            ? ' · Persecución'
                            : ' · Libre'}
                      </span>
                    </button>
                  )}
                  {/* Bug fix & feature: Selecting a mode now takes the player to level select with that mode active */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPendingMode('free');
                        setPreviousTitleStep('game_modes');
                        setTitleStep('select_level');
                      }}
                      className={`${BTN.primary} flex-1 flex items-center justify-center gap-2`}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Modo Libre</span>
                    </button>
                    <HelpTip label="Explora a tu propio ritmo sin límite de tiempo ni sombras acechadoras." side="bottom" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPendingMode('time_trial');
                        setPreviousTitleStep('game_modes');
                        setTitleStep('select_level');
                      }}
                      className={`${BTN.secondary} flex-1 flex items-center justify-center gap-2`}
                    >
                      <Clock className="w-4 h-4" />
                      <span>Contrarreloj</span>
                    </button>
                    <HelpTip label={TIPS.contrarreloj} side="bottom" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPendingMode('chase');
                        setPreviousTitleStep('game_modes');
                        setTitleStep('select_level');
                      }}
                      className={`${BTN.secondary} flex-1 flex items-center justify-center gap-2`}
                    >
                      <Timer className="w-4 h-4" />
                      <span>Persecución</span>
                    </button>
                    <HelpTip label={TIPS.persecucion} side="bottom" />
                  </div>
                </div>
              </div>
            )}

            {titleStep === 'select_character' && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      engine?.setCharacterPreview(false);
                      setTitleStep(previousTitleStep);
                    }}
                    className={BTN.back}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{UI.back}</span>
                  </button>
                  <span className="text-sm font-bold text-cozy-ink font-display">{UI.pickCharacter}</span>
                  <span className="w-10" />
                </div>

                <p className="text-xs text-cozy-muted text-center leading-relaxed -mt-2">
                  Nivel {pendingLevel} · {levelInfo(pendingLevel).name}
                  {' · '}
                  {pendingMode === 'time_trial'
                    ? 'Contrarreloj'
                    : pendingMode === 'chase'
                      ? 'Persecución'
                      : 'Libre'}
                </p>

                <div className="grid grid-cols-2 gap-2 p-1 bg-cozy-panel-deep rounded-2xl border border-cozy-line">
                  <button
                    type="button"
                    onClick={() => handleSwitchBody('chico')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      appearance.bodyType === 'chico'
                        ? 'cozy-tab-active'
                        : 'text-cozy-muted hover:text-cozy-ink'
                    }`}
                  >
                    <span>Chico</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchBody('chica')}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      appearance.bodyType === 'chica'
                        ? 'cozy-tab-active'
                        : 'text-cozy-muted hover:text-cozy-ink'
                    }`}
                  >
                    <span>Chica</span>
                  </button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 text-left">
                    <span
                      className="w-11 h-11 rounded-xl flex items-center justify-center border border-cozy-line shadow-inner shrink-0"
                      style={{ background: `linear-gradient(135deg, ${appearance.sweaterColor}, ${appearance.scarfColor})` }}
                    >
                      <UserRound className="w-5 h-5 text-white drop-shadow" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-cozy-ink truncate">
                        {appearance.name || (appearance.bodyType === 'chico' ? 'Viajero' : 'Viajera')}
                      </div>
                      <button
                        type="button"
                        onClick={openCreator}
                        className="text-[11px] font-semibold text-cozy-sky hover:text-cozy-ink cursor-pointer"
                      >
                        {UI.editLook}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleStartGame(pendingMode, pendingLevel)}
                  className={`${BTN.primary} flex items-center justify-center gap-2 mt-1`}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>
                    {previousTitleStep === 'main' && maxPlayableLevel() > 1 && pendingLevel === maxPlayableLevel()
                      ? UI.continue
                      : UI.start}
                  </span>
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. PLAYING / ACTIVE STATUS CLUSTERS (World-Matched UI)  */}
      {/* ======================================================== */}
      {gameState === 'playing' && combat && combat.darkness > 0.02 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: Math.min(1, combat.darkness),
            background: inventory?.slots.includes('antorcha')
              ? 'radial-gradient(circle at 50% 58%, rgba(8,4,16,0) 0%, rgba(8,4,16,0.25) 18%, rgba(8,4,16,0.82) 42%, rgba(4,2,8,0.95) 75%)'
              : 'radial-gradient(circle at 50% 58%, rgba(8,4,16,0.35) 0%, rgba(8,4,16,0.85) 22%, rgba(4,2,8,0.97) 60%)',
          }}
        />
      )}
      {gameState === 'playing' && !combat && levelStatus && levelStatus.darkness > 0.02 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: Math.min(1, levelStatus.darkness * 1.1),
            background: inventory?.slots.includes('luz')
              ? 'radial-gradient(circle at 50% 58%, rgba(6,5,2,0.05) 0%, rgba(6,5,2,0.45) 26%, rgba(4,3,1,0.85) 58%, rgba(2,1,0,0.95) 85%)'
              : 'radial-gradient(circle at 50% 58%, rgba(6,5,2,0.2) 0%, rgba(6,5,2,0.62) 24%, rgba(4,3,1,0.92) 55%, rgba(2,1,0,0.97) 80%)',
          }}
        />
      )}
      {gameState === 'playing' && (hurtFlash || levelHurt) && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(220,38,38,0) 45%, rgba(220,38,38,0.45) 100%)' }}
        />
      )}
      {gameState === 'playing' && combat && (
        <div
          className={`absolute pointer-events-none z-20 flex flex-col gap-1.5 ${
            isMobileUi ? 'right-2 top-[3.4rem] w-[min(44vw,220px)] pr-safe' : 'left-1/2 -translate-x-1/2 top-14 w-[min(80vw,340px)]'
          }`}
        >
          {/* Boss bar — one slim row so the arena stays visible */}
          <div className={`rounded-xl bg-stone-950/75 border border-rose-500/40 shadow-md backdrop-blur-md flex items-center gap-2 ${isMobileUi ? 'px-2 py-1' : 'px-2.5 py-1'}`}>
            <Skull className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className={`font-bold text-rose-100 truncate shrink min-w-0 ${isMobileUi ? 'text-[10px] max-w-[40%]' : 'text-[11px] max-w-[45%]'}`}>
              {isMobileUi ? combat.bossShort : combat.bossName}
            </span>
            {combat.defeated ? (
              <span className="ml-auto text-[10px] font-semibold text-rose-200">¡Derrotado!</span>
            ) : combat.bossMax <= 8 ? (
              <div className="flex-1 flex gap-0.5 min-w-[3rem]" aria-label={`Vida del jefe: ${combat.bossHp} de ${combat.bossMax}`}>
                {Array.from({ length: combat.bossMax }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full transition-colors duration-300 ${i < combat.bossHp ? 'bg-gradient-to-r from-rose-500 to-orange-400' : 'bg-stone-700'}`}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 h-2 rounded-full bg-stone-800 overflow-hidden min-w-[3rem]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-600 via-rose-500 to-orange-400 transition-[width] duration-300"
                  style={{ width: `${Math.max(0, Math.min(100, (combat.bossHp / combat.bossMax) * 100))}%` }}
                />
              </div>
            )}
          </div>
          {combat.objective && !combat.defeated && (
            <div
              className={`self-center inline-flex items-center gap-1.5 rounded-full border shadow-md backdrop-blur-md font-bold tabular-nums ${
                combat.objective.have <= 1
                  ? 'bg-rose-600/90 text-white border-rose-300 animate-pulse'
                  : 'bg-stone-950/75 text-amber-100 border-amber-300/40'
              } ${isMobileUi ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'}`}
              aria-label={`${combat.objective.label}: ${combat.objective.have} de ${combat.objective.total}`}
            >
              <span aria-hidden>🐄</span>
              {combat.objective.label} {combat.objective.have}/{combat.objective.total}
            </div>
          )}
          {/* Only what needs you right now (caught, fainted, you won). Tips come from your companion (key I). */}
          {(combat.urgent || combat.portalOpen) && (
            <div
              className={`rounded-xl text-center font-semibold shadow-md backdrop-blur-md ${
                combat.urgent
                  ? 'bg-rose-600/90 text-white border border-rose-300 animate-pulse'
                  : 'bg-sky-900/85 text-sky-100 border border-sky-400/60'
              } ${isMobileUi ? 'text-[10px] px-2 py-1' : 'text-[11px] px-3 py-1.5'}`}
            >
              {combat.urgent ? combat.hint : '¡Ganaste! Entra al portal del centro'}
            </div>
          )}
          {combat.tip && !combat.urgent && (
            <div
              role="status"
              aria-live="polite"
              className={`relative rounded-2xl bg-sky-50/95 text-sky-950 border-2 border-sky-300 shadow-lg ${isMobileUi ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
            >
              <span className={`flex items-center gap-1 font-bold text-sky-700 ${isMobileUi ? 'text-[9px]' : 'text-[10px]'} uppercase tracking-wider`}>
                <Sparkles className="w-3 h-3" />
                {combat.tip.from} dice
              </span>
              <span className={`block font-semibold leading-snug ${isMobileUi ? 'text-[10px]' : 'text-xs'}`}>{combat.tip.text}</span>
            </div>
          )}
        </div>
      )}

      {/* Backrooms: hearts, the key and the levers, in the bottom-left corner */}
      {gameState === 'playing' && !combat && levelStatus && (
        <div
          className={`absolute pointer-events-none z-20 pl-safe pb-safe ${
            touchControlsEnabled && !isAnyModalOpen
              ? compactControls
                ? 'left-3 bottom-[7.2rem]'
                : 'left-5 bottom-[9.6rem] sm:left-6 sm:bottom-[10.8rem]'
              : 'left-4 bottom-4'
          }`}
        >
          <div className="flex flex-col items-start gap-1.5">
            <div className="flex items-center gap-1.5">
              {levelStatus.key && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shadow-md backdrop-blur-sm ${
                    levelStatus.key === 'have' ? 'bg-amber-400 text-amber-950' : levelStatus.key === 'open' ? 'bg-emerald-500/80 text-white' : 'bg-stone-950/55 text-amber-100'
                  }`}
                  title={levelStatus.key === 'need' ? 'La salida del laberinto está cerrada: busca la llave' : levelStatus.key === 'have' ? 'Llévala a la puerta cerrada' : 'Puerta abierta'}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  {levelStatus.key === 'need' ? 'Busca la llave' : levelStatus.key === 'have' ? '¡Tienes la llave!' : 'Puerta abierta'}
                </span>
              )}
              {levelStatus.levers && levelStatus.key === 'open' && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shadow-md backdrop-blur-sm ${
                    levelStatus.levers.have >= levelStatus.levers.total ? 'bg-emerald-500/80 text-white' : 'bg-stone-950/55 text-rose-100'
                  }`}
                  title="Palancas del pasillo rojo: con las 3, el pasillo deja de alargarse"
                >
                  <ToggleRight className="w-3.5 h-3.5" />
                  Palancas {levelStatus.levers.have}/{levelStatus.levers.total}
                </span>
              )}
            </div>
            <HeartRow hp={levelStatus.hearts * 20} maxHp={levelStatus.maxHearts * 20} hurt={levelHurt} compact={isMobileUi} />
          </div>
        </div>
      )}

      {/* Player life in boss fights: hearts in the bottom-left corner (above the joystick on touch) */}
      {gameState === 'playing' && combat && (
        <div
          className={`absolute pointer-events-none z-20 pl-safe pb-safe ${
            touchControlsEnabled && !isAnyModalOpen
              ? compactControls
                ? 'left-3 bottom-[7.2rem]'
                : 'left-5 bottom-[9.6rem] sm:left-6 sm:bottom-[10.8rem]'
              : 'left-4 bottom-4'
          }`}
        >
          <div className="flex flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={() => engine?.askCompanionTip()}
              className={`pointer-events-auto inline-flex items-center gap-1.5 rounded-full border shadow-md backdrop-blur-sm cursor-pointer transition-colors ${
                combat.tip ? 'bg-sky-400 text-sky-950 border-sky-200' : 'bg-stone-950/55 text-sky-100 border-sky-300/40 hover:bg-stone-900/70'
              } ${isMobileUi ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1 text-xs'} font-semibold`}
              aria-label="Pedir un consejo a tu compañero"
              title="Tu compañero vuela alrededor del jefe y te dice cómo vencerlo"
            >
              <Lightbulb className="w-3.5 h-3.5" />
              Consejo
              {!touchControlsEnabled && <kbd className="px-1 rounded bg-white/20 text-[10px] font-mono leading-tight">I</kbd>}
            </button>
            <HeartRow hp={combat.hp} maxHp={combat.maxHp} hurt={hurtFlash} compact={isMobileUi} />
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <>
          {/* Top-Left Cluster: Mode Badge, Checkpoint, Collectibles, Time/Radar */}
          <div className={`absolute top-safe left-0 flex flex-col gap-2.5 sm:gap-3 pointer-events-auto pl-safe ${isMobileUi ? 'pt-2 pl-2 max-w-[58vw] sm:max-w-none' : 'top-4 left-4 pl-4 pt-4'}`}>
            <div className={`flex items-center gap-2 rounded-xl cozy-chip text-xs ${isMobileUi ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
              <MapPin className="w-3.5 h-3.5 text-cozy-moss flex-shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className={`font-semibold text-cozy-ink truncate ${isMobileUi ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>
                  {checkpointName}
                </span>
                <span className="text-[10px] text-cozy-muted truncate inline-flex items-center">
                  {orbs.total > 0 || combat ? (
                    <>
                      Nivel {engine?.currentLevel ?? 1}
                      {combat && ' · Lucha contra jefe'}
                      {orbs.total > 0 && <HelpTip label={TIPS.orbes} />}
                    </>
                  ) : (
                    <>
                      Descanso {checkpointIndex}/3
                      <HelpTip label={TIPS.descanso} />
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Open-world objective: orbs */}
            {orbs.total > 0 && (
              <div
                className={`flex items-center gap-2 rounded-xl border text-xs shadow-md backdrop-blur-md ${
                  isMobileUi ? 'px-2 py-1' : 'px-3 py-1.5'
                } ${
                  orbs.summitOpen ? 'bg-amber-950/85 border-amber-400/70 text-amber-100' : 'bg-violet-950/80 border-violet-400/50 text-violet-100'
                }`}
              >
                {orbs.summitOpen ? (
                  <Landmark className="w-4 h-4 text-amber-300 shrink-0" />
                ) : (
                  <Gem className="w-4 h-4 text-violet-300 shrink-0" />
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] uppercase tracking-wider opacity-75 font-semibold">
                    {orbs.summitOpen ? '¡Cima abierta!' : 'Orbes'}
                  </span>
                  <span className={`font-semibold tabular-nums ${isMobileUi ? 'text-[11px] truncate' : ''}`}>
                    {orbs.summitOpen
                      ? isMobileUi
                        ? '¡Sube a la cima!'
                        : 'La fortaleza está abierta: ¡sube a la cima!'
                      : `${orbs.have}/${orbs.total}`}
                  </span>
                </div>
              </div>
            )}

            {/* Mode-Specific Status Banner */}
            {gameMode === 'time_trial' && (
              <div
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors shadow-md backdrop-blur-md ${
                  timeRemaining <= 10
                    ? 'bg-red-950/95 border-red-500 text-red-100 animate-pulse ring-2 ring-red-500/60 shadow-lg shadow-red-900/50'
                    : timeRemaining <= 20
                    ? 'bg-red-950/90 border-red-500/80 text-red-200 animate-pulse'
                    : 'bg-amber-950/80 border-amber-500/50 text-amber-200'
                }`}
              >
                <Clock className={`w-3.5 h-3.5 ${timeRemaining <= 20 ? 'text-red-400' : 'text-amber-400'}`} />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Tiempo:</span>
                  <span className="font-mono font-black text-sm tracking-wide">
                    {timeRemaining > 0 ? `${timeRemaining.toFixed(1)}s` : '0.0s'}
                  </span>
                </div>

                {/* Animated Time Bonus Pill */}
                {timeBonus && (
                  <div className="absolute left-full ml-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-stone-950 text-[11px] font-extrabold shadow-lg animate-bounce whitespace-nowrap">
                    +{timeBonus.amount}s {timeBonus.reason}
                  </div>
                )}
              </div>
            )}

            {gameMode === 'chase' && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shadow-md backdrop-blur-md ${
                  stalkerWarningLevel === 'danger'
                    ? 'bg-rose-950/95 border-rose-500 text-rose-200 animate-pulse ring-2 ring-rose-500/50'
                    : stalkerWarningLevel === 'caution'
                    ? 'bg-amber-950/85 border-amber-500/60 text-amber-200'
                    : 'bg-stone-900/85 border-stone-800 text-stone-300'
                }`}
              >
                {stalkerWarningLevel === 'danger' ? (
                  <Flame className="w-4 h-4 text-rose-400 animate-bounce" />
                ) : (
                  <Ghost className="w-3.5 h-3.5 text-rose-400" />
                )}
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-wider">
                    {stalkerWarningLevel === 'danger'
                      ? '¡Acechador cerca!'
                      : stalkerWarningLevel === 'caution'
                      ? 'Acechador próximo'
                      : 'Acechador Sombrío'}
                  </span>
                  <span className="font-mono text-xs font-semibold">
                    {stalkerDistance < 100 ? `${stalkerDistance.toFixed(1)}m` : 'Buscándote...'}
                  </span>
                </div>
              </div>
            )}

            {/* Sun Crystals / Acorns Collectibles & Timer */}
            <div className={`flex items-center rounded-xl cozy-chip text-xs ${isMobileUi ? 'gap-2 px-2 py-1' : 'gap-3 px-3 py-1.5'}`}>
              {!combat && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider hidden sm:inline">Reliquias:</span>
                    <span className="tabular-nums font-semibold text-amber-300">
                      {collectedCount}/{totalCollectibles}
                    </span>
                  </div>
                  <div className="w-[1px] h-3 bg-stone-700/60" />
                </>
              )}
              <div className="flex items-center gap-1 font-mono text-stone-300">
                <Timer className="w-3 h-3 text-stone-400" />
                <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider hidden sm:inline font-ui">Tiempo:</span>
                <span>{formatTime(elapsedTime)}</span>
              </div>
              <div className="w-[1px] h-3 bg-stone-700/60" />
              <div className="flex items-center gap-1" title="Muertes: bajan tu calificación del nivel" data-testid="death-counter">
                <Skull className={`w-3.5 h-3.5 ${deaths > 0 ? 'text-rose-400' : 'text-stone-400'}`} />
                <span className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider hidden sm:inline">Muertes:</span>
                <span className={`tabular-nums font-semibold ${deaths > 0 ? 'text-rose-300' : 'text-stone-300'}`}>{deaths}</span>
              </div>
            </div>

            {/* Multiplayer Party Room badge */}
            {multiplayerClient.isInPartyRoom() && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/85 border border-emerald-500/50 text-emerald-200 text-xs shadow-md backdrop-blur-md">
                <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => setShowPartyModal(true)}
                  className="flex flex-col text-left hover:brightness-110 cursor-pointer"
                  title="Gestionar sala multijugador"
                >
                  <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <span>Sala ({multiplayerClient.getPartyCount()}/10)</span>
                    <span className="text-[8px] px-1 rounded bg-emerald-800/80 text-emerald-200 font-normal">
                      {multiplayerClient.isPartyHostRole() ? 'Anfitrión' : 'Invitado'}
                    </span>
                  </span>
                  <span className="text-[11px] text-emerald-100 font-semibold truncate max-w-[140px]">
                    {partyMembers.length > 0 ? partyMembers.join(', ') : 'En la sala'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPartyModal(true)}
                  className="ml-1 px-2 py-0.5 rounded-md bg-emerald-700/80 hover:bg-emerald-600 text-[10px] text-white font-bold transition-colors cursor-pointer"
                  title="Invitar amigos a la sala"
                >
                  + Invitar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRequest({
                      title: '¿Salir de la sala multijugador?',
                      message: 'Saldrás de la partida en línea y volverás al menú principal.',
                      confirmLabel: 'Salir de la sala',
                      cancelLabel: 'Seguir jugando',
                      tone: 'danger',
                      onConfirm: () => {
                        sessionStorage.removeItem('cozy_party_session');
                        multiplayerClient.clearPartyRoom();
                        handleReturnToTitle();
                      },
                    });
                  }}
                  className="px-1.5 py-0.5 rounded-md bg-emerald-900/80 hover:bg-rose-900/80 text-[10px] text-emerald-300 hover:text-rose-200 transition-colors cursor-pointer"
                  title="Salir de la sala"
                >
                  Salir
                </button>
              </div>
            )}

            {/* Floating Pickup Alert */}
            {pickupAlert && (
              <div
                key={pickupAlert.id}
                className="self-start px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-stone-950 text-xs font-black shadow-lg animate-bounce flex items-center gap-1 pointer-events-none"
              >
                <Sparkles className="w-3.5 h-3.5 fill-current" />
                <span>{pickupAlert.text}</span>
              </div>
            )}

            {/* FPS live counter badge */}
            {showFps && (
              <div className="self-start flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-stone-900/80 border border-stone-700/60 text-[10px] font-mono text-emerald-400 shadow-sm backdrop-blur-sm pointer-events-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{fps} FPS</span>
              </div>
            )}

            {/* Companion Power badge (hidden on mobile touch — action button covers it) */}
            {shownPower && powerInfo && !touchControlsEnabled && (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => engine?.activateCompanionPower()}
                  title={`${powerInfo.powerName}: ${powerInfo.desc}`}
                  className={`relative overflow-hidden flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl border text-left text-xs shadow-md backdrop-blur-md transition-colors cursor-pointer ${
                    shownPower.state === 'ready'
                      ? 'bg-stone-900/85 border-amber-400/70 hover:bg-stone-800'
                      : shownPower.state === 'active'
                      ? 'bg-stone-900/90 border-emerald-400/70'
                      : 'bg-stone-900/80 border-stone-700'
                  }`}
                >
                  {shownPower.state === 'active' && (
                    <span
                      className="absolute left-0 bottom-0 h-[3px] bg-emerald-400 transition-[width] duration-100"
                      style={{ width: `${Math.max(0, (shownPower.timeLeft / shownPower.duration) * 100)}%` }}
                    />
                  )}
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-stone-900 ${
                      shownPower.state === 'hungry' ? 'opacity-50 grayscale' : ''
                    } ${shownPower.state === 'active' ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: powerInfo.color }}
                  >
                    {COMPANION_ICONS[shownPower.companion]}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 font-semibold">
                      {powerInfo.companionName} · {powerInfo.powerName}
                    </span>
                    <span
                      className={`font-semibold ${
                        shownPower.state === 'ready'
                          ? 'text-amber-300'
                          : shownPower.state === 'active'
                          ? 'text-emerald-300'
                          : 'text-stone-400'
                      }`}
                    >
                      {shownPower.state === 'ready' && <>¡Listo!</>}
                      {shownPower.state === 'active' && `Activo · ${Math.ceil(shownPower.timeLeft)}s`}
                      {shownPower.state === 'hungry' && (bossAct ? `Recargando · ${Math.ceil(bossAct.cd)}s` : 'Con hambre · dale una baya')}
                    </span>
                  </span>
                </button>
                <HelpTip label={TIPS.poder} side="bottom" className="text-stone-300" />
              </span>
            )}
          </div>

          <div className={`absolute top-safe right-0 flex flex-wrap items-center justify-end gap-2 pointer-events-auto pr-safe ${isMobileUi ? 'pt-2 pr-2' : 'top-4 right-4 pr-4 pt-4'}`}>
            <IconAction
              label={UI.helpShort}
              title={UI.howToPlay}
              compact={isMobileUi}
              onClick={() => setShowHelpModal(true)}
              className="text-cozy-accent-deep"
            >
              <HelpCircle className="w-4 h-4" />
            </IconAction>
            <IconAction
              label={UI.photoShort}
              title={TIPS.modoFoto}
              compact={isMobileUi}
              onClick={() => engine?.enterPhotoMode()}
            >
              <Camera className="w-4 h-4 text-cozy-accent-deep" />
            </IconAction>
            <IconAction
              label="Ajustes"
              title="Ajustes y opciones"
              compact={isMobileUi}
              onClick={() => setShowSettingsModal(true)}
              className="text-cozy-accent-deep"
            >
              <Settings className="w-4 h-4" />
            </IconAction>
            <IconAction
              label={UI.pause}
              compact={isMobileUi}
              onClick={() => engine?.setPaused(true)}
            >
              <Pause className="w-4 h-4" />
            </IconAction>
          </div>

          {/* BACKPACK — compact FAB on mobile, full hotbar on desktop */}
          {inventory && (
            <div
              className={`absolute flex flex-col items-center gap-1.5 pointer-events-auto z-20 ${
                isMobileUi
                  ? compactControls
                    ? 'right-2 bottom-[11.5rem] items-end pr-safe'
                    : 'left-1/2 -translate-x-1/2 bottom-4 pb-safe'
                  : 'left-1/2 -translate-x-1/2 bottom-4'
              }`}
            >
              {inventory.superJumpLeft > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[10px] font-bold shadow">
                  <ItemThumb type="nuez" className="w-3.5 h-3.5" />
                  <span>{Math.ceil(inventory.superJumpLeft)}s</span>
                </span>
              )}

              {showBackpack && (
                <div className={`rounded-2xl cozy-panel ${isMobileUi ? 'w-[min(72vw,260px)] p-2.5' : 'w-[min(92vw,340px)] p-3'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-amber-300 uppercase tracking-wider">
                      <BackpackIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Mochila ({filledSlots}/{INVENTORY_SIZE})
                      <HelpTip label={TIPS.mochila} side="bottom" />
                    </span>
                    <button onClick={() => setShowBackpack(false)} className="p-1 rounded-lg hover:bg-stone-800 cursor-pointer" aria-label="Cerrar mochila">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {filledSlots === 0 ? (
                    <EmptyState
                      className="py-3"
                      title="Mochila vacía"
                      body="Recoge bayas y nueces en las islas. Luego ábrela para usarlas y alimentar a tu compañero."
                    />
                  ) : isMobileUi ? (
                    <div className="flex flex-col gap-1.5">
                      {inventory.slots.map((item, i) => {
                        const info = item ? ITEM_INFO[item] : null;
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              if (!info) return;
                              engine?.useItem(i);
                              setShowBackpack(false);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (info) requestDiscardItem(i, info.name);
                            }}
                            title={info ? `${info.name}: tocar para usar` : `Vacío ${i + 1}`}
                            className={`relative flex items-center gap-2 p-2 rounded-xl border text-left transition-transform active:scale-[0.98] cursor-pointer ${
                              info ? 'bg-stone-800 border-stone-600' : 'bg-stone-950/60 border-stone-800 border-dashed'
                            }`}
                            style={info ? { boxShadow: `inset 0 -2px 0 ${info.color}` } : undefined}
                          >
                            <span className="w-5 text-[10px] font-mono text-stone-500">{i + 1}</span>
                            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-900/80">
                              {item ? <ItemThumb type={item} className="w-5 h-5" /> : null}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="block text-xs font-semibold truncate text-stone-100">
                                {info ? info.name : 'Vacío'}
                                {slotBadge(i) && <span className="ml-1 text-amber-300">{slotBadge(i)}</span>}
                              </span>
                              {info && (
                                <span className="block text-[10px] text-stone-400 truncate">{info.desc}</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {inventory.slots.map((item, i) => {
                        const info = item ? ITEM_INFO[item] : null;
                        return (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-xl bg-stone-950/60 border border-stone-800">
                            <span className="w-5 text-[10px] font-mono text-stone-500">{i + 1}</span>
                            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-stone-800/80">
                              {item ? <ItemThumb type={item} className="w-5 h-5" /> : null}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">
                                {info ? info.name : 'Vacío'}
                                {slotBadge(i) && <span className="ml-1 text-amber-300">{slotBadge(i)}</span>}
                              </div>
                              {info && <div className="text-[10px] text-stone-400 leading-snug">{info.desc}</div>}
                            </div>
                            {info && (
                              <>
                                <button
                                  onClick={() => engine?.useItem(i)}
                                  className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-[11px] font-bold cursor-pointer"
                                >
                                  Usar
                                </button>
                                <button
                                  onClick={() => requestDiscardItem(i, info.name)}
                                  className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 cursor-pointer"
                                  title={UI.discardItem}
                                  aria-label={UI.discardItem}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {inventory && (() => {
                    const berryCount = inventory.slots.filter((s) => s === 'baya').length;
                    const nutCount = inventory.slots.filter((s) => s === 'nuez').length;
                    if (berryCount < 2 && nutCount < 2) return null;
                    return (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {berryCount >= 2 && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const n = engine?.useAllItemsOfType('baya') ?? 0;
                                if (n > 0) showToast(`Usaste ${n} baya${n === 1 ? '' : 's'}`, 1400, 'success');
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-stone-800 text-amber-200 border border-stone-600 cursor-pointer"
                            >
                              Usar bayas ({berryCount})
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmRequest({
                                  title: '¿Tirar todas las bayas?',
                                  message: `Se tiran ${berryCount} bayas. Podrás deshacerlo unos segundos desde el aviso.`,
                                  confirmLabel: UI.discardItem,
                                  cancelLabel: UI.cancel,
                                  tone: 'danger',
                                  onConfirm: () => {
                                    const removed = engine?.discardAllOfType('baya') ?? [];
                                    if (removed.length > 0) {
                                      showToast(
                                        `Tiraste ${removed.length} bayas`,
                                        6000,
                                        'neutral',
                                        () => {
                                          engine?.restoreItems(removed);
                                        }
                                      );
                                    }
                                  },
                                });
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-stone-900 text-stone-400 border border-stone-700 cursor-pointer"
                            >
                              Tirar bayas
                            </button>
                          </>
                        )}
                        {nutCount >= 2 && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const slot = inventory.slots.findIndex((s) => s === 'nuez');
                                if (slot >= 0) engine?.useItem(slot);
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-stone-800 text-amber-200 border border-stone-600 cursor-pointer"
                            >
                              Usar una nuez
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmRequest({
                                  title: '¿Tirar todas las nueces?',
                                  message: `Se tiran ${nutCount} nueces. Podrás deshacerlo unos segundos desde el aviso.`,
                                  confirmLabel: UI.discardItem,
                                  cancelLabel: UI.cancel,
                                  tone: 'danger',
                                  onConfirm: () => {
                                    const removed = engine?.discardAllOfType('nuez') ?? [];
                                    if (removed.length > 0) {
                                      showToast(
                                        `Tiraste ${removed.length} nueces`,
                                        6000,
                                        'neutral',
                                        () => {
                                          engine?.restoreItems(removed);
                                        }
                                      );
                                    }
                                  },
                                });
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-stone-900 text-stone-400 border border-stone-700 cursor-pointer"
                            >
                              Tirar nueces
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  {!isMobileUi && (
                    <p className="mt-2 text-[10px] text-stone-400 leading-snug">
                      Recoge bayas y nueces en las islas. 1–5 usan · Mayús+1–5 tiran · V batea. Las llaves se usan solas en puertas.
                    </p>
                  )}
                </div>
              )}

              {isMobileUi ? (
                <button
                  onClick={() => setShowBackpack((v) => !v)}
                  title="Mochila"
                  aria-label="Abrir mochila"
                  className={`relative rounded-2xl flex items-center justify-center cursor-pointer transition-colors shadow-lg border backdrop-blur-md ${
                    compactControls ? 'w-11 h-11' : 'w-12 h-12'
                  } ${
                    showBackpack
                      ? 'bg-amber-500 text-stone-950 border-amber-300'
                      : 'bg-stone-900/70 text-amber-300 border-stone-700/70 hover:bg-stone-800/80'
                  }`}
                >
                  <BackpackIcon className={compactControls ? 'w-4 h-4' : 'w-5 h-5'} />
                  {filledSlots > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-400 text-stone-950 text-[9px] font-black flex items-center justify-center leading-none">
                      {filledSlots}
                    </span>
                  )}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-stone-900/80 border border-stone-700/80 shadow-lg backdrop-blur-md">
                  <button
                    onClick={() => setShowBackpack((v) => !v)}
                    title="Mochila (B)"
                    aria-label="Abrir mochila"
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                      showBackpack ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-amber-300 hover:bg-stone-700'
                    }`}
                  >
                    <BackpackIcon className="w-5 h-5" />
                  </button>
                  {inventory.slots.map((item, i) => {
                    const info = item ? ITEM_INFO[item] : null;
                    return (
                      <button
                        key={i}
                        onClick={() => engine?.useItem(i)}
                        title={info ? `${info.name}: ${info.desc}` : `Espacio ${i + 1} vacío`}
                        aria-label={info ? `${info.name}` : `Espacio ${i + 1} vacío`}
                        className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex flex-col items-center justify-center border transition-transform active:scale-90 cursor-pointer ${
                          info ? 'bg-stone-800 border-stone-600 hover:border-amber-400' : 'bg-stone-950/50 border-stone-800 border-dashed'
                        }`}
                        style={info ? { boxShadow: `inset 0 -3px 0 ${info.color}` } : undefined}
                      >
                        <span className="absolute top-0.5 left-1 text-[9px] font-mono text-stone-500">{i + 1}</span>
                        {slotBadge(i) && (
                          <span className="absolute -top-1.5 -right-1.5 min-w-[1.15rem] h-[1.05rem] px-1 rounded-full bg-amber-400 text-stone-950 text-[9px] font-black flex items-center justify-center leading-none shadow">
                            {slotBadge(i)}
                          </span>
                        )}
                        {item ? <ItemThumb type={item} className="w-4 h-4" /> : null}
                        <span className="text-[8px] font-semibold text-stone-300 leading-none mt-0.5 max-w-[2.4rem] truncate">
                          {info ? info.name.split(' ')[0] : '—'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. MOBILE ON-SCREEN TOUCH CONTROLS                       */}
          {/* ======================================================== */}
          {touchControlsEnabled && !isAnyModalOpen && (
            <>
              <div className={`absolute flex flex-col items-start gap-2 pointer-events-auto z-20 pl-safe pb-safe ${compactControls ? 'bottom-3 left-3' : 'bottom-5 left-5 sm:bottom-6 sm:left-6'}`}>
                <VirtualJoystick
                  onMove={handleJoystickMove}
                  compact={compactControls}
                />
              </div>

              <div className={`absolute flex flex-col items-end pointer-events-auto z-20 pr-safe pb-safe ${compactControls ? 'bottom-3 right-3 gap-2' : 'bottom-5 right-5 sm:bottom-6 sm:right-6 gap-3'}`}>
                {shownPower && powerInfo && (
                  <button
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      engine?.activateCompanionPower();
                    }}
                    onClick={() => engine?.activateCompanionPower()}
                    className={`flex items-center gap-1.5 rounded-2xl text-[10px] sm:text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer touch-none select-none border-2 ${
                      compactControls ? 'px-2.5 py-1.5' : 'px-3.5 py-2'
                    } ${
                      shownPower.state === 'ready'
                        ? 'text-stone-950 border-amber-200'
                        : 'bg-stone-900/80 text-stone-400 border-stone-700/80'
                    }`}
                    style={{ touchAction: 'none', backgroundColor: shownPower.state === 'ready' ? powerInfo.color : undefined }}
                  >
                    {COMPANION_ICONS[shownPower.companion]}
                    <span>
                      {shownPower.state === 'ready' && (bossAct ? bossAct.name : 'Poder')}
                      {shownPower.state === 'active' && `${Math.ceil(shownPower.timeLeft)}s`}
                      {shownPower.state === 'hungry' && (bossAct ? `${Math.ceil(bossAct.cd)}s` : 'Hambre')}
                    </span>
                  </button>
                )}

                {combat && inventory && !combat.defeated && (
                  <div className="flex flex-wrap justify-end gap-1.5 max-w-[11rem]">
                    {(['bate', 'resortera', 'red', 'bomba', 'luz'] as ItemType[]).map((t) => {
                      const slot = inventory.slots.indexOf(t);
                      if (slot === -1) return null;
                      if (t === 'resortera' && !inventory.slots.includes('piedra')) return null;
                      const label = t === 'bate' ? 'Batear' : t === 'resortera' ? 'Disparar' : 'Lanzar';
                      return (
                        <button
                          key={t}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            engine?.useItem(slot);
                          }}
                          onClick={() => engine?.useItem(slot)}
                          className={`relative rounded-2xl bg-stone-900/85 border-2 flex flex-col items-center justify-center shadow-lg active:scale-90 transition-transform cursor-pointer touch-none select-none ${
                            compactControls ? 'w-11 h-11' : 'w-12 h-12'
                          }`}
                          style={{ borderColor: ITEM_INFO[t].color, touchAction: 'none' }}
                          title={ITEM_INFO[t].name}
                          aria-label={`${label}: ${ITEM_INFO[t].name}`}
                        >
                          <ItemThumb type={t} className="w-5 h-5" />
                          <span className="text-[8px] font-bold text-stone-200 leading-none mt-0.5">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    engine?.setVirtualInput({ jump: true });
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    engine?.setVirtualInput({ jump: false });
                  }}
                  onTouchCancel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    engine?.setVirtualInput({ jump: false });
                  }}
                  onMouseDown={() => engine?.setVirtualInput({ jump: true })}
                  onMouseUp={() => engine?.setVirtualInput({ jump: false })}
                  className={`rounded-full bg-gradient-to-br from-amber-500 to-amber-600 active:from-amber-600 active:to-amber-700 text-stone-950 font-bold flex flex-col items-center justify-center shadow-xl shadow-amber-950/40 border-2 border-amber-300 active:scale-90 transition-transform cursor-pointer touch-none select-none ${
                    compactControls ? 'w-14 h-14' : 'w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem]'
                  }`}
                  style={{ touchAction: 'none' }}
                  title="Saltar"
                >
                  <ArrowUp className={compactControls ? 'w-6 h-6 stroke-[3]' : 'w-7 h-7 stroke-[3]'} />
                  <span className="text-[9px] sm:text-[10px] tracking-wider uppercase -mt-0.5">Saltar</span>
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* ======================================================== */}
      {/* 4b. PHOTO MODE STUDIO (Viewfinder, Filters & Framing)     */}
      {/* ======================================================== */}
      {gameState === 'photo_mode' && (
        <div className="absolute inset-0 pointer-events-none select-none z-30">
          {/* Shutter White Flash Animation */}
          {isFlashing && (
            <div className="absolute inset-0 bg-white pointer-events-none z-50 animate-out fade-out duration-200" />
          )}

          {/* Frame Overlays */}
          {photoFrame === 'grid' && (
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none z-10 opacity-30">
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-r border-b border-white" />
              <div className="border-b border-white" />
              <div className="border-r border-white" />
              <div className="border-r border-white" />
              <div />
            </div>
          )}

          {photoFrame === 'cinematic' && (
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-10">
              <div className="w-full h-[12vh] bg-stone-950/95 border-b border-stone-800 flex items-center justify-center">
                <span className="text-[10px] text-amber-400/60 font-mono tracking-[0.25em] uppercase">
                  2.39:1 Anamorphic Widescreen
                </span>
              </div>
              <div className="w-full h-[12vh] bg-stone-950/95 border-t border-stone-800 flex items-center justify-center">
                <span className="text-xs text-amber-200/90 font-serif tracking-widest uppercase">
                  Cozy Leap · {checkpointName}
                </span>
              </div>
            </div>
          )}

          {photoFrame === 'polaroid' && (
            <div className="absolute inset-4 sm:inset-10 border-[16px] sm:border-[24px] border-b-[56px] sm:border-b-[72px] border-stone-100/95 shadow-2xl rounded-sm pointer-events-none z-10 flex items-end justify-center pb-2">
              <span className="text-stone-800 font-serif italic text-sm sm:text-base tracking-wide">
                Cozy Leap · {checkpointName}
              </span>
            </div>
          )}

          {photoFrame === 'postcard' && (
            <div className="absolute inset-4 sm:inset-8 border-4 border-dashed border-white/60 pointer-events-none z-10">
              <div className="absolute top-3 right-3 px-3 py-1.5 rounded-xl cozy-badge text-[10px] font-bold">
                Cozy Leap
              </div>
            </div>
          )}

          {/* Photo Mode HUD (Toggled with 'H' or icon) */}
          {!hidePhotoUI && (
            <>
              {/* Top Viewfinder Bar */}
              <div className="absolute top-4 inset-x-4 pt-safe flex items-center justify-between pointer-events-auto z-20 gap-2">
                <div className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-2xl cozy-panel text-cozy-ink text-xs shadow-lg">
                  <Camera className="w-4 h-4 text-cozy-accent-deep" />
                  <span className="font-bold text-cozy-ink">{UI.photoMode}</span>
                  <span className="text-cozy-soft hidden xs:inline">|</span>
                  <span className="text-cozy-muted text-[11px] hidden xs:inline">
                    Acercamiento {photoDistance.toFixed(1)} m
                  </span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  {toggleFullscreen && (
                    <button
                      onClick={() => {
                        void runFullscreenToggle();
                      }}
                      title={isFullscreen ? UI.exitFullscreen : UI.fullscreen}
                      className={`${BTN.chip} flex items-center gap-1`}
                    >
                      {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-cozy-accent-deep" /> : <Maximize className="w-3.5 h-3.5 text-cozy-accent-deep" />}
                      <span className="hidden md:inline">{isFullscreen ? UI.exitFullscreen : UI.fullscreen}</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      const next = !isPhotoPaused;
                      setIsPhotoPaused(next);
                      engine?.setPhotoModePaused(next);
                    }}
                    title={isPhotoPaused ? UI.resumeWorld : UI.pauseWorld}
                    className={`${BTN.chip} flex items-center gap-1.5 ${
                      isPhotoPaused ? 'cozy-badge' : ''
                    }`}
                  >
                    {isPhotoPaused ? <Play className="w-3.5 h-3.5 text-cozy-accent-deep fill-cozy-accent" /> : <Pause className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isPhotoPaused ? UI.resumeWorld : UI.pauseWorld}</span>
                  </button>

                  <button
                    onClick={() => setHidePhotoUI(true)}
                    title={UI.hideUi}
                    className={`${BTN.chip} flex items-center gap-1.5`}
                  >
                    <EyeOff className="w-4 h-4" />
                    <span className="hidden sm:inline">{UI.hideUi}</span>
                  </button>

                  <button
                    onClick={() => engine?.exitPhotoMode()}
                    title={UI.close}
                    className={`${BTN.chip} flex items-center gap-1`}
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">{UI.close}</span>
                  </button>
                </div>
              </div>

              {/* Bottom Photo Studio Drawer */}
              <div className="absolute bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-4 max-w-2xl mx-auto flex flex-col items-center gap-2 sm:gap-3 pointer-events-auto z-20 pb-safe">
                {/* Control Box */}
                <div className="w-full rounded-3xl cozy-panel p-3 sm:p-4 shadow-xl flex flex-col gap-2.5 sm:gap-3 max-h-[46vh] overflow-y-auto">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cozy-line pb-2.5">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <button
                        onClick={() => setPhotoActiveTab('camera')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          photoActiveTab === 'camera'
                            ? 'cozy-badge'
                            : 'text-cozy-muted hover:text-cozy-ink'
                        }`}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Cámara</span>
                      </button>
                      <button
                        onClick={() => setPhotoActiveTab('filters')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          photoActiveTab === 'filters'
                            ? 'cozy-badge'
                            : 'text-cozy-muted hover:text-cozy-ink'
                        }`}
                      >
                        <Palette className="w-3.5 h-3.5" />
                        <span>Filtros</span>
                      </button>
                      <button
                        onClick={() => setPhotoActiveTab('frames')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          photoActiveTab === 'frames'
                            ? 'cozy-badge'
                            : 'text-cozy-muted hover:text-cozy-ink'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Marcos</span>
                      </button>
                    </div>

                    <button
                      onClick={() => void handleSnapPhoto()}
                      disabled={photoAction.busy}
                      className="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-2xl cozy-btn-primary font-bold text-xs active:scale-95 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed disabled:active:scale-100"
                    >
                      {photoAction.showLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4" />
                      )}
                      <span>{photoAction.busy ? UI.capturing : UI.capture}</span>
                    </button>
                  </div>



                    {(photoAction.showLoading || photoAction.feedback) && (
                      <div className="w-full">
                        <ActionFeedbackBanner
                          feedback={photoAction.feedback}
                          showLoading={photoAction.showLoading}
                          loadingLabel="Procesando foto..."
                          onDismiss={photoAction.clearFeedback}
                        />
                      </div>
                    )}

                  {/* Tab Panels */}
                  {photoActiveTab === 'camera' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-cozy-ink">
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-cozy-muted font-medium">
                          <span>Acercar o alejar</span>
                          <span className="text-cozy-accent-deep">{photoDistance.toFixed(1)} m</span>
                        </div>
                        <input
                          type="range"
                          min="2.0"
                          max="14.0"
                          step="0.2"
                          value={photoDistance}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPhotoDistance(val);
                            engine?.setPhotoDistance(val);
                          }}
                          className="accent-cozy-accent cursor-pointer h-1.5 bg-cozy-panel-deep rounded-lg"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-cozy-muted font-medium">
                          <span>Altura</span>
                          <span className="text-cozy-accent-deep">{photoElevation.toFixed(1)} m</span>
                        </div>
                        <input
                          type="range"
                          min="-1.5"
                          max="3.5"
                          step="0.1"
                          value={photoElevation}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPhotoElevation(val);
                            engine?.setPhotoElevation(val);
                          }}
                          className="accent-cozy-accent cursor-pointer h-1.5 bg-cozy-panel-deep rounded-lg"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-cozy-muted font-medium">
                          <span>Ángulo de vista</span>
                          <span className="text-cozy-accent-deep">{photoFov}°</span>
                        </div>
                        <input
                          type="range"
                          min="28"
                          max="85"
                          step="1"
                          value={photoFov}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setPhotoFov(val);
                            engine?.setPhotoFov(val);
                          }}
                          className="accent-cozy-accent cursor-pointer h-1.5 bg-cozy-panel-deep rounded-lg"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-[11px] text-cozy-muted font-medium">
                          <span>Inclinar</span>
                          <span className="text-cozy-accent-deep">{(photoRoll * 57.3).toFixed(0)}°</span>
                        </div>
                        <input
                          type="range"
                          min="-0.4"
                          max="0.4"
                          step="0.02"
                          value={photoRoll}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setPhotoRoll(val);
                            engine?.setPhotoRoll(val);
                          }}
                          className="accent-cozy-accent cursor-pointer h-1.5 bg-cozy-panel-deep rounded-lg"
                        />
                      </div>
                    </div>
                  )}

                  {photoActiveTab === 'filters' && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {PHOTO_FILTERS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setPhotoFilter(f.id)}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border text-center transition-all cursor-pointer ${
                            photoFilter === f.id
                              ? 'cozy-badge border-cozy-accent'
                              : 'cozy-btn text-cozy-muted'
                          }`}
                        >
                          <div
                            className="w-5 h-5 rounded-full border border-cozy-line shadow-inner"
                            style={{ backgroundColor: f.color }}
                          />
                          <span className="text-[11px] font-bold leading-tight text-cozy-ink">{f.name}</span>
                          <span className="text-[9px] text-cozy-soft hidden sm:inline">{f.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {photoActiveTab === 'frames' && (
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {PHOTO_FRAMES.map((fm) => (
                        <button
                          key={fm.id}
                          onClick={() => setPhotoFrame(fm.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-2xl border text-center transition-all cursor-pointer ${
                            photoFrame === fm.id
                              ? 'cozy-badge border-cozy-accent'
                              : 'cozy-btn text-cozy-muted'
                          }`}
                        >
                          <span className="text-xs font-bold text-cozy-ink">{fm.name}</span>
                          <span className="text-[9px] text-cozy-soft">{fm.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sub-hint bar */}
                <div className="text-[11px] text-cozy-muted flex items-center gap-3 sm:gap-4 cozy-panel px-4 py-1.5 rounded-full shadow-md">
                  <span>Arrastrar para rotar</span>
                  <span>·</span>
                  <span>Rueda para acercar</span>
                  <span>·</span>
                  <span>H para ocultar</span>
                </div>
              </div>
            </>
          )}

          {/* Floating Show UI Pill if UI is hidden */}
          {hidePhotoUI && (
            <button
              onClick={() => setHidePhotoUI(false)}
              className="absolute bottom-6 right-6 pointer-events-auto px-4 py-2 rounded-2xl cozy-btn-primary text-xs font-bold shadow-xl flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>{UI.showUi}</span>
            </button>
          )}

          {/* Captured Photo Lightbox Modal */}
          {capturedPhotoUrl && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-auto cozy-scrim p-4 sm:p-6 z-50">
              <div className="w-full max-w-lg rounded-[1.75rem] cozy-panel p-5 sm:p-6 flex flex-col items-center text-center max-h-[95vh] overflow-y-auto font-ui">
                <div className="w-full flex items-center justify-between mb-3 border-b border-cozy-line pb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-cozy-accent-deep" />
                    <span className="text-sm font-bold text-cozy-ink">¡Foto lista!</span>
                  </div>
                  <button
                    onClick={discardPhotoCapture}
                    className="p-1.5 rounded-xl text-cozy-soft hover:text-cozy-ink cursor-pointer"
                    aria-label={UI.cancel}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="w-full rounded-2xl overflow-hidden border border-cozy-line bg-cozy-panel-deep flex items-center justify-center mb-4">
                  <img
                    src={capturedPhotoUrl}
                    alt="Foto lista"
                    className="w-full h-auto max-h-[55vh] object-contain rounded-xl"
                  />
                </div>

                <div className="w-full flex flex-col sm:flex-row items-center gap-2.5">
                  <a
                    href={capturedPhotoUrl}
                    download={`cozy-leap-${checkpointName.toLowerCase().replace(/\s+/g, '-')}.png`}
                    className={`${BTN.primary} sm:flex-1 flex items-center justify-center gap-2`}
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>{UI.savePhoto}</span>
                  </a>
                  <button
                    type="button"
                    onClick={discardPhotoCapture}
                    className={`${BTN.secondary} sm:w-auto`}
                  >
                    {UI.anotherPhoto}
                  </button>
                  <button
                    type="button"
                    onClick={discardPhotoCapture}
                    className={`${BTN.ghost} sm:w-auto`}
                  >
                    {UI.cancel}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* LEVEL OBJECTIVE BRIEF                                    */}
      {/* ======================================================== */}
      {showLevelBrief && (gameState === 'playing' || gameState === 'paused') && (
        <div className="absolute inset-0 z-[55] pointer-events-auto flex items-center justify-center p-4 pt-safe pb-safe cozy-scrim">
          <div className="w-full max-w-sm rounded-[1.75rem] cozy-panel p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-display font-bold text-cozy-ink leading-snug pr-2">
                {currentHowTo.title}
              </h3>
              <button
                type="button"
                onClick={() => setShowLevelBrief(false)}
                className="p-1.5 rounded-xl hover:bg-cozy-panel-deep text-cozy-soft cursor-pointer shrink-0"
                aria-label={UI.close}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-cozy-ink font-semibold leading-snug">{currentHowTo.goal}</p>
            <ul className="space-y-3 text-xs text-cozy-muted leading-relaxed">
              {currentHowTo.steps.slice(0, 3).map((step) => (
                <li key={step} className="flex gap-2">
                  <span className="text-cozy-accent-deep shrink-0">•</span>
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowLevelBrief(false)}
              className={`${BTN.primary} mt-1`}
            >
              {gameState === 'paused' ? UI.understood : UI.letsPlay}
            </button>
          </div>
        </div>
      )}

      {showEasterEgg && (
        <div className="absolute inset-0 z-[70] pointer-events-auto flex items-center justify-center p-4 pt-safe pb-safe cozy-scrim">
          <div className="w-full max-w-xs rounded-[1.75rem] bg-cozy-blush-soft border border-cozy-line shadow-2xl p-6 text-cozy-ink flex flex-col items-center text-center gap-3 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-white/70 border border-cozy-line flex items-center justify-center text-cozy-blush">
              <Heart className="w-7 h-7 fill-current" />
            </div>
            <h3 className="text-xl font-display font-bold text-cozy-ink leading-snug">
              Este juego fue creado para hacer feliz a Monse
            </h3>
            <p className="text-xs text-cozy-muted leading-relaxed">
              Un secreto entre nubes, islas y saltos. Gracias por jugar Cozy Leap.
            </p>
            <button
              type="button"
              onClick={() => onDismissEasterEgg?.()}
              className="w-full py-3 rounded-xl bg-cozy-blush hover:brightness-105 text-white font-bold text-sm cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <span>Con cariño</span>
              <Heart className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. PAUSE MODAL                                           */}
      {/* ======================================================== */}
      {gameState === 'paused' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto cozy-scrim p-6 z-30">
          <div className="w-full max-w-sm rounded-[1.75rem] cozy-panel p-6 flex flex-col items-center text-center font-ui gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-cozy-ink">{UI.pause}</h2>
              <p className="text-xs text-cozy-muted leading-relaxed">
                {checkpointName}
                {' · '}
                Nivel {engine?.currentLevel ?? 1}
              </p>
            </div>

            {multiplayerClient.isInPartyRoom() && (
              <div className="w-full px-3 py-2 rounded-xl bg-[#e3f0f7] border border-[#bcd7e8] text-[11px] text-[#2c5878] text-left flex items-start gap-2 shadow-xs">
                <Users className="w-4 h-4 shrink-0 mt-0.5 text-[#2c5878]" />
                <span className="leading-tight">
                  Partida multijugador online. El tiempo y los demás jugadores continúan en curso.
                </span>
              </div>
            )}

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => engine?.setPaused(false)}
                className={BTN.primary}
              >
                {UI.resume}
              </button>
              <button
                onClick={() => {
                  engine?.restartLevel();
                  engine?.setPaused(false);
                }}
                className={`${BTN.secondary} flex items-center justify-center gap-2`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reiniciar nivel</span>
              </button>
              <span className="inline-flex items-center justify-center gap-1">
                <button
                  onClick={requestRespawnCheckpoint}
                  className={BTN.ghost}
                >
                  {UI.lastRest}
                </button>
                <HelpTip label={TIPS.descanso} />
              </span>
              <button
                onClick={requestReturnToTitle}
                className={BTN.ghost}
              >
                {UI.mainMenu}
              </button>
            </div>

            <div className="w-full flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-cozy-muted pt-1">
              <button
                type="button"
                onClick={() => setShowLevelBrief(true)}
                className="hover:text-cozy-ink cursor-pointer"
              >
                {UI.objective}
              </button>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="hover:text-cozy-ink cursor-pointer inline-flex items-center gap-1"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {UI.howToPlay}
              </button>
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="hover:text-cozy-ink cursor-pointer inline-flex items-center gap-1"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Ajustes</span>
              </button>
              <span className="inline-flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setLeaderboardLevelId(engine?.currentLevel ?? 1);
                    setShowLeaderboardModal(true);
                  }}
                  className="hover:text-cozy-ink cursor-pointer"
                >
                  {UI.rankingShort}
                </button>
                <HelpTip label={TIPS.ranking} />
              </span>
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="hover:text-cozy-ink cursor-pointer"
              >
                {currentUser ? UI.account : UI.enter}
              </button>
              {multiplayerClient.isInPartyRoom() && (
                <button
                  type="button"
                  onClick={() => setShowPartyModal(true)}
                  className="hover:text-cozy-ink cursor-pointer inline-flex items-center gap-1 font-bold text-emerald-700"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Sala ({multiplayerClient.getPartyCount()}/10)</span>
                </button>
              )}
              <button
                type="button"
                onClick={toggleMute}
                className="hover:text-cozy-ink cursor-pointer inline-flex items-center gap-1 font-medium"
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-stone-400" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{isMuted ? 'Sonido: Silenciado' : 'Sonido: Activado'}</span>
              </button>
              {toggleFullscreen && (
                <button
                  type="button"
                  onClick={() => void runFullscreenToggle()}
                  className="hover:text-cozy-ink cursor-pointer"
                >
                  {isFullscreen ? UI.exitFullscreen : UI.screenShort}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5b. GAME OVER MODAL (Time Trial Timeout)                 */}
      {/* ======================================================== */}
      {gameState === 'game_over' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto cozy-scrim p-6 z-30">
          <div className="w-full max-w-sm rounded-[1.75rem] cozy-panel p-6 flex flex-col items-center text-center animate-in fade-in zoom-in-95 font-ui gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-display font-bold text-cozy-ink">{engine?.gameOverReason ? '¡Perdiste la batalla!' : '¡Tiempo agotado!'}</h2>
              {engine?.gameOverReason && <p className="text-sm text-cozy-muted">{engine.gameOverReason}</p>}
              <p className={`text-xs text-cozy-muted items-center justify-center gap-1 flex-wrap ${engine?.gameOverReason ? 'hidden' : 'inline-flex'}`}>
                <span>Descanso {checkpointIndex}/3</span>
                <HelpTip label={TIPS.descanso} />
                <span>· Reliquias {collectedCount}/{totalCollectibles}</span>
                <HelpTip label={TIPS.reliquias} />
              </p>
            </div>

            {engine?.gameOverReason ? (
              <div className="w-full flex flex-col gap-3">
                <button onClick={() => handleRestart(gameMode)} className={BTN.primary}>
                  Intentar de nuevo
                </button>
                <button onClick={() => engine?.returnToTitle()} className={BTN.ghost}>
                  Volver al menú
                </button>
              </div>
            ) : (
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => requestRestartRun('time_trial')}
                className={BTN.primary}
              >
                {UI.retryTimed}
              </button>
              <button
                onClick={() => {
                  if (engine) {
                    engine.addTimeTrialBonus(30, 'Continuar');
                    engine.gameState = 'playing';
                  }
                }}
                className={BTN.ghost}
              >
                {UI.keepGoing}
              </button>
              <button
                onClick={() => {
                  setConfirmRequest({
                    title: '¿Pasar a modo libre?',
                    message: 'Reinicias el nivel sin reloj. El intento contrarreloj queda atrás.',
                    confirmLabel: 'Modo libre',
                    cancelLabel: UI.cancel,
                    onConfirm: () => handleRestart('free'),
                  });
                }}
                className="text-xs text-cozy-muted hover:text-cozy-ink cursor-pointer py-1"
              >
                Modo libre
              </button>
            </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. VICTORY / LEVEL COMPLETE MODAL (Clean & Clear)        */}
      {/* ======================================================== */}
      {gameState === 'victory' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto cozy-scrim p-4 sm:p-6 z-30 animate-in fade-in duration-300">
          <div className="w-full max-w-sm rounded-[1.75rem] cozy-panel p-6 flex flex-col items-center text-center font-ui gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-cozy-ink">
                ¡Nivel completado!
              </h2>
              <p className="text-xs text-cozy-muted">
                Nivel {engine?.currentLevel ?? 1} · {levelInfo(engine?.currentLevel ?? 1).name}
              </p>
              <p className="text-xs text-cozy-muted inline-flex items-center justify-center gap-1 flex-wrap">
                <span>{formatTime(elapsedTime)}</span>
                <span>· Reliquias {collectedCount}/{totalCollectibles}</span>
                <HelpTip label={TIPS.reliquias} />
                {gameMode === 'time_trial' ? <span>· {timeRemaining.toFixed(1)}s restantes</span> : null}
              </p>
            </div>

            {engine?.lastRating && (
              <div className="w-full rounded-2xl bg-white/70 border border-cozy-line px-4 py-3 flex flex-col items-center gap-1.5" data-testid="victory-rating">
                <RatingStars stars={engine.lastRating.stars} size="w-7 h-7" />
                <div className="text-3xl font-display font-black text-cozy-ink tabular-nums">
                  {engine.lastRating.score}
                  <span className="text-sm font-semibold text-cozy-muted"> / 1000</span>
                </div>
                <p className="text-[11px] text-cozy-muted inline-flex items-center gap-1">
                  <Skull className="w-3 h-3" />
                  {engine.lastRating.deaths === 0
                    ? '¡Sin morir! Bono completo'
                    : `${engine.lastRating.deaths} ${engine.lastRating.deaths === 1 ? 'muerte' : 'muertes'} (bajan la calificación)`}
                </p>
                {(() => {
                  const best = bestRating(engine.currentLevel);
                  return best && best.score > engine.lastRating.score ? (
                    <p className="text-[10px] text-cozy-soft">Tu mejor calificación aquí: {best.score}</p>
                  ) : null;
                })()}
              </div>
            )}

            {engine?.lastUnlocked && COMPANION_POWERS[engine.lastUnlocked] && (
              <p className="text-xs font-semibold text-[#2f6a4c]">
                Nuevo compañero: {COMPANION_POWERS[engine.lastUnlocked]!.companionName}
              </p>
            )}

            {(saveProgressAction.showLoading || saveProgressAction.feedback) && (
              <div className="w-full">
                <ActionFeedbackBanner
                  feedback={saveProgressAction.feedback}
                  showLoading={saveProgressAction.showLoading}
                  loadingLabel="Guardando progreso..."
                  onDismiss={saveProgressAction.clearFeedback}
                />
              </div>
            )}

            {!apiClient.isAuthenticated() && (
              <div className="w-full p-3 rounded-2xl bg-[#fff2db] border border-[#f0d4a3] text-stone-900 flex flex-col items-center gap-2 text-center shadow-xs">
                <p className="text-xs font-bold text-amber-900">Inicia sesión para guardar tu récord</p>
                <p className="text-[11px] text-stone-600 leading-snug">
                  Tu tiempo de {formatTime(elapsedTime)} no se registra en el ranking porque juegas como invitado.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  Iniciar sesión
                </button>
              </div>
            )}

            {apiClient.isAuthenticated() && saveProgressAction.feedback?.type === 'error' && (
              <button
                type="button"
                onClick={() => void submitVictoryRun(true)}
                disabled={saveProgressAction.busy}
                className="text-xs font-bold text-cozy-accent-deep hover:underline cursor-pointer flex items-center justify-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${saveProgressAction.showLoading ? 'animate-spin' : ''}`} />
                <span>Reintentar guardar récord</span>
              </button>
            )}

            <div className="w-full flex flex-col gap-3">
              {engine && isLevelUnlocked(engine.currentLevel + 1) ? (
                <button
                  type="button"
                  disabled={saveProgressAction.busy}
                  onClick={() => {
                    setElapsedTime(0);
                    runStartTimeRef.current = performance.now();
                    setSubmittedRunKey(null);
                    saveProgressAction.clearFeedback();
                    setSelectedLevel(engine.currentLevel + 1);
                    engine.goToNextLevel();
                  }}
                  className={`${BTN.primary} flex items-center justify-center gap-2`}
                >
                  {saveProgressAction.showLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  <span>{saveProgressAction.busy ? 'Guardando...' : 'Siguiente'}</span>
                  {!saveProgressAction.busy && <ArrowRight className="w-4 h-4 stroke-[2.5]" />}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saveProgressAction.busy}
                  onClick={handleReturnToTitle}
                  className={BTN.primary}
                >
                  {saveProgressAction.busy ? 'Guardando...' : UI.mainMenu}
                </button>
              )}
              <button
                type="button"
                disabled={saveProgressAction.busy}
                onClick={() => handleRestart(gameMode)}
                className={BTN.ghost}
              >
                {UI.playAgain}
              </button>
              <button
                type="button"
                disabled={saveProgressAction.busy}
                onClick={() => {
                  setLeaderboardLevelId(engine?.currentLevel ?? 1);
                  setShowLeaderboardModal(true);
                }}
                className="text-xs text-cozy-muted hover:text-cozy-ink cursor-pointer py-1"
              >
                {UI.leaderboard}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. HELP & CONTROLS MODAL (Tabbed & Organized)            */}
      {/* ======================================================== */}
      {showHelpModal && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto cozy-scrim p-4 sm:p-6 z-40">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[1.75rem] cozy-panel p-6 relative font-ui flex flex-col gap-4">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-5 right-5 text-cozy-soft hover:text-cozy-ink cursor-pointer"
              aria-label="Cerrar ayuda"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-display font-bold text-cozy-ink flex items-center gap-2">
              <Compass className="w-5 h-5 text-cozy-accent-deep" />
              <span>{UI.howToPlay}</span>
            </h3>

            {/* Ayuda Tab Navigation */}
            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-cozy-panel-deep text-xs font-semibold">
              <button
                type="button"
                onClick={() => setHelpTab('controls')}
                className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer text-center truncate ${
                  helpTab === 'controls'
                    ? 'bg-amber-100 text-cozy-ink shadow-sm'
                    : 'text-cozy-muted hover:text-cozy-ink'
                }`}
              >
                Controles
              </button>
              <button
                type="button"
                onClick={() => setHelpTab('companions')}
                className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer text-center truncate ${
                  helpTab === 'companions'
                    ? 'bg-amber-100 text-cozy-ink shadow-sm'
                    : 'text-cozy-muted hover:text-cozy-ink'
                }`}
              >
                Compañeros
              </button>
              <button
                type="button"
                onClick={() => setHelpTab('worlds')}
                className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer text-center truncate ${
                  helpTab === 'worlds'
                    ? 'bg-amber-100 text-cozy-ink shadow-sm'
                    : 'text-cozy-muted hover:text-cozy-ink'
                }`}
              >
                Mundos
              </button>
              <button
                type="button"
                onClick={() => setHelpTab('modes')}
                className={`py-1.5 px-2 rounded-lg transition-colors cursor-pointer text-center truncate ${
                  helpTab === 'modes'
                    ? 'bg-amber-100 text-cozy-ink shadow-sm'
                    : 'text-cozy-muted hover:text-cozy-ink'
                }`}
              >
                Modos
              </button>
            </div>

            {/* TAB 1: CONTROLES */}
            {helpTab === 'controls' && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                <div>
                  <span className="text-[11px] text-cozy-accent-deep font-bold uppercase tracking-wider block mb-2">
                    Controles del teclado
                  </span>
                  <div className="space-y-2 text-xs text-cozy-ink">
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Moverse</span>
                      <span className="bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">Flechas o WASD</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Saltar</span>
                      <span className="bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">Espacio</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Correr</span>
                      <span className="bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">Mayús</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Girar cámara</span>
                      <span className="bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">Mover el mouse o Q / E</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Soltar el cursor (y pausar)</span>
                      <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">Esc</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Poder del compañero</span>
                      <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">G</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Abrir / cerrar objetivo</span>
                      <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">O</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Abrir mochila</span>
                      <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">B</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Consejo del compañero (jefes)</span>
                      <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">I</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Silenciar sonido</span>
                      <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">M</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Pausa</span>
                      <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">Esc</span>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-cozy-accent-deep font-bold uppercase tracking-wider block mb-2">
                    Controles en el móvil
                  </span>
                  <div className="space-y-2 text-xs text-cozy-ink">
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Palanca táctil (abajo izq)</span>
                      <span className="text-cozy-ink">Mover; al borde corre automáticamente</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Botón de salto (abajo der)</span>
                      <span className="text-cozy-ink">Salto vertical y rebote</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                      <span className="text-cozy-muted">Girar cámara</span>
                      <span className="text-cozy-ink">Desliza un dedo en la pantalla</span>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] text-cozy-accent-deep font-bold uppercase tracking-wider block mb-2">
                    Atajos rápidos
                  </span>
                  <div className="space-y-2 text-xs text-cozy-ink">
                    {POWER_SHORTCUTS.slice(0, 5).map((row) => (
                      <div key={`${row.action}-${row.keys}`} className="flex justify-between items-center gap-3 py-1 border-b border-cozy-line">
                        <span className="text-cozy-muted">
                          {row.action}
                          <span className="block text-[10px] text-cozy-soft">{row.context}</span>
                        </span>
                        <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep shrink-0">
                          {row.keys}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: COMPAÑEROS */}
            {helpTab === 'companions' && (
              <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-700/40 text-xs text-amber-100/90 leading-relaxed">
                  <strong className="text-cozy-accent-deep block mb-1">Poderes de tu compañero (Tecla G):</strong>
                  <ul className="list-disc list-inside space-y-1.5">
                    {Object.values(COMPANION_POWERS).map((p) =>
                      p ? (
                        <li key={p.companion}>
                          <strong>{p.companionName} – {p.powerName}:</strong> {p.desc} ({p.duration}s de duración).
                        </li>
                      ) : null
                    )}
                  </ul>
                  <div className="mt-3 pt-2.5 border-t border-amber-600/30 text-[11px]">
                    🍎 <strong>Recarga de energía:</strong> Después de activarlo, tu compañero queda hambriento. Dale una <strong>baya mágica</strong> desde la mochila para volver a usarlo.
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: MUNDOS Y OBJETOS */}
            {helpTab === 'worlds' && (
              <div className="flex flex-col gap-3 text-xs leading-relaxed animate-in fade-in duration-150">
                <div className="p-3 rounded-2xl cozy-panel-soft">
                  <strong className="text-cozy-accent-deep block mb-1">Orbes y fortalezas (Niveles abiertos):</strong>
                  <p className="text-cozy-muted text-[11px] mb-2">
                    En cada nivel hay orbes místicos que desprenden un haz de luz vertical. Al reunirlos todos se abre la fortaleza central para llegar a la cima.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-cozy-ink text-[11px]">
                    <li><strong>Rocas empujables:</strong> Camina contra ellas para acercarlas y saltar encima.</li>
                    <li><strong>Bóvedas con candado:</strong> Busca la llave escondida en islas altas o custodiada por ladrones.</li>
                    <li><strong>Vigías:</strong> Ocultate tras las paredes cuando su linterna apunte hacia ti.</li>
                  </ul>
                </div>

                <div className="p-3 rounded-2xl bg-cozy-sky-soft border border-cozy-line">
                  <strong className="text-cozy-accent-deep block mb-1">Obstáculos del mundo:</strong>
                  <ul className="list-disc list-inside space-y-1 text-cozy-ink text-[11px]">
                    <li><strong>Hongos elásticos:</strong> Te lanzan con gran impulso hacia las alturas.</li>
                    <li><strong>Molinos de viento:</strong> Mide bien el tiempo para pasar entre sus aspas.</li>
                    <li><strong>Troncos rodantes:</strong> Mantén el equilibrio mientras giran sobre su eje.</li>
                    <li><strong>Plataformas quebradizas:</strong> Caen segundos después de pisarlas.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 4: MODOS DE JUEGO */}
            {helpTab === 'modes' && (
              <div className="flex flex-col gap-3 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-2xl bg-[#fff1de] border border-cozy-line text-xs text-cozy-ink leading-relaxed">
                  <strong className="text-cozy-accent-deep inline-flex items-center gap-1.5 font-bold mb-2">
                    <Trophy className="w-4 h-4" />
                    Tres formas de jugar:
                  </strong>
                  <div className="space-y-3 text-[11px]">
                    <div className="p-2 rounded-xl bg-white/70 border border-stone-200">
                      <strong className="text-emerald-700">🌱 Modo Libre:</strong>
                      <p className="text-stone-600 mt-0.5">Explora el archipiélago con calma, sin límite de tiempo ni enemigos que te persigan. Ideal para disfrutar el paisaje y tomar fotos.</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white/70 border border-stone-200">
                      <strong className="text-amber-700">⏱️ Modo Contrarreloj:</strong>
                      <p className="text-stone-600 mt-0.5">Comienzas con 90 segundos. Cada reliquia dorada te otorga <strong>+8s</strong> y cada campana de descanso te da <strong>+15s</strong>. ¡Tus mejores tiempos quedan en el Ranking!</p>
                    </div>
                    <div className="p-2 rounded-xl bg-white/70 border border-stone-200">
                      <strong className="text-rose-700">👻 Modo Persecución:</strong>
                      <p className="text-stone-600 mt-0.5">El Acechador Sombrío sigue tus pasos sin detenerse. Si te alcanza te expulsará de la isla. ¡Usa los hongos elásticos y corre para escapar!</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-cozy-line">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className={BTN.primary}
              >
                {UI.understood}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First-Time Guidance / Tutorial Card (Level 1) */}
      {showTutorialHint && gameState === 'playing' && (engine?.currentLevel ?? 1) === 1 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 pointer-events-auto z-30 max-w-sm w-[90vw] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-2xl cozy-panel p-4 shadow-xl border border-amber-300/60 bg-amber-50/95 text-stone-900 font-ui flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-display font-bold text-sm text-amber-900">
                <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
                Guía rápida · Primeros pasos
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowTutorialHint(false);
                  localStorage.setItem('cozy_tutorial_seen', 'true');
                }}
                className="text-stone-400 hover:text-stone-700 cursor-pointer p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 text-xs text-stone-700 leading-relaxed">
              <p>🌱 <strong>Muévete:</strong> Teclas WASD / Flechas (o la palanca táctil en móvil).</p>
              <p>✨ <strong>Objetivo:</strong> Recoge las <strong>12 reliquias doradas</strong> repartidas en las islas.</p>
              <p>🚩 <strong>Meta:</strong> Salta sobre hongos y sube a la plataforma final para ganar.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowTutorialHint(false);
                localStorage.setItem('cozy_tutorial_seen', 'true');
              }}
              className="mt-1 w-full py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold text-xs cursor-pointer text-center shadow-sm transition-colors"
            >
              ¡Entendido, a jugar!
            </button>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        engine={engine}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        language={language}
        onLanguageChange={(l) => {
          setLanguage(l);
          localStorage.setItem('cozy_lang', l);
        }}
        largeText={largeText}
        onLargeTextChange={(lt) => {
          setLargeText(lt);
          localStorage.setItem('cozy_large_text', String(lt));
        }}
        showFps={showFps}
        onShowFpsChange={(f) => {
          setShowFps(f);
          localStorage.setItem('cozy_show_fps', String(f));
        }}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onProfileSynced={handleProfileSynced}
        inviteLevelId={engine?.currentLevel ?? pendingLevel}
        onInviteToPlay={handleInviteToPlay}
      />

      <PartyRoomModal
        isOpen={showPartyModal}
        onClose={() => setShowPartyModal(false)}
        levelId={inviteLevel()}
        onInviteFriend={handleInviteToPlay}
        onOpenFriends={() => {
          setShowPartyModal(false);
          setShowAuthModal(true);
        }}
        onLeaveRoom={() => {
          setShowPartyModal(false);
          sessionStorage.removeItem('cozy_party_session');
          multiplayerClient.clearPartyRoom();
          handleReturnToTitle();
        }}
      />

      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        initialLevelId={leaderboardLevelId}
        initialMode={gameMode}
      />

      {incomingInvite && (
        <div className="absolute inset-0 z-[75] pointer-events-auto flex items-center justify-center p-4 cozy-scrim">
          <div className="w-full max-w-sm rounded-[1.75rem] cozy-panel p-5 flex flex-col gap-4 font-ui">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-cozy-sky-soft border border-cozy-line flex items-center justify-center text-cozy-sky shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-display font-bold text-cozy-ink">
                  Invitación a jugar
                </h3>
                <p className="mt-1 text-xs text-cozy-muted leading-relaxed">
                  <strong className="text-cozy-ink">{incomingInvite.fromUsername}</strong> te invita al nivel{' '}
                  {incomingInvite.levelId}
                  {levelInfo(incomingInvite.levelId)
                    ? ` · ${levelInfo(incomingInvite.levelId).name}`
                    : ''}
                  . Caduca en {incomingInvite.expiresInSeconds}s.
                </p>
                <p className="mt-1 text-[10px] text-cozy-soft inline-flex items-center gap-1">
                  <Gamepad2 className="w-3 h-3" />
                  Sala privada · hasta 10 exploradores
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  multiplayerClient.respondInvite(incomingInvite.inviteId, false, 'declined');
                  setIncomingInvite(null);
                }}
                className={`flex-1 ${BTN.secondary}`}
              >
                {UI.declineRequest}
              </button>
              <button
                type="button"
                onClick={() => {
                  const inv = incomingInvite;
                  if (!inv) return;
                  if (gameState === 'playing') {
                    setConfirmRequest({
                      title: '¿Abandonar partida actual?',
                      message: `Tienes una partida en curso. Al unirte a la sala de ${inv.fromUsername}, tu partida actual se reiniciará para jugar juntos en el nivel ${inv.levelId}.`,
                      confirmLabel: 'Unirme a la sala',
                      cancelLabel: 'Seguir jugando',
                      tone: 'danger',
                      onConfirm: () => {
                        setConfirmRequest(null);
                        setIncomingInvite(null);
                        multiplayerClient.respondInvite(inv.inviteId, true);
                      },
                    });
                  } else {
                    setIncomingInvite(null);
                    multiplayerClient.respondInvite(inv.inviteId, true);
                  }
                }}
                className={`flex-1 ${BTN.primary}`}
              >
                {UI.acceptRequest}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSpectating && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-auto max-w-[94vw] animate-in fade-in slide-in-from-top-3 duration-300">
          <div className="px-4 sm:px-5 py-2.5 rounded-2xl bg-black/80 backdrop-blur-md text-white border border-white/20 shadow-2xl flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs font-medium">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-amber-300">Modo Espectador</span>
              <span className="text-white/40">·</span>
              <span className="text-emerald-300 font-semibold">
                {engine?.lastRating?.forfeited
                  ? 'Se acabó el tiempo: pasas con calificación 0'
                  : `Meta alcanzada (#${spectateRank} en ${spectateTime > 0 ? `${spectateTime.toFixed(1)}s` : `${elapsedTime.toFixed(1)}s`})`}
              </span>
              {engine?.lastRating && !engine.lastRating.forfeited && (
                <span className="inline-flex items-center gap-1.5">
                  <RatingStars stars={engine.lastRating.stars} size="w-3.5 h-3.5" />
                  <span className="font-bold text-amber-200 tabular-nums">{engine.lastRating.score}</span>
                </span>
              )}
            </div>

            <div className="hidden sm:block h-4 w-px bg-white/20" />

            <div className="flex items-center gap-2">
              <span className="text-white/70">Observando a:</span>
              <span className="font-bold text-white px-2.5 py-1 rounded-xl bg-white/15 border border-white/10 shadow-xs">
                {spectateTargetName || 'Compañero'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => engine?.cycleSpectateTarget(-1)}
                title="Jugador anterior (Q / Shift+Tab)"
                className="px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
              >
                <span>◀</span>
                <span className="hidden md:inline">Anterior (Q)</span>
              </button>
              <button
                type="button"
                onClick={() => engine?.cycleSpectateTarget(1)}
                title="Siguiente jugador (E / Tab / Espacio)"
                className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 shadow-xs"
              >
                <span className="hidden md:inline">Siguiente (E)</span>
                <span>▶</span>
              </button>
            </div>
          </div>
          <div className="text-[11px] text-white/80 drop-shadow-md bg-black/40 px-3 py-1 rounded-full backdrop-blur-xs">
            Usa las teclas <span className="font-bold text-amber-300">E</span> o <span className="font-bold text-amber-300">Q</span> para cambiar de compañero
          </div>
        </div>
      )}

      {power?.companion === 'polilla' && power.state === 'active' && gameState === 'playing' && (
        <div className="fixed inset-0 z-20 pointer-events-none flex items-start justify-center" data-testid="rewind-overlay">
          <div className="absolute inset-0 mix-blend-multiply" style={{ background: 'radial-gradient(ellipse at center, rgba(255,240,205,0.05) 30%, rgba(120,90,40,0.55) 100%)' }} />
          <div className="absolute inset-0" style={{ backdropFilter: 'sepia(0.75) saturate(0.8)', WebkitBackdropFilter: 'sepia(0.75) saturate(0.8)' }} />
          <div className="relative mt-24 px-4 py-2 rounded-2xl bg-stone-900/80 text-amber-100 font-bold text-sm shadow-xl border border-amber-200/40 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 animate-spin [animation-direction:reverse]" />
            Regresando el tiempo…
          </div>
        </div>
      )}

      {partyTimer !== null && !isSpectating && gameState === 'playing' && (
        <div className="fixed top-28 sm:top-32 left-1/2 -translate-x-1/2 z-40 pointer-events-none" data-testid="party-timer">
          <div
            className={`px-4 py-2 rounded-2xl font-bold text-xs shadow-xl border flex items-center gap-2 ${
              partyTimer <= 15 ? 'bg-rose-600/95 text-white border-rose-300 animate-pulse' : 'bg-stone-900/90 text-amber-200 border-amber-400/60'
            }`}
          >
            <Timer className="w-4 h-4" />
            <span>¡Un compañero ya llegó!</span>
            <span className="font-mono text-sm tabular-nums">{formatTime(partyTimer)}</span>
            <span className="font-medium opacity-80 hidden sm:inline">o pasas con calificación 0</span>
          </div>
        </div>
      )}

      {roomFinishNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="px-4 py-2 rounded-2xl bg-amber-500/95 text-stone-950 font-bold text-xs shadow-xl border border-amber-300 flex items-center gap-2">
            <span>🏁</span>
            <span>
              ¡{roomFinishNotice.displayName || roomFinishNotice.username || 'Un compañero'} llegó a la meta en puesto #{roomFinishNotice.rank ?? 1}
              {roomFinishNotice.timeSeconds ? ` (${roomFinishNotice.timeSeconds.toFixed(1)}s)` : ''}!
            </span>
          </div>
        </div>
      )}

      {roomSummary && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-auto bg-black/60 backdrop-blur-sm p-4 sm:p-6 z-50 animate-in fade-in duration-300">
          <div className="w-full max-w-md rounded-[1.75rem] cozy-panel p-6 flex flex-col items-center text-center font-ui gap-5 shadow-2xl border border-white/40">
            <div className="space-y-1">
              <div className="text-3xl">🏆</div>
              <h2 className="text-2xl font-display font-bold text-cozy-ink">
                ¡Todos completaron el nivel!
              </h2>
              <p className="text-xs text-cozy-muted">
                Nivel {roomSummary.levelId} · Podio de la Sala
              </p>
            </div>

            <div className="w-full space-y-2 max-h-60 overflow-y-auto pr-1">
              {Array.isArray(roomSummary.summary) && roomSummary.summary.length > 0 ? (
                roomSummary.summary.map((entry: any, i: number) => {
                  const rank = entry.rank || i + 1;
                  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
                  return (
                    <div
                      key={entry.userId || rank}
                      className={`flex items-center justify-between p-3 rounded-2xl border ${
                        rank === 1
                          ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold shadow-xs'
                          : 'bg-stone-50 border-stone-200 text-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg w-6 text-center">{medal}</span>
                        <span className="text-xs font-semibold">
                          {entry.displayName || entry.username || entry.name || 'Explorador'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-0.5">
                        {entry.forfeited ? (
                          <span className="text-[10px] font-bold text-rose-600">Sin terminar · 0 pts</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <RatingStars stars={entry.stars ?? 0} size="w-3 h-3" />
                            <span className="text-xs font-black tabular-nums text-cozy-ink">{entry.score ?? 0}</span>
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold text-emerald-700">
                          {typeof entry.timeSeconds === 'number' ? `${entry.timeSeconds.toFixed(2)}s` : '--'}
                          {typeof entry.deaths === 'number' && entry.deaths > 0 ? ` · ${entry.deaths}💀` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-stone-500 py-3">¡Carrera completada con éxito!</p>
              )}
            </div>

            <div className="w-full flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  multiplayerClient.emitAdvanceLevel();
                  onDismissRoomSummary?.();
                }}
                className={`${BTN.primary} flex items-center justify-center gap-2`}
              >
                <span>Avanzar al siguiente nivel juntos</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </button>

              <button
                type="button"
                onClick={() => {
                  onDismissRoomSummary?.();
                  handleRestart(gameMode);
                }}
                className={BTN.ghost}
              >
                Reintentar nivel
              </button>

              <button
                type="button"
                onClick={() => {
                  onDismissRoomSummary?.();
                  handleReturnToTitle();
                }}
                className="text-xs text-stone-500 hover:text-stone-800 cursor-pointer pt-1"
              >
                Salir al menú principal
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
      <DevPanel
        open={showDevPanel}
        hasAccess={devAccess}
        devOn={devOn}
        onUnlock={() => {
          setDevAccess(true);
          setDevAccessState(true);
          setDevMode(true);
          setDevOn(true);
          showToast('Modo desarrollador: todo desbloqueado', 1800, 'success');
        }}
        onLock={() => {
          setDevAccess(false);
          setDevAccessState(false);
          setDevMode(false);
          setDevOn(false);
          setShowDevPanel(false);
          const max = maxPlayableLevel();
          if (pendingLevel > max) setPendingLevel(max);
          if (engine && engine.currentLevel > max) engine.reloadLevel(max);
          showToast('Modo desarrollador bloqueado', 1600, 'neutral');
        }}
        onToggleDev={(on) => {
          setDevMode(on);
          setDevOn(on);
          if (!on) {
            // Back to your real progress
            const max = maxPlayableLevel();
            if (pendingLevel > max) setPendingLevel(max);
            if (engine && engine.currentLevel > max) engine.reloadLevel(max);
            showToast('Modo desarrollador desactivado', 1600, 'neutral');
          }
        }}
        onPlay={(pick: DevPlay) => {
          if (!isDevMode()) {
            setDevMode(true);
            setDevOn(true);
          }
          setDevLevelPick(pick.kind === 'handmade' ? null : { level: pick.level, kind: pick.kind, theme: pick.theme });
          // In a party: your friends get this same world when you enter it
          engine?.markDevPickChanged();
          setShowDevPanel(false);
          setPendingLevel(pick.level);
          engine?.reloadLevel(pick.level);
          handleStartGame(undefined, pick.level);
          showToast(`Nivel ${pick.level} · ${levelInfo(pick.level).name}`, 2000, 'neutral');
        }}
        onClose={() => setShowDevPanel(false)}
      />
    </div>
  );
};
