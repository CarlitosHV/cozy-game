import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Clock, X, RefreshCw, Medal, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient, LeaderboardEntry } from '../services/apiClient';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { ActionFeedbackBanner } from './ActionFeedback';
import { formatSeconds, friendlyError } from '../utils/locale';
import { UI, BTN } from '../ui/labels';
import { isTypingTarget } from '../ui/shortcuts';
import { levelInfo, maxPlayableLevel } from '../game/progress';
import { EmptyState, HelpTip, TIPS } from './HelpTip';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLevelId?: number;
  initialMode?: 'time_trial' | 'free' | 'chase';
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  initialLevelId = 1,
  initialMode = 'time_trial',
}) => {
  const sanitizeMode = (m?: string): 'time_trial' | 'chase' => (m === 'chase' ? 'chase' : 'time_trial');
  const [levelId, setLevelId] = useState<number>(initialLevelId);
  const [mode, setMode] = useState<'time_trial' | 'chase'>(sanitizeMode(initialMode));
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadAction = useAsyncAction();

  useEffect(() => {
    if (!isOpen) return;
    setLevelId(initialLevelId);
    setMode(sanitizeMode(initialMode));
  }, [isOpen, initialLevelId, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    setHasLoadedOnce(false);
    void fetchLeaderboard(false);
  }, [isOpen, levelId, mode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setLevelId((prev) => Math.max(1, prev - 1));
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        setLevelId((prev) => prev + 1);
        return;
      }
      const match = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (match) {
        e.preventDefault();
        setLevelId(parseInt(match[1], 10));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // Keep active level button visible in horizontal scroll
  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current.querySelector<HTMLElement>(`[data-level="${levelId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [levelId, isOpen]);

  const maxAvailableLevels = Math.max(12, maxPlayableLevel(), levelId + 4);
  const levelList = Array.from({ length: maxAvailableLevels }, (_, i) => i + 1);

  const fetchLeaderboard = async (manual: boolean) => {
    const result = await loadAction.run(
      async () => {
        const res = await apiClient.getLeaderboard(levelId, mode);
        return res.leaderboard || [];
      },
      {
        successMessage: manual ? 'Lista al día' : undefined,
        silentSuccess: !manual,
        errorMessage: (err) =>
          friendlyError(
            err,
            'No pudimos cargar el ranking. Revisa tu conexión y toca Actualizar.'
          ),
      }
    );

    if (result.ok) {
      setEntries(result.result);
      setHasLoadedOnce(true);
    } else {
      setHasLoadedOnce(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cozy-scrim pointer-events-auto select-none font-ui">
      <div className="relative w-full max-w-lg rounded-[1.75rem] cozy-panel p-6 max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          disabled={loadAction.busy}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-cozy-soft hover:text-cozy-ink hover:bg-cozy-panel-deep transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={UI.close}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#fff1de] border border-cozy-line flex items-center justify-center text-cozy-accent-deep">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-cozy-ink inline-flex items-center gap-1">
              {UI.leaderboard}
              <HelpTip label={TIPS.ranking} side="bottom" />
            </h2>
            <p className="text-xs text-cozy-muted">Quién llegó más rápido</p>
          </div>
        </div>

        {/* Level Selector with Stepper, Scrollable List, and Direct Level Input */}
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLevelId((prev) => Math.max(1, prev - 1))}
                disabled={levelId <= 1 || loadAction.busy}
                className="p-1.5 rounded-xl cozy-btn text-cozy-ink disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Nivel anterior (flecha izquierda)"
                aria-label="Nivel anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 bg-cozy-panel-deep px-2.5 py-1 rounded-xl border border-cozy-line">
                <span className="text-[10px] text-cozy-muted font-bold">Nivel:</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={levelId}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1) setLevelId(val);
                  }}
                  className="w-11 text-center text-xs font-bold text-cozy-ink bg-white/90 rounded-lg border border-cozy-line py-0.5 focus:outline-none focus:ring-1 focus:ring-cozy-accent"
                  title="Escribe cualquier nivel para ver sus mejores tiempos"
                />
              </div>
              <button
                type="button"
                onClick={() => setLevelId((prev) => prev + 1)}
                disabled={loadAction.busy}
                className="p-1.5 rounded-xl cozy-btn text-cozy-ink disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Nivel siguiente (flecha derecha)"
                aria-label="Nivel siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => void fetchLeaderboard(true)}
              disabled={loadAction.busy}
              className="px-2.5 py-1.5 rounded-xl cozy-btn text-cozy-accent-deep cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed flex items-center gap-1 text-[10px] font-semibold shrink-0"
              title={UI.updateList}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadAction.showLoading ? 'animate-spin' : ''}`} />
              <span>{UI.updateList}</span>
            </button>
          </div>

          <div
            ref={scrollContainerRef}
            className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none"
          >
            {levelList.map((lvl) => {
              const info = levelInfo(lvl);
              const isSelected = levelId === lvl;
              return (
                <button
                  key={lvl}
                  data-level={lvl}
                  onClick={() => setLevelId(lvl)}
                  disabled={loadAction.busy}
                  title={`Nivel ${lvl}: ${info.name}`}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed shrink-0 whitespace-nowrap ${
                    isSelected ? 'cozy-tab-active shadow-sm' : 'cozy-btn text-cozy-muted'
                  }`}
                >
                  {lvl}. {info.name.replace(/^Archipiélago /, '').replace(/^Ruta /, '').replace(/^Valle /, '').replace(/^Jefe: /, '👑 ')}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-cozy-muted mb-2 truncate">
          Viendo: Nivel {levelId} · {levelInfo(levelId).name} ·{' '}
          {mode === 'time_trial' ? 'Contrarreloj' : 'Persecución'}
        </p>

        <div className="flex items-center gap-1.5 mb-3 pb-3 border-b border-cozy-line">
          {(
            [
              { id: 'time_trial' as const, label: 'Contrarreloj' },
              { id: 'chase' as const, label: 'Persecución' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              disabled={loadAction.busy}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer disabled:opacity-55 ${
                mode === m.id ? 'cozy-tab-active' : 'cozy-btn text-cozy-muted'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <ActionFeedbackBanner
          className="mb-3"
          feedback={loadAction.feedback}
          showLoading={loadAction.showLoading}
          loadingLabel="Cargando..."
          onDismiss={loadAction.clearFeedback}
        />

        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {loadAction.busy ? (
            <div className="flex flex-col items-center justify-center h-48 text-cozy-muted text-xs gap-3">
              <Loader2 className="w-7 h-7 text-cozy-accent-deep animate-spin" />
              <span>Cargando mejores tiempos...</span>
            </div>
          ) : loadAction.feedback?.type === 'error' && entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-cozy-ink text-xs text-center p-4 gap-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <Medal className="w-10 h-10 text-cozy-accent-deep stroke-[1.5]" />
              <div className="space-y-1">
                <p className="font-bold text-cozy-ink">No se pudo conectar con el ranking</p>
                <p className="text-cozy-muted text-[11px]">
                  El servidor de clasificaciones no respondió. Revisa tu conexión y vuelve a intentar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void fetchLeaderboard(true)}
                disabled={loadAction.busy}
                className={`${BTN.primary} flex items-center justify-center gap-2 text-xs py-2 px-4`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reintentar</span>
              </button>
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              className="h-48"
              title="Aún no hay tiempos aquí"
              body="Completa este nivel en modo Contrarreloj estando dentro de tu cuenta. Tu mejor tiempo aparecerá solo."
            />
          ) : (
            entries.map((entry) => {
              const isFirst = entry.rank === 1;
              const isSecond = entry.rank === 2;
              const isThird = entry.rank === 3;

              return (
                <div
                  key={entry.userId || entry.rank}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isFirst
                      ? 'bg-[#fff1de] border-[#f0c48a]'
                      : isSecond
                      ? 'bg-cozy-panel-deep border-cozy-line'
                      : isThird
                      ? 'bg-[#f7ebe0] border-cozy-line'
                      : 'cozy-panel-soft'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                        isFirst
                          ? 'bg-cozy-accent text-cozy-accent-ink'
                          : isSecond
                          ? 'bg-[#c9d5dc] text-cozy-ink'
                          : isThird
                          ? 'bg-[#d8b48a] text-white'
                          : 'bg-cozy-panel-deep text-cozy-muted'
                      }`}
                    >
                      {entry.rank}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-cozy-ink">{entry.username}</div>
                      {entry.collectiblesFound > 0 && (
                        <div className="text-[10px] text-cozy-muted">
                          {entry.collectiblesFound} / {levelInfo(levelId).totalCollectibles} reliquias
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-cozy-accent-deep font-bold text-sm bg-white/80 px-3 py-1.5 rounded-xl border border-cozy-line">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatSeconds(entry.timeSeconds)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-cozy-line flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loadAction.busy}
            className={BTN.secondary}
          >
            {UI.cancel}
          </button>
        </div>
      </div>
    </div>
  );
};
