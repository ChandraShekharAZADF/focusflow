import { Router, Request, Response } from 'express';
import prisma, { isDbConnected } from '../lib/prisma';
import { mockStore } from '../lib/mockStore';
import { createEventSchema, updateEventSchema, eventQuerySchema } from '../schemas';
import { requireAuth, validate } from '../middleware';

const router = Router();

// All event routes require authentication
router.use(requireAuth);

// ─── GET /api/events ─────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const queryResult = eventQuerySchema.safeParse(req.query);
    const query = queryResult.success ? queryResult.data : {};

    if (!isDbConnected) {
      const events = mockStore.getEvents(req.userId!, query.from, query.to);
      res.json({ events });
      return;
    }

    try {
      const where: any = { userId: req.userId };
      if (query.from || query.to) {
        where.startTime = {};
        if (query.from) where.startTime.gte = new Date(query.from);
        if (query.to) where.startTime.lte = new Date(query.to);
      }

      const events = await prisma.event.findMany({
        where,
        orderBy: { startTime: 'asc' },
        include: { reminders: true },
      });

      res.json({ events });
    } catch {
      const events = mockStore.getEvents(req.userId!, query.from, query.to);
      res.json({ events });
    }
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ─── POST /api/events ────────────────────────────────────

router.post('/', validate(createEventSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, startTime, endTime, location, source, sourceUrl, color } = req.body;

    if (!isDbConnected) {
      const event = mockStore.createEvent(req.userId!, req.body);
      res.status(201).json({ event });
      return;
    }

    try {
      const start = new Date(startTime);
      const windowStart = new Date(start.getTime() - 5 * 60 * 1000);
      const windowEnd = new Date(start.getTime() + 5 * 60 * 1000);

      const existing = await prisma.event.findFirst({
        where: {
          userId: req.userId,
          title: { equals: title, mode: 'insensitive' },
          startTime: { gte: windowStart, lte: windowEnd },
        },
      });

      if (existing) {
        res.status(409).json({ error: 'An event with this title and time already exists' });
        return;
      }

      const event = await prisma.event.create({
        data: {
          userId: req.userId!,
          title,
          description,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          location,
          source: source || 'MANUAL',
          sourceUrl,
          color: color || '#6366f1',
        },
      });

      res.status(201).json({ event });
    } catch {
      const event = mockStore.createEvent(req.userId!, req.body);
      res.status(201).json({ event });
    }
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// ─── PATCH /api/events/:id ───────────────────────────────

router.patch('/:id', validate(updateEventSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!isDbConnected) {
      const event = mockStore.updateEvent(req.userId!, id, req.body);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      res.json({ event });
      return;
    }

    try {
      const existing = await prisma.event.findFirst({
        where: { id, userId: req.userId },
      });

      if (!existing) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      const data: any = { ...req.body };
      if (data.startTime) data.startTime = new Date(data.startTime);
      if (data.endTime) data.endTime = new Date(data.endTime);

      const event = await prisma.event.update({
        where: { id },
        data,
      });

      res.json({ event });
    } catch {
      const event = mockStore.updateEvent(req.userId!, id, req.body);
      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      res.json({ event });
    }
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// ─── DELETE /api/events/:id ──────────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!isDbConnected) {
      const deleted = mockStore.deleteEvent(req.userId!, id);
      if (!deleted) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      res.status(204).send();
      return;
    }

    try {
      const existing = await prisma.event.findFirst({
        where: { id, userId: req.userId },
      });

      if (!existing) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      await prisma.event.delete({ where: { id } });
      res.status(204).send();
    } catch {
      const deleted = mockStore.deleteEvent(req.userId!, id);
      if (!deleted) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }
      res.status(204).send();
    }
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
