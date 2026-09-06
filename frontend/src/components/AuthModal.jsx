import React, { useState } from 'react';
import { Mail, Lock, User, X, ArrowRight, ArrowLeft, Github, CheckCircle2, KeyRound } from 'lucide-react';
import { supabase } from '../utils/supabase';

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup' | 'forgot' | 'reset'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleResetFormState = (mode = 'signin') => {
    setAuthMode(mode);
    setError('');
    setSuccessMsg('');
  };

  const handleSignIn = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both email address and password.');
      return;
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email format (e.g. name@example.com).');
      return;
    }

    setLoading(true);
    try {
      // 1. Try Backend API login
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password: cleanPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Fallback to Supabase auth if backend API returned error
        const supaRes = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        if (supaRes.error) throw new Error(data.detail || supaRes.error.message);
        
        const u = supaRes.data.user;
        const userData = {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.full_name || u.email.split('@')[0],
          avatar: u.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`,
          token: supaRes.data.session?.access_token,
        };
        localStorage.setItem('pixlexpert_user', JSON.stringify(userData));
        onAuthSuccess(userData);
        onClose();
        return;
      }

      const userData = data.user;
      localStorage.setItem('pixlexpert_user', JSON.stringify(userData));
      onAuthSuccess(userData);
      onClose();
    } catch (err) {
      setError(err.message || 'Invalid email or password credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanName = name.trim();

    if (!cleanName || cleanName.length < 2) {
      setError('Please enter your full name (at least 2 characters).');
      return;
    }
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (cleanPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      // 1. Backend API Registration
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName, email: cleanEmail, password: cleanPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Fallback to Supabase SignUp
        const supaRes = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: { data: { full_name: cleanName } },
        });
        if (supaRes.error) throw new Error(data.detail || supaRes.error.message);

        const u = supaRes.data.user;
        const userData = {
          id: u.id,
          email: u.email,
          name: cleanName,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanName)}`,
          token: supaRes.data.session?.access_token,
        };
        localStorage.setItem('pixlexpert_user', JSON.stringify(userData));
        onAuthSuccess(userData);
        onClose();
        return;
      }

      const userData = data.user;
      localStorage.setItem('pixlexpert_user', JSON.stringify(userData));
      onAuthSuccess(userData);
      onClose();
    } catch (err) {
      setError(err.message || 'Account registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError('Please enter a valid registered email address.');
      return;
    }

    setLoading(true);
    try {
      // Try Supabase password reset email
      if (supabase) {
        supabase.auth.resetPasswordForEmail(cleanEmail).catch(() => {});
      }

      // Backend API Forgot Password
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to process password reset request.');
      }

      if (data.reset_token) {
        setResetToken(data.reset_token);
        setAuthMode('reset');
        setSuccessMsg('Reset token generated! Please enter a new password below.');
      } else {
        setSuccessMsg(`Password reset instructions have been sent to ${cleanEmail}.`);
      }
    } catch (err) {
      setError(err.message || 'Password reset request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async () => {
    const cleanEmail = email.trim();
    const cleanPass = newPassword.trim();
    if (cleanPass.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, reset_token: resetToken, new_password: cleanPass }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Password reset failed.');
      }

      setSuccessMsg('Your password has been successfully updated! You can now sign in.');
      setTimeout(() => {
        handleResetFormState('signin');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSubmit = async (provider) => {
    setError('');
    setLoading(true);
    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOAuth({ provider });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message || `Failed to authenticate with ${provider}.`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl border border-slate-200/90 shadow-2xl shadow-slate-900/20 overflow-hidden relative transition-all p-6 sm:p-7 space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-4">
          {/* Header Titles */}
          <div className="text-left pt-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {authMode === 'signup' && 'Create your account'}
              {authMode === 'signin' && 'Welcome back'}
              {authMode === 'forgot' && 'Reset your password'}
              {authMode === 'reset' && 'Set new password'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {authMode === 'signup' && 'Sign up to build AI web applications and manage sessions.'}
              {authMode === 'signin' && 'Sign in to access your saved chat sessions and projects.'}
              {authMode === 'forgot' && 'Enter your email address to receive reset instructions.'}
              {authMode === 'reset' && 'Enter your new account password.'}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (authMode === 'signin') handleSignIn();
              else if (authMode === 'signup') handleSignUp();
              else if (authMode === 'forgot') handleForgotPassword();
              else if (authMode === 'reset') handleResetPasswordSubmit();
            }}
            className="space-y-3.5"
          >
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium leading-relaxed">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-start space-x-2 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Sign Up Name Input */}
            {authMode === 'signup' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Mukesh Singh"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all font-sans"
                  />
                </div>
              </div>
            )}

            {/* Email Input */}
            {authMode !== 'reset' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all font-sans"
                  />
                </div>
              </div>
            )}

            {/* Password Input for Sign In / Sign Up */}
            {(authMode === 'signin' || authMode === 'signup') && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-700">Password</label>
                  {authMode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => handleResetFormState('forgot')}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all font-sans"
                  />
                </div>
              </div>
            )}

            {/* Reset Password Form Step */}
            {authMode === 'reset' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all font-sans"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-all shadow-md shadow-slate-900/15 hover:shadow-lg flex items-center justify-center space-x-2 active:scale-[0.99]"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {authMode === 'signin' && 'Sign In'}
                    {authMode === 'signup' && 'Create Account'}
                    {authMode === 'forgot' && 'Send Reset Link'}
                    {authMode === 'reset' && 'Update Password'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* OAuth Dividers & Social Login (Only in Sign In / Sign Up modes) */}
            {(authMode === 'signin' || authMode === 'signup') && (
              <>
                <div className="relative flex items-center justify-center my-3">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-2.5 text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
                    Or continue with
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleOAuthSubmit('google')}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all flex items-center justify-center space-x-2 shadow-2xs hover:shadow-xs"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOAuthSubmit('github')}
                    className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all flex items-center justify-center space-x-2 shadow-2xs hover:shadow-xs"
                  >
                    <Github className="w-4 h-4 shrink-0" />
                    <span>GitHub</span>
                  </button>
                </div>
              </>
            )}

            {/* Bottom Toggle Navigation */}
            <div className="pt-2 text-center text-xs text-slate-500 font-sans">
              {authMode === 'signin' && (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleResetFormState('signup')}
                    className="text-slate-900 font-semibold hover:underline"
                  >
                    Sign Up
                  </button>
                </>
              )}

              {authMode === 'signup' && (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => handleResetFormState('signin')}
                    className="text-slate-900 font-semibold hover:underline"
                  >
                    Sign In
                  </button>
                </>
              )}

              {(authMode === 'forgot' || authMode === 'reset') && (
                <button
                  type="button"
                  onClick={() => handleResetFormState('signin')}
                  className="text-slate-900 font-semibold hover:underline inline-flex items-center space-x-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
