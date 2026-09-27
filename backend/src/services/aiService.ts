import { GoogleGenAI } from '@google/genai';
import prisma, { isDbConnected } from '../lib/prisma';
import { mockStore } from '../lib/mockStore';
import { config } from '../config';

// ─── Interfaces ──────────────────────────────────────────

export interface ExtractedIntent {
  intent: 'create_event' | 'create_task' | 'reschedule' | 'query' | 'unclear';
  title?: string | null;
  date?: string | null; // YYYY-MM-DD
  startTime?: string | null; // HH:mm
  endTime?: string | null; // HH:mm
  durationMinutes?: number | null;
  location?: string | null;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  participants?: string[];
  isExplicitConfirmation?: boolean;
  keepOriginalAnyway?: boolean;
  selectedSlot?: string | null;
  clarificationQuestion?: string | null;
}

export interface ConversationSession {
  id: string;
  userId: string;
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  lastExtractedData?: ExtractedIntent;
  conflictingEvent?: any;
  suggestedSlots?: Array<{ start: string; end: string; label: string }>;
  createdAt: number;
  updatedAt: number;
}

// ─── In-Memory Conversation Store (10 min TTL) ────────────

class ConversationStore {
  private sessions = new Map<string, ConversationSession>();
  private readonly TTL_MS = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Periodically prune stale sessions
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  get(id: string): ConversationSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (Date.now() - session.updatedAt > this.TTL_MS) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  set(session: ConversationSession): void {
    session.updatedAt = Date.now();
    this.sessions.set(session.id, session);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.updatedAt > this.TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}

export const conversationStore = new ConversationStore();

// ─── AI Service ──────────────────────────────────────────

export class AiService {
  private getAiClient(): GoogleGenAI {
    const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in backend environment');
    }
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Interpret user input using Gemini with structured output
   */
  async interpretInput(
    inputText: string,
    timezone: string,
    conversationSession?: ConversationSession
  ): Promise<ExtractedIntent> {
    const ai = this.getAiClient();

    const now = new Date();
    // Format reference date in user's timezone if possible
    let currentDateStr: string;
    let currentTimeStr: string;
    try {
      currentDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      currentTimeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now);
    } catch {
      currentDateStr = now.toISOString().split('T')[0];
      currentTimeStr = now.toTimeString().substring(0, 5);
    }

