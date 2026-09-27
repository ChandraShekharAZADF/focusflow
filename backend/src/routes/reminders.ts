import { Router, Request, Response } from 'express';
import prisma, { isDbConnected } from '../lib/prisma';
import { createReminderSchema } from '../schemas';
import { requireAuth, validate } from '../middleware';

const router = Router();

// All reminder routes require authentication
router.use(requireAuth);

// ─── GET /api/reminders ──────────────────────────────────
// Returns upcoming unsent reminders for the authenticated user

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isDbConnected) {
      res.json({ reminders: [] });
      return;
    }

    const reminders = await prisma.reminder.findMany({
      where: {
        sent: false,
        triggerAt: { lte: new Date() },
        OR: [
          { event: { userId: req.userId } },
          { task: { userId: req.userId } },
        ],
      },
      include: {
        event: { select: { id: true, title: true, startTime: true, endTime: true } },
        task: { select: { id: true, title: true, dueDate: true, priority: true } },
      },
      orderBy: { triggerAt: 'asc' },
    });

    res.json({ reminders });
  } catch (error) {
    res.json({ reminders: [] });
  }
});

// ─── GET /api/reminders/all ──────────────────────────────
// Returns all reminders (sent and unsent) for the authenticated user

router.get('/all', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!isDbConnected) {
      res.json({ reminders: [] });
      return;
    }

    const reminders = await prisma.reminder.findMany({
      where: {
        OR: [
          { event: { userId: req.userId } },
          { task: { userId: req.userId } },
        ],
      },
      include: {
        event: { select: { id: true, title: true, startTime: true, endTime: true } },
        task: { select: { id: true, title: true, dueDate: true, priority: true } },
      },
      orderBy: { triggerAt: 'desc' },
    });

    res.json({ reminders });
  } catch (error) {
    res.json({ reminders: [] });
  }
});

// ─── POST /api/reminders ─────────────────────────────────

router.post('/', validate(createReminderSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, taskId, triggerOffsetMinutes, method } = req.body;

    // Compute triggerAt time
    let triggerAt: Date;

    if (eventId) {
      // Verify event ownership
      const event = await prisma.event.findFirst({
        where: { id: eventId, userId: req.userId },
      });
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      triggerAt = new Date(event.startTime.getTime() - triggerOffsetMinutes * 60 * 1000);
    } else if (taskId) {
      // Verify task ownership
      const task = await prisma.task.findFirst({
        where: { id: taskId, userId: req.userId },
      });
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      if (!task.dueDate) {
        res.status(400).json({ error: 'Task has no due date — cannot set a reminder' });
        return;
      }
      triggerAt = new Date(task.dueDate.getTime() - triggerOffsetMinutes * 60 * 1000);
    } else {
      res.status(400).json({ error: 'Either eventId or taskId is required' });
      return;
    }

    const reminder = await prisma.reminder.create({
      data: {
        eventId: eventId || null,
        taskId: taskId || null,
        triggerOffsetMinutes,
        method,
        triggerAt,
      },
      include: {
        event: { select: { id: true, title: true, startTime: true } },
        task: { select: { id: true, title: true, dueDate: true } },
      },
    });

    res.status(201).json({ reminder });
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// ─── PATCH /api/reminders/:id/dismiss ────────────────────
// Mark a reminder as sent/dismissed

router.patch('/:id/dismiss', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    const reminder = await prisma.reminder.findFirst({
      where: {
        id,
        OR: [
          { event: { userId: req.userId } },
          { task: { userId: req.userId } },
        ],
      },
    });

    if (!reminder) {
      res.status(404).json({ error: 'Reminder not found' });
      return;
    }

    const updated = await prisma.reminder.update({
      where: { id },
      data: { sent: true },
    });

    res.json({ reminder: updated });
  } catch (error) {
    console.error('Dismiss reminder error:', error);
    res.status(500).json({ error: 'Failed to dismiss reminder' });
  }
});

export default router;
