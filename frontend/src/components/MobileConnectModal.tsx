import React, { useState } from 'react';
import {
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  Copy,
  Check,
  X,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Sparkles,
  Wifi,
  ArrowRightLeft,
  ChevronRight,
} from 'lucide-react';
import { formatDeviceId } from '../utils/format.js';
import { generateQrMatrix } from '../utils/qrGenerator.js';

interface MobileConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName?: string;
}

export const MobileConnectModal: React.FC<MobileConnectModalProps> = ({
  isOpen,
  onClose,
  deviceId,
  deviceName,
}) => {
  const [activeTab, setActiveTab] = useState<'mobile' | 'tablet' | 'guide'>('mobile');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Use LAN address if on localhost so phones can access it over Wi-Fi
  const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '192.168.0.104'
    : window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';
  const connectUrl = `http://${host}${port}/connect?target=${deviceId.replace(/\D/g, '')}`;
  const localUrl = `${window.location.origin}/connect?target=${deviceId.replace(/\D/g, '')}`;

  const qrMatrix = generateQrMatrix(connectUrl);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openSimulatedDevice = (type: 'mobile' | 'tablet') => {
    const width = type === 'mobile' ? 390 : 768;
    const height = type === 'mobile' ? 844 : 1024;
    const left = window.screenX + 50;
    const top = window.screenY + 50;
    window.open(
      localUrl,
      `BeamDesk_${type}_Sim`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden transform animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-cyan-600 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ArrowRightLeft className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Cross-Device Connection Hub</h2>
              <p className="text-xs text-brand-100">
                Laptop ↔ Tablet ↔ Mobile Remote Access & Control
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex bg-black/20 p-1 rounded-xl mt-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('mobile')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                activeTab === 'mobile' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Connect Mobile</span>
            </button>
            <button
              onClick={() => setActiveTab('tablet')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                activeTab === 'tablet' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              <Tablet className="w-4 h-4" />
              <span>Connect Tablet</span>
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
                activeTab === 'guide' ? 'bg-white text-slate-900 shadow-sm' : 'text-white/80 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>How It Works</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {activeTab !== 'guide' ? (
            <div className="space-y-6">
              {/* QR Code and Quick Pairing Info */}
              <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                {/* Visual SVG QR Code */}
                <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0 flex flex-col items-center">
                  <svg
                    width="150"
                    height="150"
                    viewBox="0 0 29 29"
                    className="shape-rendering-crisp"
                  >
                    <rect width="29" height="29" fill="#ffffff" />
                    {qrMatrix.map((row, y) =>
                      row.map((val, x) =>
                        val ? (
                          <rect
                            key={`${x}-${y}`}
                            x={x}
                            y={y}
                            width="1"
                            height="1"
                            fill="#0f172a"
                          />
                        ) : null
                      )
                    )}
                  </svg>
                  <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider flex items-center space-x-1">
                    <QrCode className="w-3 h-3" />
                    <span>Scan with Camera</span>
                  </span>
                </div>

                {/* Connection Instructions */}
                <div className="space-y-3 text-left flex-1">
                  <div>
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-brand-50 text-brand-700 border border-brand-200 mb-1">
                      <Wifi className="w-3 h-3" />
                      <span>Same Wi-Fi or LAN</span>
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      Instant Pairing for {activeTab === 'mobile' ? 'Smartphones' : 'Tablets / iPads'}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed mt-0.5">
                      Open your phone camera to scan the QR code, or paste the link in your mobile browser.
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between">
                    <div className="truncate font-mono text-[11px] text-slate-700 select-all pr-2">
                      {connectUrl}
                    </div>
                    <button
                      onClick={() => handleCopy(connectUrl)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-600 text-slate-600 transition-colors shrink-0"
                      title="Copy URL"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                    <span className="font-semibold text-slate-700">Target Address:</span>
                    <span className="font-mono font-bold text-brand-600">
                      {formatDeviceId(deviceId)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Simulator & Vice-Versa Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => openSimulatedDevice(activeTab)}
                  className="py-3 px-4 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-xs transition-all flex items-center justify-center space-x-2 shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>
                    Simulate {activeTab === 'mobile' ? 'Mobile' : 'Tablet'} on this PC
                  </span>
                </button>

                <button
                  onClick={() => handleCopy(deviceId.replace(/\D/g, ''))}
                  className="py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all flex items-center justify-center space-x-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-600">Copied Device ID!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy 9-Digit Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Capabilities Checklist */}
              <div className="border border-slate-100 bg-slate-50/60 rounded-2xl p-4 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Supported Features for {activeTab === 'mobile' ? 'Mobile' : 'Tablet'}:
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Touch to Tap / Click</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Virtual Trackpad Mode</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>On-Screen Remote Keyboard</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Screen & Camera Broadcast</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Guide Tab: Clear explanations of all connection permutations */
            <div className="space-y-4 text-xs text-slate-600">
              <div className="p-4 rounded-2xl bg-brand-50/60 border border-brand-100 space-y-2">
                <div className="flex items-center space-x-2 text-brand-700 font-bold">
                  <Laptop className="w-4 h-4" />
                  <span>↔</span>
                  <Smartphone className="w-4 h-4" />
                  <span>Laptop to Mobile & Mobile to Laptop</span>
                </div>
                <p className="leading-relaxed text-slate-600">
                  <strong>Control Laptop from Phone:</strong> Open BeamDesk on your phone, enter your laptop's 9-digit address, and approve on laptop. You can now use your smartphone touch gestures, virtual trackpad, and keyboard shortcuts to control your laptop from anywhere!
                </p>
                <p className="leading-relaxed text-slate-600">
                  <strong>Control / View Phone from Laptop (Vice-Versa):</strong> Open BeamDesk on your phone, get its 9-digit address, and enter it on your laptop. The phone will broadcast its screen or camera to your laptop for tech support.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-cyan-50/60 border border-cyan-100 space-y-2">
                <div className="flex items-center space-x-2 text-cyan-800 font-bold">
                  <Laptop className="w-4 h-4" />
                  <span>↔</span>
                  <Tablet className="w-4 h-4" />
                  <span>Laptop to Tablet & Tablet to Laptop</span>
                </div>
                <p className="leading-relaxed text-slate-600">
                  <strong>Tablet as Second Screen / Controller:</strong> Tablets have large high-resolution touchscreens. Use your tablet to view your laptop desktop with pinch-to-zoom, stylus/touch precision, and full responsive controls.
                </p>
                <p className="leading-relaxed text-slate-600">
                  <strong>Tablet to Laptop (Vice-Versa):</strong> Stream your tablet screen to your laptop for demonstrations, presentations, or troubleshooting.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
                <span className="flex items-center space-x-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Zero installation required — works directly in any browser</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
