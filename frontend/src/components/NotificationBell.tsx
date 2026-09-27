import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle2, Calendar, ListTodo } from 'lucide-react';
import { remindersApi, Reminder } from '../lib/api';
import { format } from 'date-fns';

export default function NotificationBell() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);

  const fetchReminders = async () => {
    try {
      const res = await remindersApi.upcoming();
      setReminders(res.data.reminders);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchReminders();
    const interval = setInterval(fetchReminders, 60000);
    return () => clearInterval(interval);
  }, []);

  // Browser push notifications
  useEffect(() => {
    if (reminders.length > 0 && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
      if (Notification.permission === 'granted') {
        reminders.forEach(r => {
          const title = r.event?.title || r.task?.title || 'Reminder';
          new Notification(`FocusFlow: ${title}`, {
            body: `Reminder for: ${title}`,
            icon: '/favicon.ico',
          });
        });
      }
    }
  }, [reminders]);

  const dismiss = async (id: string) => {
    await remindersApi.dismiss(id);
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-surface-800 transition-colors"
        id="notification-bell"
      >
        <Bell className="w-5 h-5 text-surface-200" />
        {reminders.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-accent-red text-white text-xs rounded-full flex items-center justify-center font-semibold animate-pulse-soft">
            {reminders.length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto glass rounded-xl shadow-elevated z-50 animate-scale-in">
            <div className="p-4 border-b border-white/5">
              <h3 className="text-sm font-semibold text-surface-100">Notifications</h3>
            </div>
            {reminders.length === 0 ? (
              <div className="p-6 text-center text-surface-200/50 text-sm">
                No new notifications
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {reminders.map(r => (
                  <div key={r.id} className="p-3 hover:bg-white/5 transition-colors flex items-start gap-3">
                    <div className="mt-0.5">
                      {r.event ? (
                        <Calendar className="w-4 h-4 text-primary-400" />
                      ) : (
                        <ListTodo className="w-4 h-4 text-accent-amber" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-100 truncate">
                        {r.event?.title || r.task?.title}
                      </p>
                      <p className="text-xs text-surface-200/60 mt-0.5">
                        {format(new Date(r.triggerAt), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <button
                      onClick={() => dismiss(r.id)}
                      className="p-1 hover:bg-white/10 rounded-md transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4 text-accent-green" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
