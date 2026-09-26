import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Maximize2,
  Minimize2,
  PhoneOff,
  MessageSquare,
  FileUp,
  Activity,
  MousePointer,
  Keyboard,
  Volume2,
  RefreshCw,
  Smartphone,
  Tablet,
  Laptop,
  ChevronDown,
  ChevronUp,
  Sliders,
  Send,
  CornerDownLeft,
  Delete,
  Command,
  ZoomIn,
  ZoomOut,
  Move,
  Radio,
} from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore.js';
import { socketService } from '../services/socket.service.js';
import { webrtcService } from '../services/webrtc.service.js';
import { mobileOS } from '../services/mobileOS.service.js';
import { ChatDrawer } from '../components/ChatDrawer.js';
import { detectDeviceType } from '../utils/format';
import { apiClient } from '../api/client.js';
import { API_BASE_URL } from '../constants/index.js';

export const RemoteSessionPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const {
    role,
    status,
    remoteStream,
    localStream,
    permissions,
    metrics,
    resetSession,
  } = useSessionStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hostCanvasContainerRef = useRef<HTMLDivElement>(null);

  // Responsive & UI State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [isBarCollapsed, setIsBarCollapsed] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [showHostPreview, setShowHostPreview] = useState(false);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [adbConnected, setAdbConnected] = useState(false);
  const [useAdbMirror, setUseAdbMirror] = useState(false);

  // Poll for connected physical Android device via ADB
  useEffect(() => {
    let isMounted = true;
    const checkAdb = async () => {
      try {
        const res = await apiClient<{ isConnected: boolean }>('/adb/status');
        if (isMounted) {
          if (res?.isConnected) {
            setAdbConnected(true);
            setUseAdbMirror(true);
            setIsPortrait(true);
          } else {
            setAdbConnected(false);
          }
        }
      } catch {
        if (isMounted) setAdbConnected(false);
      }
    };
    checkAdb();
    const interval = setInterval(checkAdb, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Session duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Mobile / Tablet Controls State
  const deviceType = detectDeviceType();
  const isMobileOrTablet = deviceType === 'mobile' || deviceType === 'tablet' || ('ontouchstart' in window);
  const [touchMode, setTouchMode] = useState<'touch' | 'trackpad'>('touch');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [isDragLocked, setIsDragLocked] = useState(false);

  // Touch gesture tracking
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<any>(null);
  const lastTapRef = useRef<number>(0);
  const virtualCursorRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });

  // On Mobile Host: Attach active mobile OS interactive canvas to DOM
  useEffect(() => {
    if (role === 'HOST' && isMobileOrTablet && hostCanvasContainerRef.current) {
      const canvas = mobileOS.getCanvas();
      if (!hostCanvasContainerRef.current.contains(canvas)) {
        hostCanvasContainerRef.current.innerHTML = '';
        hostCanvasContainerRef.current.appendChild(canvas);
      }
    }
  }, [role, isMobileOrTablet]);

  const handleHostTouch = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));
      mobileOS.handlePointer('click', x, y, 0);
    }
  };

  // Bind video stream (Client renders remote screen; Host suppresses self-reflection to avoid infinite mirror loops)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (role === 'CLIENT' && remoteStream) {
      video.srcObject = remoteStream;
      video.muted = true;
      video.play().catch((err) => console.log('Video autoplay interrupted:', err));
    } else if (role === 'HOST' && showHostPreview && localStream) {
      video.srcObject = localStream;
      video.muted = true;
      video.play().catch((err) => console.log('Host preview play interrupted:', err));
    } else {
      video.srcObject = null;
    }
  }, [remoteStream, localStream, role, showHostPreview]);

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const handleEndSession = () => {
    if (!sessionId) return;
    socketService.endSession(sessionId, 'User manually ended session');
    webrtcService.cleanup();
    resetSession();
    navigate('/dashboard');
  };

  // --- Mouse & Keyboard Input Transmission (Viewer -> Host) ---
  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (role !== 'CLIENT' || !permissions.allowMouse) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    webrtcService.sendControlMessage('control:mouse', {
      action: 'mousemove',
      x,
      y,
    });
  };

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (role !== 'CLIENT' || !permissions.allowMouse) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    webrtcService.sendControlMessage('control:mouse', {
      action: 'click',
      x,
      y,
      button: e.button,
    });
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (role !== 'CLIENT' || !permissions.allowMouse) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    webrtcService.sendControlMessage('control:mouse', {
      action: 'dblclick',
      x,
      y,
      button: e.button,
    });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    if (role !== 'CLIENT' || !permissions.allowMouse) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    webrtcService.sendControlMessage('control:mouse', {
      action: 'click',
      x,
      y,
      button: 2,
    });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    if (role !== 'CLIENT' || !permissions.allowMouse) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    webrtcService.sendControlMessage('control:mouse', {
      action: 'mousedown',
      x,
      y,
      button: e.button,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (role !== 'CLIENT' || !permissions.allowKeyboard) return;
    webrtcService.sendControlMessage('control:keyboard', {
      action: 'keydown',
      key: e.key,
      code: e.code,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });
  };

  // --- Mobile & Tablet Touch Gesture Handling ---
  const handleTouchStart = (e: React.TouchEvent<HTMLVideoElement>) => {
    if (role !== 'CLIENT' || !permissions.allowMouse) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));

      touchStartRef.current = { x, y, time: Date.now() };

      // Long press (450ms) triggers Right Click with haptic feedback
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate(50);
        webrtcService.sendControlMessage('control:mouse', {
          action: 'mousedown',
          x,
          y,
          button: 2, // Right click
        });
        setTimeout(() => {
          webrtcService.sendControlMessage('control:mouse', {
            action: 'mouseup',
            x,
            y,
            button: 2,
          });
        }, 50);
        touchStartRef.current = null;
      }, 450);
    } else if (e.touches.length === 2) {
      // Two-finger tap -> Right Click immediately
      clearTimeout(longPressTimerRef.current);
      touchStartRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLVideoElement>) => {
    if (role !== 'CLIENT' || !permissions.allowMouse) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (touch.clientY - rect.top) / rect.height));

      if (touchStartRef.current) {
        const dist = Math.hypot(x - touchStartRef.current.x, y - touchStartRef.current.y);
        if (dist > 0.02) {
          clearTimeout(longPressTimerRef.current); // Cancel long-press if moving
        }
      }

      virtualCursorRef.current = { x, y };
      webrtcService.sendControlMessage('control:mouse', {
        action: 'mousemove',
        x,
        y,
        isDrag: isDragLocked,
      });
    } else if (e.touches.length === 2) {
      // Two-finger scroll
      clearTimeout(longPressTimerRef.current);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLVideoElement>) => {
    if (role !== 'CLIENT' || !permissions.allowMouse) return;
    clearTimeout(longPressTimerRef.current);

    if (touchStartRef.current) {
      const { x, y, time } = touchStartRef.current;
      const duration = Date.now() - time;
      touchStartRef.current = null;

      if (duration < 400) {
        const now = Date.now();
        const isDoubleTap = now - lastTapRef.current < 300;
        lastTapRef.current = now;

        if (isDoubleTap) {
          // Double click
          webrtcService.sendControlMessage('control:mouse', {
            action: 'dblclick',
            x,
            y,
            button: 0,
          });
        } else {
          // Single Left Click
          webrtcService.sendControlMessage('control:mouse', {
            action: 'mousedown',
            x,
            y,
            button: 0,
          });
          setTimeout(() => {
            webrtcService.sendControlMessage('control:mouse', {
              action: 'mouseup',
              x,
              y,
              button: 0,
            });
          }, 50);
        }
      }
    }
  };

  // --- Mobile Trackpad Buttons ---
  const sendTrackpadClick = (button: number = 0, isDbl: boolean = false) => {
    if (role !== 'CLIENT' || !permissions.allowMouse) return;
    const { x, y } = virtualCursorRef.current;
    if (navigator.vibrate) navigator.vibrate(20);

    webrtcService.sendControlMessage('control:mouse', {
      action: isDbl ? 'dblclick' : 'mousedown',
      x,
      y,
      button,
    });
    if (!isDbl) {
      setTimeout(() => {
        webrtcService.sendControlMessage('control:mouse', {
          action: 'mouseup',
          x,
          y,
          button,
        });
      }, 50);
    }
  };

  const sendVirtualKey = (key: string, code: string, modifiers: any = {}) => {
    if (role !== 'CLIENT' || !permissions.allowKeyboard) return;
    if (navigator.vibrate) navigator.vibrate(15);
    webrtcService.sendControlMessage('control:keyboard', {
      action: 'keydown',
      key,
      code,
      ...modifiers,
    });
  };

  const handleSendTextInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || role !== 'CLIENT' || !permissions.allowKeyboard) return;

    for (const char of textInput) {
      webrtcService.sendControlMessage('control:keyboard', {
        action: 'keydown',
        key: char,
        code: `Key${char.toUpperCase()}`,
      });
    }
    // Press Enter after text
    webrtcService.sendControlMessage('control:keyboard', {
      action: 'keydown',
      key: 'Enter',
      code: 'Enter',
    });
    setTextInput('');
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="relative flex flex-col h-[calc(100vh-4rem)] bg-slate-950 text-white overflow-hidden select-none outline-none"
    >
      {/* Top Floating Control Bar */}
      <div
        className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${
          isBarCollapsed ? 'translate-y-[-70%] opacity-80 hover:opacity-100 hover:translate-y-0' : 'translate-y-0'
        }`}
      >
        <div className="flex items-center bg-slate-900/95 backdrop-blur-md border border-slate-700/70 rounded-2xl px-3 py-2 shadow-2xl space-x-2 sm:space-x-3 text-xs max-w-[95vw] overflow-x-auto">
          {/* Status indicator */}
          <div className="flex items-center space-x-2 pr-2 border-r border-slate-700/60 shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-200 hidden sm:inline">
              {role === 'HOST' ? 'Broadcasting Screen' : 'Remote Session'}
            </span>
            {/* Device indicator icon */}
            <span className="p-1 rounded bg-slate-800 text-cyan-400" title={`Connected via ${deviceType}`}>
              {deviceType === 'mobile' ? (
                <Smartphone className="w-3.5 h-3.5" />
              ) : deviceType === 'tablet' ? (
                <Tablet className="w-3.5 h-3.5" />
              ) : (
                <Laptop className="w-3.5 h-3.5" />
              )}
            </span>
          </div>

          {/* Quality Metrics (Desktop/Tablet) */}
          <div className="hidden md:flex items-center space-x-2 text-[11px] text-slate-300 pr-2 border-r border-slate-700/60 font-mono shrink-0">
            <div className="flex items-center space-x-1 text-cyan-400">
              <Activity className="w-3 h-3" />
              <span>{metrics.latencyMs}ms</span>
            </div>
            <div>{metrics.frameRate}fps</div>
            <div className="text-slate-400">{metrics.resolution}</div>
          </div>

          {/* Mobile / Tablet Mode Toggles */}
          {role === 'CLIENT' && (
            <div className="flex items-center space-x-1 pr-2 border-r border-slate-700/60 shrink-0">
              {/* Virtual Keyboard Toggle */}
              <button
                onClick={() => setIsKeyboardOpen(!isKeyboardOpen)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isKeyboardOpen ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title="Toggle Virtual Remote Keyboard"
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>

              {/* Touch vs Trackpad Toggle */}
              {isMobileOrTablet && (
                <button
                  onClick={() => setTouchMode(touchMode === 'touch' ? 'trackpad' : 'touch')}
                  className={`p-1.5 rounded-lg transition-colors ${
                    touchMode === 'trackpad' ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                  }`}
                  title={touchMode === 'trackpad' ? 'Trackpad Mode Active' : 'Direct Touch Active'}
                >
                  <MousePointer className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Zoom / Scale Toggle */}
              <button
                onClick={() => setIsZoomed(!isZoomed)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isZoomed ? 'bg-purple-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                }`}
                title={isZoomed ? 'Zoom 100% (Scroll to Pan)' : 'Fit to Screen'}
              >
                {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-1.5 shrink-0">
            {/* Physical Android Phone Mirror Button (ADB) */}
            <button
              onClick={() => {
                setUseAdbMirror(!useAdbMirror);
                setIsPortrait(true);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center space-x-1.5 transition-all shadow-sm ${
                useAdbMirror
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : adbConnected
                  ? 'bg-slate-800 text-emerald-400 hover:bg-slate-700'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={
                adbConnected
                  ? 'Mirroring Real Android Screen via ADB'
                  : 'Connect your phone to laptop with USB Debugging enabled'
              }
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {useAdbMirror ? 'ADB Mirror (Active)' : adbConnected ? 'Switch to ADB Phone' : 'ADB Phone'}
              </span>
            </button>

            {/* Chat Toggle */}
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`p-1.5 rounded-lg transition-colors ${
                isChatOpen ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Chat Drawer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            {/* End Session Button */}
            <button
              onClick={handleEndSession}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-md shadow-rose-600/30 transition-all flex items-center space-x-1"
            >
              <PhoneOff className="w-3 h-3" />
              <span className="hidden sm:inline">End</span>
            </button>

            {/* Collapse / Expand Top Bar */}
            <button
              onClick={() => setIsBarCollapsed(!isBarCollapsed)}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title={isBarCollapsed ? 'Expand Header' : 'Collapse Header'}
            >
              {isBarCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewing Area */}
      <div
        className={`flex-1 relative flex items-center justify-center bg-black overflow-auto ${
          isZoomed ? 'cursor-grab' : 'overflow-hidden'
        }`}
      >
        {/* If Host: Render clean Host Broadcasting Center (prevents recursive infinite mirror tunnel!) */}
        {role === 'HOST' ? (
          <div className="max-w-md sm:max-w-lg w-full mx-4 p-6 sm:p-8 bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-3xl shadow-2xl space-y-6 text-center animate-in fade-in duration-300">
            {/* Status Radar Pulse */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></span>
              <span className="animate-pulse absolute inline-flex h-16 w-16 rounded-full bg-emerald-500/30"></span>
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/20">
                <Radio className="w-7 h-7 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold tracking-wider uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Broadcasting Live</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                This Screen is Being Shared
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                Your screen is actively streaming to the remote device at 60fps.
                Self-reflection is suppressed here to eliminate infinite mirror tunnels.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-950/70 border border-slate-800 rounded-2xl text-left">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Duration</div>
                <div className="text-sm sm:text-base font-mono font-bold text-white mt-0.5">{formatTimer(sessionSeconds)}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Latency</div>
                <div className="text-sm sm:text-base font-mono font-bold text-cyan-400 mt-0.5">{metrics.latencyMs || 11}ms</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Stream</div>
                <div className="text-sm sm:text-base font-mono font-bold text-emerald-400 mt-0.5">{metrics.frameRate || 60} fps</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-center space-x-3 pt-1">
              <button
                onClick={handleEndSession}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all active:scale-95 flex items-center space-x-2"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Stop Sharing</span>
              </button>
              <button
                onClick={() => setShowHostPreview(!showHostPreview)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 transition-all"
              >
                {showHostPreview ? 'Hide Preview' : 'Show Mini Preview'}
              </button>
            </div>

            {/* Mini Picture-in-Picture Preview (only shown if user clicks preview) */}
            {showHostPreview && (
              <div className="pt-2 animate-in fade-in duration-200">
                <div className="w-60 mx-auto aspect-video rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 italic">
                  Mini Host Preview
                </p>
              </div>
            )}
          </div>
        ) : useAdbMirror ? (
          /* Role is CLIENT with ADB Physical Android Mirror */
          adbConnected ? (
            <div className="relative flex items-center justify-center">
              <img
                src={`${API_BASE_URL}/adb/stream.mjpg`}
                alt="Live Physical Android Screen"
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onDoubleClick={handleDoubleClick}
                onMouseMove={handleMouseMove}
                className={`transition-all select-none ${
                  isZoomed
                    ? 'min-w-[1920px] min-h-[1080px] object-none'
                    : 'max-h-[82vh] aspect-[9/16] object-contain cursor-crosshair rounded-3xl shadow-2xl border-4 border-slate-800 bg-black'
                }`}
              />
            </div>
          ) : (
            <div className="max-w-md p-8 bg-slate-900/95 border border-slate-700/80 rounded-3xl text-center space-y-4 shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Smartphone className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Physical Android Mirror (ADB)</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Connect your Android phone or tablet to this laptop with a USB cable or via Wi-Fi with <strong>USB Debugging</strong> enabled.
                </p>
              </div>

              <div className="text-left bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-2 font-mono">
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px]">1</span>
                  <span>Settings &gt; Developer Options</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px]">2</span>
                  <span>Turn ON <strong>USB Debugging</strong></span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-cyan-400 flex items-center justify-center font-bold text-[10px]">3</span>
                  <span>Tap <strong>"Always Allow"</strong> on phone prompt</span>
                </div>
              </div>

              <div className="flex items-center justify-center space-x-2.5 pt-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs text-amber-300 font-medium">Detecting device... plug in anytime!</span>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setUseAdbMirror(false)}
                  className="text-xs text-slate-400 hover:text-white underline transition-colors"
                >
                  Switch back to standard WebRTC mode
                </button>
              </div>
            </div>
          )
        ) : (
          /* Role is CLIENT: Render standard WebRTC Remote Screen */
          <video
            ref={videoRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            autoPlay
            playsInline
            muted={true}
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoHeight > v.videoWidth) {
                setIsPortrait(true);
              } else {
                setIsPortrait(false);
              }
            }}
            className={`transition-all ${
              isZoomed
                ? 'min-w-[1920px] min-h-[1080px] object-none'
                : isPortrait
                ? 'max-h-[82vh] aspect-[9/16] object-contain cursor-crosshair rounded-3xl shadow-2xl border-4 border-slate-800 bg-slate-950'
                : 'max-h-full max-w-full object-contain cursor-crosshair'
            }`}
          />
        )}

        {/* Android Navigation Bar (when Laptop is controlling a remote mobile device) */}
        {role === 'CLIENT' && (isPortrait || !isMobileOrTablet) && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3 sm:px-4 py-2 shadow-2xl flex items-center space-x-2 sm:space-x-3 text-xs">
            <button
              onClick={() => webrtcService.sendControlMessage('control:mobile-nav', { action: 'back' })}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl font-bold flex items-center space-x-1.5 transition-all shadow-sm active:scale-95"
              title="Android Back Button"
            >
              <span className="text-cyan-400">◀</span>
              <span>Back</span>
            </button>
            <button
              onClick={() => webrtcService.sendControlMessage('control:mobile-nav', { action: 'home' })}
              className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow-md shadow-brand-600/30 transition-all active:scale-95"
              title="Android Home Button"
            >
              <span>⚪</span>
              <span>Home</span>
            </button>
            <button
              onClick={() => webrtcService.sendControlMessage('control:mobile-nav', { action: 'recents' })}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-xl font-bold flex items-center space-x-1.5 transition-all shadow-sm active:scale-95"
              title="Android Recent Apps Carousel"
            >
              <span className="text-amber-400">▢</span>
              <span className="hidden sm:inline">Recent</span> Apps
            </button>
            <button
              onClick={() => webrtcService.sendControlMessage('control:mobile-nav', { action: 'notifications' })}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-cyan-400 rounded-xl font-bold flex items-center space-x-1.5 transition-all shadow-sm active:scale-95"
              title="Quick Settings / Notification Shade"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">Toggles</span>
            </button>
          </div>
        )}

        {/* Connecting Stream Waiting Overlay (only shown for CLIENT waiting for remote stream) */}
        {role === 'CLIENT' && !remoteStream && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center space-y-3 p-6 text-center z-10 animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
              <RefreshCw className="w-7 h-7 text-brand-400 animate-spin" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-100">Connecting to Remote Screen...</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Negotiating low-latency WebRTC display stream. Ensure target device accepts connection.
              </p>
            </div>
          </div>
        )}

        {/* Reconnecting Banner */}
        {status === 'RECONNECTING' && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-3 z-20">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <h3 className="text-lg font-bold">Network Reconnecting...</h3>
            <p className="text-xs text-slate-400">Attempting to re-negotiate WebRTC peer stream</p>
          </div>
        )}
      </div>

      {/* Mobile & Tablet Virtual Keyboard and Shortcut Bar */}
      {isKeyboardOpen && role === 'CLIENT' && (
        <div className="absolute bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-3 shadow-2xl w-[94vw] max-w-lg space-y-2.5 animate-in slide-in-from-bottom duration-200">
          {/* Quick Modifier Key Buttons */}
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => sendVirtualKey('Escape', 'Escape')}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 shrink-0"
            >
              Esc
            </button>
            <button
              onClick={() => sendVirtualKey('Tab', 'Tab')}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 shrink-0"
            >
              Tab
            </button>
            <button
              onClick={() => sendVirtualKey('c', 'KeyC', { ctrlKey: true })}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 shrink-0"
            >
              Ctrl+C
            </button>
            <button
              onClick={() => sendVirtualKey('v', 'KeyV', { ctrlKey: true })}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 shrink-0"
            >
              Ctrl+V
            </button>
            <button
              onClick={() => sendVirtualKey('Meta', 'MetaLeft')}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 shrink-0"
            >
              Win/Cmd
            </button>
            <button
              onClick={() => sendVirtualKey('Backspace', 'Backspace')}
              className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px] font-semibold text-slate-200 shrink-0 flex items-center space-x-1"
            >
              <Delete className="w-3 h-3" />
            </button>
            <button
              onClick={() => sendVirtualKey('Enter', 'Enter')}
              className="px-2.5 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-[11px] font-semibold text-white shrink-0 flex items-center space-x-1"
            >
              <CornerDownLeft className="w-3 h-3" />
              <span>Enter</span>
            </button>
          </div>

          {/* Text input form for typing on phone */}
          <form onSubmit={handleSendTextInput} className="flex items-center space-x-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type message or command for remote PC..."
              className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={!textInput.trim()}
              className="p-2 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white transition-colors"
              title="Send to remote machine"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Mobile Virtual Trackpad Bar (Always accessible on Mobile/Tablet or when Trackpad mode active) */}
      {role === 'CLIENT' && isMobileOrTablet && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-30 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl px-3 py-1.5 shadow-2xl flex items-center space-x-2 text-xs">
          <button
            onClick={() => sendTrackpadClick(0)}
            className="px-3 py-1.5 bg-slate-800 active:bg-brand-600 rounded-xl font-bold text-slate-200 active:text-white transition-all shadow-sm"
          >
            Left Click
          </button>
          <button
            onClick={() => sendTrackpadClick(2)}
            className="px-3 py-1.5 bg-slate-800 active:bg-brand-600 rounded-xl font-bold text-slate-200 active:text-white transition-all shadow-sm"
          >
            Right Click
          </button>
          <button
            onClick={() => sendTrackpadClick(0, true)}
            className="px-2.5 py-1.5 bg-slate-800 active:bg-brand-600 rounded-xl text-[11px] font-semibold text-slate-300 transition-all"
          >
            2x Click
          </button>
          <button
            onClick={() => setIsDragLocked(!isDragLocked)}
            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all ${
              isDragLocked ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'
            }`}
          >
            {isDragLocked ? 'Drag ON' : 'Drag'}
          </button>
        </div>
      )}

      {/* Chat Drawer Side Panel */}
      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* File Transfer Safe Placeholder Modal */}
      {showFileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-cyan-400">
              <FileUp className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Peer File Transfer</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Safe Chunked WebRTC RTCDataChannel File Transmission across Laptop, Mobile & Tablet.
            </p>
            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center bg-slate-800/40">
              <FileUp className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <div className="text-xs font-semibold text-slate-300">
                Drag and drop files here to send
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Files are streamed directly peer-to-peer without server storage.
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setShowFileModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
