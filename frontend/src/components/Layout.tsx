import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, ListTodo, Settings, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import NotificationBell from './NotificationBell';
import QuickAddBar from './QuickAddBar';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/calendar', icon: Calendar, label: 'Calendar' },
  { to: '/tasks', icon: ListTodo, label: 'Tasks' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col glass border-r border-white/5">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-primary-300 to-primary-500 bg-clip-text text-transparent">
            FocusFlow
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-primary-500/15 text-primary-300 shadow-glow'
                    : 'text-surface-200/70 hover:text-surface-100 hover:bg-white/5'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center text-white text-xs font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-100 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-200/60 hover:text-accent-red hover:bg-accent-red/10 rounded-lg transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/5 z-50 flex justify-around py-2 px-4">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-xs transition-all ${
                isActive ? 'text-primary-400' : 'text-surface-200/50'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/5 glass gap-4 z-40">
          <div className="md:hidden flex items-center gap-2 flex-shrink-0">
            <Zap className="w-5 h-5 text-primary-400" />
            <span className="font-bold text-primary-300">FocusFlow</span>
          </div>
          
          {/* Persistent AI Quick Add Bar */}
          <div className="flex-1 max-w-xl mx-auto px-2">
            <QuickAddBar />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-6 pb-24 md:pb-6">
          {children}
        </div>
      </main>
    </div>
  );
}
