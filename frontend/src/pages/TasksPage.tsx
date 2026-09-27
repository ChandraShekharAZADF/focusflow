import React, { useState, useEffect } from 'react';
import { format, isPast } from 'date-fns';
import { Plus, X, Filter, SortAsc, CheckCircle2, Circle, Clock, Loader2, AlertCircle, Trash2, ArrowUpDown } from 'lucide-react';
import { tasksApi, Task, CreateTaskData } from '../lib/api';

const priorityConfig = {
  HIGH:   { label: 'High',   color: 'text-accent-red bg-accent-red/10 border-accent-red/20', dot: 'bg-accent-red' },
  MEDIUM: { label: 'Medium', color: 'text-accent-amber bg-accent-amber/10 border-accent-amber/20', dot: 'bg-accent-amber' },
  LOW:    { label: 'Low',    color: 'text-accent-cyan bg-accent-cyan/10 border-accent-cyan/20', dot: 'bg-accent-cyan' },
};

const statusConfig = {
  TODO:        { label: 'To Do',       icon: Circle,        color: 'text-surface-200/50' },
  IN_PROGRESS: { label: 'In Progress', icon: Clock,         color: 'text-accent-amber' },
  DONE:        { label: 'Done',        icon: CheckCircle2,  color: 'text-accent-green' },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('priority');
  const [sortOrder, setSortOrder] = useState<string>('desc');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params: any = { sortBy, order: sortOrder };
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      const res = await tasksApi.list(params);
      setTasks(res.data.tasks);
    } catch {
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const handleRefresh = () => fetchTasks();
    window.addEventListener('focusflow:refresh', handleRefresh);
    return () => window.removeEventListener('focusflow:refresh', handleRefresh);
  }, [filterStatus, filterPriority, sortBy, sortOrder]);

  const toggleStatus = async (task: Task) => {
    const nextStatus = task.status === 'TODO' ? 'IN_PROGRESS' : task.status === 'IN_PROGRESS' ? 'DONE' : 'TODO';
    await tasksApi.update(task.id, { status: nextStatus });
    fetchTasks();
  };

  const handleDelete = async (id: string) => {
    await tasksApi.delete(id);
    fetchTasks();
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-surface-100">Tasks</h1>
        <button onClick={() => setModalOpen(true)} id="create-task-btn"
          className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-medium rounded-xl hover:from-primary-500 hover:to-primary-400 transition-all shadow-glow">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-surface-200/40" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-xs bg-surface-900/50 border border-white/5 rounded-lg text-surface-200 outline-none">
          <option value="">All Statuses</option>
          <option value="TODO">To Do</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="DONE">Done</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="px-3 py-1.5 text-xs bg-surface-900/50 border border-white/5 rounded-lg text-surface-200 outline-none">
          <option value="">All Priorities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-surface-200/40" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="px-3 py-1.5 text-xs bg-surface-900/50 border border-white/5 rounded-lg text-surface-200 outline-none">
            <option value="priority">Priority</option>
            <option value="dueDate">Due Date</option>
            <option value="createdAt">Created</option>
          </select>
          <button onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
            className="px-2 py-1.5 text-xs text-surface-200/50 hover:text-surface-200 border border-white/5 rounded-lg transition-colors">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-400" /></div>
      ) : error ? (
        <div className="flex items-center justify-center h-64"><AlertCircle className="w-8 h-8 text-accent-red" /><span className="ml-2">{error}</span></div>
      ) : tasks.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-surface-200/20" />
          <p className="text-surface-200/40">No tasks found. Create one to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task, i) => {
            const StatusIcon = statusConfig[task.status].icon;
            const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'DONE';
            return (
              <div key={task.id}
                className={`glass rounded-xl p-4 flex items-center gap-4 hover:bg-white/[0.03] transition-all animate-slide-up ${
                  task.status === 'DONE' ? 'opacity-50' : ''
                }`}
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <button onClick={() => toggleStatus(task)} className="shrink-0 group" title="Toggle status">
                  <StatusIcon className={`w-5 h-5 ${statusConfig[task.status].color} group-hover:scale-110 transition-transform`} />
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-surface-100 ${task.status === 'DONE' ? 'line-through' : ''}`}>{task.title}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {task.dueDate && (
                      <span className={`text-xs ${isOverdue ? 'text-accent-red font-medium' : 'text-surface-200/40'}`}>
                        {isOverdue && '⚠ '}Due {format(new Date(task.dueDate), 'MMM d, h:mm a')}
                      </span>
                    )}
                  </div>
                </div>

                <span className={`px-2 py-0.5 text-xs font-medium rounded-md border shrink-0 ${priorityConfig[task.priority].color}`}>
                  {priorityConfig[task.priority].label}
                </span>

                <button onClick={() => handleDelete(task.id)} className="p-1.5 hover:bg-accent-red/10 rounded-lg transition-colors shrink-0">
                  <Trash2 className="w-4 h-4 text-surface-200/30 hover:text-accent-red" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && <TaskModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); fetchTasks(); }} />}
    </div>
  );
}

// ─── Task Modal ─────────────────────────────────────────

function TaskModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', dueDate: '', priority: 'MEDIUM' as string });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data: CreateTaskData = {
        title: form.title,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
        priority: form.priority as any,
      };
      await tasksApi.create(data);
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md glass rounded-2xl shadow-elevated animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-surface-100">New Task</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-800 rounded-lg"><X className="w-5 h-5 text-surface-200/60" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-surface-200/70 mb-1">Title</label>
            <input id="task-title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required
              className="w-full px-3 py-2.5 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 outline-none focus:border-primary-500/50 transition-colors" placeholder="What needs to be done?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-surface-200/70 mb-1">Due Date</label>
              <input id="task-due-date" type="datetime-local" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})}
                className="w-full px-3 py-2.5 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 outline-none focus:border-primary-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-surface-200/70 mb-1">Priority</label>
              <select id="task-priority" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}
                className="w-full px-3 py-2.5 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 outline-none focus:border-primary-500/50 transition-colors">
                <option value="HIGH">🔴 High</option>
                <option value="MEDIUM">🟡 Medium</option>
                <option value="LOW">🔵 Low</option>
              </select>
            </div>
          </div>
          {error && <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-xl text-accent-red text-sm">{error}</div>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-surface-200/60 border border-white/5 rounded-xl hover:bg-white/5 transition-all">Cancel</button>
            <button type="submit" disabled={saving} id="task-save-btn"
              className="flex-1 py-2.5 text-sm font-medium bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-500 hover:to-primary-400 transition-all shadow-glow disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
