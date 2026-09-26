import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Check,
  X,
  MousePointer,
  Keyboard,
  Volume2,
  Clipboard,
  AlertCircle,
  Smartphone,
  Camera,
  Layers,
  Info,
} from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore.js';
import { socketService } from '../services/socket.service.js';
import { webrtcService } from '../services/webrtc.service.js';
import { detectDeviceType } from '../utils/format';

export const IncomingRequestModal: React.FC = () => {
  const { incomingRequest, setIncomingRequest, setSession, setPermissions } = useSessionStore();
  const navigate = useNavigate();

  const [permissions, setLocalPermissions] = useState({
    allowMouse: true,
    allowKeyboard: true,
    allowAudio: true,
    allowClipboard: false,
    allowFileTransfer: false,
  });

  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<'auto' | 'screen' | 'camera' | 'mirror'>('auto');

  if (!incomingRequest) return null;

  const deviceType = detectDeviceType();
  const isMobile = deviceType === 'mobile' || deviceType === 'tablet' || ('ontouchstart' in window);
  const isInsecureLAN = !window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

  const togglePermission = (key: keyof typeof permissions) => {
    setLocalPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAccept = async (overrideMode?: 'auto' | 'screen' | 'camera' | 'mirror') => {
    const modeToUse = overrideMode || selectedMode;
    try {
      setIsCapturing(true);
      setError(null);

      // 1. Capture screen/media FIRST directly from this click handler
      // This preserves user gesture activation on mobile browsers
      await webrtcService.startScreenCapture(modeToUse);

      // 2. Initialize Host WebRTC connection
      await webrtcService.initializePeerConnection(incomingRequest.sessionId, 'HOST');

      setPermissions(permissions);
      setSession(incomingRequest.sessionId, 'HOST', incomingRequest.targetDeviceId);
      const isDesktopHost = deviceType === 'desktop' && !('ontouchstart' in window);
      socketService.acceptSession(incomingRequest.sessionId, permissions, isDesktopHost);

      // 4. Close modal and open session viewer
      setIncomingRequest(null);
      navigate(`/session/${incomingRequest.sessionId}`);
    } catch (err: any) {
      console.error('Failed to accept session:', err);
      setError(err.message || 'Connection failed. You can retry in Live Mirror mode.');
      setIsCapturing(false);
    }
  };

  const handleReject = () => {
    socketService.rejectSession(incomingRequest.sessionId, 'Rejected by host user');
    setIncomingRequest(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden transform animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-brand-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Incoming Remote Request</h3>
              <p className="text-xs text-brand-100">A user is asking to connect to this device</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
              Requester Details
            </span>
            <div className="text-base font-bold text-slate-900">{incomingRequest.requesterName}</div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">Device ID: {incomingRequest.requesterId}</div>
          </div>

          {/* Insecure LAN Notice & Mode Selection for Mobile */}
          {isMobile && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                Sharing Stream Mode:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMode('screen')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    selectedMode === 'screen' || selectedMode === 'auto'
                      ? 'border-brand-500 bg-brand-50/50 text-brand-700 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Smartphone className="w-4 h-4 mx-auto mb-1 text-brand-600" />
                  <span className="text-[11px] block">Screen Cast</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode('camera')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    selectedMode === 'camera'
                      ? 'border-brand-500 bg-brand-50/50 text-brand-700 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Camera className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                  <span className="text-[11px] block">Camera AR</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode('mirror')}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    selectedMode === 'mirror'
                      ? 'border-brand-500 bg-brand-50/50 text-brand-700 font-semibold'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Layers className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                  <span className="text-[11px] block">Live Mirror</span>
                </button>
              </div>

              {isInsecureLAN && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] rounded-xl flex items-start space-x-2">
                  <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    <strong>Mobile LAN notice:</strong> Browsers require HTTPS for system screen cast. If your browser restricts display capture, BeamDesk automatically streams the Live Mirror Canvas or Camera seamlessly!
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Granular Permission Toggles */}
          <div>
            <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block mb-2">
              Allowed Remote Permissions:
            </label>
            <div className="space-y-2">
              <label
                onClick={() => togglePermission('allowMouse')}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <MousePointer className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-700">Remote Mouse & Touch</span>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowMouse}
                  readOnly
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
              </label>

              <label
                onClick={() => togglePermission('allowKeyboard')}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Keyboard className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-700">Keyboard Input</span>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowKeyboard}
                  readOnly
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
              </label>

              <label
                onClick={() => togglePermission('allowAudio')}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Volume2 className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-700">Audio Streaming</span>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowAudio}
                  readOnly
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
              </label>

              <label
                onClick={() => togglePermission('allowClipboard')}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center space-x-2.5">
                  <Clipboard className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-700">Shared Clipboard</span>
                </div>
                <input
                  type="checkbox"
                  checked={permissions.allowClipboard}
                  readOnly
                  className="rounded text-brand-600 focus:ring-brand-500"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end space-x-3">
          <button
            onClick={handleReject}
            disabled={isCapturing}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center space-x-1.5"
          >
            <X className="w-4 h-4 text-slate-500" />
            <span>Reject</span>
          </button>
          <button
            onClick={() => handleAccept()}
            disabled={isCapturing}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isCapturing ? 'Starting Stream...' : 'Accept & Connect'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
