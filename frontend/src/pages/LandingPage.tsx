import React from 'react';
import { Link } from 'react-router-dom';
import {
  Monitor,
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Globe,
  Sliders,
  CheckCircle2,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            {/* Pill */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold tracking-wide shadow-sm">
              <span className="flex h-2 w-2 rounded-full bg-brand-600 animate-pulse" />
              <span>Next-Gen WebRTC Remote Desktop System</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              Seamless Remote Access,{' '}
              <span className="bg-gradient-to-r from-brand-600 to-cyan-600 bg-clip-text text-transparent">
                Direct in Your Browser
              </span>
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              BeamDesk provides ultra-low latency remote screen viewing, diagnostic assistance, and device management with zero installation hurdles and strict interactive consent.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/signup"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-lg shadow-brand-600/25 transition-all flex items-center justify-center space-x-2 group"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/signin"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200 shadow-sm transition-all flex items-center justify-center"
              >
                <span>Sign In to Dashboard</span>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="pt-8 flex flex-wrap justify-center items-center gap-6 text-xs text-slate-500 font-medium">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>WebRTC 60 FPS Video</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>End-to-End DTLS Encryption</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Zero Hidden Access</span>
              </div>
            </div>
          </div>

          {/* Interactive Mockup Graphic */}
          <div className="mt-14 max-w-4xl mx-auto rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="text-xs font-mono text-slate-500 font-medium">
                beamdesk://remote-session/489-123-789
              </div>
              <div className="flex items-center space-x-1 text-emerald-600 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>60 FPS • 16ms</span>
              </div>
            </div>
            <div className="p-8 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white min-h-[300px] flex flex-col items-center justify-center relative">
              <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
              <Monitor className="w-16 h-16 text-brand-400 mb-4 animate-bounce" />
              <h3 className="text-xl font-bold tracking-tight">Ultra-Crisp Peer-to-Peer Remote Stream</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-md text-center">
                Sub-frame latency media pipeline utilizing hardware-accelerated H.264 / VP8 codecs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-bold text-slate-900">Engineered for Reliability and Consent</h2>
            <p className="text-sm text-slate-500 mt-2">
              Enterprise-grade communication architecture built strictly around user privacy and real-time responsiveness.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center font-bold">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Ultra-Low Latency</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Direct WebRTC peer connections negotiated via STUN/TURN deliver smooth 60 FPS desktop streaming with near-zero input lag.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Explicit Consent</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                No silent control or hidden background sessions. Every connection requires an explicit interactive approval and offers immediate revocation.
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-lg transition-all space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">Granular Controls</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Configure permissions per session: view-only mode, mouse interaction, keyboard input, system audio, and synchronized clipboard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 bg-slate-100 border-t border-slate-200 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <Monitor className="w-4 h-4 text-brand-600" />
            <span className="font-semibold text-slate-700">BeamDesk Remote Systems</span>
          </div>
          <div>All sessions are peer-to-peer encrypted via DTLS-SRTP.</div>
          <div>© {new Date().getFullYear()} BeamDesk. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};
