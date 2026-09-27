import { Router, Request, Response } from 'express';
import prisma, { isDbConnected } from '../lib/prisma';
import { mockStore } from '../lib/mockStore';
import { createTaskSchema, updateTaskSchema, taskQuerySchema } from '../schemas';
import { requireAuth, validate } from '../middleware';
import { Prisma } from '@prisma/client';

const router = Router();

// All task routes require authentication
router.use(requireAuth);

const priorityOrder: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

// ─── GET /api/tasks ──────────────────────────────────────

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const queryResult = taskQuerySchema.safeParse(req.query);
    const query = queryResult.success ? queryResult.data : { sortBy: 'createdAt' as const, order: 'desc' as const };

    if (!isDbConnected) {
      const tasks = mockStore.getTasks(req.userId!, query);
      res.json({ tasks });
      return;
    }

    try {
      const where: any = { userId: req.userId };
      if (query.status) where.status = query.status;
      if (query.priority) where.priority = query.priority;

      let orderBy: Prisma.TaskOrderByWithRelationInput = {};
      if (query.sortBy === 'dueDate') {
        orderBy = { dueDate: query.order || 'desc' };
      } else if (query.sortBy !== 'priority') {
        orderBy = { createdAt: query.order || 'desc' };
      }

      let tasks = await prisma.task.findMany({
        where,
        orderBy: query.sortBy !== 'priority' ? orderBy : { createdAt: 'desc' },
        include: { reminders: true },
      });

      if (query.sortBy === 'priority') {
        tasks.sort((a, b) => {
          const diff = priorityOrder[b.priority] - priorityOrder[a.priority];
          return query.order === 'asc' ? -diff : diff;
        });
      }

      res.json({ tasks });
    } catch {
      const tasks = mockStore.getTasks(req.userId!, query);
      res.json({ tasks });
    }
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// ─── POST /api/tasks ─────────────────────────────────────

router.post('/', validate(createTaskSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, dueDate, priority, status } = req.body;

    if (!isDbConnected) {
      const task = mockStore.createTask(req.userId!, req.body);
      res.status(201).json({ task });
      return;
    }

    try {
      const task = await prisma.task.create({
        data: {
          userId: req.userId!,
          title,
          dueDate: dueDate ? new Date(dueDate) : null,
          priority: priority || 'MEDIUM',
          status: status || 'TODO',
        },
      });

      res.status(201).json({ task });
    } catch {
      const task = mockStore.createTask(req.userId!, req.body);
      res.status(201).json({ task });
    }
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// ─── PATCH /api/tasks/:id ────────────────────────────────

router.patch('/:id', validate(updateTaskSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!isDbConnected) {
      const task = mockStore.updateTask(req.userId!, id, req.body);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.json({ task });
      return;
    }

    try {
      const existing = await prisma.task.findFirst({
        where: { id, userId: req.userId },
      });

      if (!existing) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      const data: any = { ...req.body };
      if (data.dueDate !== undefined) {
        data.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      }

      const task = await prisma.task.update({
        where: { id },
        data,
      });

      res.json({ task });
    } catch {
      const task = mockStore.updateTask(req.userId!, id, req.body);
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.json({ task });
    }
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ─── DELETE /api/tasks/:id ───────────────────────────────

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    if (!isDbConnected) {
      const deleted = mockStore.deleteTask(req.userId!, id);
      if (!deleted) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.status(204).send();
      return;
    }

    try {
      const existing = await prisma.task.findFirst({
        where: { id, userId: req.userId },
      });

      if (!existing) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      await prisma.task.delete({ where: { id } });
      res.status(204).send();
    } catch {
      const deleted = mockStore.deleteTask(req.userId!, id);
      if (!deleted) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      res.status(204).send();
    }
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
