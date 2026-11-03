/**
 * AuthModal & Account Manager
 * Adapts to Cozy Leap Online Backend API v1 (/api/v1/auth/* & /api/v1/player/me).
 * Allows logging in, creating an account, testing backend health, and inspecting user status.
 */

import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Server,
  CheckCircle2,
  AlertCircle,
  LogOut,
  X,
  Sparkles,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { apiClient, User, PlayerProfileData } from '../services/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileSynced?: (profile: PlayerProfileData) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onProfileSynced,
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<User | null>(apiClient.getCurrentUser());

  // Form states
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & Errors
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Server health state
  const [serverUrl, setServerUrl] = useState(apiClient.getBaseUrl());
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline' | 'idle'>('idle');

  useEffect(() => {
    return apiClient.onAuthChange((user) => {
      setCurrentUser(user);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      checkServerHealth();
    }
  }, [isOpen]);

  const checkServerHealth = async () => {
    setServerStatus('checking');
    try {
      await apiClient.checkHealth();
      setServerStatus('online');
    } catch {
      setServerStatus('offline');
    }
  };

  const handleSaveServerUrl = () => {
    apiClient.setBaseUrl(serverUrl);
    checkServerHealth();
    setSuccessMsg('URL del servidor actualizada');
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  const validateInputs = (): string | null => {
    if (activeTab === 'register') {
      const cleanUsername = username.trim();
      if (cleanUsername.length < 3 || cleanUsername.length > 20) {
        return 'El nombre de usuario debe tener entre 3 y 20 caracteres.';
      }
      if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
        return 'El nombre de usuario sólo puede contener letras, números y guión bajo (_).';
      }
      if (!email.includes('@') || !email.includes('.')) {
        return 'Por favor ingresa un correo electrónico válido.';
      }
      if (password.length < 8) {
        return 'La contraseña debe tener al menos 8 caracteres.';
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return 'La contraseña debe incluir al menos una mayúscula, una minúscula y un número.';
      }
    } else {
      if (!email.trim() || !password) {
        return 'Por favor completa todos los campos.';
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const validationError = validateInputs();
    if (validationError) {
      setErrorMsg(validationError);
      return;
    }

    setIsLoading(true);

    try {
      if (activeTab === 'register') {
        await apiClient.register({
          username: username.trim().toLowerCase(),
          displayName: displayName.trim() || username.trim(),
          email: email.trim().toLowerCase(),
          password,
        });
        setSuccessMsg('¡Cuenta creada e iniciada con éxito!');
      } else {
        await apiClient.login({
          email: email.trim().toLowerCase(),
          password,
        });
        setSuccessMsg('¡Sesión iniciada con éxito!');
      }

      // Sync player profile with the app
      try {
        const profile = await apiClient.getMe();
        if (onProfileSynced) {
          onProfileSynced(profile);
        }
      } catch (profileErr) {
        console.warn('Could not fetch player profile:', profileErr);
      }

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: unknown) {
      const msg = (err as Error)?.message || 'Ocurrió un error inesperado al conectar con la API.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    await apiClient.logout();
    setIsLoading(false);
    setSuccessMsg('Has cerrado sesión.');
    setTimeout(() => setSuccessMsg(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm pointer-events-auto select-none font-['Outfit',sans-serif]">
      <div className="relative w-full max-w-md rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl p-6 text-stone-100 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors cursor-pointer"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
            <UserIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-amber-200">
              {currentUser ? 'Cuenta de Jugador' : 'Cozy Leap Online'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span className={`w-2 h-2 rounded-full ${serverStatus === 'online' ? 'bg-emerald-400 animate-pulse' : serverStatus === 'checking' ? 'bg-amber-400' : 'bg-rose-500'}`} />
              <span>
                {serverStatus === 'online' && 'Servidor API Conectado'}
                {serverStatus === 'checking' && 'Comprobando conexión...'}
                {serverStatus === 'offline' && 'Servidor API Desconectado'}
                {serverStatus === 'idle' && 'Estado del servidor'}
              </span>
            </div>
          </div>
        </div>

        {/* Success / Error Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-950/40 border border-rose-600/40 text-rose-200 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-600/40 text-emerald-200 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>{successMsg}</div>
          </div>
        )}

        {currentUser ? (
          /* Profile / Logged In View */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
                <span className="text-xs text-stone-400">Nombre de Usuario</span>
                <span className="text-sm font-bold text-amber-300 font-mono">@{currentUser.username}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
                <span className="text-xs text-stone-400">Nombre Visible</span>
                <span className="text-sm font-semibold text-stone-200">{currentUser.displayName}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
                <span className="text-xs text-stone-400">Correo</span>
                <span className="text-xs font-mono text-stone-300">{currentUser.email}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-stone-400">Rol de Cuenta</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {currentUser.role}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-600/30 text-amber-200/90 text-xs leading-relaxed flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Tu personaje, niveles y mejores tiempos se sincronizan automáticamente con el servidor en tiempo real.</span>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoading}
                className="flex-1 py-3 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors border border-stone-700/80"
              >
                <LogOut className="w-4 h-4 text-stone-400" />
                <span>Cerrar sesión</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs cursor-pointer transition-colors shadow-lg shadow-amber-950/30"
              >
                Volver al juego
              </button>
            </div>
          </div>
        ) : (
          /* Login / Register Form */
          <>
            {/* Tab Selector */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-stone-950/80 border border-stone-800 mb-5">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'login'
                    ? 'bg-amber-500 text-stone-950 shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'register'
                    ? 'bg-amber-500 text-stone-950 shadow-md'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Crear cuenta
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {activeTab === 'register' && (
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                      Nombre de usuario (único)
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="saltarin_pro"
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-950/70 border border-stone-800 focus:border-amber-400 focus:outline-none text-stone-100 text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                      Nombre visible (opcional)
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Saltarín Pro"
                      className="w-full px-4 py-2.5 rounded-xl bg-stone-950/70 border border-stone-800 focus:border-amber-400 focus:outline-none text-stone-100 text-xs"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                  {activeTab === 'login' ? 'Correo o usuario' : 'Correo electrónico'}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type={activeTab === 'login' ? 'text' : 'email'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={activeTab === 'login' ? 'saltarin@cozyleap.com' : 'tu_correo@ejemplo.com'}
                    required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-stone-950/70 border border-stone-800 focus:border-amber-400 focus:outline-none text-stone-100 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-300 uppercase tracking-wider mb-1">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-stone-950/70 border border-stone-800 focus:border-amber-400 focus:outline-none text-stone-100 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {activeTab === 'register' && (
                  <span className="block mt-1 text-[10px] text-stone-400">
                    Mínimo 8 caracteres, con 1 mayúscula, 1 minúscula y 1 número.
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 active:scale-[0.99] text-stone-950 font-bold text-sm shadow-xl shadow-amber-950/40 cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-stone-950" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-stone-950 stroke-[2.5]" />
                )}
                <span>{activeTab === 'login' ? 'Entrar a la aventura' : 'Registrar y comenzar'}</span>
              </button>
            </form>
          </>
        )}

        {/* Server Endpoint Configuration Panel */}
        <div className="mt-6 pt-4 border-t border-stone-800/80">
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            className="w-full flex items-center justify-between text-xs text-stone-400 hover:text-amber-300 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              <span>Configuración de Servidor Backend (API URL)</span>
            </span>
            <span className="text-[10px] underline">{showServerConfig ? 'Ocultar' : 'Ajustar'}</span>
          </button>

          {showServerConfig && (
            <div className="mt-3 p-3 rounded-2xl bg-stone-950/70 border border-stone-800 space-y-2 text-xs">
              <label className="block text-[10px] text-stone-400">
                Dirección Base de la API (por defecto http://localhost:3000/api/v1):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-700 text-stone-200 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveServerUrl}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer"
                >
                  Guardar
                </button>
              </div>
              <div className="flex items-center justify-between pt-1 text-[11px]">
                <button
                  type="button"
                  onClick={checkServerHealth}
                  className="text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Probar salud (/system/health)</span>
                </button>
                <span className={serverStatus === 'online' ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {serverStatus === 'online' ? 'OK 200' : serverStatus === 'offline' ? 'Inalcanzable' : serverStatus}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
