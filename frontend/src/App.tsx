import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Navbar } from './components/Navbar.js';
import { IncomingRequestModal } from './components/IncomingRequestModal.js';
import { RemoteCursor } from './components/RemoteCursor.js';
import { AppRoutes } from './routes/AppRoutes.js';
import { useAuthStore } from './store/useAuthStore.js';
import { socketService } from './services/socket.service.js';

export const App: React.FC = () => {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth().then(() => {
      socketService.connect();
    });
  }, [initAuth]);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
        <Navbar />
        <main className="flex-1">
          <AppRoutes />
        </main>
        <IncomingRequestModal />
        <RemoteCursor />
      </div>
    </BrowserRouter>
  );
};

export default App;
