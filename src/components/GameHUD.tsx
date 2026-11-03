/**
 * Game HUD & Shell: Title Screen, Low-Occlusion Status Clusters,
 * Collapsible Bottom Control Dock, Pause & Victory Modals,
 * and Ergonomic Mobile Touch Controls (360° Analog Joystick + Jump/Sprint Buttons).
 */
import React, { useState, useEffect, useRef } from 'react';
import {
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
  Users,
  Gamepad2,
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
} from '../game/progress';
import { AuthModal } from './AuthModal';
import { LeaderboardModal } from './LeaderboardModal';
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
} from '../services/multiplayerClient';
import { INVENTORY_SIZE, ITEM_INFO, InventoryStatus } from '../game/items';
import type { ItemType } from '../game/items';
import { CharacterCreator, COMPANION_ICONS } from './CharacterCreator';
import { ItemThumb } from './ItemThumb';
import { COMPANION_POWERS, CompanionPowerStatus } from '../game/companionPowers';
import {
  BodyType,
  CharacterAppearance,
  CompanionStyle,
  COMPANIONS,
  loadAppearance,
  loadRoster,
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
}

// --- 360° Analog Virtual Joystick for Mobile Devices with Auto-Sprint ---
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
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>('free');
  type TitleStep = 'main' | 'select_level' | 'game_modes' | 'select_character';
  const [titleStep, setTitleStep] = useState<TitleStep>('main');
  const [pendingLevel, setPendingLevel] = useState<number>(() => maxPlayableLevel());
  const [pendingMode, setPendingMode] = useState<GameMode>('free');
  const [previousTitleStep, setPreviousTitleStep] = useState<'main' | 'select_level' | 'game_modes'>('main');
  const [titleDraftReady, setTitleDraftReady] = useState(false);

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLevelBrief, setShowLevelBrief] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [leaderboardLevelId, setLeaderboardLevelId] = useState(1);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<InviteReceivedPayload | null>(null);
  const [levelListFilter, setLevelListFilter] = useState<'all' | 'done' | 'todo'>('all');
  const [levelSearch, setLevelSearch] = useState('');
  const [recentLevelSearches, setRecentLevelSearches] = useState<string[]>(() =>
    getRecent(RECENT_KEYS.levelSearches)
  );
  const [currentUser, setCurrentUser] = useState<User | null>(() => apiClient.getCurrentUser());
  const [lastSubmittedVictory, setLastSubmittedVictory] = useState<number | null>(null);
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
    if (gameState === 'playing' && engine.currentLevel === levelId) {
      multiplayerClient.joinLevel(levelId, roomId);
      showToast(`Sala privada · nivel ${levelId}`, 2200, 'success');
      return;
    }
    engine.startGame('free', levelId);
    multiplayerClient.joinLevel(levelId, roomId);
    showToast(`Entraste a la sala · nivel ${levelId}`, 2200, 'success');
  };

  const handleInviteToPlay = (friend: FriendUser) => {
    const levelId = engine?.currentLevel ?? pendingLevel;
    setShowAuthModal(false);
    multiplayerClient.connect();
    multiplayerClient.sendInvite(friend._id, levelId);
    showToast(
      `Invitando a ${friend.displayName || friend.username} al nivel ${levelId}…`,
      2200,
      'success'
    );
  };

  useEffect(() => {
    multiplayerClient.onInviteReceived = (data) => {
      setShowAuthModal(false);
      setIncomingInvite(data);
    };
    multiplayerClient.onInviteSent = () => {
      showToast('Invitación enviada. Esperando respuesta (60 s)…', 2800, 'success');
    };
    multiplayerClient.onInviteResult = (data) => {
      setIncomingInvite((cur) => (cur?.inviteId === data.inviteId ? null : cur));
      if (data.accepted && data.roomId) {
        enterPartyRoom(data.levelId, data.roomId);
      } else if (!data.accepted) {
        showToast('La invitación fue rechazada o caducó.', 2200);
      }
    };
    multiplayerClient.onSocketError = (err) => {
      const wrapped = new Error(err.message || '');
      (wrapped as Error & { code?: string }).code = err.code;
      showToast(friendlyError(wrapped, 'No se pudo completar la invitación.'), 2800, 'error');
    };
    multiplayerClient.onPlayerLeftNotice = (data) => {
      const name = data.displayName || data.username || 'Un jugador';
      const msg =
        data.reason === 'disconnect'
          ? `${name} se desconectó de la sala`
          : `${name} salió de la sala`;
      showToast(msg, 2600, 'neutral');
    };
    return () => {
      multiplayerClient.onInviteReceived = undefined;
      multiplayerClient.onInviteSent = undefined;
      multiplayerClient.onInviteResult = undefined;
      multiplayerClient.onSocketError = undefined;
      multiplayerClient.onPlayerLeftNotice = undefined;
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
  const powerInfo = power ? COMPANION_POWERS[power.companion] : undefined;

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

  // Submit level completion when logged in, with loading / success / error feedback
  useEffect(() => {
    if (gameState === 'victory' && engine && lastSubmittedVictory !== engine.currentLevel) {
      setLastSubmittedVictory(engine.currentLevel);
      if (apiClient.isAuthenticated()) {
        void saveProgressAction.run(
          async () => {
            const res = await apiClient.completeLevel({
              levelId: engine.currentLevel,
              timeSeconds: elapsedTime,
              relicsFound: collectedCount,
              mode: gameMode,
            });
            if (res?.progress?.maxUnlockedLevel) {
              syncProgressFromBackend(res.progress.maxUnlockedLevel - 1);
            }
            return res;
          },
          {
            successMessage: (res) =>
              (res as { isNewBest?: boolean })?.isNewBest
                ? '¡Nuevo récord personal!'
                : 'Progreso guardado',
            errorMessage: (err) =>
              friendlyError(
                err,
                'No se guardó el progreso. Puedes seguir: inténtalo otra vez al terminar.'
              ),
          }
        );
      }
    } else if (gameState === 'playing') {
      setLastSubmittedVictory(null);
      saveProgressAction.clearFeedback();
    }
  }, [gameState, engine, elapsedTime, collectedCount, gameMode, lastSubmittedVictory]);

  const handleProfileSynced = (profile: PlayerProfileData) => {
    if (profile.appearance && engine) {
      const fullAppearance = {
        ...appearance,
        ...(profile.appearance as Partial<CharacterAppearance>),
      };
      setAppearance(fullAppearance);
      engine.setPlayerAppearance(fullAppearance);
    }
    if (profile.progress?.maxUnlockedLevel) {
      syncProgressFromBackend(profile.progress.maxUnlockedLevel - 1);
      setSelectedLevel(profile.progress.maxUnlockedLevel);
    }
    if (profile.inventory?.slots && engine?.itemSystem) {
      engine.itemSystem.setSlots(profile.inventory.slots);
    }
    showToast('¡Listo! Tu cuenta está al día', 2500, 'success');
  };

  const currentHowTo = levelHowTo(engine?.currentLevel ?? pendingLevel);

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
        'KeyQ', 'KeyE', 'KeyR', 'KeyC', 'KeyG', 'KeyI', 'Escape'
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

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

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
          multiplayerClient.respondInvite(incomingInvite.inviteId, false);
          setIncomingInvite(null);
          e.preventDefault();
          return;
        }
        if (capturedPhotoUrl) {
          discardPhotoCapture();
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
        setShowBackpack((v) => !v);
        return;
      }

      if (e.code === 'KeyO' && (gameState === 'playing' || gameState === 'paused')) {
        e.preventDefault();
        setShowLevelBrief(true);
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
        handleRestart('time_trial');
        return;
      }

      if (gameState === 'game_over' && e.code === 'KeyR') {
        e.preventDefault();
        handleRestart('time_trial');
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
            setPendingMode('free');
            engine?.loadLevel(lvl);
            engine?.setCharacterPreview(true);
            setPreviousTitleStep('select_level');
            setTitleStep('select_character');
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
    const next = !isMuted;
    setIsMuted(next);
    soundManager.setMuted(next);
  };

  const handleStartGame = (modeToStart?: GameMode, levelToStart?: number) => {
    const targetMode = modeToStart ?? pendingMode;
    const targetLevel = levelToStart ?? pendingLevel;
    setTitleDraftReady(false);
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
    const targetMode = modeToRestart ?? gameMode;
    if (engine) engine.restartGame(targetMode);
  };

  const handleReturnToTitle = () => {
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
                          setLeaderboardLevelId(1);
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
                      className="hover:text-cozy-ink cursor-pointer font-semibold"
                    >
                      {currentUser
                        ? currentUser.displayName || currentUser.username
                        : UI.enter}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {titleStep === 'select_level' && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setTitleStep('main')}
                    className={BTN.back}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>{UI.back}</span>
                  </button>
                  <span className="text-sm font-bold text-cozy-ink font-display">{UI.selectLevel}</span>
                  <span className="w-10" />
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
                    const levels = Array.from({ length: maxPlayableLevel() }, (_, i) => i + 1)
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
                      return (
                        <button
                          key={lvl}
                          onClick={() => {
                            const label = `Nivel ${lvl} · ${info.name}`;
                            setRecentLevelSearches(pushRecent(RECENT_KEYS.levelSearches, label));
                            setPendingLevel(lvl);
                            setPendingMode('free');
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPendingMode('time_trial');
                        setPendingLevel(maxPlayableLevel());
                        engine?.loadLevel(maxPlayableLevel());
                        engine?.setCharacterPreview(true);
                        setPreviousTitleStep('game_modes');
                        setTitleStep('select_character');
                      }}
                      className={`${BTN.primary} flex-1 flex items-center justify-center gap-2`}
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
                        setPendingLevel(maxPlayableLevel());
                        engine?.loadLevel(maxPlayableLevel());
                        engine?.setCharacterPreview(true);
                        setPreviousTitleStep('game_modes');
                        setTitleStep('select_character');
                      }}
                      className={`${BTN.secondary} flex-1`}
                    >
                      Persecución
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
                  {orbs.total > 0 ? (
                    <>
                      Nivel {engine?.currentLevel ?? 1}
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
                  timeRemaining <= 20
                    ? 'bg-red-950/90 border-red-500/80 text-red-200 animate-pulse'
                    : 'bg-amber-950/80 border-amber-500/50 text-amber-200'
                }`}
              >
                <Clock className={`w-3.5 h-3.5 ${timeRemaining <= 20 ? 'text-red-400' : 'text-amber-400'}`} />
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Tiempo:</span>
                  <span className="font-mono font-black text-sm tracking-wide">
                    {timeRemaining > 0 ? `${timeRemaining}s` : '0s'}
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
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="tabular-nums font-semibold text-amber-300">
                  {collectedCount}/{totalCollectibles}
                </span>
              </div>
              <div className="w-[1px] h-3 bg-stone-700/60" />
              <div className="flex items-center gap-1 font-mono text-stone-300">
                <Timer className="w-3 h-3 text-stone-400" />
                <span>{formatTime(elapsedTime)}</span>
              </div>
            </div>

            {/* Companion Power badge (hidden on mobile touch — action button covers it) */}
            {power && powerInfo && !touchControlsEnabled && (
              <span className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => engine?.activateCompanionPower()}
                  title={`${powerInfo.powerName}: ${powerInfo.desc}`}
                  className={`relative overflow-hidden flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl border text-left text-xs shadow-md backdrop-blur-md transition-colors cursor-pointer ${
                    power.state === 'ready'
                      ? 'bg-stone-900/85 border-amber-400/70 hover:bg-stone-800'
                      : power.state === 'active'
                      ? 'bg-stone-900/90 border-emerald-400/70'
                      : 'bg-stone-900/80 border-stone-700'
                  }`}
                >
                  {power.state === 'active' && (
                    <span
                      className="absolute left-0 bottom-0 h-[3px] bg-emerald-400 transition-[width] duration-100"
                      style={{ width: `${Math.max(0, (power.timeLeft / power.duration) * 100)}%` }}
                    />
                  )}
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-stone-900 ${
                      power.state === 'hungry' ? 'opacity-50 grayscale' : ''
                    } ${power.state === 'active' ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: powerInfo.color }}
                  >
                    {COMPANION_ICONS[power.companion]}
                  </span>
                  <span className="flex flex-col leading-tight">
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 font-semibold">
                      {powerInfo.companionName} · {powerInfo.powerName}
                    </span>
                    <span
                      className={`font-semibold ${
                        power.state === 'ready'
                          ? 'text-amber-300'
                          : power.state === 'active'
                          ? 'text-emerald-300'
                          : 'text-stone-400'
                      }`}
                    >
                      {power.state === 'ready' && <>¡Listo!</>}
                      {power.state === 'active' && `Activo · ${Math.ceil(power.timeLeft)}s`}
                      {power.state === 'hungry' && 'Con hambre · dale una baya'}
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
                              <div className="text-xs font-semibold truncate">{info ? info.name : 'Vacío'}</div>
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
                      Recoge bayas y nueces en las islas. 1–5 usan · Mayús+1–5 tiran. Las llaves se usan solas en puertas.
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
                    title="Mochila (I)"
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
                {power && powerInfo && (
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
                      power.state === 'ready'
                        ? 'text-stone-950 border-amber-200'
                        : 'bg-stone-900/80 text-stone-400 border-stone-700/80'
                    }`}
                    style={{ touchAction: 'none', backgroundColor: power.state === 'ready' ? powerInfo.color : undefined }}
                  >
                    {COMPANION_ICONS[power.companion]}
                    <span>
                      {power.state === 'ready' && 'Poder'}
                      {power.state === 'active' && `${Math.ceil(power.timeLeft)}s`}
                      {power.state === 'hungry' && 'Hambre'}
                    </span>
                  </button>
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

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => engine?.setPaused(false)}
                className={BTN.primary}
              >
                {UI.resume}
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
              <button
                type="button"
                onClick={toggleMute}
                className="hover:text-cozy-ink cursor-pointer"
              >
                {isMuted ? UI.soundOff : UI.soundOn}
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
              <h2 className="text-2xl font-display font-bold text-cozy-ink">¡Tiempo agotado!</h2>
              <p className="text-xs text-cozy-muted inline-flex items-center justify-center gap-1 flex-wrap">
                <span>Descanso {checkpointIndex}/3</span>
                <HelpTip label={TIPS.descanso} />
                <span>· Reliquias {collectedCount}/{totalCollectibles}</span>
                <HelpTip label={TIPS.reliquias} />
              </p>
            </div>

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
                {gameMode === 'time_trial' ? <span>· {timeRemaining}s restantes</span> : null}
              </p>
            </div>

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

            <div className="w-full flex flex-col gap-3">
              {engine && isLevelUnlocked(engine.currentLevel + 1) ? (
                <button
                  type="button"
                  disabled={saveProgressAction.busy}
                  onClick={() => {
                    setElapsedTime(0);
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
      {/* 7. HELP & CONTROLS MODAL (Spanish & English Detailed)    */}
      {/* ======================================================== */}
      {showHelpModal && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-auto cozy-scrim p-4 sm:p-6 z-40">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[1.75rem] cozy-panel p-6 relative font-ui">
            <button
              onClick={() => setShowHelpModal(false)}
              className="absolute top-5 right-5 text-cozy-soft hover:text-cozy-ink cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-display font-bold text-cozy-ink mb-4 flex items-center gap-2">
              <Compass className="w-5 h-5 text-cozy-accent-deep" />
              <span>{UI.howToPlay}</span>
            </h3>

            {/* Keyboard Section */}
            <div className="mb-4">
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
                  <span className="bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">Arrastrar o Q / E</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Pantalla completa</span>
                  <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">F</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Modo foto</span>
                  <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">P</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">{UI.lastRest}</span>
                  <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">R</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Poder del compañero</span>
                  <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">G</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Usar objeto</span>
                  <span className="bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">1 a 5</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Abrir mochila</span>
                  <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">I</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Silencio</span>
                  <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">M</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Pausa</span>
                  <span className="font-mono bg-cozy-panel-deep px-2 py-0.5 rounded text-cozy-accent-deep">Esc</span>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <span className="text-[11px] text-cozy-accent-deep font-bold uppercase tracking-wider block mb-2">
                Atajos para quienes juegan mucho
              </span>
              <p className="text-[10px] text-cozy-muted mb-2 leading-relaxed">
                Opcionales: no hacen falta para empezar. Aceleran lo que ya haces a menudo.
              </p>
              <div className="space-y-2 text-xs text-cozy-ink">
                {POWER_SHORTCUTS.map((row) => (
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

            {/* Companion powers guide */}
            <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-700/40 text-[11px] text-amber-100/90 leading-relaxed mb-3">
              <strong className="text-cozy-accent-deep">Poderes de tu compañero:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {Object.values(COMPANION_POWERS).map((p) =>
                  p ? (
                    <li key={p.companion}>
                      <strong>{p.companionName} – {p.powerName}:</strong> {p.desc} ({p.duration}s)
                    </li>
                  ) : null
                )}
              </ul>
              <p className="mt-1.5">
                Después de usarlo, tu compañero queda con hambre. Dale una <strong>baya mágica</strong> desde la mochila para recargar el poder.
              </p>
            </div>

            {/* Puzzles guide (generated levels) */}
            <div className="p-3 rounded-2xl cozy-panel-soft text-[11px] leading-relaxed mb-3">
              <strong className="text-cozy-accent-deep">Mundos abiertos (desde el nivel 5):</strong>
              <p className="mt-1">
                Cada nivel es una zona para explorar libremente: colinas, mesetas, escaleras, fosos e islas en el cielo. Escondidos por la zona hay varios{' '}
                <strong>orbes</strong> (busca los rayos de luz): en torres, islas flotantes, bóvedas con llave, sobre pilares o al final de rutas fuera del mapa
                (con un <strong>portal</strong> para volver). Con todos los orbes se rompe el escudo de la <strong>fortaleza</strong> del centro: entra por la
                puerta y sube su espiral, la parte más difícil del nivel, hasta la cima.
              </p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Roca:</strong> camina contra ella para empujarla hasta el pilar alto y súbete encima para alcanzar el orbe. Si se cae, vuelve a su sitio.</li>
                <li><strong>Bóveda con candado:</strong> el orbe está encerrado; necesitas una llave. Búscala en las islas del cielo (sube con un trampolín).</li>
                <li><strong>Ladrón de llaves:</strong> si un enemigo lleva una llave sobre la cabeza, salta encima de él para quitársela.</li>
                <li><strong>Vigía:</strong> si su luz te ve, vuelves a la entrada de la zona. Escóndete tras los muros y avanza cuando mire a otro lado.</li>
              </ul>
            </div>

            {/* Game Modes Guide */}
            <div className="p-3 rounded-2xl bg-[#fff1de] border border-cozy-line text-[11px] text-cozy-ink leading-relaxed mb-3">
              <strong className="text-cozy-accent-deep inline-flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" />
                {UI.gameModes} disponibles:
              </strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>
                  <strong>Modo libre:</strong> Salta sin prisa. Sin reloj ni enemigos. El clima cambia poco a poco.
                </li>
                <li>
                  <strong>Modo contrarreloj:</strong> Empiezas con 90 segundos. Cada reliquia o bellota otorga <strong>+8 segundos</strong> y cada campana de punto de control te da <strong>+15 segundos</strong>.
                </li>
                <li>
                  <strong>Modo persecución:</strong> Un <em>Acechador Sombrío</em> aparece detrás de ti y te persigue por todo el archipiélago. Si te alcanza, te expulsará de la plataforma. ¡Mantente en movimiento!
                </li>
              </ul>
            </div>

            {/* Mobile Touch Section */}
            <div className="mb-4">
              <span className="text-[11px] text-cozy-accent-deep font-bold uppercase tracking-wider block mb-2">
                Controles en el móvil
              </span>
              <div className="space-y-2 text-xs text-cozy-ink">
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Orientación</span>
                  <span className="text-stone-200">Gira el móvil físicamente a horizontal</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Botón pantalla completa</span>
                  <span className="text-cozy-ink">Ocupa toda la pantalla</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">{UI.objective}</span>
                  <span className="text-stone-200">Al empezar y en el menú de pausa</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Palanca (abajo izquierda)</span>
                  <span className="text-cozy-ink">Mueve en cualquier dirección; al borde, corre</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Botón saltar (abajo a la derecha)</span>
                  <span className="text-stone-200">Salto y rebote</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-cozy-line">
                  <span className="text-cozy-muted">Girar y acercar</span>
                  <span className="text-cozy-ink">Un dedo gira, dos dedos acercan</span>
                </div>
              </div>
            </div>

            {/* Enhanced Object Physics & Varied Obstacles Section */}
            <div className="p-3 rounded-2xl bg-cozy-sky-soft border border-cozy-line text-[11px] text-cozy-ink leading-relaxed mb-3">
              <strong className="text-cozy-accent-deep">Obstáculos y elementos del mundo:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Hongos elásticos:</strong> Al tocarlos o rozarlos te lanzan de inmediato por los cielos con un salto vertical potente hacia las nubes.</li>
                <li><strong>Corriente de aire:</strong> Te eleva hacia las nubes para alcanzar plataformas lejanas.</li>
                <li><strong>Molinos florales giratorios:</strong> Aspas de madera suave que rotan sobre puentes; sincroniza tu paso para cruzarlos.</li>
                <li><strong>Troncos rodantes de equilibrio:</strong> Troncos cubiertos de musgo que giran sobre su eje, requiriendo paso ágil.</li>
                <li><strong>Géiseres de esporas cálidas:</strong> Calderas que erupcionan ráfagas rítmicas de vapor para impulsarte en el aire.</li>
                <li><strong>Pelotas de lana:</strong> Rebotan y empujan al chocar.</li>
                <li><strong>Plataformas quebradizas:</strong> Tiemblan bajo tu peso, cayendo tras un breve instante y regenerándose después.</li>
              </ul>
            </div>

            {/* Photo Mode Guide */}
            <div className="p-3 rounded-2xl cozy-panel-soft text-[11px] leading-relaxed mb-3">
              <strong className="text-cozy-accent-deep">Modo foto:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li><strong>Cámara libre:</strong> Acerca, aleja, sube, baja e inclina la vista a tu gusto.</li>
                <li><strong>Pausar acción:</strong> Congela el tiempo para capturar poses en el aire.</li>
                <li><strong>Filtros artísticos:</strong> Hora dorada, pastel ensueño, atardecer cálido, noche estelar, película clásica y natural.</li>
                <li><strong>Marcos:</strong> Polaroid, cine, postal y guía suave.</li>
                <li><strong>Guardar:</strong> Descarga tu foto al instante.</li>
              </ul>
            </div>

            {/* Cozy Enemies Guide */}
            <div className="p-3 rounded-2xl bg-cozy-moss-soft border border-cozy-line text-[11px] text-cozy-ink leading-relaxed mb-4">
              <strong className="text-cozy-moss">Criaturas pacíficas y desafíos:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>
                  <strong>Duendes bellota:</strong> Seres de musgo con casco de bellota. ¡Salta sobre su cabeza para impulsarte!
                </li>
                <li>
                  <strong>Nubes sopladoras:</strong> Inflan las mejillas y soplan brisas que ponen a prueba tu equilibrio.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className={BTN.primary}
              >
                {UI.understood}
              </button>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className={BTN.ghost}
              >
                {UI.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onProfileSynced={handleProfileSynced}
        inviteLevelId={engine?.currentLevel ?? pendingLevel}
        onInviteToPlay={handleInviteToPlay}
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
                  Sala privada · hasta 4 jugadores
                </p>
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  multiplayerClient.respondInvite(incomingInvite.inviteId, false);
                  setIncomingInvite(null);
                }}
                className={`flex-1 ${BTN.secondary}`}
              >
                {UI.declineRequest}
              </button>
              <button
                type="button"
                onClick={() => {
                  multiplayerClient.respondInvite(incomingInvite.inviteId, true);
                }}
                className={`flex-1 ${BTN.primary}`}
              >
                {UI.acceptRequest}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
    </div>
  );
};
