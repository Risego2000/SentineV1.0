import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import './index.css';

const AuthenticatedApp = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden animate-dynamic-shield">
            <img src="/ESCUDO.png" alt="Escudo" className="w-full h-full object-contain" />
          </div>
          <p className="text-sm text-slate-500 font-mono animate-pulse">
            Verificando credenciales...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <App />;
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  // Disable StrictMode in development to avoid double-rendering effects
  // which causes Supabase lock contention in Electron
  root.render(
    import.meta.env.DEV ? (
      <AuthenticatedApp />
    ) : (
      <React.StrictMode>
        <AuthenticatedApp />
      </React.StrictMode>
    )
  );
}
