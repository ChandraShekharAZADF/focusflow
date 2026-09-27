import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Bearer token from localStorage as fallback for seamless persistence
api.interceptors.request.use((reqConfig) => {
  const token = localStorage.getItem('focusflow_token');
  if (token && reqConfig.headers) {
    reqConfig.headers.Authorization = `Bearer ${token}`;
  }
  return reqConfig;
});

// ─── Auth ────────────────────────────────────────────────

export const authApi = {
  signup: (email: string, password: string) =>
    api.post('/auth/signup', { email, password }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  regenerateApiKey: () => api.post('/auth/regenerate-api-key'),
};

// ─── Events ──────────────────────────────────────────────

export interface Event {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  startTime: string;
  endTime: string;
  location?: string | null;
  source: 'MANUAL' | 'MEETUP' | 'LUMA';
  sourceUrl?: string | null;
  color?: string | null;
  createdAt: string;
  updatedAt: string;
  reminders?: Reminder[];
}

export interface CreateEventData {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  source?: 'MANUAL' | 'MEETUP' | 'LUMA';
  sourceUrl?: string;
  color?: string;
}

export const eventsApi = {
  list: (from?: string, to?: string) => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return api.get<{ events: Event[] }>('/events', { params });
  },
  create: (data: CreateEventData) =>
    api.post<{ event: Event }>('/events', data),
  update: (id: string, data: Partial<CreateEventData>) =>
    api.patch<{ event: Event }>(`/events/${id}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
};

// ─── Tasks ───────────────────────────────────────────────

export interface Task {
  id: string;
  userId: string;
  title: string;
  dueDate?: string | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdAt: string;
  updatedAt: string;
  reminders?: Reminder[];
}

export interface CreateTaskData {
  title: string;
  dueDate?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'TODO' | 'IN_PROGRESS' | 'DONE';
}

export const tasksApi = {
  list: (params?: { status?: string; priority?: string; sortBy?: string; order?: string }) =>
    api.get<{ tasks: Task[] }>('/tasks', { params }),
  create: (data: CreateTaskData) =>
    api.post<{ task: Task }>('/tasks', data),
  update: (id: string, data: Partial<CreateTaskData>) =>
    api.patch<{ task: Task }>(`/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

// ─── Reminders ───────────────────────────────────────────

export interface Reminder {
  id: string;
  eventId?: string | null;
  taskId?: string | null;
  triggerOffsetMinutes: number;
  method: 'PUSH' | 'EMAIL';
  sent: boolean;
  triggerAt: string;
  event?: { id: string; title: string; startTime: string; endTime?: string } | null;
  task?: { id: string; title: string; dueDate?: string; priority?: string } | null;
}

export const remindersApi = {
  upcoming: () => api.get<{ reminders: Reminder[] }>('/reminders'),
  all: () => api.get<{ reminders: Reminder[] }>('/reminders/all'),
  create: (data: { eventId?: string; taskId?: string; triggerOffsetMinutes: number; method?: string }) =>
    api.post<{ reminder: Reminder }>('/reminders', data),
  dismiss: (id: string) => api.patch(`/reminders/${id}/dismiss`),
};

// ─── AI Assistant ────────────────────────────────────────

export interface AiInterpretResponse {
  status: 'created' | 'needs_clarification' | 'conflict' | 'error';
  type?: 'event' | 'task';
  summary?: string;
  eventId?: string;
  taskId?: string;
  question?: string;
  conflictingEvent?: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  };
  message?: string;
  suggestedSlots?: Array<{ start: string; end: string; label: string }>;
  conversationId?: string;
}

export const aiApi = {
  interpret: (data: { inputText: string; timezone: string; conversationId?: string }) =>
    api.post<AiInterpretResponse>('/ai/interpret', data),
  undo: (data: { eventId?: string; taskId?: string }) =>
    api.post<{ status: string; message: string }>('/ai/undo', data),
};

export default api;

