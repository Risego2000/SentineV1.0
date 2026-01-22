import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SentinelProvider } from './context/SentinelContext';
import './index.css';

const container = document.getElementById('root');
if (container) {
  // @ts-ignore
  if (!container._reactRootContainer) {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <SentinelProvider>
          <App />
        </SentinelProvider>
      </React.StrictMode>
    );
  }
}
