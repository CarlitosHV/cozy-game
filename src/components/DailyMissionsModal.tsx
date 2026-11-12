import React, { useEffect, useState } from 'react';
import {
  Check,
  Clock,
  Compass,
  Gift,
  Lock,
  Mountain,
  Palette,
  Sparkles,
  X,
} from 'lucide-react';
import { CharacterAppearance } from '../game/character';
import {
  SHIRT_PATTERNS,
  ShirtPatternId,
  getPatternDef,
  getPatternSwatchUrl,
} from '../game/patterns';
import {
  DailyMission,
  DailyMissionsSnapshot,
  claimDailyMissionReward,
  formatResetCountdown,
  getDailyMissionsState,
  getMsUntilNextDailyReset,
  isPatternUnlocked,
  subscribeDailyMissions,
} from '../game/dailyMissions';
import { THEME_INFO } from '../game/progress';

interface DailyMissionsModalProps {
  open: boolean;
  appearance: CharacterAppearance;
  onEquipPattern: (pattern: ShirtPatternId) => void;
  onClaimFeedback?: (message: string) => void;
  onClose: () => void;
}

type ModalTab = 'missions' | 'patterns';

export const DailyMissionsModal: React.FC<DailyMissionsModalProps> = ({
  open,
  appearance,
  onEquipPattern,
  onClaimFeedback,
  onClose,
}) => {
  const [tab, setTab] = useState<ModalTab>('missions');
  const [snapshot, setSnapshot] = useState<DailyMissionsSnapshot>(() => getDailyMissionsState());
  const [resetMs, setResetMs] = useState<number>(() => getMsUntilNextDailyReset());
  const [justClaimedId, setJustClaimedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSnapshot(getDailyMissionsState());
    setResetMs(getMsUntilNextDailyReset());

    const unsub = subscribeDailyMissions(() => {
      setSnapshot(getDailyMissionsState());
    });

    const interval = window.setInterval(() => {
      setResetMs(getMsUntilNextDailyReset());
      // Refresh if local midnight just ticked over
      const fresh = getDailyMissionsState();
      setSnapshot((prev) => (prev.dateKey !== fresh.dateKey ? fresh : prev));
    }, 1000);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);

    return () => {
      unsub();
      window.clearInterval(interval);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const baseColor = appearance.sweaterColor;
  const detailColor = appearance.detailColor;
  const equippedPattern = appearance.shirtPattern ?? 'liso';

  const unlockableTotal = SHIRT_PATTERNS.filter((p) => !p.defaultUnlocked).length;
  const unlockedCount = SHIRT_PATTERNS.filter(
    (p) => !p.defaultUnlocked && isPatternUnlocked(p.id)
  ).length;

  const handleClaim = (mission: DailyMission) => {
    const res = claimDailyMissionReward(mission.id);
    if (!res) return;
    setJustClaimedId(mission.id);
    onEquipPattern(res.pattern);
    onClaimFeedback?.(
      res.newlyUnlocked
        ? `¡Desbloqueaste y equipaste el patrón "${res.name}"!`
        : `¡Recompensa reclamada! Equipaste "${res.name}"`
    );
  };

  const categoryIcon = (m: DailyMission) => {
    if (m.category === 'parkour') return <Mountain className="w-4 h-4 text-cozy-accent-deep shrink-0" />;
    if (m.category === 'biome') return <Compass className="w-4 h-4 text-cozy-sky shrink-0" />;
    return <Sparkles className="w-4 h-4 text-cozy-moss shrink-0" />;
  };

  const categoryLabel = (m: DailyMission) => {
    if (m.category === 'parkour') return 'Desafío Parkour';
    if (m.category === 'biome' && m.targetBiome) return THEME_INFO[m.targetBiome].name;
    return 'Recolección';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 cozy-scrim pointer-events-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-missions-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[88dvh] rounded-[1.75rem] cozy-panel flex flex-col overflow-hidden text-cozy-ink shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-cozy-line">
          <div className="min-w-0">
            <h2
              id="daily-missions-title"
              className="text-xl font-display font-bold text-cozy-ink leading-tight"
            >
              Misiones diarias
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cozy-muted">
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-cozy-sky" />
                Renovación en {formatResetCountdown(resetMs)}
              </span>
              <span className="tabular-nums font-semibold text-cozy-accent-deep">
                {unlockedCount}/{unlockableTotal} patrones desbloqueados
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar misiones diarias"
            className="p-2 rounded-xl cozy-btn text-cozy-muted hover:text-cozy-ink cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 px-5 pt-3 pb-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'missions'}
            onClick={() => setTab('missions')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              tab === 'missions'
                ? 'cozy-tab-active'
                : 'bg-cozy-panel-deep text-cozy-muted hover:text-cozy-ink border border-cozy-line'
            }`}
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Misiones de hoy</span>
            {snapshot.claimableCount > 0 && (
              <span className="ml-0.5 text-[11px] font-black tabular-nums">
                ({snapshot.claimableCount})
              </span>
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'patterns'}
            onClick={() => setTab('patterns')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              tab === 'patterns'
                ? 'cozy-tab-active'
                : 'bg-cozy-panel-deep text-cozy-muted hover:text-cozy-ink border border-cozy-line'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Catálogo de patrones</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3 overscroll-contain">
          {tab === 'missions' && (
            <>
              <p className="text-xs text-cozy-muted leading-relaxed">
                Supera desafíos de parkour y reúne reliquias u objetos en distintos biomas para desbloquear patrones exclusivos para tu ropa.
              </p>

              {snapshot.missions.map((mission) => {
                const patternDef = getPatternDef(mission.rewardPattern);
                const swatchUrl = getPatternSwatchUrl(
                  mission.rewardPattern,
                  baseColor,
                  detailColor
                );
                const pct = Math.min(100, Math.round((mission.progress / Math.max(1, mission.target)) * 100));
                const patternAlreadyOwned = isPatternUnlocked(mission.rewardPattern);
                const isEquipped = equippedPattern === mission.rewardPattern;

                return (
                  <div
                    key={mission.id}
                    className={`rounded-2xl border p-3.5 flex flex-col gap-3 transition-colors ${
                      mission.completed && !mission.claimed
                        ? 'bg-[#fff3e0] border-cozy-accent'
                        : 'bg-cozy-panel-deep/70 border-cozy-line'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5">{categoryIcon(mission)}</div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-cozy-accent-deep">
                            {categoryLabel(mission)}
                          </div>
                          <h3 className="text-sm font-bold text-cozy-ink leading-snug">
                            {mission.title}
                          </h3>
                          <p className="text-xs text-cozy-muted leading-snug mt-0.5">
                            {mission.desc}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-cozy-ink tabular-nums">
                          {mission.progress}/{mission.target}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          mission.completed ? 'bg-cozy-moss' : 'bg-cozy-accent'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Reward footer */}
                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-lg overflow-hidden border border-black/15 shrink-0">
                          {swatchUrl ? (
                            <img
                              src={swatchUrl}
                              alt={patternDef.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full" style={{ backgroundColor: baseColor }} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-cozy-muted">
                            {patternAlreadyOwned && !mission.claimed ? 'Patrón destacado' : 'Recompensa'}
                          </div>
                          <div className="text-xs font-bold text-cozy-ink truncate">
                            {patternDef.name}
                          </div>
                        </div>
                      </div>

                      {mission.completed && !mission.claimed ? (
                        <button
                          type="button"
                          onClick={() => handleClaim(mission)}
                          className="px-3.5 py-2 rounded-xl cozy-btn-primary text-xs font-bold cursor-pointer active:scale-95 shrink-0"
                        >
                          Reclamar y equipar
                        </button>
                      ) : mission.claimed ? (
                        isEquipped ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-cozy-moss shrink-0">
                            <Check className="w-3.5 h-3.5" />
                            {justClaimedId === mission.id ? 'Desbloqueado y equipado' : 'Equipado'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onEquipPattern(mission.rewardPattern)}
                            className="px-3 py-1.5 rounded-xl cozy-btn text-xs font-semibold text-cozy-ink cursor-pointer active:scale-95 shrink-0"
                          >
                            Equipar
                          </button>
                        )
                      ) : (
                        <span className="text-xs font-medium text-cozy-muted shrink-0">
                          En progreso
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {tab === 'patterns' && (
            <>
              <p className="text-xs text-cozy-muted leading-relaxed">
                Cada patrón se adapta dinámicamente a los colores elegidos para tu personaje. Toca cualquiera que hayas desbloqueado para equiparlo al instante.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pb-1">
                {SHIRT_PATTERNS.map((p) => {
                  const unlocked = isPatternUnlocked(p.id);
                  const equipped = equippedPattern === p.id;
                  const swatchUrl = getPatternSwatchUrl(p.id, baseColor, detailColor);

                  if (!unlocked) {
                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-dashed border-cozy-line bg-cozy-panel-deep/60 p-2.5 flex flex-col items-center text-center gap-2 opacity-80"
                        aria-disabled="true"
                      >
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-cozy-line">
                          {swatchUrl ? (
                            <img
                              src={swatchUrl}
                              alt={p.name}
                              className="w-full h-full object-cover grayscale opacity-55"
                            />
                          ) : (
                            <div className="w-full h-full" style={{ backgroundColor: baseColor }} />
                          )}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
                            <Lock className="w-4 h-4" />
                          </span>
                        </div>
                        <div className="min-w-0 w-full">
                          <div className="text-xs font-bold text-cozy-muted truncate">{p.name}</div>
                          <div className="text-[10px] text-cozy-accent-deep/90 mt-0.5">
                            Misión diaria · {p.biomeHint}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onEquipPattern(p.id)}
                      title={p.desc}
                      className={`rounded-2xl border p-2.5 flex flex-col items-center text-center gap-2 cursor-pointer transition-all active:scale-95 ${
                        equipped
                          ? 'bg-[#fff1de] border-cozy-accent ring-1 ring-cozy-accent/40'
                          : 'cozy-panel-soft hover:border-cozy-sky'
                      }`}
                    >
                      <div className="w-14 h-14 rounded-xl overflow-hidden border border-black/15">
                        {swatchUrl ? (
                          <img src={swatchUrl} alt={p.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full" style={{ backgroundColor: baseColor }} />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        <div className="text-xs font-bold text-cozy-ink truncate">{p.name}</div>
                        <div className="text-[10px] font-semibold mt-0.5 text-cozy-muted">
                          {equipped ? 'Equipado' : p.biomeHint}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
