import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Monitor,
  Copy,
  Check,
  ArrowRight,
  Clock,
  Laptop,
  ShieldCheck,
  Bookmark,
  Share2,
  RefreshCw,
  Smartphone,
  Tablet,
  QrCode,
  ArrowRightLeft,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore.js';
import { formatDeviceId, normalizeDeviceId, formatRelativeTime, detectDeviceType } from '../utils/format';
import { apiClient } from '../api/client.js';
import { SavedDevice, SessionRecord } from '../types/index.js';
import { MobileConnectModal } from '../components/MobileConnectModal.js';
import { socketService } from '../services/socket.service.js';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, currentDevice } = useAuthStore();

  const [targetId, setTargetId] = useState('');
  const [copied, setCopied] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([]);
  const [savedDevices, setSavedDevices] = useState<SavedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [adbStatus, setAdbStatus] = useState<{ isConnected: boolean; devices: any[] }>({ isConnected: false, devices: [] });
  const [adbIp, setAdbIp] = useState('');
  const [isConnectingAdb, setIsConnectingAdb] = useState(false);
  const [adbMsg, setAdbMsg] = useState<string | null>(null);

  const localDeviceType = currentDevice?.deviceType || detectDeviceType();

  useEffect(() => {
    fetchDashboardData();
    checkAdbStatus();
    socketService.connect();
    if (currentDevice?.publicDeviceId) {
      socketService.registerCurrentDevice();
    }
  }, [currentDevice]);

  const checkAdbStatus = async () => {
    try {
      const res = await apiClient<any>('/adb/status');
      if (res) {
        setAdbStatus({ isConnected: res.isConnected, devices: res.devices || [] });
      }
    } catch {}
  };

  const handleConnectWirelessAdb = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adbIp.trim()) return;
    try {
      setIsConnectingAdb(true);
      setAdbMsg(null);
      const res = await apiClient<any>('/adb/connect', {
        method: 'POST',
        body: JSON.stringify({ ip: adbIp.trim() }),
      });
      if (res?.success) {
        setAdbMsg('✓ Connected to Android via ADB');
        checkAdbStatus();
      } else {
        setAdbMsg(res?.message || 'Failed to connect. Ensure Wireless Debugging is on.');
      }
    } catch (err: any) {
      setAdbMsg(err.message || 'Error connecting to ADB');
    } finally {
      setIsConnectingAdb(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const [historyData, savedData] = await Promise.all([
        apiClient<SessionRecord[]>('/sessions/history').catch(() => []),
        apiClient<SavedDevice[]>('/devices/saved').catch(() => []),
      ]);
      setRecentSessions(historyData || []);
      setSavedDevices(savedData || []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyId = () => {
    if (!currentDevice) return;
    navigator.clipboard.writeText(formatDeviceId(currentDevice.publicDeviceId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId.trim()) return;
    const normalized = normalizeDeviceId(targetId);
    navigate(`/connect?target=${encodeURIComponent(normalized)}`);
  };

  const quickConnect = (deviceId: string) => {
    navigate(`/connect?target=${encodeURIComponent(deviceId)}`);
  };

  const getDeviceIcon = (type?: string, platform?: string) => {
    if (type === 'mobile' || platform === 'Android' || platform === 'iOS') {
      return <Smartphone className="w-5 h-5" />;
    }
    if (type === 'tablet') {
      return <Tablet className="w-5 h-5" />;
    }
    if (type === 'laptop') {
      return <Laptop className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Welcome Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white rounded-2xl border border-slate-200 p-6 shadow-sm gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back, {user?.name || 'User'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200">
              Cross-Device Ready
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Secure, WebRTC remote desktop & mobile-tablet assistance across any device or operating system.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsMobileModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-brand-50 hover:bg-brand-100 border border-brand-200 text-brand-700 text-xs font-semibold flex items-center space-x-2 transition-all shadow-sm"
          >
            <QrCode className="w-4 h-4" />
            <span>Connect Mobile / Tablet</span>
          </button>
          <button
            onClick={fetchDashboardData}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready for Remote Connection</span>
          </div>
        </div>
      </div>

      {/* Cross-Device Feature Strip */}
      <div className="bg-gradient-to-r from-brand-900 via-indigo-950 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-400/30 flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center space-x-2">
              <span>Cross-Device Remote Ecosystem Enabled</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                Active
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Connect <strong>Laptop ↔ Laptop</strong>, <strong>Laptop ↔ Tablet</strong>, <strong>Laptop ↔ Mobile</strong>, and vice-versa with touch gestures & virtual keyboard!
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsMobileModalOpen(true)}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white transition-all flex items-center space-x-2 shrink-0 self-end md:self-auto"
        >
          <QrCode className="w-4 h-4 text-cyan-300" />
          <span>Scan QR Code to Pair</span>
        </button>
      </div>

      {/* Main Grid: This Device & Remote Connect */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: This Device */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  {getDeviceIcon(localDeviceType, currentDevice?.platform)}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">This Device</h2>
                  <p className="text-xs text-slate-500">{currentDevice?.name || 'Local Workstation'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-[11px] font-semibold capitalize flex items-center space-x-1">
                  {getDeviceIcon(localDeviceType, currentDevice?.platform)}
                  <span>{localDeviceType}</span>
                </span>
                <span className="px-2.5 py-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-md text-[11px] font-semibold">
                  {currentDevice?.platform || 'Web'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Share this 9-digit address with a partner, technician, tablet, or phone to allow viewing and remote control.
            </p>

            {/* Device ID Display Box */}
            <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 text-center relative group">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Your Device Address
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-mono tracking-wider">
                {currentDevice ? formatDeviceId(currentDevice.publicDeviceId) : 'Generating...'}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  onClick={handleCopyId}
                  className="px-4 py-2 bg-white border border-slate-200 hover:border-brand-500 rounded-xl text-xs font-semibold text-slate-700 hover:text-brand-600 shadow-sm transition-all flex items-center space-x-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-600">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Device ID</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setIsMobileModalOpen(true)}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center space-x-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Connect Mobile/Tablet</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Interactive approval required for every session</span>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        {/* Right Column: Connect to Remote Device */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Control Remote Device</h2>
                <p className="text-xs text-slate-500">Enter a 9-digit address to request access</p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Connect to another computer, tablet, or smartphone to provide assistance, collaborate, or control tasks.
            </p>

            <form onSubmit={handleConnect} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Target Device Address
                </label>
                <div className="relative">
                  <Laptop className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="e.g. 489 123 789"
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white tracking-wider transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!targetId.trim()}
                className="w-full py-3.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>Initiate Connection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Quick Connect Saved Devices */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Saved Devices</span>
              <Bookmark className="w-3.5 h-3.5 text-slate-400" />
            </div>
            {savedDevices.length === 0 ? (
              <div className="text-xs text-slate-400 italic">No saved devices yet.</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {savedDevices.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => quickConnect(item.device.publicDeviceId)}
                    className="p-2.5 rounded-lg border border-slate-200 hover:border-brand-400 bg-slate-50/50 hover:bg-white text-left transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        {item.customName || item.device.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        {formatDeviceId(item.device.publicDeviceId)}
                      </div>
                    </div>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.device.isOnline ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Physical Android Control (ADB) Bridge */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                    Physical Android Touch & Control (ADB)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Control real phone apps, gestures, and physical clicks
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  adbStatus.isConnected
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {adbStatus.isConnected ? '● ACTIVE' : '○ DISCONNECTED'}
              </span>
            </div>

            {adbStatus.isConnected ? (
              <div className="bg-slate-800/80 rounded-xl p-3 text-xs flex items-center justify-between text-slate-300">
                <span>
                  Connected Device: <strong className="text-white">{adbStatus.devices[0]?.model || adbStatus.devices[0]?.id}</strong>
                </span>
                <span className="text-emerald-400 font-semibold">Touch & Input Active</span>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-slate-300">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  To click & control your physical phone from laptop:
                  <br />
                  <strong>1. USB:</strong> Connect phone to laptop with USB cable (USB Debugging ON).
                  <br />
                  <strong>2. Wireless:</strong> Enter phone Wi-Fi IP to pair wirelessly:
                </p>
                <form onSubmit={handleConnectWirelessAdb} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={adbIp}
                    onChange={(e) => setAdbIp(e.target.value)}
                    placeholder="Phone IP (e.g. 192.168.0.xxx)"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                  <button
                    type="submit"
                    disabled={isConnectingAdb || !adbIp.trim()}
                    className="px-3.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-all"
                  >
                    {isConnectingAdb ? 'Connecting...' : 'Pair ADB'}
                  </button>
                </form>
                {adbMsg && (
                  <div className={`text-[11px] font-medium ${adbMsg.startsWith('✓') ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {adbMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Sessions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="w-5 h-5 text-slate-500" />
            <h3 className="text-base font-bold text-slate-900">Recent Session History</h3>
          </div>
          <span className="text-xs text-slate-500">{recentSessions.length} sessions logged</span>
        </div>

        {recentSessions.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            No remote sessions found in your history.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-semibold">
                  <th className="py-3 px-4">Remote Device</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                      {session.targetDevice
                        ? formatDeviceId(session.targetDevice.publicDeviceId)
                        : 'Unknown'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">
                      {session.requesterId === user?.id ? 'Viewer (Client)' : 'Host'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          session.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : session.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {session.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {formatRelativeTime(session.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {session.targetDevice && (
                        <button
                          onClick={() => quickConnect(session.targetDevice!.publicDeviceId)}
                          className="text-brand-600 hover:text-brand-700 font-semibold"
                        >
                          Reconnect
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile & Tablet Pairing Modal */}
      {currentDevice && (
        <MobileConnectModal
          isOpen={isMobileModalOpen}
          onClose={() => setIsMobileModalOpen(false)}
          deviceId={currentDevice.publicDeviceId}
          deviceName={currentDevice.name}
        />
      )}
    </div>
  );
};
