import React, { useState } from 'react';
import { Eye, EyeOff, Shield, Lock, User, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export const LoginScreen = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, register, isLoading, error, clearError, isConfigured } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (isLogin) {
      await login(email, password);
    } else {
      await register(email, password, name);
    }
  };

  if (!isConfigured) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0c] flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 hud-grid opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />

        <div className="relative z-10 max-w-md w-full mx-4">
          <div className="horizon-card rounded-2xl p-8 text-center">
            <div className="w-28 h-28 mx-auto mb-8 rounded-2xl overflow-hidden animate-shield-glow">
              <img src="/ESCUDO.png" alt="Escudo" className="w-full h-full object-contain" />
            </div>

            <h1 className="text-5xl font-black uppercase tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              Sentinel <span className="text-blue-500">AI</span>{' '}
              <span className="text-xs font-mono text-blue-500/50 align-top ml-1">v.1.0</span>
            </h1>
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-blue-500/50" />
              <p className="text-sm font-bold text-blue-500 uppercase tracking-[0.3em]">
                Policía de Daganzo
              </p>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-blue-500/50" />
            </div>
            <p className="text-lg font-medium text-slate-400 italic tracking-wider">
              "Seguridad vial impulsada por IA"
            </p>

            <div className="flex items-center justify-center gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-semibold text-amber-500">Configuración Requerida</p>
                <p className="text-xs text-amber-500/70 mt-0.5">
                  Configure las variables de entorno de Supabase en .env.local
                </p>
              </div>
            </div>

            <div className="space-y-2 text-left text-xs font-mono text-slate-500 bg-black/30 rounded-lg p-3">
              <p>VITE_SUPABASE_URL=https://tu-proyecto.supabase.co</p>
              <p>VITE_SUPABASE_ANON_KEY=tu-clave-anonima</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0a0a0c] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 hud-grid opacity-30" />

      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse-slow" />
      <div
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-pulse-slow"
        style={{ animationDelay: '1s' }}
      />

      <div className="relative z-10 max-w-md w-full mx-4 h-full flex items-center">
        <div className="horizon-card rounded-2xl p-6 w-full max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="absolute -top-px left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

          <div className="text-center mb-8">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl overflow-hidden animate-dynamic-shield">
              <img src="/ESCUDO.png" alt="Escudo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-4xl font-black uppercase tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              Sentinel <span className="text-blue-500">AI</span>{' '}
              <span className="text-[10px] font-mono text-blue-500/50 align-top ml-1">v.1.0</span>
            </h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-blue-500/50" />
              <p className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em]">
                Policía de Daganzo
              </p>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-blue-500/50" />
            </div>
            <p className="text-sm font-medium text-slate-500 italic mt-3 tracking-wide">
              "Seguridad vial impulsada por IA"
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Nombre Completo
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Juan Pérez"
                    required={!isLogin}
                    className="w-full pl-11 pr-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-black/50 transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operador@policia.es"
                  required
                  className="w-full pl-11 pr-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-black/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full pl-11 pr-12 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-black/50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  <span>{isLogin ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-center text-sm text-slate-500">
              {isLogin ? '¿No tiene cuenta?' : '¿Ya tiene cuenta?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  clearError();
                }}
                className="text-blue-500 hover:text-blue-400 font-semibold transition-colors"
              >
                {isLogin ? 'Registrarse' : 'Iniciar Sesión'}
              </button>
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-600 font-mono">
              ACCESO RESTRINGIDO • POLICÍA LOCAL DE DAGANZO
            </p>
            <p className="text-[9px] text-slate-700 font-mono mt-1 uppercase">
              Copyright perteneciente a EXCMO. AYUNTAMIENTO DE DAGANZO DE ARRIBA (MADRID)
            </p>
          </div>
        </div>
      </div>

      <div className="scan-bar" />
    </div>
  );
};
