import { z } from 'zod';

// ─── Auth Schemas ────────────────────────────────────────

export const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Event Schemas ───────────────────────────────────────

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(2000).optional().nullable(),
  startTime: z.string().datetime({ message: 'Invalid start time' }),
  endTime: z.string().datetime({ message: 'Invalid end time' }),
  location: z.string().max(500).optional().nullable(),
  source: z.enum(['MANUAL', 'MEETUP', 'LUMA']).optional().default('MANUAL'),
  sourceUrl: z.string().url().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional().nullable(),
}).refine(data => new Date(data.startTime) < new Date(data.endTime), {
  message: 'Start time must be before end time',
  path: ['endTime'],
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional().nullable(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  location: z.string().max(500).optional().nullable(),
  source: z.enum(['MANUAL', 'MEETUP', 'LUMA']).optional(),
  sourceUrl: z.string().url().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

export const eventQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// ─── Task Schemas ────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional().default('MEDIUM'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional().default('TODO'),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
});

export const taskQuerySchema = z.object({
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// ─── Reminder Schemas ────────────────────────────────────

export const createReminderSchema = z.object({
  eventId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  triggerOffsetMinutes: z.number().int().min(0).max(10080).default(15), // max 1 week
  method: z.enum(['PUSH', 'EMAIL']).optional().default('PUSH'),
}).refine(data => data.eventId || data.taskId, {
  message: 'Either eventId or taskId must be provided',
}).refine(data => !(data.eventId && data.taskId), {
  message: 'Cannot set both eventId and taskId',
});

// ─── Type Exports ────────────────────────────────────────

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventQuery = z.infer<typeof eventQuerySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQuery = z.infer<typeof taskQuerySchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
