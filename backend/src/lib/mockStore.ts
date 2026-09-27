// ─── Dev Mock In-Memory Store ──────────────────────────────
// Activated automatically when PostgreSQL is not running locally

import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

export interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  apiKey: string;
  createdAt: Date;
}

export interface MockEvent {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  startTime: Date;
  endTime: Date;
  location?: string | null;
  source: 'MANUAL' | 'MEETUP' | 'LUMA';
  sourceUrl?: string | null;
  color?: string | null;
  createdAt: Date;
  updatedAt: Date;
  reminders?: any[];
}

export interface MockTask {
  id: string;
  userId: string;
  title: string;
  dueDate?: Date | null;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdAt: Date;
  updatedAt: Date;
  reminders?: any[];
}

const DB_DIR = path.resolve(__dirname, '../../data');
const DB_FILE = path.join(DB_DIR, 'mock_db.json');

class MockStore {
  private users: MockUser[] = [];
  private events: MockEvent[] = [];
  private tasks: MockTask[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const data = JSON.parse(raw);
        this.users = (data.users || []).map((u: any) => ({ ...u, createdAt: new Date(u.createdAt) }));
        this.events = (data.events || []).map((e: any) => ({
          ...e,
          startTime: new Date(e.startTime),
          endTime: new Date(e.endTime),
          createdAt: new Date(e.createdAt),
          updatedAt: new Date(e.updatedAt),
        }));
        this.tasks = (data.tasks || []).map((t: any) => ({
          ...t,
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        }));
      }
    } catch (e) {
      console.warn('Failed to load mock_db.json:', e);
    }

    if (this.users.length === 0) {
      this.seed();
    }
  }

  private saveToDisk() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(
        DB_FILE,
        JSON.stringify(
          {
            users: this.users,
            events: this.events,
            tasks: this.tasks,
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (e) {
      console.warn('Failed to save to mock_db.json:', e);
    }
  }

  private seed() {
    const demoPasswordHash = bcrypt.hashSync('password123', 10);
    const demoUser: MockUser = {
      id: 'demo-user-1',
      email: 'demo@focusflow.io',
      passwordHash: demoPasswordHash,
      apiKey: 'ff_live_demo_key_987654321',
      createdAt: new Date(),
    };
    this.users.push(demoUser);

    const now = new Date();
    const today = (hours: number, minutes = 0) => {
      const d = new Date(now);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };
    const tomorrow = (hours: number, minutes = 0) => {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    // Events (includes an intentional overlap conflict to showcase conflict detection!)
    this.events.push(
      {
        id: 'ev-1',
        userId: demoUser.id,
        title: 'Team Architecture & Sprint Planning',
        description: 'Review Q3 goals and discuss high-priority microservices roadmap.',
        startTime: today(10, 0),
        endTime: today(11, 30),
        location: 'Zoom Room #4',
        source: 'MANUAL',
        color: '#6366f1',
        createdAt: now,
        updatedAt: now,
        reminders: [],
      },
      {
        id: 'ev-2',
        userId: demoUser.id,
        title: 'Design System & UI Review',
        description: 'Review Figma components and color system tokens with frontend team.',
        startTime: today(11, 0), // Overlaps with ev-1 (10:00 - 11:30) -> triggers red conflict alert!
        endTime: today(12, 0),
        location: 'Design Studio & Meet',
        source: 'LUMA',
        sourceUrl: 'https://lu.ma/design-sprint',
        color: '#ec4899',
        createdAt: now,
        updatedAt: now,
        reminders: [],
      },
      {
        id: 'ev-3',
        userId: demoUser.id,
        title: 'Tech Meetup: Building High-Performance Web Apps',
        description: 'Keynote and networking with community engineers.',
        startTime: today(17, 30),
        endTime: today(19, 30),
        location: 'Innovation Hub Downtown',
        source: 'MEETUP',
        sourceUrl: 'https://www.meetup.com/tech-innovators/events/12345',
        color: '#f59e0b',
        createdAt: now,
        updatedAt: now,
        reminders: [],
      },
      {
        id: 'ev-4',
        userId: demoUser.id,
        title: 'Deep Work: Core Engine Refactoring',
        description: 'Focused session with zero notifications.',
        startTime: tomorrow(9, 0),
        endTime: tomorrow(11, 0),
        location: 'Focus Mode',
        source: 'MANUAL',
        color: '#10b981',
        createdAt: now,
        updatedAt: now,
        reminders: [],
      }
    );

    // Tasks
    this.tasks.push(
      {
        id: 'tsk-1',
        userId: demoUser.id,
        title: 'Finalize browser extension manifest & icons',
        dueDate: today(18, 0),
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        createdAt: now,
        updatedAt: now,
        reminders: [],
      },
      {
        id: 'tsk-2',
        userId: demoUser.id,
        title: 'Implement visual calendar conflict warning highlights',
        dueDate: tomorrow(12, 0),
        priority: 'HIGH',
        status: 'DONE',
        createdAt: now,
        updatedAt: now,
        reminders: [],
      },
      {
        id: 'tsk-3',
        userId: demoUser.id,
        title: 'Draft deployment blueprint for Render & Vercel',
        dueDate: tomorrow(17, 0),
        priority: 'MEDIUM',
        status: 'TODO',
        createdAt: now,
        updatedAt: now,
        reminders: [],
      },
      {
        id: 'tsk-4',
        userId: demoUser.id,
        title: 'Prepare demo walkthrough presentation slides',
        dueDate: null,
        priority: 'LOW',
        status: 'TODO',
        createdAt: now,
        updatedAt: now,
        reminders: [],
      }
    );
  }

  // Users
  findUserByEmail(email: string) {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  findUserById(id: string) {
    return this.users.find(u => u.id === id);
  }

  findUserByApiKey(key: string) {
    return this.users.find(u => u.apiKey === key);
  }

  createUser(email: string, passwordHash: string) {
    const user: MockUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      email,
      passwordHash,
      apiKey: `ff_live_${Math.random().toString(36).substr(2, 12)}`,
      createdAt: new Date(),
    };
    this.users.push(user);
    this.saveToDisk();
    return user;
  }

  regenerateApiKey(userId: string) {
    const user = this.findUserById(userId);
    if (!user) return null;
    user.apiKey = `ff_live_${Math.random().toString(36).substr(2, 12)}`;
    this.saveToDisk();
    return user.apiKey;
  }

  // Events
  getEvents(userId: string, from?: string, to?: string) {
    let list = this.events.filter(e => e.userId === userId);
    if (from) {
      const fromDate = new Date(from);
      list = list.filter(e => new Date(e.startTime) >= fromDate);
    }
    if (to) {
      const toDate = new Date(to);
      list = list.filter(e => new Date(e.startTime) <= toDate);
    }
    return list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  createEvent(userId: string, data: any) {
    const ev: MockEvent = {
      id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      title: data.title,
      description: data.description || null,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      location: data.location || null,
      source: data.source || 'MANUAL',
      sourceUrl: data.sourceUrl || null,
      color: data.color || '#6366f1',
      createdAt: new Date(),
      updatedAt: new Date(),
      reminders: [],
    };
    this.events.push(ev);
    this.saveToDisk();
    return ev;
  }

  updateEvent(userId: string, id: string, data: any) {
    const ev = this.events.find(e => e.id === id && e.userId === userId);
    if (!ev) return null;
    if (data.title !== undefined) ev.title = data.title;
    if (data.description !== undefined) ev.description = data.description;
    if (data.startTime !== undefined) ev.startTime = new Date(data.startTime);
    if (data.endTime !== undefined) ev.endTime = new Date(data.endTime);
    if (data.location !== undefined) ev.location = data.location;
    if (data.color !== undefined) ev.color = data.color;
    ev.updatedAt = new Date();
    this.saveToDisk();
    return ev;
  }

  deleteEvent(userId: string, id: string) {
    const idx = this.events.findIndex(e => e.id === id && e.userId === userId);
    if (idx === -1) return false;
    this.events.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  // Tasks
  getTasks(userId: string, query: any = {}) {
    let list = this.tasks.filter(t => t.userId === userId);
    if (query.status) {
      list = list.filter(t => t.status === query.status);
    }
    if (query.priority) {
      list = list.filter(t => t.priority === query.priority);
    }
    if (query.sortBy === 'priority') {
      const pOrder: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      list.sort((a, b) => {
        const diff = pOrder[b.priority] - pOrder[a.priority];
        return query.order === 'asc' ? -diff : diff;
      });
    } else if (query.sortBy === 'dueDate') {
      list.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
    } else {
      list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    return list;
  }

  createTask(userId: string, data: any) {
    const tsk: MockTask = {
      id: `tsk_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId,
      title: data.title,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      priority: data.priority || 'MEDIUM',
      status: data.status || 'TODO',
      createdAt: new Date(),
      updatedAt: new Date(),
      reminders: [],
    };
    this.tasks.push(tsk);
    this.saveToDisk();
    return tsk;
  }

  updateTask(userId: string, id: string, data: any) {
    const tsk = this.tasks.find(t => t.id === id && t.userId === userId);
    if (!tsk) return null;
    if (data.title !== undefined) tsk.title = data.title;
    if (data.dueDate !== undefined) tsk.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.priority !== undefined) tsk.priority = data.priority;
    if (data.status !== undefined) tsk.status = data.status;
    tsk.updatedAt = new Date();
    this.saveToDisk();
    return tsk;
  }

  deleteTask(userId: string, id: string) {
    const idx = this.tasks.findIndex(t => t.id === id && t.userId === userId);
    if (idx === -1) return false;
    this.tasks.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  // Reminders
  getReminders(userId: string) {
    return [];
  }
}

export const mockStore = new MockStore();
