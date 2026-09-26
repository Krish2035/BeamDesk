import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Monitor, Settings, LogOut, ShieldCheck, Activity, Laptop } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import { formatDeviceId } from '../utils/format.js';

export const Navbar: React.FC = () => {
  const { user, currentDevice, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  const isCurrent = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center text-white shadow-md shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xl font-bold text-slate-900 tracking-tight flex items-center">
                  Beam<span className="text-brand-600 font-extrabold">Desk</span>
                </span>
                <span className="block text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                  Remote Connect
                </span>
              </div>
            </Link>

            {/* Device Online Pill */}
            {currentDevice && (
              <div className="hidden md:flex items-center ml-4 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium text-slate-600 space-x-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>This PC:</span>
                <span className="font-mono font-semibold text-slate-800">
                  {formatDeviceId(currentDevice.publicDeviceId)}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          {user ? (
            <div className="flex items-center space-x-2 md:space-x-4">
              <Link
                to="/dashboard"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCurrent('/dashboard')
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/connect"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isCurrent('/connect')
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Connect to Device
              </Link>
              <Link
                to="/settings"
                className={`p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors ${
                  isCurrent('/settings') ? 'bg-slate-100 text-slate-900' : ''
                }`}
                title="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>

              {/* User Dropdown / Profile */}
              <div className="flex items-center pl-3 border-l border-slate-200 space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-semibold text-slate-800 leading-tight">
                    {user.name}
                  </div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                to="/signin"
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/signup"
                className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 shadow-sm transition-all"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
