import React, { useState } from 'react';
import { Key, Copy, RefreshCw, CheckCircle2, User, Shield, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../lib/api';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const copyApiKey = async () => {
    if (user?.apiKey) {
      await navigator.clipboard.writeText(user.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const regenerateKey = async () => {
    setRegenerating(true);
    try {
      await authApi.regenerateApiKey();
      await refreshUser();
    } catch { /* silent */ }
    setRegenerating(false);
  };

  const requestNotifPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('FocusFlow', { body: 'Push notifications enabled! 🎉' });
      }
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-surface-100">Settings</h1>

      {/* Profile */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-semibold text-surface-100">Profile</h2>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-surface-200/40 mb-1">Email</label>
            <p className="text-surface-100 font-medium">{user?.email}</p>
          </div>
          <div>
            <label className="block text-xs text-surface-200/40 mb-1">Member since</label>
            <p className="text-surface-200/70 text-sm">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-5 h-5 text-accent-amber" />
          <h2 className="text-lg font-semibold text-surface-100">API Key</h2>
        </div>
        <p className="text-xs text-surface-200/40 mb-3">
          Use this key in the FocusFlow browser extension to authenticate. Keep it secret.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2.5 bg-surface-900/50 border border-white/5 rounded-xl text-sm text-surface-200 font-mono truncate">
            {user?.apiKey || '—'}
          </code>
          <button onClick={copyApiKey}
            className="p-2.5 hover:bg-white/5 border border-white/5 rounded-xl transition-colors" title="Copy">
            {copied ? <CheckCircle2 className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4 text-surface-200/50" />}
          </button>
          <button onClick={regenerateKey} disabled={regenerating}
            className="p-2.5 hover:bg-white/5 border border-white/5 rounded-xl transition-colors" title="Regenerate">
            <RefreshCw className={`w-4 h-4 text-surface-200/50 ${regenerating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-accent-cyan" />
          <h2 className="text-lg font-semibold text-surface-100">Notifications</h2>
        </div>
        <p className="text-xs text-surface-200/40 mb-3">
          Enable browser push notifications to get alerted when reminders fire.
        </p>
        <button onClick={requestNotifPermission}
          className="px-4 py-2 text-sm font-medium text-primary-400 border border-primary-500/20 rounded-xl hover:bg-primary-500/10 transition-colors">
          Enable Push Notifications
        </button>
      </div>

      {/* Google OAuth Placeholder */}
      <div className="glass rounded-2xl p-6 opacity-50">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-accent-green" />
          <h2 className="text-lg font-semibold text-surface-100">Google Calendar Sync</h2>
          <span className="px-2 py-0.5 text-[10px] font-medium text-surface-200/40 border border-white/5 rounded-md">Coming Soon</span>
        </div>
        <p className="text-xs text-surface-200/40">
          Connect your Google account to sync events with Google Calendar.
        </p>
      </div>
    </div>
  );
}
