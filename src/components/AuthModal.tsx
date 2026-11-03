import React, { useMemo, useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  X,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { apiClient, User, PlayerProfileData } from '../services/apiClient';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { ActionFeedbackBanner } from './ActionFeedback';
import { ConfirmDialog, ConfirmRequest } from './ConfirmDialog';
import { FieldError, RequirementList } from './FieldHints';
import { UI, BTN } from '../ui/labels';
import {
  DISPLAY_NAME_MAX,
  emailRequirements,
  isEmailValid,
  isPasswordValid,
  isUsernameValid,
  passwordRequirements,
  sanitizeUsernameInput,
  usernameRequirements,
} from '../ui/validation';
import {
  AuthField,
  FieldErrors,
  collectAuthFieldErrors,
  displayNameHint,
  emailHint,
  mapAuthServerError,
  passwordConfirmHint,
  passwordHint,
  usernameHint,
} from '../ui/errors';
import { getRecent, pushRecent, RECENT_KEYS } from '../ui/recentMemory';
import { RecentChips, SuggestionList } from './RecentChips';
import { HelpTip, TIPS } from './HelpTip';
import { FriendsPanel } from './FriendsPanel';
import type { FriendUser } from '../services/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSynced?: (profile: PlayerProfileData) => void;
  inviteLevelId?: number;
  onInviteToPlay?: (friend: FriendUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onProfileSynced,
  inviteLevelId = 1,
  onInviteToPlay,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(apiClient.getCurrentUser());

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [recentEmails, setRecentEmails] = useState<string[]>([]);

  const authAction = useAsyncAction();
  const logoutAction = useAsyncAction();

  useEffect(() => {
    return apiClient.onAuthChange((user) => {
      setCurrentUser(user);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      authAction.clearFeedback();
      logoutAction.clearFeedback();
      setTouched({});
      setSubmitted(false);
      setServerErrors({});
      setConfirmRequest(null);
      setRecentEmails(getRecent(RECENT_KEYS.emails));
    }
  }, [isOpen]);

  const markTouched = (field: string) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const clearServerField = (field: AuthField) => {
    setServerErrors((prev) => {
      if (!prev[field] && !prev.form) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const usernameReqs = useMemo(() => usernameRequirements(username), [username]);
  const emailReqs = useMemo(() => emailRequirements(email), [email]);
  const passwordReqs = useMemo(() => passwordRequirements(password), [password]);

  const showField = (field: AuthField) => submitted || Boolean(touched[field]);

  const usernameError =
    activeTab === 'register' && showField('username')
      ? serverErrors.username || usernameHint(username)
      : serverErrors.username || null;

  const emailError = showField('email')
    ? serverErrors.email || emailHint(email)
    : serverErrors.email || null;

  const passwordError = showField('password')
    ? serverErrors.password || passwordHint(password, activeTab)
    : serverErrors.password || null;

  const passwordConfirmError =
    activeTab === 'register' && showField('passwordConfirm')
      ? serverErrors.passwordConfirm || passwordConfirmHint(password, passwordConfirm)
      : serverErrors.passwordConfirm || null;

  const displayNameError =
    activeTab === 'register' && showField('displayName')
      ? serverErrors.displayName || displayNameHint(displayName)
      : serverErrors.displayName || null;

  const formReady =
    activeTab === 'login'
      ? isEmailValid(email) && password.length > 0
      : isUsernameValid(username) &&
        isEmailValid(email) &&
        isPasswordValid(password) &&
        passwordConfirm === password &&
        displayName.trim().length <= DISPLAY_NAME_MAX;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    authAction.clearFeedback();
    setSubmitted(true);
    setTouched({
      username: true,
      email: true,
      password: true,
      passwordConfirm: true,
      displayName: true,
    });

    const localErrors = collectAuthFieldErrors({
      mode: activeTab,
      username,
      email,
      password,
      passwordConfirm,
      displayName,
    });
    setServerErrors(localErrors);
    if (Object.keys(localErrors).length > 0 || !formReady) return;

    const result = await authAction.run(
      async () => {
        if (activeTab === 'register') {
          await apiClient.register({
            username: username.trim().toLowerCase(),
            displayName: displayName.trim() || username.trim(),
            email: email.trim().toLowerCase(),
            password,
          });
        } else {
          await apiClient.login({
            email: email.trim().toLowerCase(),
            password,
          });
        }

        try {
          const profile = await apiClient.getMe();
          if (onProfileSynced) {
            onProfileSynced(profile);
          }
        } catch (profileErr) {
          console.warn('Could not fetch player profile:', profileErr);
        }
      },
      {
        successMessage:
          activeTab === 'register'
            ? '¡Listo! Bienvenido.'
            : '¡Qué bueno verte!',
        silentError: true,
      }
    );

    if (result.ok) {
      setServerErrors({});
      setRecentEmails(pushRecent(RECENT_KEYS.emails, email.trim().toLowerCase()));
      window.setTimeout(() => onClose(), 900);
    } else {
      setServerErrors(mapAuthServerError(result.error, activeTab));
    }
  };

  const requestLogout = () => {
    setConfirmRequest({
      title: '¿Salir de tu cuenta?',
      message: 'Podrás volver a entrar cuando quieras. Tu progreso guardado se queda en la nube.',
      confirmLabel: UI.leave,
      cancelLabel: UI.cancel,
      tone: 'danger',
      onConfirm: () => {
        void logoutAction.run(
          async () => {
            await apiClient.logout();
          },
          {
            successMessage: 'Listo. ¡Hasta pronto!',
            errorMessage: () =>
              'No se pudo cerrar la sesión. Revisa tu conexión e inténtalo de nuevo.',
          }
        );
      },
    });
  };

  if (!isOpen) return null;

  const busy = authAction.busy || logoutAction.busy;
  const feedback = authAction.feedback || logoutAction.feedback;
  const showLoading = authAction.showLoading || logoutAction.showLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cozy-scrim pointer-events-auto select-none font-ui">
      <div className="relative w-full max-w-md rounded-[1.75rem] cozy-panel p-6 max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          disabled={busy}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-cozy-soft hover:text-cozy-ink hover:bg-cozy-panel-deep transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label={UI.close}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-cozy-sky-soft border border-cozy-line flex items-center justify-center text-cozy-sky">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-cozy-ink">
              {currentUser ? 'Tu cuenta' : 'Tu aventura'}
            </h2>
            <p className="text-xs text-cozy-muted">
              {currentUser ? 'Progreso y personaje guardados' : 'Entra para guardar tu progreso'}
            </p>
          </div>
        </div>

        {(feedback || showLoading || serverErrors.form) && (
          <div className="mb-4 space-y-2">
            {serverErrors.form && (
              <ActionFeedbackBanner
                feedback={{ type: 'error', message: serverErrors.form }}
                onDismiss={() =>
                  setServerErrors((prev) => {
                    const next = { ...prev };
                    delete next.form;
                    return next;
                  })
                }
              />
            )}
            <ActionFeedbackBanner
              feedback={feedback}
              showLoading={showLoading}
              loadingLabel={logoutAction.busy ? 'Saliendo...' : 'Un momento...'}
              onDismiss={() => {
                authAction.clearFeedback();
                logoutAction.clearFeedback();
              }}
            />
          </div>
        )}

        {currentUser ? (
          <div className="flex flex-col gap-5">
            <div className="space-y-1">
              <p className="text-sm font-bold text-cozy-ink">
                {currentUser.displayName || currentUser.username}
              </p>
              <p className="text-xs text-cozy-muted">{currentUser.email}</p>
            </div>

            {onInviteToPlay && (
              <FriendsPanel
                inviteLevelId={inviteLevelId}
                onInviteToPlay={(friend) => {
                  onClose();
                  onInviteToPlay(friend);
                  onClose();
                }}
              />
            )}

            <div className="flex flex-col gap-3 pt-1 border-t border-cozy-line">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className={BTN.primary}
              >
                {UI.keepPlaying}
              </button>
              <button
                type="button"
                onClick={requestLogout}
                disabled={busy}
                className={`${BTN.ghost} flex items-center justify-center gap-2`}
              >
                {logoutAction.showLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-cozy-muted" />
                ) : (
                  <LogOut className="w-4 h-4 text-cozy-muted" />
                )}
                <span>{logoutAction.busy ? 'Saliendo...' : UI.leave}</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-cozy-panel-deep border border-cozy-line mb-5">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setActiveTab('login');
                  authAction.clearFeedback();
                  setSubmitted(false);
                  setServerErrors({});
                  setTouched({});
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed ${
                  activeTab === 'login' ? 'cozy-tab-active' : 'text-cozy-muted hover:text-cozy-ink'
                }`}
              >
                {UI.enter}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setActiveTab('register');
                  authAction.clearFeedback();
                  setSubmitted(false);
                  setServerErrors({});
                  setTouched({});
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:cursor-not-allowed ${
                  activeTab === 'register' ? 'cozy-tab-active' : 'text-cozy-muted hover:text-cozy-ink'
                }`}
              >
                {UI.createAccount}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              {activeTab === 'register' && (
                <>
                  <div>
                    <label className="flex items-center gap-0.5 text-[11px] font-bold text-cozy-muted uppercase tracking-wider mb-1">
                      Usuario
                      <HelpTip label={TIPS.usuario} side="bottom" />
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cozy-soft" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => {
                          setUsername(sanitizeUsernameInput(e.target.value));
                          clearServerField('username');
                        }}
                        onBlur={() => markTouched('username')}
                        placeholder="luna_suave"
                        autoComplete="username"
                        inputMode="text"
                        spellCheck={false}
                        disabled={busy}
                        aria-invalid={Boolean(usernameError)}
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl cozy-input text-xs font-semibold disabled:opacity-60 ${
                          usernameError ? 'border-cozy-blush' : ''
                        }`}
                      />
                    </div>
                    <RequirementList items={usernameReqs} show={username.length > 0 || touched.username || submitted} />
                    <FieldError message={usernameError} />
                  </div>

                  <div>
                    <label className="flex items-center gap-0.5 text-[11px] font-bold text-cozy-muted uppercase tracking-wider mb-1">
                      Cómo te ven (opcional)
                      <HelpTip label={TIPS.displayName} side="bottom" />
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => {
                        setDisplayName(e.target.value.slice(0, DISPLAY_NAME_MAX));
                        clearServerField('displayName');
                      }}
                      onBlur={() => markTouched('displayName')}
                      placeholder="Luna Suave"
                      disabled={busy}
                      maxLength={DISPLAY_NAME_MAX}
                      aria-invalid={Boolean(displayNameError)}
                      className={`w-full px-4 py-2.5 rounded-xl cozy-input text-xs disabled:opacity-60 ${
                        displayNameError ? 'border-cozy-blush' : ''
                      }`}
                    />
                    <span className="block mt-1 text-[10px] text-cozy-soft">
                      {displayName.length}/{DISPLAY_NAME_MAX} · Si lo dejas vacío, usamos tu usuario.
                    </span>
                    <FieldError message={displayNameError} />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold text-cozy-muted uppercase tracking-wider mb-1">
                  Correo
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cozy-soft" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearServerField('email');
                    }}
                    onBlur={() => markTouched('email')}
                    placeholder="tu_correo@ejemplo.com"
                    autoComplete="email"
                    list="cozy-recent-emails"
                    inputMode="email"
                    disabled={busy}
                    aria-invalid={Boolean(emailError)}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl cozy-input text-xs disabled:opacity-60 ${
                      emailError ? 'border-cozy-blush' : ''
                    }`}
                  />
                  <datalist id="cozy-recent-emails">
                    {recentEmails.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>
                <RecentChips
                  label="Correos recientes"
                  items={recentEmails}
                  onPick={(value) => {
                    setEmail(value);
                    clearServerField('email');
                    markTouched('email');
                  }}
                />
                <SuggestionList
                  query={email}
                  options={recentEmails}
                  onPick={(value) => {
                    setEmail(value);
                    clearServerField('email');
                    markTouched('email');
                  }}
                />
                <RequirementList
                  items={emailReqs}
                  show={activeTab === 'register' && (email.length > 0 || touched.email || submitted)}
                />
                <FieldError message={emailError} />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-cozy-muted uppercase tracking-wider mb-1">
                  Clave
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cozy-soft" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearServerField('password');
                    }}
                    onBlur={() => markTouched('password')}
                    placeholder="••••••••"
                    autoComplete={activeTab === 'login' ? 'current-password' : 'new-password'}
                    disabled={busy}
                    aria-invalid={Boolean(passwordError)}
                    className={`w-full pl-10 pr-10 py-2.5 rounded-xl cozy-input text-xs disabled:opacity-60 ${
                      passwordError ? 'border-cozy-blush' : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={busy}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-cozy-soft hover:text-cozy-ink cursor-pointer disabled:opacity-50"
                    aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {activeTab === 'register' && (
                  <RequirementList items={passwordReqs} show={password.length > 0 || touched.password || submitted} />
                )}
                <FieldError message={passwordError} />
              </div>

              {activeTab === 'register' && (
                <div>
                  <label className="block text-[11px] font-bold text-cozy-muted uppercase tracking-wider mb-1">
                    {UI.passwordAgain}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cozy-soft" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => {
                        setPasswordConfirm(e.target.value);
                        clearServerField('passwordConfirm');
                      }}
                      onBlur={() => markTouched('passwordConfirm')}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={busy}
                      aria-invalid={Boolean(passwordConfirmError)}
                      className={`w-full pl-10 pr-4 py-2.5 rounded-xl cozy-input text-xs disabled:opacity-60 ${
                        passwordConfirmError ? 'border-cozy-blush' : ''
                      }`}
                    />
                  </div>
                  <FieldError message={passwordConfirmError} />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className={`${BTN.primary} mt-2 flex items-center justify-center gap-2 active:scale-[0.99] disabled:active:scale-100`}
              >
                {authAction.showLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                )}
                <span>
                  {authAction.busy
                    ? 'Un momento...'
                    : activeTab === 'login'
                      ? UI.enter
                      : UI.createAccount}
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className={BTN.ghost}
              >
                {UI.cancel}
              </button>
            </form>
          </>
        )}
      </div>

      <ConfirmDialog request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
    </div>
  );
};
