/**
 * Leaderboard Modal
 * Adapts to /api/v1/leaderboard/:levelId?mode=time_trial&limit=50
 * Displays high scores, ranks, and times from Redis Sorted Sets.
 */

import React, { useState, useEffect } from 'react';
import { Trophy, Clock, X, RefreshCw, AlertCircle, Medal } from 'lucide-react';
import { apiClient, LeaderboardEntry } from '../services/apiClient';

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen, levelId, mode]);

  const fetchLeaderboard = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiClient.getLeaderboard(levelId, mode);
      setEntries(res.leaderboard || []);
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'No se pudo cargar la tabla de clasificación.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm pointer-events-auto select-none font-['Outfit',sans-serif]">
      <div className="relative w-full max-w-lg rounded-3xl bg-stone-900 border border-amber-600/30 shadow-2xl p-6 text-stone-100 max-h-[90vh] flex flex-col">
        {/* Header */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-amber-200">Mejores Tiempos Online</h2>
            <p className="text-xs text-stone-400">Récords validados por el servidor en Redis</p>
          </div>
        </div>

        {/* Level and Mode Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-stone-800">
          {/* Level selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelId(lvl)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  levelId === lvl
                    ? 'bg-amber-500 text-stone-950 shadow-md'
                    : 'bg-stone-950/70 text-stone-400 hover:text-stone-200 border border-stone-800'
                }`}
              >
                Nivel {lvl}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchLeaderboard}
            disabled={isLoading}
            className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 transition-colors cursor-pointer"
            title="Actualizar tabla"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Leaderboard Table / Content */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-stone-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
              <span>Consultando récords en el servidor...</span>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-600/30 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-500 text-xs text-center p-4">
              <Medal className="w-10 h-10 text-stone-600 mb-2 stroke-[1.5]" />
              <p className="font-semibold text-stone-400 mb-1">Aún no hay récords para este nivel</p>
              <p>¡Sé el primer explorador en completar el nivel para aparecer en la cima!</p>
            </div>
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
                      ? 'bg-amber-950/40 border-amber-400/60 shadow-md shadow-amber-500/10'
                      : isSecond
                      ? 'bg-stone-800/80 border-stone-600'
                      : isThird
                      ? 'bg-stone-900/90 border-amber-800/40'
                      : 'bg-stone-950/60 border-stone-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black ${
                        isFirst
                          ? 'bg-amber-400 text-stone-950 shadow'
                          : isSecond
                          ? 'bg-stone-300 text-stone-950'
                          : isThird
                          ? 'bg-amber-700 text-stone-100'
                          : 'bg-stone-800 text-stone-400 font-mono'
                      }`}
                    >
                      {entry.rank}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-stone-100 flex items-center gap-1.5">
                        <span>{entry.username}</span>
                        {isFirst && <span className="text-amber-400">👑</span>}
                      </div>
                      {entry.collectiblesFound > 0 && (
                        <div className="text-[10px] text-stone-400">
                          {entry.collectiblesFound} reliquias encontradas
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-amber-300 font-mono font-bold text-sm bg-stone-900/90 px-3 py-1.5 rounded-xl border border-stone-800">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>{Number(entry.timeSeconds).toFixed(2)}s</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
          <span>Tiempos verificados con anti-cheat</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
