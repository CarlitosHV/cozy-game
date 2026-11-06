import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  UserPlus,
  Users,
  Inbox,
  RefreshCw,
  Circle,
  Trash2,
  Gamepad2,
  Copy,
  Check,
} from 'lucide-react';
import {
  apiClient,
  FriendRequestItem,
  FriendSearchResult,
  FriendUser,
} from '../services/apiClient';
import { multiplayerClient } from '../services/multiplayerClient';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { ActionFeedbackBanner } from './ActionFeedback';
import { ConfirmDialog, ConfirmRequest } from './ConfirmDialog';
import { EmptyState, HelpTip, TIPS } from './HelpTip';
import { BTN, UI } from '../ui/labels';
import { friendlyError } from '../utils/locale';
import { sanitizeUsernameInput } from '../ui/validation';

type FriendsTab = 'friends' | 'requests' | 'search';

interface FriendsPanelProps {
  inviteLevelId: number;
  onInviteToPlay: (friend: FriendUser) => void;
}

export const FriendsPanel: React.FC<FriendsPanelProps> = ({
  inviteLevelId,
  onInviteToPlay,
}) => {
  const [tab, setTab] = useState<FriendsTab>('friends');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [results, setResults] = useState<FriendSearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const loadAction = useAsyncAction();
  const mutateAction = useAsyncAction();
  const searchTimer = useRef<number | null>(null);

  const refreshLists = async () => {
    const [nextFriends, nextRequests] = await Promise.all([
      apiClient.listFriends(),
      apiClient.listFriendRequests(),
    ]);
    setFriends(nextFriends);
    setRequests(nextRequests);
  };

  useEffect(() => {
    void loadAction.run(
      async () => {
        await refreshLists();
        setInitialLoading(false);
      },
      {
        silentSuccess: true,
        errorMessage: (err) => {
          setInitialLoading(false);
          return friendlyError(err, 'No se pudo cargar amigos. Revisa la conexión e inténtalo.');
        },
      }
    );
  }, []);

  useEffect(() => {
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      void loadAction.run(
        async () => {
          const found = await apiClient.searchFriends(q);
          setResults(found);
        },
        {
          silentSuccess: true,
          silentError: true,
          errorMessage: (err) =>
            friendlyError(err, 'No se pudo buscar. Inténtalo otra vez.'),
        }
      );
    }, 320);
    return () => {
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    };
  }, [query]);

  const runMutate = (
    task: () => Promise<void>,
    successMessage: string,
    fallbackError: string
  ) => {
    void mutateAction.run(task, {
      successMessage,
      errorMessage: (err) => friendlyError(err, fallbackError),
    }).then((result) => {
      if (result.ok) {
        void refreshLists();
        if (query.trim().length >= 2) {
          void apiClient.searchFriends(query).then(setResults).catch(() => undefined);
        }
      }
    });
  };

  const requestAdd = (username: string) => {
    runMutate(
      async () => {
        const res = await apiClient.sendFriendRequest(username);
        if (res.status === 'accepted') {
          /* message overridden below via toast from successMessage */
        }
      },
      'Listo. Solicitud enviada (o ya son amigos).',
      'No se pudo enviar la solicitud. Revisa el usuario e inténtalo.'
    );
  };

  const accept = (requestId: string) => {
    runMutate(
      async () => {
        await apiClient.acceptFriendRequest(requestId);
      },
      '¡Ahora son amigos!',
      'No se pudo aceptar. Inténtalo otra vez.'
    );
  };

  const decline = (requestId: string) => {
    runMutate(
      async () => {
        await apiClient.declineFriendRequest(requestId);
      },
      'Solicitud rechazada.',
      'No se pudo rechazar. Inténtalo otra vez.'
    );
  };

  const requestRemove = (friend: FriendUser) => {
    setConfirmRequest({
      title: `¿Quitar a ${friend.displayName || friend.username}?`,
      message: 'Dejarán de ser amigos. Podrás volver a enviar una solicitud más tarde.',
      confirmLabel: UI.removeFriend,
      cancelLabel: UI.cancel,
      tone: 'danger',
      onConfirm: () => {
        runMutate(
          async () => {
            await apiClient.removeFriend(friend._id);
          },
          'Amigo quitado de la lista.',
          'No se pudo quitar. Inténtalo otra vez.'
        );
      },
    });
  };

  const [copied, setCopied] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const busy = loadAction.busy || mutateAction.busy;
  const feedback = mutateAction.feedback || loadAction.feedback;

  const requestInvite = (friend: FriendUser) => {
    if (!friend.online) return;
    setInvitedIds((prev) => new Set(prev).add(friend._id));
    onInviteToPlay(friend);
  };

  const handleCopyRoomCode = async () => {
    const roomId = multiplayerClient.getCurrentRoomId();
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-display font-bold text-cozy-ink inline-flex items-center gap-1">
          {UI.friends}
          <HelpTip label={TIPS.friends} side="bottom" />
        </h3>
        <button
          type="button"
          onClick={() => {
            void loadAction.run(
              async () => {
                await refreshLists();
              },
              {
                silentSuccess: true,
                errorMessage: (err) =>
                  friendlyError(err, 'No se pudo actualizar. Inténtalo otra vez.'),
              }
            );
          }}
          disabled={busy}
          className="p-1.5 rounded-xl text-cozy-soft hover:text-cozy-ink cursor-pointer disabled:opacity-50"
          aria-label={UI.updateList}
          title={UI.updateList}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadAction.busy ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 p-1 rounded-2xl bg-cozy-panel-deep border border-cozy-line">
        {(
          [
            { id: 'friends' as const, label: UI.friends, icon: Users },
            { id: 'requests' as const, label: UI.friendRequests, icon: Inbox },
            { id: 'search' as const, label: UI.findFriends, icon: Search },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const badge =
            t.id === 'requests' && requests.length > 0 ? requests.length : null;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative py-2 rounded-xl text-[10px] font-bold cursor-pointer inline-flex items-center justify-center gap-1 ${
                tab === t.id ? 'cozy-tab-active' : 'text-cozy-muted hover:text-cozy-ink'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{t.label}</span>
              {badge !== null && (
                <span className="absolute -top-1 -right-1 min-w-[1rem] h-4 px-1 rounded-full bg-cozy-blush text-white text-[9px] leading-4">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {(feedback || loadAction.showLoading || mutateAction.showLoading) && (
        <ActionFeedbackBanner
          feedback={feedback}
          showLoading={loadAction.showLoading || mutateAction.showLoading}
          loadingLabel="Un momento..."
          onDismiss={() => {
            loadAction.clearFeedback();
            mutateAction.clearFeedback();
          }}
        />
      )}

      {multiplayerClient.isInPartyRoom() && (
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-cozy-sun/20 border border-cozy-sun/40 text-xs">
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-cozy-ink flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sala activa ({multiplayerClient.getPartyCount()}/10)
            </span>
            <span className="text-[10px] text-cozy-muted truncate">
              Invita a tus amigos para jugar juntos (hasta 10)
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyRoomCode}
            className="px-2 py-1 rounded-xl bg-white/80 border border-cozy-line text-[11px] font-bold text-cozy-ink hover:bg-white cursor-pointer inline-flex items-center gap-1 shrink-0"
            title="Copiar código de sala"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copiado' : 'Código'}</span>
          </button>
        </div>
      )}

      {tab === 'friends' && (
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-0.5">
          {initialLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-cozy-soft">
              <span className="w-4 h-4 rounded-full border-2 border-cozy-accent border-t-transparent animate-spin" />
              <span className="text-xs">Cargando amigos…</span>
            </div>
          ) : friends.length === 0 ? (
            <EmptyState
              title="Aún no tienes amigos"
              body="Busca por usuario y envía una solicitud. Cuando acepte, podrás invitarle a jugar."
              actionLabel={UI.findFriends}
              onAction={() => setTab('search')}
            />
          ) : (
            friends.map((friend) => {
              const partyPlayers = Array.from(multiplayerClient.getPartyPlayers().values());
              const isAlreadyInParty = partyPlayers.some(
                (p) =>
                  p.username?.toLowerCase() === friend.username?.toLowerCase() ||
                  p.userId === friend._id ||
                  p.id === friend._id
              );
              const wasInvited = invitedIds.has(friend._id);

              return (
                <div
                  key={friend._id}
                  className="flex items-center gap-2 p-2.5 rounded-2xl cozy-panel-soft border border-cozy-line"
                >
                  <span className="relative shrink-0">
                    <span className="w-9 h-9 rounded-xl bg-[#fff1de] border border-cozy-line flex items-center justify-center text-cozy-accent-deep text-xs font-bold">
                      {(friend.displayName || friend.username).slice(0, 1).toUpperCase()}
                    </span>
                    <Circle
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                        friend.online ? 'text-cozy-moss fill-cozy-moss' : 'text-cozy-soft fill-cozy-soft'
                      }`}
                    />
                  </span>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-bold text-cozy-ink truncate">
                      {friend.displayName || friend.username}
                    </div>
                    <div className="text-[10px] text-cozy-muted truncate">
                      @{friend.username} · {friend.online ? UI.online : UI.offline}
                    </div>
                  </div>

                  {isAlreadyInParty ? (
                    <span className="px-2 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      En la sala
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!friend.online || busy}
                      onClick={() => requestInvite(friend)}
                      title={friend.online ? `${UI.invitePlay}: ${TIPS.invitePlay}` : 'Desconectado'}
                      aria-label={UI.invitePlay}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed ${
                        wasInvited
                          ? 'bg-cozy-sky/15 text-cozy-sky border border-cozy-sky/30'
                          : 'bg-cozy-accent text-white shadow-sm hover:brightness-105 active:scale-95'
                      }`}
                    >
                      <Gamepad2 className="w-3.5 h-3.5" />
                      <span>{wasInvited ? 'Invitado ✓' : 'Invitar'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => requestRemove(friend)}
                    title={UI.removeFriend}
                    aria-label={UI.removeFriend}
                    className="p-2 rounded-xl cozy-btn cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-cozy-muted" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-0.5">
          {initialLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-cozy-soft">
              <span className="w-4 h-4 rounded-full border-2 border-cozy-accent border-t-transparent animate-spin" />
              <span className="text-xs">Cargando solicitudes…</span>
            </div>
          ) : requests.length === 0 ? (
            <EmptyState
              title="Sin solicitudes"
              body="Cuando alguien te agregue, la petición aparecerá aquí para aceptar o rechazar."
            />
          ) : (
            requests.map((req) => (
              <div
                key={req._id}
                className="flex items-center gap-2 p-2.5 rounded-2xl cozy-panel-soft border border-cozy-line"
              >
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs font-bold text-cozy-ink truncate">
                    {req.fromUser?.displayName || req.fromUser?.username || 'Jugador'}
                  </div>
                  <div className="text-[10px] text-cozy-muted truncate">
                    @{req.fromUser?.username || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => accept(req._id)}
                  className={`${BTN.chip} text-cozy-moss`}
                >
                  {UI.acceptRequest}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decline(req._id)}
                  className={`${BTN.chip} text-cozy-muted`}
                >
                  {UI.declineRequest}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'search' && (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cozy-soft" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(sanitizeUsernameInput(e.target.value))}
              placeholder="usuario o nombre"
              className="w-full pl-9 pr-3 py-2 rounded-xl cozy-input text-xs"
              aria-label={UI.findFriends}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          {query.trim().length > 0 && query.trim().length < 2 && (
            <p className="text-[10px] text-cozy-soft">Escribe al menos 2 caracteres.</p>
          )}
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-0.5">
            {query.trim().length >= 2 && results.length === 0 && !loadAction.busy ? (
              <EmptyState
                title="Nadie con ese nombre"
                body="Prueba otra escritura. El usuario solo admite letras, números o _."
              />
            ) : (
              results.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center gap-2 p-2.5 rounded-2xl cozy-panel-soft border border-cozy-line"
                >
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-bold text-cozy-ink truncate">
                      {user.displayName || user.username}
                    </div>
                    <div className="text-[10px] text-cozy-muted truncate">
                      @{user.username}
                      {user.relationship === 'friends'
                        ? ' · Amigos'
                        : user.relationship === 'outgoing_request'
                          ? ' · Solicitud enviada'
                          : user.relationship === 'incoming_request'
                            ? ' · Te envió solicitud'
                            : ''}
                    </div>
                  </div>
                  {user.relationship === 'none' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => requestAdd(user.username)}
                      className={`${BTN.chip} inline-flex items-center gap-1`}
                    >
                      <UserPlus className="w-3 h-3" />
                      {UI.addFriend}
                    </button>
                  )}
                  {user.relationship === 'incoming_request' && user.requestId && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => accept(user.requestId!)}
                      className={BTN.chip}
                    >
                      {UI.acceptRequest}
                    </button>
                  )}
                  {user.relationship === 'friends' && (
                    <button
                      type="button"
                      disabled={!user.online || busy}
                      onClick={() => requestInvite(user)}
                      className={`${BTN.chip} disabled:opacity-40`}
                    >
                      {UI.invitePlay}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <ConfirmDialog request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
    </div>
  );
};
