import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Laptop,
  ArrowRight,
  Loader2,
  AlertCircle,
  X,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { apiClient } from '../api/client.js';
import { normalizeDeviceId, formatDeviceId } from '../utils/format.js';
import { socketService } from '../services/socket.service.js';
import { useSessionStore } from '../store/useSessionStore.js';
import { webrtcService } from '../services/webrtc.service.js';
import { SOCKET_EVENTS } from '../constants/index.js';

export const ConnectionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const targetFromUrl = searchParams.get('target') || '';

  const [targetId, setTargetId] = useState(targetFromUrl);
  const [stage, setStage] = useState<
    'IDLE' | 'CHECKING' | 'WAITING_APPROVAL' | 'NEGOTIATING' | 'CONNECTED' | 'ERROR'
  >('IDLE');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [targetDeviceInfo, setTargetDeviceInfo] = useState<any>(null);

  const { setSession, status } = useSessionStore();

  useEffect(() => {
    if (targetFromUrl) {
      setTargetId(targetFromUrl);
    }
  }, [targetFromUrl]);

  // Listen to socket session events
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    const handleAccepted = async (payload: any) => {
      console.log('Host accepted request, negotiating WebRTC offer...');
      setStage('NEGOTIATING');
      setSession(payload.sessionId, 'CLIENT', targetId);

      try {
        // Initialize Viewer WebRTC PeerConnection and create offer
        await webrtcService.initializePeerConnection(payload.sessionId, 'CLIENT');
        await webrtcService.createAndSendOffer(payload.sessionId);
        setStage('CONNECTED');
        navigate(`/session/${payload.sessionId}`);
      } catch (err: any) {
        setErrorMessage('Failed to establish WebRTC media pipeline.');
        setStage('ERROR');
      }
    };

    const handleRejected = (payload: any) => {
      setStage('ERROR');
      setErrorMessage(payload.reason || 'The remote user declined the connection request.');
    };

    socket.on(SOCKET_EVENTS.SESSION_ACCEPTED, handleAccepted);
    socket.on(SOCKET_EVENTS.SESSION_REJECTED, handleRejected);

    return () => {
      socket.off(SOCKET_EVENTS.SESSION_ACCEPTED, handleAccepted);
      socket.off(SOCKET_EVENTS.SESSION_REJECTED, handleRejected);
    };
  }, [targetId, navigate, setSession]);

  const handleStartConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const normalized = normalizeDeviceId(targetId);

    if (normalized.length < 9) {
      setErrorMessage('Please enter a valid 9-digit device address.');
      setStage('ERROR');
      return;
    }

    try {
      setStage('CHECKING');
      // Step 1: Look up device in backend
      const device = await apiClient<any>(`/devices/lookup/${encodeURIComponent(normalized)}`);
      setTargetDeviceInfo(device);

      if (!device.isOnline && device.status === 'OFFLINE') {
        setStage('ERROR');
        setErrorMessage(`Device ${formatDeviceId(normalized)} is currently OFFLINE.`);
        return;
      }

      // Step 2: Request session via Socket.IO
      setStage('WAITING_APPROVAL');
      socketService.requestSession(normalized, {
        allowMouse: true,
        allowKeyboard: true,
        allowAudio: true,
      });
    } catch (err: any) {
      setStage('ERROR');
      setErrorMessage(err.message || 'Target device could not be reached.');
    }
  };

  const handleCancel = () => {
    setStage('IDLE');
    setErrorMessage(null);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-brand-600 to-cyan-600 p-8 text-white">
          <h1 className="text-2xl font-bold">Connect to Remote Device</h1>
          <p className="text-xs text-brand-100 mt-1">
            Establish an interactive remote viewing and control session
          </p>
        </div>

        <div className="p-8 space-y-6">
          {/* Status Tracker */}
          {stage !== 'IDLE' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-3">
              {stage === 'CHECKING' && (
                <div className="flex flex-col items-center space-y-2">
                  <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
                  <span className="text-sm font-semibold text-slate-800">
                    Locating device on network...
                  </span>
                </div>
              )}

              {stage === 'WAITING_APPROVAL' && (
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative">
                    <Laptop className="w-12 h-12 text-brand-600" />
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full animate-ping" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">
                      Waiting for Remote User Approval
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      A request prompt has appeared on the target screen ({targetDeviceInfo?.name || targetId}).
                    </p>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="mt-2 px-4 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors"
                  >
                    Cancel Request
                  </button>
                </div>
              )}

              {stage === 'NEGOTIATING' && (
                <div className="flex flex-col items-center space-y-2">
                  <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
                  <span className="text-sm font-semibold text-slate-800">
                    Negotiating WebRTC encryption & direct P2P channel...
                  </span>
                </div>
              )}

              {stage === 'ERROR' && errorMessage && (
                <div className="flex flex-col items-center space-y-2 text-rose-600">
                  <AlertCircle className="w-8 h-8" />
                  <span className="text-sm font-bold">{errorMessage}</span>
                  <button
                    onClick={() => setStage('IDLE')}
                    className="mt-2 px-4 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Device ID Input Form */}
          {stage === 'IDLE' && (
            <form onSubmit={handleStartConnection} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Enter 9-Digit Remote Address
                </label>
                <div className="relative">
                  <Laptop className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                  <input
                    type="text"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="489 123 789"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xl font-bold text-slate-900 tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Format: 9 digits with or without spaces/dashes (e.g. 489-123-789)
                </p>
              </div>

              <button
                type="submit"
                disabled={!targetId.trim()}
                className="w-full py-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>Connect</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Security Safeguard Notice */}
          <div className="pt-4 border-t border-slate-100 flex items-start space-x-3 text-xs text-slate-500">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              All remote sessions are established via direct encrypted peer-to-peer WebRTC channels. The remote user will be prompted to grant screen sharing permissions before video begins.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
