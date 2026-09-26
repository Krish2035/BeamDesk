import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage.js';
import { SignUpPage } from '../pages/SignUpPage.js';
import { SignInPage } from '../pages/SignInPage.js';
import { DashboardPage } from '../pages/DashboardPage.js';
import { ConnectionPage } from '../pages/ConnectionPage.js';
import { RemoteSessionPage } from '../pages/RemoteSessionPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import { useAuthStore } from '../store/useAuthStore.js';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/signin" element={<SignInPage />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/connect"
        element={
          <ProtectedRoute>
            <ConnectionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:sessionId"
        element={
          <ProtectedRoute>
            <RemoteSessionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
