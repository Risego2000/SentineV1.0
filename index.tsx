import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LoginScreen } from './components/LoginScreen';
import { useAuth } from './hooks/useAuth';
import { SentinelProvider } from './context/SentinelProvider';
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

  return (
    <SentinelProvider viewerId="global">
      <App />
    </SentinelProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<AuthenticatedApp />);
}
