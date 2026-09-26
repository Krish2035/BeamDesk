import React, { useState } from 'react';
import {
  User,
  Shield,
  Laptop,
  Bell,
  Key,
  Check,
  AlertTriangle,
  Monitor,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import { formatDeviceId } from '../utils/format.js';

export const SettingsPage: React.FC = () => {
  const { user, currentDevice } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'devices' | 'notifications'>(
    'profile'
  );

  const [name, setName] = useState(user?.name || '');
  const [unattendedAccess, setUnattendedAccess] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h1>
        <p className="text-xs text-slate-500">
          Manage your account profile, device visibility, and security preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm">
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3 font-semibold transition-colors flex items-center space-x-2 ${
            activeTab === 'profile'
              ? 'border-b-2 border-brand-600 text-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`pb-3 font-semibold transition-colors flex items-center space-x-2 ${
            activeTab === 'security'
              ? 'border-b-2 border-brand-600 text-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Security & Consent</span>
        </button>
        <button
          onClick={() => setActiveTab('devices')}
          className={`pb-3 font-semibold transition-colors flex items-center space-x-2 ${
            activeTab === 'devices'
              ? 'border-b-2 border-brand-600 text-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>This Device</span>
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`pb-3 font-semibold transition-colors flex items-center space-x-2 ${
            activeTab === 'notifications'
              ? 'border-b-2 border-brand-600 text-brand-600'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Notifications</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl flex items-center space-x-2 animate-in fade-in">
          <Check className="w-4 h-4" />
          <span>Settings successfully updated!</span>
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-800">Personal Information</h3>
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-xl text-sm cursor-not-allowed"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-bold hover:bg-brand-700 transition-colors"
            >
              Save Profile
            </button>
          </form>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-800">Security & Access Safeguards</h3>

          <div className="space-y-4 max-w-xl">
            {/* Unattended access toggle */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between">
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-900">Unattended Access</div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  Allow approved devices to connect using a pre-shared master security key without manual prompt approval. (Disabled by default for security).
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUnattendedAccess(!unattendedAccess)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  unattendedAccess ? 'bg-brand-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    unattendedAccess ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Security Standard</span>
                BeamDesk strictly requires explicit confirmation on the host machine before any screen media is transmitted.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'devices' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-800">Current Device Information</h3>
          {currentDevice ? (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 max-w-md">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Public Device Address:</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatDeviceId(currentDevice.publicDeviceId)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Operating System:</span>
                <span className="font-semibold text-slate-800">{currentDevice.platform}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Device Name:</span>
                <span className="font-semibold text-slate-800">{currentDevice.name}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Signaling Status:</span>
                <span className="font-bold text-emerald-600">ONLINE</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400">No device registered for this browser.</div>
          )}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-800">Notification Preferences</h3>
          <p className="text-xs text-slate-500">
            Audio and visual alerts for incoming remote connection requests
          </p>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-brand-600 focus:ring-brand-500" />
              <span>Play audible chime upon incoming remote assistance requests</span>
            </label>
            <label className="flex items-center space-x-3 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" defaultChecked className="rounded text-brand-600 focus:ring-brand-500" />
              <span>Show browser push notifications when minimized</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
