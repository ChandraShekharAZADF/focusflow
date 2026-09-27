import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await signup(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/8 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary-700/6 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-glow mb-4">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-300 to-primary-500 bg-clip-text text-transparent">
            FocusFlow
          </h1>
          <p className="text-surface-200/50 mt-2">Your personal productivity command center</p>
        </div>

        {/* Form Card */}
        <div className="glass rounded-2xl p-8 shadow-elevated">
          <div className="flex mb-6 bg-surface-900/50 rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isLogin
                  ? 'bg-primary-500/20 text-primary-300 shadow-glow'
                  : 'text-surface-200/50 hover:text-surface-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                !isLogin
                  ? 'bg-primary-500/20 text-primary-300 shadow-glow'
                  : 'text-surface-200/50 hover:text-surface-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-200/70 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30" />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 placeholder:text-surface-200/25 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-200/70 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-200/30" />
                <input
                  id="auth-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 placeholder:text-surface-200/25 focus:border-primary-500/50 focus:ring-1 focus:ring-primary-500/20 transition-all outline-none"
                  placeholder={isLogin ? 'Enter your password' : 'Min. 8 characters'}
                  required
                  minLength={isLogin ? 1 : 8}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-xl text-accent-red text-sm animate-scale-in">
                {error}
              </div>
            )}

            <button
              id="auth-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-medium rounded-xl hover:from-primary-500 hover:to-primary-400 transition-all shadow-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {isLogin && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('demo@focusflow.io');
                    setPassword('password123');
                    setError('');
                  }}
                  className="text-xs text-primary-400 hover:text-primary-300 underline underline-offset-4 transition-colors"
                  id="fill-demo-btn"
                >
                  ⚡ Fill Demo Account (demo@focusflow.io / password123)
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