    const conversationHistoryText = conversationSession?.history
      ? conversationSession.history
          .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: "${h.text}"`)
          .join('\n')
      : 'None';

    const previousContext = conversationSession?.lastExtractedData
      ? JSON.stringify(conversationSession.lastExtractedData)
      : 'None';

    const systemInstruction = `You are FocusFlow's AI Scheduling Assistant.
Your job is to analyze scheduling requests from users and extract structured scheduling details.

CURRENT DATE: ${currentDateStr}
CURRENT TIME: ${currentTimeStr}
USER TIMEZONE: ${timezone || 'UTC'}

PREVIOUS CONVERSATION HISTORY:
${conversationHistoryText}

PREVIOUS EXTRACTED DATA CONTEXT (if multi-turn conversation):
${previousContext}

GUIDELINES:
1. Intent:
   - "create_event": User wants to schedule a time-bound meeting, appointment, event, call, session.
   - "create_task": User wants to create an action item, to-do, task, reminder with or without a due date (e.g. "Buy groceries", "Finish project by Friday").
   - "reschedule": User wants to adjust a previously discussed time slot or choose an alternative.
   - "query": User is asking what is on their schedule.
   - "unclear": Input is gibberish, greeting without scheduling intent, or cannot be understood.

2. Context merging:
   - If this is a follow-up (e.g. "make it 3pm instead", "Thursday", "option 1", "keep original anyway", "sounds good"), MERGE the new details with PREVIOUS EXTRACTED DATA CONTEXT.
   - If user says "keep original anyway", "ignore conflict", "schedule it anyway", set keepOriginalAnyway = true.
   - If user selects one of the suggested times (e.g. "the first one", "2pm", "let's do 3:00"), set selectedSlot and update startTime.

3. Date/Time resolution:
   - Calculate exact ISO 'date' (YYYY-MM-DD) based on CURRENT DATE (${currentDateStr}). "tomorrow" is the day after CURRENT DATE.
   - 'startTime' and 'endTime' must be 24-hour format HH:mm (e.g. "14:00").
   - Default event duration is 60 minutes if not specified.
   - If user does not specify a time for an event, leave startTime as null and provide a polite clarificationQuestion (e.g. "What time would you like to schedule this?").

4. Output ONLY valid JSON matching the requested structure.`;

    const jsonSchema = {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['create_event', 'create_task', 'reschedule', 'query', 'unclear'],
        },
        title: { type: 'string' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        startTime: { type: 'string', description: 'HH:mm (24h format)' },
        endTime: { type: 'string', description: 'HH:mm (24h format)' },
        durationMinutes: { type: 'integer' },
        location: { type: 'string' },
        priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
        participants: {
          type: 'array',
          items: { type: 'string' },
        },
        isExplicitConfirmation: { type: 'boolean' },
        keepOriginalAnyway: { type: 'boolean' },
        selectedSlot: { type: 'string' },
        clarificationQuestion: { type: 'string' },
      },
      required: ['intent'],
    };

    const userPrompt = `You are FocusFlow's AI Scheduling Assistant.
Reference Date: ${currentDateStr}
Reference Time: ${currentTimeStr}
User Timezone: ${timezone || 'UTC'}

CONVERSATION HISTORY:
${conversationHistoryText}

PREVIOUS EXTRACTED DATA CONTEXT (if any):
${previousContext}

USER'S LATEST MESSAGE:
"${inputText}"

INSTRUCTIONS:
1. Combine the user's intent across all conversation turns and extract the complete scheduling request into structured JSON.
2. If this is a follow-up (e.g., answering "What time?" with "tomorrow at 3pm", or "make it 4pm", or choosing a suggested slot, or "keep original anyway"), MERGE it with the previous context so the title, participants, and date/time are all unified.
3. When user specifies relative dates like "tomorrow" or "today" or a day of the week, calculate the exact ISO 'date' (YYYY-MM-DD) based on Reference Date (${currentDateStr}).
4. 'startTime' and 'endTime' must be in 24-hour format HH:mm (e.g. 15:00). Default event duration is 60 minutes if not specified.
5. If the user provided both date and time (or if previous turns provided the title and this turn provides date/time), do NOT set clarificationQuestion. Set clarificationQuestion to null.
6. If critical details are still missing (e.g. no time for an event), leave startTime as null and provide a polite, concise clarificationQuestion.`;

    const contents = [{ role: 'user', parts: [{ text: userPrompt }] }];

    const modelsToTry = [
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-2.5-flash',
    ];
    let responseText = '';
    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const generatePromise = ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: jsonSchema,
            temperature: 0.1,
          },
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Model ${model} timed out after 7000ms`)), 7000)
        );
        const response = await Promise.race([generatePromise, timeoutPromise]);
        responseText = response.text?.trim() || '';
        if (responseText) {
          console.log(`Successfully used model: ${model}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next:`, err.message);
      }
    }

    if (!responseText) {
      console.warn('All Gemini models failed or experienced spikes, using intelligent heuristic fallback parser. Last error:', lastError?.message);
      return this.parseWithHeuristics(inputText, currentDateStr, conversationSession?.lastExtractedData);
    }

    try {
      console.log('Gemini raw responseText:', responseText);
      const cleaned = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      const parsed: ExtractedIntent = JSON.parse(cleaned);
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse Gemini output:', responseText, parseError);
      return this.parseWithHeuristics(inputText, currentDateStr, conversationSession?.lastExtractedData);
    }
  }

  /**
   * Resilient heuristic fallback parser when LLM models are experiencing demand spikes
   */
  private parseWithHeuristics(
    inputText: string,
    currentDateStr: string,
    previousContext?: ExtractedIntent
  ): ExtractedIntent {
    const text = inputText.trim();
    const lower = text.toLowerCase();

    // Check for explicit confirmation or conflict decisions
    if (lower.includes('keep original') || lower.includes('keep it') || lower.includes('schedule anyway') || lower.includes('ignore conflict')) {
      return {
        intent: previousContext?.intent || 'create_event',
        ...previousContext,
        keepOriginalAnyway: true,
        clarificationQuestion: null,
      };
    }

    // Determine intent
    let intent: 'create_event' | 'create_task' = 'create_event';
    const isTaskKeyword = lower.startsWith('todo:') || lower.startsWith('task:') || lower.startsWith('buy ') || lower.startsWith('finish ') || lower.includes('todo') || lower.includes('remind me to ');
    const isEventKeyword = lower.includes('meeting') || lower.includes('sync') || lower.includes('lunch') || lower.includes('coffee') || lower.includes('dinner') || lower.includes('call') || lower.includes('interview') || lower.includes('session') || lower.includes('workshop');

    if (isTaskKeyword && !isEventKeyword) {
      intent = 'create_task';
    }

    // Resolve date
    let targetDate = currentDateStr;
    const baseDate = new Date(currentDateStr);
    if (lower.includes('tomorrow')) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + 1);
      targetDate = d.toISOString().split('T')[0];
    } else if (lower.includes('today')) {
      targetDate = currentDateStr;
    } else {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      for (let i = 0; i < days.length; i++) {
        if (lower.includes(days[i])) {
          const currentDay = baseDate.getDay();
          let diff = (i - currentDay + 7) % 7;
          if (diff === 0) diff = 7;
          const d = new Date(baseDate);
          d.setDate(d.getDate() + diff);
          targetDate = d.toISOString().split('T')[0];
          break;
        }
      }
    }

    // Resolve time (e.g. "3pm", "3:30pm", "10am", "15:00")
    let startTime: string | null = null;
    let endTime: string | null = null;
    const timeMatch = text.match(/(?:at\s+)?(\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b)/i);
    if (timeMatch) {
      const rawTime = timeMatch[1].toLowerCase().replace(/\s+/g, '');
      let hours = 0;
      let minutes = 0;
      if (rawTime.includes('am') || rawTime.includes('pm')) {
        const isPm = rawTime.includes('pm');
        const numPart = rawTime.replace(/am|pm/, '');
        const [h, m] = numPart.split(':');
        hours = parseInt(h, 10);
        if (isPm && hours !== 12) hours += 12;
        if (!isPm && hours === 12) hours = 0;
        minutes = m ? parseInt(m, 10) : 0;
      } else {
        const [h, m] = rawTime.split(':');
        hours = parseInt(h, 10);
        minutes = parseInt(m, 10);
      }
      startTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const endHours = (hours + 1) % 24;
      endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Clean title
    let title = text
      .replace(/\b(?:tomorrow|today|yesterday)\b/gi, '')
      .replace(/(?:at\s+)?(?:\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b\d{1,2}:\d{2}\b)/gi, '')
      .replace(/\b(?:on\s+)?(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, '')
      .replace(/\b(?:schedule|add|create|remind me to|set up|book)\b/gi, '')
      .trim();

    if (!title) {
      title = previousContext?.title || (intent === 'create_event' ? 'Scheduled Event' : 'New Task');
    }

    // If event with missing time
    let clarificationQuestion: string | null = null;
    if (intent === 'create_event' && !startTime) {
      clarificationQuestion = `What time would you like to schedule "${title}" on ${targetDate}?`;
    }

    return {
      intent,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      date: targetDate,
      startTime,
      endTime,
      durationMinutes: 60,
      priority: 'MEDIUM',
      clarificationQuestion,
    };
  }

  /**
   * Query existing events for the user on a given date to check for overlaps
   */
  async getEventsOnDate(userId: string, dateStr: string): Promise<any[]> {
    let allEvents: any[] = [];
    if (!isDbConnected) {
      allEvents = mockStore.getEvents(userId);
    } else {
      try {
        allEvents = await prisma.event.findMany({
          where: { userId },
          orderBy: { startTime: 'asc' },
        });
      } catch {
        allEvents = mockStore.getEvents(userId);
      }
    }

    return allEvents.filter((ev) => {
      const s = new Date(ev.startTime);
      const isoDate = s.toISOString().split('T')[0];
      const localDate = s.toLocaleDateString('en-CA');
      return isoDate === dateStr || localDate === dateStr;
    });
  }

  /**
   * Generate 2-3 realistic nearby free time slots on the same day
   */
  findSuggestedSlots(
    dateStr: string,
    requestedStart: Date,
    durationMinutes: number,
    existingEvents: any[]
  ): Array<{ start: string; end: string; label: string }> {
    const suggestions: Array<{ start: string; end: string; label: string }> = [];

    // Candidate offsets in hours: +1 hour, +2 hours, -1 hour, +3 hours, -2 hours
    const candidateOffsets = [1, 2, -1, 3, -2, 4];

    for (const offset of candidateOffsets) {
      if (suggestions.length >= 3) break;

      const slotStart = new Date(requestedStart.getTime() + offset * 60 * 60 * 1000);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);

      // Keep within standard waking hours (8am - 9pm)
      const hours = slotStart.getHours();
      if (hours < 8 || hours > 20) continue;

      // Check conflict against existing events
      const hasConflict = existingEvents.some((ev) => {
        const evStart = new Date(ev.startTime).getTime();
        const evEnd = new Date(ev.endTime).getTime();
        return slotStart.getTime() < evEnd && slotEnd.getTime() > evStart;
      });

      if (!hasConflict) {
        const formatTime = (d: Date) =>
          d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        suggestions.push({
          start: slotStart.toTimeString().substring(0, 5),
          end: slotEnd.toTimeString().substring(0, 5),
          label: `${formatTime(slotStart)} - ${formatTime(slotEnd)}`,
        });
      }
    }

    // Fallback if no nearby slots found: offer default afternoon or morning slots
    if (suggestions.length === 0) {
      suggestions.push({ start: '14:00', end: '15:00', label: '2:00 PM - 3:00 PM' });
      suggestions.push({ start: '16:00', end: '17:00', label: '4:00 PM - 5:00 PM' });
    }

    return suggestions;
  }
}

export const aiService = new AiService();
