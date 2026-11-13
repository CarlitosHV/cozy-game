import React, { useEffect, useState } from 'react';
import {
  Bug,
  Check,
  ChevronRight,
  Clock,
  Gamepad2,
  Gem,
  Gift,
  HelpCircle,
  Lock,
  Maximize,
  Minimize,
  Play,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { GameEngine, GameMode } from '../game/GameEngine';
import { BodyType, CharacterAppearance } from '../game/character';
import {
  getDevLevelPick,
  isLevelCompleted,
  isLevelUnlocked,
  levelInfo,
  maxPlayableLevel,
  setDevLevelPick,
} from '../game/progress';
import {
  claimDailyMissionReward,
  DailyMissionsSnapshot,
  formatResetCountdown,
  getDailyMissionsState,
  getMsUntilNextDailyReset,
  subscribeDailyMissions,
} from '../game/dailyMissions';
import { ShirtPatternId } from '../game/patterns';
import { apiClient, User } from '../services/apiClient';
import { CharacterCreator } from './CharacterCreator';
import { DailyMissionsModal } from './DailyMissionsModal';
import { LobbyShop } from './LobbyShop';
import { EmptyState } from './HelpTip';
import { UI } from '../ui/labels';

export type LobbyTab = 'play' | 'character' | 'shop' | 'missions';

interface ApexLobbyProps {
  engine: GameEngine | null;
  appearance: CharacterAppearance;
  currentUser: User | null;
  pendingLevel: number;
  pendingMode: GameMode;
  portrait: boolean;
  isFullscreen?: boolean;
  toggleFullscreen?: () => void | Promise<boolean>;
  partyMembers: string[];
  rejoinSession: { roomId: string; levelId: number } | null;
  claimableMissions: number;
  devOn: boolean;
  onPendingLevelChange: (lvl: number) => void;
  onPendingModeChange: (mode: GameMode) => void;
  onStartGame: (mode: GameMode, level: number) => void;
  onAppearanceChange: (next: CharacterAppearance, syncServer?: boolean) => void;
  onSwitchBody: (body: BodyType) => void;
  onEquipPattern: (pattern: ShirtPatternId) => void;
  onOpenAuth: () => void;
  onOpenParty: () => void;
  onOpenLeaderboard: (levelId: number) => void;
  onOpenHelp: () => void;
  onOpenSettings: () => void;
  onOpenDevPanel: () => void;
  onRejoinSession: (roomId: string, levelId: number) => void;
  onDismissRejoin: () => void;
  onToast: (msg: string, ms?: number, tone?: 'neutral' | 'success' | 'error') => void;
}

const MODE_LABELS: Record<GameMode, { name: string; desc: string; icon: React.ReactNode }> = {
  free: {
    name: 'Modo Libre',
    desc: 'Explora sin reloj ni persecución',
    icon: <Sparkles className="w-3.5 h-3.5 text-cozy-accent-deep" />,
  },
  time_trial: {
    name: 'Contrarreloj',
    desc: 'Supera el nivel antes de que acabe el reloj',
    icon: <Clock className="w-3.5 h-3.5 text-sky-600" />,
  },
  chase: {
    name: 'Persecución',
    desc: 'Escapa del Acechador Sombrío hasta la cima',
    icon: <Timer className="w-3.5 h-3.5 text-rose-600" />,
  },
};

export const ApexLobby: React.FC<ApexLobbyProps> = ({
  engine,
  appearance,
  currentUser,
  pendingLevel,
  pendingMode,
  portrait,
  isFullscreen = false,
  toggleFullscreen,
  partyMembers,
  rejoinSession,
  claimableMissions,
  devOn,
  onPendingLevelChange,
  onPendingModeChange,
  onStartGame,
  onAppearanceChange,
  onSwitchBody,
  onEquipPattern,
  onOpenAuth,
  onOpenParty,
  onOpenLeaderboard,
  onOpenHelp,
  onOpenSettings,
  onOpenDevPanel,
  onRejoinSession,
  onDismissRejoin,
  onToast,
}) => {
  const [activeTab, setActiveTab] = useState<LobbyTab>('play');
  const [showModePicker, setShowModePicker] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [relicsBalance, setRelicsBalance] = useState<number>(0);
  const [levelSearch, setLevelSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [missionsSnapshot, setMissionsSnapshot] = useState<DailyMissionsSnapshot>(() =>
    getDailyMissionsState()
  );
  const [resetMs, setResetMs] = useState<number>(() => getMsUntilNextDailyReset());
  const [creatorSnapshot, setCreatorSnapshot] = useState<CharacterAppearance | null>(null);

  // Sync lobby camera framing with the active Lobby Tab
  useEffect(() => {
    if (!engine) return;
    if (activeTab === 'play') {
      engine.setTempPreviewAppearance(null);
      engine.setLobbyCameraMode('lobby_center');
    } else if (activeTab === 'shop') {
      engine.setLobbyCameraMode('lobby_shop');
    } else if (activeTab === 'character') {
      engine.setTempPreviewAppearance(null);
      engine.setLobbyCameraMode('creator');
    } else {
      engine.setTempPreviewAppearance(null);
      engine.setLobbyCameraMode('orbit');
    }
  }, [engine, activeTab]);

  // Fetch initial Relics balance from shop catalog / inventory when user signs in
  useEffect(() => {
    let cancelled = false;
    const syncBalance = async () => {
      try {
        const cat = await apiClient.getShopCatalog();
        if (!cancelled && typeof cat.relicsBalance === 'number') {
          setRelicsBalance(cat.relicsBalance);
        }
      } catch {
        // ignore silent background sync failure
      }
    };
    void syncBalance();
    return () => {
      cancelled = true;
    };
  }, [currentUser?._id]);

  // Subscribe to Daily Missions & midnight countdown
  useEffect(() => {
    setMissionsSnapshot(getDailyMissionsState());
    const unsub = subscribeDailyMissions(() => {
      setMissionsSnapshot(getDailyMissionsState());
    });
    const timer = window.setInterval(() => {
      setResetMs(getMsUntilNextDailyReset());
    }, 1000);
    return () => {
      unsub();
      window.clearInterval(timer);
    };
  }, []);

  const switchTab = (next: LobbyTab) => {
    if (next === 'character' && activeTab !== 'character') {
      setCreatorSnapshot({ ...appearance });
    }
    setShowModePicker(false);
    setActiveTab(next);
  };

  const handleCloseCreator = () => {
    setCreatorSnapshot(null);
    setActiveTab('play');
    if (apiClient.isAuthenticated()) {
      apiClient
        .updateAppearance(appearance)
        .then(() => onToast('Aspecto guardado', 2000, 'success'))
        .catch(() => {});
    }
  };

  const handleCancelCreator = () => {
    if (creatorSnapshot) {
      onAppearanceChange(creatorSnapshot, false);
    }
    setCreatorSnapshot(null);
    setActiveTab('play');
  };

  const currentLevelData = levelInfo(pendingLevel);
  const modeInfo = MODE_LABELS[pendingMode];
  const playerLevelNum = maxPlayableLevel();
  const displayName = appearance.name || currentUser?.displayName || currentUser?.username || 'Viajero';
  const totalLevelsToShow = Math.max(5, maxPlayableLevel());

  const filteredLevels = Array.from({ length: totalLevelsToShow }, (_, i) => i + 1)
    .filter((lvl) => {
      const done = isLevelCompleted(lvl);
      if (levelFilter === 'done') return done;
      if (levelFilter === 'todo') return !done;
      return true;
    })
    .filter((lvl) => {
      const q = levelSearch.trim().toLowerCase();
      if (!q) return true;
      const inf = levelInfo(lvl);
      return (
        `nivel ${lvl}`.includes(q) ||
        String(lvl) === q ||
        inf.name.toLowerCase().includes(q) ||
        inf.desc.toLowerCase().includes(q)
      );
    });

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between font-ui text-cozy-ink select-none">
      {/* ================================================================ */}
      {/* TOP NAVIGATION BAR (White Translucent Frosted Glass)             */}
      {/* ================================================================ */}
      <header className="relative z-40 h-14 px-3 sm:px-6 bg-white/76 backdrop-blur-xl border-b border-white/75 flex items-center justify-between gap-2 pointer-events-auto shadow-[0_6px_24px_rgba(30,48,64,0.08)]">
        {/* Left: Emblem & Current World */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-cozy-accent/90 border border-white/75 flex items-center justify-center shadow-sm shrink-0">
            <Sparkles className="w-4 h-4 text-cozy-accent-ink" />
          </div>
          <div className="hidden sm:block min-w-0">
            <div className="font-display font-bold text-sm leading-none tracking-wide text-cozy-ink">
              COZY LEAP
            </div>
            <div className="text-[10px] text-cozy-muted truncate mt-0.5 font-medium">
              Nivel {pendingLevel} · {currentLevelData.name}
            </div>
          </div>
        </div>

        {/* Center: Main Lobby Tabs (JUGAR | PERSONAJE | TIENDA | MISIONES) */}
        <nav className="flex items-center gap-1 sm:gap-1.5 py-1.5" role="tablist" aria-label="Menú del lobby">
          {(
            [
              { id: 'play', label: 'JUGAR' },
              { id: 'character', label: 'PERSONAJE' },
              { id: 'shop', label: 'TIENDA' },
              { id: 'missions', label: 'MISIONES' },
            ] as const
          ).map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchTab(t.id)}
                className={`relative px-2.5 sm:px-4 h-9 rounded-xl flex items-center justify-center gap-1.5 text-[11px] sm:text-xs font-extrabold tracking-wider uppercase cursor-pointer transition-all ${
                  active
                    ? 'bg-white/95 text-cozy-ink border border-cozy-line shadow-sm'
                    : 'text-cozy-muted hover:text-cozy-ink hover:bg-white/55 border border-transparent'
                }`}
              >
                <span>{t.label}</span>
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0.5 inset-x-3 h-0.5 rounded-full bg-cozy-accent-deep"
                  />
                )}
                {t.id === 'missions' && claimableMissions > 0 && (
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center tabular-nums ${
                      active
                        ? 'bg-cozy-accent text-cozy-accent-ink'
                        : 'bg-cozy-accent/90 text-cozy-accent-ink'
                    }`}
                  >
                    {claimableMissions}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Relics Currency + User Account + Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => switchTab('shop')}
            title="Ir a la Tienda de Reliquias"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/75 hover:bg-white/95 border border-cozy-line text-amber-800 cursor-pointer transition-colors shadow-xs"
          >
            <Gem className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-xs font-black tabular-nums">{relicsBalance}</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowUserMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={showUserMenu}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/75 hover:bg-white/95 border border-cozy-line text-xs font-semibold text-cozy-ink cursor-pointer transition-colors shadow-xs"
            >
              <UserRound className="w-3.5 h-3.5 text-cozy-accent-deep shrink-0" />
              <span className="max-w-[90px] sm:max-w-[130px] truncate">
                {currentUser ? currentUser.displayName || currentUser.username : UI.enter}
              </span>
              {devOn && (
                <span className="px-1 py-px rounded cozy-badge text-[9px] font-bold leading-none">
                  DEV
                </span>
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
                  className="absolute right-0 top-full mt-2 z-50 w-52 rounded-2xl cozy-panel p-1.5 flex flex-col text-left"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenAuth();
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-cozy-ink hover:bg-white/80 cursor-pointer"
                  >
                    <UserRound className="w-4 h-4 text-cozy-accent-deep" />
                    {currentUser ? 'Mi cuenta y amigos' : 'Iniciar sesión / Registro'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenDevPanel();
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-cozy-ink hover:bg-white/80 cursor-pointer"
                  >
                    <Bug className="w-4 h-4 text-sky-600" />
                    Modo desarrollador
                  </button>
                </div>
              </>
            )}
          </div>

          {toggleFullscreen && (
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              title={isFullscreen ? UI.exitFullscreen : UI.fullscreen}
              aria-label={isFullscreen ? UI.exitFullscreen : UI.fullscreen}
              className="p-2 rounded-xl bg-white/75 hover:bg-white/95 border border-cozy-line text-cozy-ink cursor-pointer transition-colors hidden sm:flex shadow-xs"
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </header>

      {/* ================================================================ */}
      {/* TAB 1: JUGAR (OPEN 3D HERO LOBBY)                                 */}
      {/* ================================================================ */}
      {activeTab === 'play' && (
        <div className="relative flex-1 flex flex-col justify-between p-3 sm:p-6 pointer-events-none overflow-hidden">
          {/* Center Top Over Hero Character: Rank Badge + Name */}
          <div className="flex flex-col items-center mt-2 sm:mt-4 pointer-events-auto">
            <div className="flex items-center gap-2.5 bg-white/78 backdrop-blur-xl border border-white/80 px-3.5 py-1.5 rounded-2xl shadow-lg text-cozy-ink">
              <div className="w-7 h-7 rounded-lg bg-cozy-moss-soft border border-cozy-moss/35 flex items-center justify-center font-black text-xs text-[#26593f] tabular-nums">
                {playerLevelNum}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-cozy-ink leading-tight">
                  {displayName}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-cozy-muted">
                  <button
                    type="button"
                    onClick={() => switchTab('character')}
                    className="hover:text-cozy-accent-deep font-semibold cursor-pointer transition-colors"
                  >
                    Personalizar
                  </button>
                  <span className="opacity-40">·</span>
                  <button
                    type="button"
                    onClick={() => onSwitchBody(appearance.bodyType === 'chico' ? 'chica' : 'chico')}
                    className="hover:text-cozy-accent-deep font-semibold cursor-pointer transition-colors"
                  >
                    {appearance.bodyType === 'chico' ? 'Chico' : 'Chica'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Flanking Squad Invite `+` Slots (Apex layout in white frosted glass) */}
          <div className="hidden md:flex items-center justify-between w-full max-w-4xl mx-auto px-4 pointer-events-none">
            {[0, 1].map((slotIdx) => {
              const memberName = partyMembers[slotIdx];
              return (
                <button
                  key={slotIdx}
                  type="button"
                  onClick={onOpenParty}
                  title={memberName ? `En sala: ${memberName}` : 'Invitar amigos / Sala multijugador'}
                  className="pointer-events-auto group flex flex-col items-center gap-2 cursor-pointer"
                >
                  <div
                    className={`w-12 h-12 rotate-45 flex items-center justify-center rounded-xl border transition-all backdrop-blur-xl shadow-lg ${
                      memberName
                        ? 'bg-cozy-moss-soft/90 border-cozy-moss/50 text-[#26593f]'
                        : 'bg-white/75 border-white/85 text-cozy-ink group-hover:bg-white/95 group-hover:scale-105'
                    }`}
                  >
                    {memberName ? (
                      <Users className="w-5 h-5 -rotate-45" />
                    ) : (
                      <Plus className="w-6 h-6 -rotate-45" />
                    )}
                  </div>
                  <span className="text-[11px] font-semibold text-cozy-ink bg-white/78 border border-white/75 px-2.5 py-0.5 rounded-lg backdrop-blur-md shadow-xs">
                    {memberName || 'Invitar amigo'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Side: Compact Daily Missions Card */}
          {!portrait && (
            <aside className="hidden lg:flex flex-col w-72 absolute right-5 top-6 pointer-events-auto bg-white/78 backdrop-blur-xl border border-white/75 rounded-2xl overflow-hidden shadow-xl text-cozy-ink">
              <div className="px-3.5 py-2.5 bg-white/45 border-b border-cozy-line flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4 text-cozy-accent-deep" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-cozy-ink">
                    Misiones diarias
                  </span>
                </div>
                <span className="text-[10px] font-mono text-cozy-muted tabular-nums">
                  {formatResetCountdown(resetMs)}
                </span>
              </div>

              <div className="p-3 flex flex-col gap-2.5">
                {missionsSnapshot.missions.slice(0, 4).map((m) => {
                  const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.target)) * 100));
                  const canClaim = m.completed && !m.claimed;
                  return (
                    <div key={m.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-cozy-ink truncate">{m.title}</span>
                        {canClaim ? (
                          <button
                            type="button"
                            onClick={() => {
                              const res = claimDailyMissionReward(m.id);
                              if (res) {
                                onEquipPattern(res.pattern);
                                onToast(`¡Patrón "${res.name}" desbloqueado y equipado!`, 3000, 'success');
                              }
                            }}
                            className="px-2 py-0.5 rounded-lg cozy-btn-primary text-[10px] font-bold cursor-pointer shrink-0"
                          >
                            Reclamar
                          </button>
                        ) : m.claimed ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#26593f] shrink-0">
                            <Check className="w-3 h-3" />
                            Lista
                          </span>
                        ) : (
                          <span className="text-[10px] text-cozy-muted tabular-nums shrink-0">
                            {m.progress}/{m.target}
                          </span>
                        )}
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-stone-900/10 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            m.completed ? 'bg-cozy-moss' : 'bg-cozy-accent-deep'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => switchTab('missions')}
                className="px-3.5 py-2 border-t border-cozy-line bg-white/40 hover:bg-white/80 text-[11px] font-bold uppercase tracking-wider text-cozy-accent-deep flex items-center justify-between cursor-pointer transition-colors"
              >
                <span>Ver todas las misiones</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </aside>
          )}

          {/* Bottom Row: Bottom-Left Mode/Level Selector + Play CTA | Bottom-Right Utility Dock */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 w-full">
            {/* Bottom-Left Mode Selector & READY/JUGAR CTA */}
            <div className="flex flex-col gap-2 w-full sm:w-[300px] pointer-events-auto">
              {rejoinSession && (
                <div className="p-2.5 rounded-2xl bg-white/82 backdrop-blur-xl border border-amber-400/50 text-cozy-ink flex items-center justify-between gap-2 shadow-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-4 h-4 text-cozy-accent-deep shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold truncate">Sala multijugador activa</p>
                      <p className="text-[10px] text-cozy-muted truncate">Nivel {rejoinSession.levelId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRejoinSession(rejoinSession.roomId, rejoinSession.levelId)}
                      className="px-2.5 py-1 rounded-lg cozy-btn-primary font-bold text-[11px] cursor-pointer"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      onClick={onDismissRejoin}
                      className="p-1 text-cozy-muted hover:text-cozy-ink cursor-pointer"
                      aria-label="Cerrar aviso de sala"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Mode & Level Selector Card */}
              <button
                type="button"
                onClick={() => setShowModePicker(true)}
                className="group relative w-full text-left rounded-2xl overflow-hidden bg-white/80 hover:bg-white/95 backdrop-blur-xl border border-white/80 transition-all shadow-xl cursor-pointer text-cozy-ink"
              >
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: currentLevelData.accent }}
                />
                <div className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cozy-muted">
                      {modeInfo.icon}
                      <span>{modeInfo.name}</span>
                    </div>
                    <div className="text-base font-display font-bold text-cozy-ink truncate mt-0.5">
                      Nivel {pendingLevel} · {currentLevelData.name}
                    </div>
                    <div className="text-[11px] text-cozy-muted truncate">
                      Toca para cambiar modo o mundo
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white/75 group-hover:bg-white border border-cozy-line flex items-center justify-center shrink-0">
                    <SlidersHorizontal className="w-4 h-4 text-cozy-ink" />
                  </div>
                </div>
              </button>

              {/* Primary JUGAR / READY Button (Pause-menu consistent translucent / warm cozy primary) */}
              <button
                type="button"
                onClick={() => onStartGame(pendingMode, pendingLevel)}
                className="w-full py-3.5 px-6 rounded-2xl cozy-btn-primary active:scale-[0.99] font-display font-bold text-lg tracking-wider uppercase flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>{maxPlayableLevel() > 1 ? 'LISTO · JUGAR' : 'JUGAR'}</span>
              </button>
            </div>

            {/* Bottom Center Subtle Drag Hint (desktop only) */}
            <div className="hidden xl:block text-[11px] text-cozy-ink bg-white/74 border border-white/70 px-3 py-1 rounded-xl backdrop-blur-md shadow-xs">
              Arrastra para girar al personaje · Rueda para acercar
            </div>

            {/* Bottom-Right Utility Icon Dock */}
            <div className="flex items-center justify-end gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={() => onOpenLeaderboard(pendingLevel)}
                title={UI.rankingShort}
                aria-label={UI.rankingShort}
                className="h-11 px-3 rounded-xl bg-white/78 hover:bg-white/95 backdrop-blur-xl border border-white/75 text-cozy-ink flex items-center gap-1.5 text-xs font-bold shadow-lg cursor-pointer transition-colors"
              >
                <Trophy className="w-4 h-4 text-cozy-accent-deep" />
                <span className="hidden sm:inline">Ranking</span>
              </button>

              <button
                type="button"
                onClick={onOpenParty}
                title="Sala multijugador e invitaciones"
                aria-label="Sala multijugador"
                className="h-11 px-3 rounded-xl bg-white/78 hover:bg-white/95 backdrop-blur-xl border border-white/75 text-cozy-ink flex items-center gap-1.5 text-xs font-bold shadow-lg cursor-pointer transition-colors"
              >
                <Users className="w-4 h-4 text-cozy-moss" />
                <span className="tabular-nums">{partyMembers.length > 0 ? partyMembers.length + 1 : 'Sala'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenHelp}
                title={UI.helpShort}
                aria-label={UI.helpShort}
                className="w-11 h-11 rounded-xl bg-white/78 hover:bg-white/95 backdrop-blur-xl border border-white/75 text-cozy-ink flex items-center justify-center shadow-lg cursor-pointer transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                title="Ajustes"
                aria-label="Ajustes"
                className="w-11 h-11 rounded-xl bg-white/78 hover:bg-white/95 backdrop-blur-xl border border-white/75 text-cozy-ink flex items-center justify-center shadow-lg cursor-pointer transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB 2: PERSONAJE                                                 */}
      {/* ================================================================ */}
      {activeTab === 'character' && (
        <CharacterCreator
          appearance={appearance}
          onChange={(next) => onAppearanceChange(next, false)}
          onSwitchBody={onSwitchBody}
          onClose={handleCloseCreator}
          onCancel={handleCancelCreator}
          portrait={portrait}
          onFocusChange={(focus) => engine?.setCharacterPreviewFocus(focus)}
          onZoom={(delta) => engine?.adjustCharacterPreviewZoom(delta)}
          embeddedInLobby
        />
      )}

      {/* ================================================================ */}
      {/* TAB 3: TIENDA                                                    */}
      {/* ================================================================ */}
      {activeTab === 'shop' && (
        <LobbyShop
          appearance={appearance}
          currentUser={currentUser}
          relicsBalance={relicsBalance}
          portrait={portrait}
          onRelicsBalanceChange={setRelicsBalance}
          onApplyAppearance={(next, syncServer) => onAppearanceChange(next, syncServer)}
          onTempPreview={(temp) => engine?.setTempPreviewAppearance(temp)}
          onZoom={(delta) => engine?.adjustCharacterPreviewZoom(delta)}
          onOpenAuth={onOpenAuth}
          onToast={onToast}
        />
      )}

      {/* ================================================================ */}
      {/* TAB 4: MISIONES                                                  */}
      {/* ================================================================ */}
      {activeTab === 'missions' && (
        <DailyMissionsModal
          open
          appearance={appearance}
          onEquipPattern={onEquipPattern}
          onClaimFeedback={(msg) => onToast(msg, 3200, 'success')}
          onClose={() => switchTab('play')}
          embeddedInLobby
        />
      )}

      {/* ================================================================ */}
      {/* MODE & LEVEL PICKER DRAWER / MODAL                               */}
      {/* ================================================================ */}
      {showModePicker && (
        <div
          className="fixed inset-0 z-50 cozy-scrim flex items-center justify-center p-4 pointer-events-auto animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModePicker(false);
          }}
        >
          <div className="w-full max-w-2xl max-h-[88dvh] rounded-3xl cozy-panel flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-cozy-line flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Gamepad2 className="w-5 h-5 text-cozy-accent-deep" />
                <div>
                  <h2 className="font-display font-bold text-lg text-cozy-ink leading-tight">
                    Elegir modo y nivel
                  </h2>
                  <p className="text-xs text-cozy-muted">
                    El fondo del lobby cambia según el mundo seleccionado.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModePicker(false)}
                aria-label="Cerrar selector"
                className="p-2 rounded-xl cozy-btn cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-5 overscroll-contain">
              {/* Game Mode Selector */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-cozy-muted mb-2">
                  Modo de juego
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['free', 'time_trial', 'chase'] as GameMode[]).map((m) => {
                    const info = MODE_LABELS[m];
                    const selected = pendingMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onPendingModeChange(m)}
                        className={`p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                          selected
                            ? 'bg-amber-50/90 border-cozy-accent-deep text-cozy-ink shadow-xs'
                            : 'bg-white/65 border-cozy-line text-cozy-ink hover:bg-white/90'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold text-xs">
                          {info.icon}
                          <span>{info.name}</span>
                        </div>
                        <p className="text-[11px] text-cozy-muted mt-1 leading-snug">{info.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Level Search + Filter */}
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-cozy-muted">
                    Seleccionar nivel
                  </div>
                  <div className="flex items-center gap-1.5">
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
                        onClick={() => setLevelFilter(f.id)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer transition-colors ${
                          levelFilter === f.id
                            ? 'cozy-tab-active'
                            : 'bg-white/55 text-cozy-muted hover:bg-white/85 border border-cozy-line'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {maxPlayableLevel() > 4 && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-cozy-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={levelSearch}
                      onChange={(e) => setLevelSearch(e.target.value)}
                      placeholder={UI.searchLevel}
                      className="w-full pl-9 pr-3 py-2 rounded-xl cozy-input text-xs placeholder:text-cozy-soft"
                    />
                  </div>
                )}

                {filteredLevels.length === 0 ? (
                  <EmptyState
                    title="Nada por aquí"
                    body="Ningún nivel coincide con tu filtro actual."
                    actionLabel="Ver todos"
                    onAction={() => {
                      setLevelFilter('all');
                      setLevelSearch('');
                    }}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredLevels.map((lvl) => {
                      const info = levelInfo(lvl);
                      const completed = isLevelCompleted(lvl);
                      const unlocked = isLevelUnlocked(lvl);
                      const selected = pendingLevel === lvl;

                      if (!unlocked) {
                        return (
                          <div
                            key={lvl}
                            onClick={() =>
                              onToast(
                                `El nivel ${lvl} está bloqueado. Completa el nivel ${lvl - 1}.`,
                                2200,
                                'neutral'
                              )
                            }
                            className="flex items-center gap-3 p-3 rounded-2xl bg-white/40 border border-cozy-line opacity-60 cursor-not-allowed"
                          >
                            <span className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0">
                              <Lock className="w-4 h-4 text-cozy-muted" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-cozy-muted truncate">
                                Nivel {lvl} · {info.name}
                              </div>
                              <div className="text-[10px] text-cozy-soft">Bloqueado</div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            if (getDevLevelPick()) {
                              setDevLevelPick(null);
                              engine?.reloadLevel(lvl);
                            } else if (engine && engine.currentLevel !== lvl) {
                              engine.loadLevel(lvl);
                            }
                            onPendingLevelChange(lvl);
                            setShowModePicker(false);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-2xl border text-left cursor-pointer transition-all ${
                            selected
                              ? 'bg-amber-50/90 border-cozy-accent-deep text-cozy-ink shadow-xs'
                              : 'bg-white/68 border-cozy-line hover:bg-white/95 text-cozy-ink'
                          }`}
                        >
                          <span
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border border-cozy-line"
                            style={{ backgroundColor: `${info.accent}22`, color: '#3d4a52' }}
                          >
                            {lvl}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-cozy-ink truncate">{info.name}</div>
                            <div className="text-[10px] text-cozy-muted truncate">
                              {completed ? 'Completado' : info.desc}
                            </div>
                          </div>
                          {selected && <Check className="w-4 h-4 text-cozy-accent-deep shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
