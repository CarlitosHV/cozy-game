import React, { useState, useEffect } from 'react';
import {
  Users,
  Copy,
  Check,
  X,
  UserPlus,
  Gamepad2,
  Circle,
  RefreshCw,
  LogOut,
  Shield,
  Search,
} from 'lucide-react';
import {
  multiplayerClient,
  RemotePlayer,
  getPlayerDisplayName,
} from '../services/multiplayerClient';
import { apiClient, FriendUser } from '../services/apiClient';
import { BTN } from '../ui/labels';
import { friendlyError } from '../utils/locale';

interface PartyRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  levelId?: number;
  onInviteFriend?: (friend: FriendUser) => void;
  onOpenFriends?: () => void;
  onLeaveRoom: () => void;
}

export const PartyRoomModal: React.FC<PartyRoomModalProps> = ({
  isOpen,
  onClose,
  levelId = 1,
  onInviteFriend,
  onOpenFriends,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [players, setPlayers] = useState<RemotePlayer[]>([]);

  const roomId = multiplayerClient.getCurrentRoomId() || 'party_local';
  const isHost = multiplayerClient.isPartyHostRole();
  const self = multiplayerClient.getSelf();
  const selfId = self?.userId || self?.id || apiClient.getCurrentUser()?._id;

  // Sync player list from multiplayerClient
  const updatePlayerList = () => {
    setPlayers(multiplayerClient.getPartyPlayers());
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePlayerList();

    const unsubRoomState = multiplayerClient.addRoomStateListener(() => {
      updatePlayerList();
    });
    const unsubJoined = multiplayerClient.addPlayerJoinedListener(() => {
      updatePlayerList();
    });
    const unsubLeft = multiplayerClient.addPlayerLeftListener(() => {
      updatePlayerList();
    });

    return () => {
      unsubRoomState();
      unsubJoined();
      unsubLeft();
    };
  }, [isOpen]);

  // Load online friends
  const loadFriends = async () => {
    setIsLoadingFriends(true);
    try {
      const list = await apiClient.listFriends();
      setFriends(list);
    } catch (e) {
      console.warn('Could not fetch friends for party modal:', e);
    } finally {
      setIsLoadingFriends(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadFriends();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleSendInvite = (friend: FriendUser) => {
    setInvitedIds((prev) => new Set(prev).add(friend._id));
    if (onInviteFriend) {
      onInviteFriend(friend);
    } else {
      multiplayerClient.connect();
      multiplayerClient.sendInvite(friend._id, levelId, roomId);
    }
  };

  const connectedCount = Math.max(1, players.length);
  const maxCapacity = 10;
  const capacityPercent = Math.min(100, (connectedCount / maxCapacity) * 100);

  // Filter friends for quick invite
  const filteredFriends = friends.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.username.toLowerCase().includes(q) ||
      (f.displayName && f.displayName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl cozy-panel border border-cozy-line p-5 sm:p-6 flex flex-col gap-5 text-stone-800 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-cozy-line/80 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-emerald-600" />
            </span>
            <div className="min-w-0 text-left">
              <h2 className="text-base sm:text-lg font-bold font-display text-cozy-ink truncate">
                Sala Multijugador · Nivel {levelId}
              </h2>
              <p className="text-xs text-cozy-muted">
                {connectedCount} de {maxCapacity} exploradores conectados
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-cozy-muted hover:text-cozy-ink hover:bg-stone-200/50 transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Capacity Bar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-cozy-muted">Capacidad de la sala</span>
            <span className={connectedCount >= 10 ? 'text-amber-600 font-bold' : 'text-emerald-700 font-bold'}>
              {connectedCount} / {maxCapacity} jugadores
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                connectedCount >= 10
                  ? 'bg-amber-500'
                  : connectedCount >= 6
                  ? 'bg-emerald-500'
                  : 'bg-emerald-600'
              }`}
              style={{ width: `${capacityPercent}%` }}
            />
          </div>
        </div>

        {/* Room Code Badge */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f5ede0] border border-[#e4d5c0]">
          <div className="flex flex-col text-left min-w-0 pr-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Código de sala privada
            </span>
            <span className="text-xs font-mono font-bold text-stone-800 truncate select-all">
              {roomId}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-3 py-1.5 rounded-xl bg-white/90 hover:bg-white text-stone-800 font-bold text-xs border border-stone-300/80 shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                <span className="text-emerald-700">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-stone-600" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>

        {/* Connected Players Section */}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cozy-muted text-left">
            Exploradores en la isla ({connectedCount})
          </h3>
          <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
            {players.length === 0 ? (
              <div className="p-3 rounded-2xl bg-stone-100/60 text-stone-500 text-xs text-center">
                Eres el primer explorador en la sala. ¡Invita hasta 9 amigos más!
              </div>
            ) : (
              players.map((p, idx) => {
                const displayName = getPlayerDisplayName(p);
                const isLocal = (p.userId || p.id) === selfId;
                const isRoomHost = idx === 0 || (isHost && isLocal);

                return (
                  <div
                    key={p.userId || p.id || idx}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/70 border border-cozy-line/70 text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-cozy-ink truncate flex items-center gap-1.5">
                          <span>{displayName}</span>
                          {isLocal && (
                            <span className="px-1.5 py-0.5 rounded-md bg-stone-200 text-[10px] text-stone-700 font-semibold">
                              Tú
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-cozy-muted truncate">
                          @{p.username || displayName}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isRoomHost ? (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold flex items-center gap-1">
                          <Shield className="w-3 h-3 text-amber-700" />
                          <span>Anfitrión</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-900 text-[10px] font-semibold">
                          Explorador
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Invite Friends Section */}
        <div className="flex flex-col gap-2.5 border-t border-cozy-line/80 pt-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cozy-muted text-left flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Invitar amigos a la sala</span>
            </h3>
            <button
              type="button"
              onClick={loadFriends}
              disabled={isLoadingFriends}
              className="p-1 rounded-lg text-cozy-muted hover:text-cozy-ink transition-colors cursor-pointer disabled:opacity-50"
              title="Actualizar lista de amigos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFriends ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Quick search input */}
          {friends.length > 3 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar amigo por nombre..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/80 border border-stone-300 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          )}

          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
            {isLoadingFriends && friends.length === 0 ? (
              <div className="py-4 text-xs text-stone-400 text-center flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Cargando amigos...</span>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="py-3 text-xs text-stone-500 text-center bg-stone-100/50 rounded-2xl">
                {searchQuery.trim()
                  ? 'No se encontraron amigos con esa búsqueda.'
                  : 'Aún no tienes amigos agregados. Búscalos desde el menú de Amigos.'}
              </div>
            ) : (
              filteredFriends.map((f) => {
                const name = f.displayName || f.username;
                const isAlreadyInRoom = players.some(
                  (p) => p.userId === f._id || (p as any).id === f._id || p.username === f.username
                );
                const hasBeenInvited = invitedIds.has(f._id);

                return (
                  <div
                    key={f._id}
                    className="flex items-center justify-between p-2.5 rounded-2xl bg-white/80 border border-stone-200/80 text-left"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="relative shrink-0">
                        <span className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300/60 flex items-center justify-center text-amber-900 text-xs font-bold">
                          {name.slice(0, 1).toUpperCase()}
                        </span>
                        <Circle
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 ${
                            f.online ? 'text-emerald-500 fill-emerald-500' : 'text-stone-300 fill-stone-300'
                          }`}
                        />
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-stone-800 truncate">{name}</div>
                        <div className="text-[10px] text-stone-500 truncate">
                          @{f.username} · {f.online ? 'En línea' : 'Desconectado'}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      {isAlreadyInRoom ? (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                          ✓ En la sala
                        </span>
                      ) : hasBeenInvited ? (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-800 text-[11px] font-semibold animate-pulse">
                          ⏳ Invitado
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!f.online || connectedCount >= 10}
                          onClick={() => handleSendInvite(f)}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-xs cursor-pointer disabled:cursor-not-allowed shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
                        >
                          <Gamepad2 className="w-3.5 h-3.5" />
                          <span>Invitar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 border-t border-cozy-line/80 pt-3 mt-1">
          <button
            type="button"
            onClick={onLeaveRoom}
            className="px-3.5 py-2 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>Salir de la sala</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${BTN.primary} text-xs py-2 px-5`}
          >
            Volver a jugar
          </button>
        </div>
      </div>
    </div>
  );
};
