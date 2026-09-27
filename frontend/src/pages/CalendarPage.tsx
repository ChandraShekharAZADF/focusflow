import React, { useState, useEffect, useMemo } from 'react';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths,
  subMonths, isSameMonth, isSameDay, isToday, startOfDay, endOfDay,
  addWeeks, subWeeks, startOfHour, addHours, areIntervalsOverlapping, parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Loader2, AlertCircle, MapPin, Clock, Edit, Trash2 } from 'lucide-react';
import { eventsApi, Event, CreateEventData } from '../lib/api';

type View = 'month' | 'week' | 'day';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<View>('month');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const start = view === 'month' ? startOfWeek(startOfMonth(currentDate)) :
                    view === 'week' ? startOfWeek(currentDate) : startOfDay(currentDate);
      const end = view === 'month' ? endOfWeek(endOfMonth(currentDate)) :
                  view === 'week' ? endOfWeek(currentDate) : endOfDay(currentDate);
      const res = await eventsApi.list(start.toISOString(), end.toISOString());
      setEvents(res.data.events || []);
      setError('');
    } catch (err: any) {
      console.error('Failed to load events:', err);
      setError(err?.response?.data?.error || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const handleRefresh = () => fetchEvents();
    window.addEventListener('focusflow:refresh', handleRefresh);
    return () => window.removeEventListener('focusflow:refresh', handleRefresh);
  }, [currentDate, view]);

  const navigate = (dir: 'prev' | 'next') => {
    if (view === 'month') setCurrentDate(dir === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(dir === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    else setCurrentDate(dir === 'next' ? addDays(currentDate, 1) : addDays(currentDate, -1));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    await eventsApi.delete(id);
    fetchEvents();
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setModalOpen(true);
  };

  // Detect conflicts (overlapping events) safely
  const conflicts = useMemo(() => {
    const ids = new Set<string>();
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i], b = events[j];
        const startA = safeParseDate(a.startTime);
        const endA = safeParseDate(a.endTime);
        const startB = safeParseDate(b.startTime);
        const endB = safeParseDate(b.endTime);
        if (startA.getTime() < endA.getTime() && startB.getTime() < endB.getTime()) {
          try {
            if (areIntervalsOverlapping(
              { start: startA, end: endA },
              { start: startB, end: endB },
            )) {
              ids.add(a.id); ids.add(b.id);
            }
          } catch {
            // ignore malformed interval error
          }
        }
      }
    }
    return ids;
  }, [events]);

  const headerLabel = view === 'month' ? format(currentDate, 'MMMM yyyy') :
                      view === 'week' ? `${format(startOfWeek(currentDate), 'MMM d')} – ${format(endOfWeek(currentDate), 'MMM d, yyyy')}` :
                      format(currentDate, 'EEEE, MMMM d, yyyy');

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('prev')} className="p-2 hover:bg-surface-800 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-surface-200" />
            </button>
            <button onClick={() => navigate('next')} className="p-2 hover:bg-surface-800 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5 text-surface-200" />
            </button>
          </div>
          <h1 className="text-xl font-bold text-surface-100">{headerLabel}</h1>
          <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-xs font-medium text-primary-400 border border-primary-500/20 rounded-lg hover:bg-primary-500/10 transition-colors">
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex bg-surface-900/50 rounded-xl p-1">
            {(['month', 'week', 'day'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all capitalize ${
                  view === v ? 'bg-primary-500/20 text-primary-300' : 'text-surface-200/50 hover:text-surface-200'
                }`}
              >{v}</button>
            ))}
          </div>
          <button
            onClick={() => { setEditingEvent(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white text-sm font-medium rounded-xl hover:from-primary-500 hover:to-primary-400 transition-all shadow-glow"
            id="create-event-btn"
          >
            <Plus className="w-4 h-4" /> Event
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-400" /></div>
      ) : error ? (
        <div className="flex items-center justify-center h-64"><AlertCircle className="w-8 h-8 text-accent-red" /><span className="ml-2 text-surface-200/60">{error}</span></div>
      ) : (
        <>
          {view === 'month' && <MonthView currentDate={currentDate} events={events} conflicts={conflicts} onEdit={handleEdit} onDelete={handleDelete} />}
          {view === 'week' && <WeekView currentDate={currentDate} events={events} conflicts={conflicts} onEdit={handleEdit} onDelete={handleDelete} />}
          {view === 'day' && <DayView currentDate={currentDate} events={events} conflicts={conflicts} onEdit={handleEdit} onDelete={handleDelete} />}
        </>
      )}

      {modalOpen && (
        <EventModal
          event={editingEvent}
          onClose={() => { setModalOpen(false); setEditingEvent(null); }}
          onSaved={() => { setModalOpen(false); setEditingEvent(null); fetchEvents(); }}
        />
      )}
    </div>
  );
}

function safeParseDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return isNaN(val.getTime()) ? new Date() : val;
  try {
    const s = String(val);
    const parsed = parseISO(s);
    if (!isNaN(parsed.getTime())) return parsed;
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  } catch {}
  return new Date();
}

function safeFormat(val: any, fmt: string): string {
  try {
    const d = safeParseDate(val);
    return format(d, fmt);
  } catch {
    return '';
  }
}

// ─── Month View ─────────────────────────────────────────

function MonthView({ currentDate, events, conflicts, onEdit, onDelete }: {
  currentDate: Date; events: Event[]; conflicts: Set<string>; onEdit: (e: Event) => void; onDelete: (id: string) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const start = startOfWeek(monthStart);
  const end = endOfWeek(endOfMonth(currentDate));
  const days: Date[] = [];
  let d = start;
  while (d <= end) { days.push(d); d = addDays(d, 1); }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-white/5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="p-3 text-center text-xs font-semibold text-surface-200/40 uppercase tracking-wider">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvents = events.filter(e => isSameDay(safeParseDate(e.startTime), day));
          return (
            <div key={i} className={`min-h-[100px] p-2 border-b border-r border-white/5 ${
              !isSameMonth(day, currentDate) ? 'bg-surface-950/30' : ''
            } ${isToday(day) ? 'bg-primary-500/5' : ''}`}>
              <span className={`text-xs font-medium ${
                isToday(day) ? 'w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center' :
                !isSameMonth(day, currentDate) ? 'text-surface-200/20' : 'text-surface-200/60'
              }`}>
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map(ev => (
                  <button key={ev.id} onClick={() => onEdit(ev)}
                    className={`w-full text-left px-1.5 py-0.5 text-[10px] rounded truncate font-medium transition-colors ${
                      conflicts.has(ev.id) ? 'bg-accent-red/20 text-accent-red ring-1 ring-accent-red/30' : 'hover:brightness-125'
                    }`}
                    style={!conflicts.has(ev.id) ? { backgroundColor: (ev.color || '#6366f1') + '22', color: ev.color || '#6366f1' } : {}}
                  >
                    {safeFormat(ev.startTime, 'h:mm')} {ev.title}
                  </button>
                ))}
                {dayEvents.length > 3 && <span className="text-[10px] text-surface-200/30 pl-1">+{dayEvents.length - 3} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week View ──────────────────────────────────────────

function WeekView({ currentDate, events, conflicts, onEdit, onDelete }: {
  currentDate: Date; events: Event[]; conflicts: Set<string>; onEdit: (e: Event) => void; onDelete: (id: string) => void;
}) {
  const weekStart = startOfWeek(currentDate);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="grid grid-cols-8 border-b border-white/5">
        <div className="p-3" />
        {days.map((day, i) => (
          <div key={i} className={`p-3 text-center border-l border-white/5 ${isToday(day) ? 'bg-primary-500/5' : ''}`}>
            <div className="text-xs text-surface-200/40">{format(day, 'EEE')}</div>
            <div className={`text-sm font-semibold mt-0.5 ${isToday(day) ? 'text-primary-400' : 'text-surface-100'}`}>{format(day, 'd')}</div>
          </div>
        ))}
      </div>
      <div className="overflow-y-auto max-h-[600px]">
        {hours.map(hour => (
          <div key={hour} className="grid grid-cols-8 border-b border-white/5 min-h-[48px]">
            <div className="p-1 text-right text-[10px] text-surface-200/30 pr-2">{format(new Date(2000, 0, 1, hour), 'ha')}</div>
            {days.map((day, di) => {
              const slotEvents = events.filter(e => {
                const s = safeParseDate(e.startTime);
                return isSameDay(s, day) && s.getHours() === hour;
              });
              return (
                <div key={di} className="border-l border-white/5 p-0.5 relative">
                  {slotEvents.map(ev => (
                    <button key={ev.id} onClick={() => onEdit(ev)}
                      className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${
                        conflicts.has(ev.id) ? 'bg-accent-red/20 text-accent-red ring-1 ring-accent-red/30' : ''
                      }`}
                      style={!conflicts.has(ev.id) ? { backgroundColor: (ev.color || '#6366f1') + '22', color: ev.color || '#6366f1' } : {}}
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Day View ───────────────────────────────────────────

function DayView({ currentDate, events, conflicts, onEdit, onDelete }: {
  currentDate: Date; events: Event[]; conflicts: Set<string>; onEdit: (e: Event) => void; onDelete: (id: string) => void;
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayEvents = events.filter(e => isSameDay(safeParseDate(e.startTime), currentDate));

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="overflow-y-auto max-h-[600px]">
        {hours.map(hour => {
          const hourEvents = dayEvents.filter(e => safeParseDate(e.startTime).getHours() === hour);
          return (
            <div key={hour} className="flex border-b border-white/5 min-h-[56px]">
              <div className="w-16 p-2 text-right text-xs text-surface-200/30 shrink-0">{format(new Date(2000, 0, 1, hour), 'h a')}</div>
              <div className="flex-1 border-l border-white/5 p-1 space-y-1">
                {hourEvents.map(ev => (
                  <div key={ev.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      conflicts.has(ev.id) ? 'bg-accent-red/15 ring-1 ring-accent-red/30' : 'hover:brightness-125'
                    }`}
                    style={!conflicts.has(ev.id) ? { backgroundColor: (ev.color || '#6366f1') + '15' } : {}}
                    onClick={() => onEdit(ev)}
                  >
                    <div className="w-1 h-8 rounded-full" style={{ backgroundColor: ev.color || '#6366f1' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-100 truncate">{ev.title}</p>
                      <p className="text-xs text-surface-200/40">{safeFormat(ev.startTime, 'h:mm a')} – {safeFormat(ev.endTime, 'h:mm a')}</p>
                    </div>
                    {conflicts.has(ev.id) && <span className="text-[10px] text-accent-red font-medium px-1.5 py-0.5 bg-accent-red/10 rounded">CONFLICT</span>}
                    <button onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }} className="p-1 hover:bg-white/10 rounded"><Trash2 className="w-3.5 h-3.5 text-surface-200/40" /></button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Event Modal ────────────────────────────────────────

function EventModal({ event, onClose, onSaved }: { event: Event | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: event?.title || '',
    description: event?.description || '',
    startTime: event ? safeFormat(event.startTime, "yyyy-MM-dd'T'HH:mm") : format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
    endTime: event ? safeFormat(event.endTime, "yyyy-MM-dd'T'HH:mm") : format(addHours(new Date(), 2), "yyyy-MM-dd'T'HH:mm"),
    location: event?.location || '',
    color: event?.color || '#6366f1',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data: CreateEventData = {
        title: form.title,
        description: form.description || undefined,
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        location: form.location || undefined,
        color: form.color,
      };
      if (event) {
        await eventsApi.update(event.id, data);
      } else {
        await eventsApi.create(data);
      }
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-md glass rounded-2xl shadow-elevated animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-lg font-semibold text-surface-100">{event ? 'Edit Event' : 'New Event'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-800 rounded-lg"><X className="w-5 h-5 text-surface-200/60" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm text-surface-200/70 mb-1">Title</label>
            <input id="event-title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required
              className="w-full px-3 py-2.5 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 outline-none focus:border-primary-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-surface-200/70 mb-1">Description</label>
            <textarea id="event-description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2}
              className="w-full px-3 py-2.5 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 outline-none focus:border-primary-500/50 transition-colors resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-surface-200/70 mb-1">Start</label>
              <input id="event-start" type="datetime-local" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} required
                className="w-full px-3 py-2.5 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 outline-none focus:border-primary-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-sm text-surface-200/70 mb-1">End</label>
              <input id="event-end" type="datetime-local" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} required
                className="w-full px-3 py-2.5 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 outline-none focus:border-primary-500/50 transition-colors" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-surface-200/70 mb-1">Location</label>
              <input id="event-location" value={form.location} onChange={e => setForm({...form, location: e.target.value})}
                className="w-full px-3 py-2.5 bg-surface-900/50 border border-white/5 rounded-xl text-surface-100 outline-none focus:border-primary-500/50 transition-colors" />
            </div>
            <div className="w-20">
              <label className="block text-sm text-surface-200/70 mb-1">Color</label>
              <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})}
                className="w-full h-[42px] bg-surface-900/50 border border-white/5 rounded-xl cursor-pointer" />
            </div>
          </div>

          {error && <div className="p-3 bg-accent-red/10 border border-accent-red/20 rounded-xl text-accent-red text-sm">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium text-surface-200/60 hover:text-surface-200 border border-white/5 rounded-xl hover:bg-white/5 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving} id="event-save-btn"
              className="flex-1 py-2.5 text-sm font-medium bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-500 hover:to-primary-400 transition-all shadow-glow disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (event ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
