import React, { useState, useEffect } from 'react';
import { Trophy, Clock, X, RefreshCw, Medal } from 'lucide-react';
import { apiClient, LeaderboardEntry } from '../services/apiClient';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { ActionFeedbackBanner } from './ActionFeedback';
import { formatSeconds, friendlyError } from '../utils/locale';
import { UI, BTN } from '../ui/labels';
import { isTypingTarget } from '../ui/shortcuts';
import { levelInfo } from '../game/progress';
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
  const [levelId, setLevelId] = useState<number>(initialLevelId);
  const [mode, setMode] = useState<'time_trial' | 'free' | 'chase'>(initialMode);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const loadAction = useAsyncAction();

  useEffect(() => {
    if (!isOpen) return;
    setLevelId(initialLevelId);
    setMode(initialMode);
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
      const match = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
      if (match) {
        e.preventDefault();
        setLevelId(parseInt(match[1], 10));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]);

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

        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {[1, 2, 3, 4, 5].map((lvl) => {
              const info = levelInfo(lvl);
              return (
                <button
                  key={lvl}
                  onClick={() => setLevelId(lvl)}
                  disabled={loadAction.busy}
                  title={`${info.name} (tecla ${lvl})`}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed max-w-[7.5rem] truncate ${
                    levelId === lvl ? 'cozy-tab-active' : 'cozy-btn text-cozy-muted'
                  }`}
                >
                  {lvl}. {info.name.replace(/^Archipiélago /, '').replace(/^Ruta /, '').replace(/^Valle /, '')}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => void fetchLeaderboard(true)}
            disabled={loadAction.busy}
            className="px-2.5 py-1.5 rounded-xl cozy-btn text-cozy-accent-deep cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed flex items-center gap-1 text-[10px] font-semibold"
            title={UI.updateList}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadAction.showLoading ? 'animate-spin' : ''}`} />
            <span>{UI.updateList}</span>
          </button>
        </div>

        <p className="text-[11px] text-cozy-muted mb-2 truncate">
          Viendo: Nivel {levelId} · {levelInfo(levelId).name} ·{' '}
          {mode === 'time_trial' ? 'Contrarreloj' : mode === 'free' ? 'Libre' : 'Persecución'}
        </p>

        <div className="flex items-center gap-1.5 mb-3 pb-3 border-b border-cozy-line">
          {(
            [
              { id: 'time_trial' as const, label: 'Contrarreloj' },
              { id: 'free' as const, label: 'Libre' },
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
          {loadAction.busy && !hasLoadedOnce && !loadAction.showLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-cozy-soft text-xs">
              <span>Un momento...</span>
            </div>
          ) : loadAction.feedback?.type === 'error' && entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-cozy-soft text-xs text-center p-4 gap-3">
              <Medal className="w-10 h-10 text-cozy-soft stroke-[1.5]" />
              <p>No pudimos cargar el ranking. Revisa tu conexión y toca Actualizar.</p>
              <button
                type="button"
                onClick={() => void fetchLeaderboard(true)}
                disabled={loadAction.busy}
                className={BTN.primary}
              >
                {UI.retryLoad}
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
                          {entry.collectiblesFound} reliquias
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
