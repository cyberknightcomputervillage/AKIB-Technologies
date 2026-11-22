import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useStore } from '../context/StoreContext';

interface AdminLoginGateProps {
  onBackToStore: () => void;
}

export function AdminLoginGate({ onBackToStore }: AdminLoginGateProps) {
  const { user, isAdmin, signInWithGoogle, logout, unlockAdminPortal } = useStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await unlockAdminPortal(username, password);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Invalid admin credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-[#F2F4F8]">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
        {/* Top Navy Banner */}
        <div className="bg-[#081621] text-white px-6 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-[#EF4A23]" />
            <div>
              <h1 className="font-display text-lg font-bold">AKIB Technologies Admin</h1>
              <p className="text-xs text-slate-300">
                Authorized Store Management & Product Publishing
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Firebase Admin Session Step */}
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-2.5">
            {isAdmin && user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-emerald-800 font-medium min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span className="truncate">Database Verified: {user.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline shrink-0 cursor-pointer"
                >
                  Switch
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-[#3749BB] shrink-0" />
                  <span>
                    {user
                      ? `Signed in as ${user.email} (Not Admin)`
                      : 'Step 1: Verify Authorized Google Account'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Database writes require signing in with your authorized Firebase admin Google account first.
                </p>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="w-full px-4 py-2.5 rounded bg-[#3749BB] text-white text-xs font-semibold hover:bg-[#2A3998] transition-colors cursor-pointer min-h-[40px]"
                >
                  {user ? 'Switch to Admin Google Account' : 'Verify Admin Google Account'}
                </button>
              </>
            )}
          </div>

          {/* Username & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <div>
              <label
                htmlFor="admin-username"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Admin Username
              </label>
              <input
                id="admin-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter admin username"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
              />
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Admin Password
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#3749BB]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !isAdmin}
              className="w-full px-5 py-3 rounded bg-[#EF4A23] text-white text-sm font-semibold hover:bg-[#D93E18] disabled:bg-slate-300 disabled:text-slate-500 transition-colors cursor-pointer min-h-[44px]"
            >
              {submitting ? 'Verifying...' : 'Sign In to Admin Panel'}
            </button>
          </form>

          <div className="pt-2 border-t border-slate-200 text-center">
            <button
              type="button"
              onClick={onBackToStore}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Storefront
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
