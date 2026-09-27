import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma, { isDbConnected } from '../lib/prisma';
import { mockStore } from '../lib/mockStore';
import { requireAuth } from '../middleware';
import { aiService, conversationStore, ConversationSession, ExtractedIntent } from '../services/aiService';

const router = Router();

router.use(requireAuth);

// Helper to format 24h time to 12h readable time
function formatReadableTime(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = m < 10 ? `0${m}` : `${m}`;
  return `${hour12}:${minStr} ${period}`;
}

// ─── POST /api/ai/interpret ──────────────────────────────

router.post('/interpret', async (req: Request, res: Response): Promise<void> => {
  try {
    const { inputText, timezone, conversationId } = req.body;
    const userId = req.userId!;

    if (!inputText || typeof inputText !== 'string' || !inputText.trim()) {
      res.status(400).json({ error: 'inputText is required' });
      return;
    }

    const userTimezone = timezone || 'UTC';

    // Retrieve or create conversation session
    let session: ConversationSession;
    if (conversationId && conversationStore.get(conversationId)) {
      session = conversationStore.get(conversationId)!;
    } else {
      session = {
        id: conversationId || `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        userId,
        history: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Record user turn
    session.history.push({ role: 'user', text: inputText.trim() });
    if (session.history.length > 10) {
      session.history = session.history.slice(-10); // Keep last 10 messages
    }

    const lowerInput = inputText.trim().toLowerCase();
    const isExplicitKeepOriginal =
      lowerInput.includes('keep original') ||
      lowerInput.includes('schedule anyway') ||
      lowerInput.includes('ignore conflict');

    const matchedSuggestedSlot = session.suggestedSlots?.find(
      (s) => inputText.includes(s.start) || inputText.includes(s.label) || lowerInput.includes(s.start)
    );

    let extracted: ExtractedIntent;

    if (session.lastExtractedData && (isExplicitKeepOriginal || matchedSuggestedSlot)) {
      extracted = {
        ...session.lastExtractedData,
        keepOriginalAnyway: true,
        startTime: matchedSuggestedSlot ? matchedSuggestedSlot.start : session.lastExtractedData.startTime,
        endTime: matchedSuggestedSlot ? matchedSuggestedSlot.end : session.lastExtractedData.endTime,
      };
    } else {
      // Call Gemini with context
      try {
        extracted = await aiService.interpretInput(inputText.trim(), userTimezone, session);
      } catch (llmError: any) {
        console.error('LLM interpret error:', llmError);
        res.status(503).json({
          status: 'error',
          message: "I couldn't reach the AI assistant right now. Please check your network or try rephrasing.",
        });
        return;
      }
    }

    // Merge previous context with newly extracted intent
    const prev = session.lastExtractedData;
    const merged: ExtractedIntent = {
      intent: extracted.intent !== 'unclear' ? extracted.intent : prev?.intent || 'unclear',
      title: extracted.title || prev?.title || null,
      date: extracted.date || prev?.date || null,
      startTime: extracted.startTime || prev?.startTime || null,
      endTime: extracted.endTime || prev?.endTime || null,
      durationMinutes: extracted.durationMinutes || prev?.durationMinutes || 60,
      location: extracted.location || prev?.location || null,
      priority: extracted.priority || prev?.priority || null,
      participants: extracted.participants?.length ? extracted.participants : prev?.participants || [],
      keepOriginalAnyway: extracted.keepOriginalAnyway || prev?.keepOriginalAnyway || false,
      selectedSlot: extracted.selectedSlot || null,
      clarificationQuestion: extracted.clarificationQuestion || null,
    };

    const isKeepOriginal =
      inputText.toLowerCase().includes('keep original') ||
      inputText.toLowerCase().includes('schedule anyway') ||
      inputText.toLowerCase().includes('ignore conflict') ||
      Boolean(extracted.keepOriginalAnyway);

    if (isKeepOriginal) {
      merged.keepOriginalAnyway = true;
    }

    // If user clicked or picked a suggested slot (e.g. from previous conflict options)
    if (session.suggestedSlots?.length) {
      for (const slot of session.suggestedSlots) {
        if (
          inputText.includes(slot.start) ||
          inputText.includes(slot.label) ||
          (extracted.selectedSlot && (slot.label.includes(extracted.selectedSlot) || slot.start === extracted.selectedSlot))
        ) {
          merged.startTime = slot.start;
          merged.endTime = slot.end;
          merged.keepOriginalAnyway = true;
          break;
        }
      }
    }

    session.lastExtractedData = merged;

    // ── 1. Check if intent is a Task ──
    if (merged.intent === 'create_task') {
      if (!merged.title) {
        const question = merged.clarificationQuestion || 'What task would you like to create?';
        session.history.push({ role: 'assistant', text: question });
        conversationStore.set(session);
        res.json({
          status: 'needs_clarification',
          question,
          conversationId: session.id,
        });
        return;
      }

      // Create task
      let taskDueDate: Date | null = null;
      if (merged.date) {
        taskDueDate = merged.startTime
          ? new Date(`${merged.date}T${merged.startTime}:00`)
          : new Date(`${merged.date}T23:59:59`);
      }

      let createdTask: any;
      if (!isDbConnected) {
        createdTask = mockStore.createTask(userId, {
          title: merged.title,
          dueDate: taskDueDate,
          priority: merged.priority || 'MEDIUM',
          status: 'TODO',
        });
      } else {
        try {
          createdTask = await prisma.task.create({
            data: {
              userId,
              title: merged.title,
              dueDate: taskDueDate,
              priority: merged.priority || 'MEDIUM',
              status: 'TODO',
            },
          });
        } catch {
          createdTask = mockStore.createTask(userId, {
            title: merged.title,
            dueDate: taskDueDate,
            priority: merged.priority || 'MEDIUM',
            status: 'TODO',
          });
        }
      }

      const dueMsg = merged.date ? ` due for ${merged.date}${merged.startTime ? ` at ${formatReadableTime(merged.startTime)}` : ''}` : '';
      const summary = `Created task: "${merged.title}"${dueMsg} [${merged.priority || 'MEDIUM'} priority].`;

      conversationStore.delete(session.id); // Finished
      res.json({
        status: 'created',
        type: 'task',
        summary,
        taskId: createdTask.id,
        conversationId: session.id,
      });
      return;
    }

    // ── 2. Check if intent is an Event ──
    if (merged.intent === 'create_event' || merged.intent === 'reschedule') {
      // Missing title?
      if (!merged.title) {
        const question = merged.clarificationQuestion || 'What would you like to call this event?';
        session.history.push({ role: 'assistant', text: question });
        conversationStore.set(session);
        res.json({
          status: 'needs_clarification',
          question,
          conversationId: session.id,
        });
        return;
      }

      // Missing date or time?
      if (!merged.date || !merged.startTime) {
        let question = merged.clarificationQuestion;
        if (!question) {
          if (!merged.date && !merged.startTime) {
            question = `When would you like to schedule "${merged.title}"? (Date and time)`;
          } else if (!merged.date) {
            question = `Which day would you like to schedule "${merged.title}" at ${formatReadableTime(merged.startTime!)}?`;
          } else {
            question = `What time on ${merged.date} works best for "${merged.title}"?`;
          }
        }
        session.history.push({ role: 'assistant', text: question });
        conversationStore.set(session);
        res.json({
          status: 'needs_clarification',
          question,
          conversationId: session.id,
        });
        return;
      }

      // Calculate candidate start and end
      const candidateStart = new Date(`${merged.date}T${merged.startTime}:00`);
      let candidateEnd: Date;
      if (merged.endTime) {
        candidateEnd = new Date(`${merged.date}T${merged.endTime}:00`);
      } else {
        const duration = merged.durationMinutes || 60;
        candidateEnd = new Date(candidateStart.getTime() + duration * 60 * 1000);
      }

      // ── Conflict Check ──
      const existingEvents = await aiService.getEventsOnDate(userId, merged.date);

      // Check overlap: existing.start < candidateEnd && existing.end > candidateStart
      const candStartMs = candidateStart.getTime();
      const candEndMs = candidateEnd.getTime();
      const [cSH, cSM] = (merged.startTime || '00:00').split(':').map(Number);
      const candSMin = cSH * 60 + cSM;
      const candEMin = merged.endTime
        ? parseInt(merged.endTime.split(':')[0], 10) * 60 + parseInt(merged.endTime.split(':')[1] || '0', 10)
        : candSMin + (merged.durationMinutes || 60);

      const conflicting = existingEvents.find((ev) => {
        const evStartMs = new Date(ev.startTime).getTime();
        const evEndMs = new Date(ev.endTime).getTime();
        if (evStartMs < candEndMs && evEndMs > candStartMs) return true;

        const evSH = new Date(ev.startTime).getHours() * 60 + new Date(ev.startTime).getMinutes();
        const evEH = new Date(ev.endTime).getHours() * 60 + new Date(ev.endTime).getMinutes();
        return evSH < candEMin && evEH > candSMin;
      });

      // If conflict detected and user has NOT explicitly said to keep original anyway
      if (conflicting && !merged.keepOriginalAnyway) {
        const duration = merged.durationMinutes || 60;
        const suggestedSlots = aiService.findSuggestedSlots(
          merged.date,
          candidateStart,
          duration,
          existingEvents
        );

        session.conflictingEvent = conflicting;
        session.suggestedSlots = suggestedSlots;
        conversationStore.set(session);

        const conflictStartStr = new Date(conflicting.startTime).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
        const conflictEndStr = new Date(conflicting.endTime).toLocaleTimeString([], {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });

        const message = `You already have "${conflicting.title}" scheduled from ${conflictStartStr} to ${conflictEndStr}.`;

        res.json({
          status: 'conflict',
          conflictingEvent: {
            id: conflicting.id,
            title: conflicting.title,
            startTime: conflicting.startTime,
            endTime: conflicting.endTime,
          },
          message,
          suggestedSlots,
          conversationId: session.id,
        });
        return;
      }

      // ── Clear & No Conflict (or Keep Original Anyway) ──
      let createdEvent: any;
      const descParts: string[] = [];
      if (merged.participants?.length) {
        descParts.push(`Participants: ${merged.participants.join(', ')}`);
      }
      if (merged.location) {
        descParts.push(`Location: ${merged.location}`);
      }
      const description = descParts.length ? descParts.join(' | ') : null;

      if (!isDbConnected) {
        createdEvent = mockStore.createEvent(userId, {
          title: merged.title,
          description,
          startTime: candidateStart,
          endTime: candidateEnd,
          location: merged.location,
          source: 'MANUAL',
          color: '#6366f1',
        });
      } else {
        try {
          createdEvent = await prisma.event.create({
            data: {
              userId,
              title: merged.title,
              description,
              startTime: candidateStart,
              endTime: candidateEnd,
              location: merged.location,
              source: 'MANUAL',
              color: '#6366f1',
            },
          });
        } catch {
          createdEvent = mockStore.createEvent(userId, {
            title: merged.title,
            description,
            startTime: candidateStart,
            endTime: candidateEnd,
            location: merged.location,
            source: 'MANUAL',
            color: '#6366f1',
          });
        }
      }

      const formattedStart = candidateStart.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const formattedEnd = candidateEnd.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      const summary = `Scheduled "${merged.title}" on ${merged.date} from ${formattedStart} to ${formattedEnd}.`;

      conversationStore.delete(session.id); // Resolved
      res.json({
        status: 'created',
        type: 'event',
        summary,
        eventId: createdEvent.id,
        conversationId: session.id,
      });
      return;
    }

    // ── 3. Unclear / Query / Other Intent ──
    const question =
      merged.clarificationQuestion ||
      "I'm ready to schedule an event or task. For example, say 'Add event: team sync tomorrow at 3pm' or 'Create task: finish slides by Friday'.";

    session.history.push({ role: 'assistant', text: question });
    conversationStore.set(session);

    res.json({
      status: 'needs_clarification',
      question,
      conversationId: session.id,
    });
  } catch (error) {
    console.error('AI interpret route error:', error);
    res.status(500).json({ error: 'Failed to interpret scheduling request' });
  }
});

// ─── POST /api/ai/undo ───────────────────────────────────

router.post('/undo', async (req: Request, res: Response): Promise<void> => {
  try {
    const { eventId, taskId } = req.body;
    const userId = req.userId!;

    if (eventId) {
      if (!isDbConnected) {
        mockStore.deleteEvent(userId, eventId);
      } else {
        try {
          await prisma.event.deleteMany({
            where: { id: eventId, userId },
          });
        } catch {
          mockStore.deleteEvent(userId, eventId);
        }
      }
      res.json({ status: 'undone', message: 'Event successfully removed' });
      return;
    }

    if (taskId) {
      if (!isDbConnected) {
        mockStore.deleteTask(userId, taskId);
      } else {
        try {
          await prisma.task.deleteMany({
            where: { id: taskId, userId },
          });
        } catch {
          mockStore.deleteTask(userId, taskId);
        }
      }
      res.json({ status: 'undone', message: 'Task successfully removed' });
      return;
    }

    res.status(400).json({ error: 'Either eventId or taskId must be provided' });
  } catch (error) {
    console.error('AI undo error:', error);
    res.status(500).json({ error: 'Failed to undo action' });
  }
});

export default router;
