import React, { useState, useEffect } from 'react';
import { format, addHours, isAfter, isBefore, addDays } from 'date-fns';
import { Calendar, ListTodo, Clock, TrendingUp, ArrowRight, Loader2, AlertCircle, Zap } from 'lucide-react';
import { eventsApi, tasksApi, Event, Task } from '../lib/api';

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const now = new Date();
        const in48h = addDays(now, 2);
        const [evRes, taskRes] = await Promise.all([
          eventsApi.list(now.toISOString(), in48h.toISOString()),
          tasksApi.list({ sortBy: 'priority', order: 'desc' }),
        ]);
        setEvents(evRes.data.events);
        setTasks(taskRes.data.tasks);
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const handleRefresh = () => fetchData();
    window.addEventListener('focusflow:refresh', handleRefresh);
    return () => window.removeEventListener('focusflow:refresh', handleRefresh);
  }, []);

  const activeTasks = tasks.filter(t => t.status !== 'DONE');
  const topPriorityTasks = activeTasks.slice(0, 3);
  const completedToday = tasks.filter(t => {
    if (t.status !== 'DONE') return false;
    const updated = new Date(t.updatedAt);
    const today = new Date();
    return updated.toDateString() === today.toDateString();
  });

  const priorityColor: Record<string, string> = {
    HIGH: 'text-accent-red bg-accent-red/10 border-accent-red/20',
    MEDIUM: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20',
    LOW: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-accent-red mx-auto mb-3" />
          <p className="text-surface-200/60">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-100">Good {getGreeting()} 👋</h1>
        <p className="text-surface-200/50 mt-1">
          Here's what's on your plate today — {format(new Date(), 'EEEE, MMMM d')}
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<ListTodo className="w-5 h-5" />} label="Active Tasks" value={activeTasks.length} color="primary" />
        <StatCard icon={<Calendar className="w-5 h-5" />} label="Upcoming Events" value={events.length} color="amber" />
        <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Done Today" value={completedToday.length} color="green" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Due Soon" value={activeTasks.filter(t => t.dueDate && isBefore(new Date(t.dueDate), addDays(new Date(), 1))).length} color="red" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Top Priority Tasks */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-accent-amber" />
              Top Priority
            </h2>
            <a href="/tasks" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {topPriorityTasks.length === 0 ? (
            <div className="text-center py-8 text-surface-200/40">
              <ListTodo className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No active tasks. You're all caught up! 🎉</p>
            </div>
          ) : (
            <div className="space-y-3">
              {topPriorityTasks.map((task, i) => (
                <div
                  key={task.id}
                  className="flex items-center gap-3 p-3 bg-surface-900/30 rounded-xl hover:bg-surface-900/50 transition-colors animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-500/10 flex items-center justify-center text-primary-400 text-sm font-bold">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-100 truncate">{task.title}</p>
                    {task.dueDate && (
                      <p className="text-xs text-surface-200/40 mt-0.5">
                        Due {format(new Date(task.dueDate), 'MMM d, h:mm a')}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-md border ${priorityColor[task.priority]}`}>
                    {task.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary-400" />
              Next 48 Hours
            </h2>
            <a href="/calendar" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1 transition-colors">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {events.length === 0 ? (
            <div className="text-center py-8 text-surface-200/40">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No events in the next 48 hours</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 5).map((event, i) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 bg-surface-900/30 rounded-xl hover:bg-surface-900/50 transition-colors animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div
                    className="w-1.5 h-full min-h-[40px] rounded-full mt-0.5"
                    style={{ backgroundColor: event.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-100 truncate">{event.title}</p>
                    <p className="text-xs text-surface-200/40 mt-0.5">
                      {format(new Date(event.startTime), 'EEE, MMM d · h:mm a')}
                      {' — '}
                      {format(new Date(event.endTime), 'h:mm a')}
                    </p>
                    {event.location && (
                      <p className="text-xs text-surface-200/30 mt-0.5 truncate">📍 {event.location}</p>
                    )}
                  </div>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${
                    event.source === 'MEETUP' ? 'text-accent-red bg-accent-red/10 border-accent-red/20' :
                    event.source === 'LUMA' ? 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20' :
                    'text-surface-200/40 bg-surface-800/50 border-white/5'
                  }`}>
                    {event.source}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    primary: 'from-primary-500/15 to-primary-600/5 border-primary-500/10 text-primary-400',
    amber: 'from-accent-amber/15 to-accent-amber/5 border-accent-amber/10 text-accent-amber',
    green: 'from-accent-green/15 to-accent-green/5 border-accent-green/10 text-accent-green',
    red: 'from-accent-red/15 to-accent-red/5 border-accent-red/10 text-accent-red',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2 opacity-70">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="text-2xl font-bold text-surface-100">{value}</p>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
