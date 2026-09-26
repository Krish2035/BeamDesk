import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Monitor, User, Mail, Lock, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { signUpSchema, SignUpFormValues } from '../validations/auth.schema.js';
import { apiClient } from '../api/client.js';
import { useAuthStore } from '../store/useAuthStore.js';
import { socketService } from '../services/socket.service.js';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser, setTokens, registerDevice } = useAuthStore();

  const [formData, setFormData] = useState<SignUpFormValues>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
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

    const validation = signUpSchema.safeParse(formData);
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
      const res = await apiClient<any>('/auth/register', {
        method: 'POST',
        requiresAuth: false,
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      setUser(res.user);
      setTokens(res.tokens.accessToken, res.tokens.refreshToken);

      // Register device for current browser
      await registerDevice();
      socketService.connect();

      navigate('/dashboard');
    } catch (err: any) {
      setServerError(err.message || 'Failed to create account. Please try again.');
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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create your account</h2>
          <p className="text-xs text-slate-500">
            Sign up to securely access and manage your remote workstations
          </p>
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
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Alex Morgan"
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                  errors.name ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 focus:ring-brand-500'
                }`}
              />
            </div>
            {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name}</p>}
          </div>

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
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all ${
                  errors.confirmPassword
                    ? 'border-rose-300 focus:ring-rose-500'
                    : 'border-slate-200 focus:ring-brand-500'
                }`}
              />
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-rose-600 mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <span>Sign Up</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          Already have an account?{' '}
          <Link to="/signin" className="text-brand-600 font-semibold hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
