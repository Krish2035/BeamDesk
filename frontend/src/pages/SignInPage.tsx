import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Monitor, Mail, Lock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { signInSchema, SignInFormValues } from '../validations/auth.schema.js';
import { apiClient } from '../api/client.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { socketService } from '../services/socket.service.js';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setTokens, registerDevice } = useAuthStore();

  const [formData, setFormData] = useState<SignInFormValues>({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const validation = signInSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        if (issue.path[0]) {
          fieldErrors[issue.path[0].toString()] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await apiClient<any>('/auth/login', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify(formData),
      });

      setUser(res.user);
      setTokens(res.tokens.accessToken, res.tokens.refreshToken);

      // Register or reclaim device
      await registerDevice();
      socketService.connect();

      navigate('/dashboard');
    } catch (err: any) {
      setServerError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto shadow-sm">
            <Monitor className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
          <p className="text-xs text-slate-500">Sign in to start or join remote assistance sessions</p>
        </div>

        {serverError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="alex@example.com"
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                  errors.email ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:ring-brand-500'
                }`}
              />
            </div>
            {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email}</p>}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <button
                type="button"
                onClick={() => alert('Password reset link has been dispatched to your email address.')}
                className="text-xs text-brand-600 hover:underline"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                  errors.password ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:ring-brand-500'
                }`}
              />
            </div>
            {errors.password && <p className="text-xs text-rose-600 mt-1">{errors.password}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Quick Fill Credentials Banner */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 font-medium">
            <span>Quick Login Credentials</span>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">Ready</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setFormData({ email: 'krish@beamdesk.io', password: 'Password123!' })}
              className="px-2.5 py-1.5 text-left bg-white border border-slate-200 hover:border-brand-500 rounded-lg transition-all text-[11px] group"
            >
              <span className="font-semibold text-slate-800 block group-hover:text-brand-600">Krish</span>
              <span className="text-slate-400 text-[10px] block truncate">krish@beamdesk.io</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData({ email: 'demo@beamdesk.io', password: 'Password123!' })}
              className="px-2.5 py-1.5 text-left bg-white border border-slate-200 hover:border-brand-500 rounded-lg transition-all text-[11px] group"
            >
              <span className="font-semibold text-slate-800 block group-hover:text-brand-600">Demo User</span>
              <span className="text-slate-400 text-[10px] block truncate">demo@beamdesk.io</span>
            </button>
          </div>
          <div className="text-[10px] text-slate-400 text-center">
            Password: <code className="bg-white px-1 py-0.5 rounded border border-slate-200 font-mono text-slate-600">Password123!</code>
          </div>
        </div>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand-600 font-semibold hover:underline">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};
