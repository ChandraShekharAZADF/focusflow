import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Mic,
  MicOff,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  X,
  Clock,
  Calendar,
  MessageSquare
} from 'lucide-react';
import { aiApi, AiInterpretResponse } from '../lib/api';

interface ChatExchange {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AiInterpretResponse;
}

export default function QuickAddBar() {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [thread, setThread] = useState<ChatExchange[]>([]);
  const [latestResponse, setLatestResponse] = useState<AiInterpretResponse | null>(null);
  const [showThread, setShowThread] = useState(false);
  const [undoLoading, setUndoLoading] = useState(false);
  const [undoSuccess, setUndoSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition check
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Handle Voice Input Toggle
  const toggleListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in your browser or requires HTTPS.');
      setTimeout(() => setSpeechError(null), 4000);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          // Automatically submit voice transcript
          handleSubmit(undefined, transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access.');
        } else if (event.error === 'network') {
          setSpeechError('Speech recognition network error. (Note: speech requires HTTPS or localhost).');
        } else {
          setSpeechError(`Voice input error: ${event.error}`);
        }
        setIsListening(false);
        setTimeout(() => setSpeechError(null), 4000);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err);
      setSpeechError('Could not start voice input. Please ensure microphone permissions are granted.');
      setIsListening(false);
      setTimeout(() => setSpeechError(null), 4000);
    }
  };

  // Submit request to AI
  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const textToSend = (overrideText !== undefined ? overrideText : inputText).trim();
    if (!textToSend || loading) return;

    setInputText('');
    setLoading(true);
    setShowThread(true);
    setUndoSuccess(false);

    // Append user message to local thread
    const userExchange: ChatExchange = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: textToSend,
    };
    setThread((prev) => [...prev.slice(-4), userExchange]);

    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const { data } = await aiApi.interpret({
        inputText: textToSend,
        timezone: userTimezone,
        conversationId,
      });

      setLatestResponse(data);
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      // Add assistant response to thread
      const assistantText =
        data.summary || data.question || data.message || 'Understood request.';

      setThread((prev) => [
        ...prev.slice(-4),
        {
          id: `asst_${Date.now()}`,
          role: 'assistant',
          text: assistantText,
          response: data,
        },
      ]);

      // If created, trigger app-wide refresh so Calendar & Tasks update automatically
      if (data.status === 'created') {
        window.dispatchEvent(new CustomEvent('focusflow:refresh'));
      }

      // If needs clarification, keep focus in input
      if (data.status === 'needs_clarification') {
        setTimeout(() => inputRef.current?.focus(), 150);
      }
    } catch (err: any) {
      console.error('AI interpret request failed:', err);
      const errMsg =
        err.response?.data?.message ||
        "Couldn't understand that or AI service is unavailable. Please try rephrasing.";
      setThread((prev) => [
        ...prev.slice(-4),
        {
          id: `asst_err_${Date.now()}`,
          role: 'assistant',
          text: errMsg,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Undo
  const handleUndo = async () => {
    if (!latestResponse || undoLoading) return;
    const { eventId, taskId } = latestResponse;
    if (!eventId && !taskId) return;

    setUndoLoading(true);
    try {
      await aiApi.undo({ eventId, taskId });
      setUndoSuccess(true);
      window.dispatchEvent(new CustomEvent('focusflow:refresh'));
      setThread((prev) => [
        ...prev,
        {
          id: `undo_${Date.now()}`,
          role: 'assistant',
          text: 'Action undone successfully.',
        },
      ]);
    } catch (err) {
      console.error('Failed to undo:', err);
    } finally {
      setUndoLoading(false);
    }
  };

  // Handle picking a suggested alternative slot
  const handleSelectSlot = (slotLabel: string) => {
    handleSubmit(undefined, slotLabel);
  };

  // Handle "Keep original anyway"
  const handleKeepOriginal = () => {
    handleSubmit(undefined, 'Keep original anyway');
  };

  // Close thread bubble
  const handleClose = () => {
    setShowThread(false);
    setConversationId(undefined);
  };

  return (
    <div className="relative w-full max-w-xl mx-auto">
      {/* Quick Add Bar */}
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center bg-surface-800/80 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-xl transition-all duration-200 focus-within:border-primary-500/50 focus-within:ring-2 focus-within:ring-primary-500/20"
      >
        {/* Left AI Sparkle Icon */}
        <div className="flex items-center justify-center pl-2.5 pr-1.5 text-primary-400">
          <Sparkles className="w-4 h-4 animate-pulse" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask AI: 'Lunch with John tomorrow 2pm' or 'Finish slides by Friday'..."
          className="flex-1 bg-transparent px-2 py-1.5 text-sm text-surface-100 placeholder:text-surface-200/40 focus:outline-none"
          disabled={loading}
        />

        {/* Voice Button */}
        <button
          type="button"
          onClick={toggleListening}
          title={
            !speechSupported
              ? 'Voice input requires HTTPS / Web Speech API'
              : isListening
              ? 'Stop listening'
              : 'Voice input (Speech to Text)'
          }
          className={`p-2 rounded-xl text-sm transition-all duration-200 mr-1 ${
            isListening
              ? 'bg-accent-red/20 text-accent-red border border-accent-red/40 animate-pulse ring-2 ring-accent-red/30'
              : 'text-surface-200/60 hover:text-surface-100 hover:bg-white/5'
          }`}
        >
          {isListening ? (
            <Mic className="w-4 h-4 text-accent-red animate-bounce" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!inputText.trim() || loading}
          className="p-2 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:hover:bg-primary-600 text-white transition-all duration-200 shadow-glow flex items-center justify-center"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>

      {/* Voice Error Notice */}
      {speechError && (
        <div className="absolute top-full left-0 right-0 mt-2 px-3 py-2 bg-accent-red/10 border border-accent-red/30 rounded-xl text-xs text-accent-red flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-1">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Floating Chat / Clarification Bubble */}
      {showThread && thread.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2.5 bg-surface-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg bg-primary-500/20 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-primary-400" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-200/60">
                FocusFlow Assistant
              </span>
            </div>
            <button
              onClick={handleClose}
              className="text-surface-200/40 hover:text-surface-100 p-1 rounded-lg hover:bg-white/5 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Conversation Exchanges */}
          <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
            {thread.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary-600/30 border border-primary-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="w-3 h-3 text-primary-300" />
                  </div>
                )}
                <div
                  className={`rounded-xl px-3 py-2 text-xs max-w-[85%] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary-600 text-white ml-auto'
                      : 'bg-white/5 border border-white/5 text-surface-100'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Outcome Actions (Conflict, Undo, or Clarification) */}
          {latestResponse && (
            <div className="mt-3 pt-3 border-t border-white/5">
              {/* 1. Created Confirmation with Undo */}
              {latestResponse.status === 'created' && (
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 text-xs text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{latestResponse.summary}</span>
                  </div>
                  {!undoSuccess ? (
                    <button
                      onClick={handleUndo}
                      disabled={undoLoading}
                      className="ml-3 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-medium flex items-center gap-1.5 transition-all"
                    >
                      {undoLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      Undo
                    </button>
                  ) : (
                    <span className="text-surface-200/50 italic ml-2">Undone</span>
                  )}
                </div>
              )}

              {/* 2. Conflict Warning with Suggested Chips */}
              {latestResponse.status === 'conflict' && (
                <div className="space-y-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs">
                  <div className="flex items-start gap-2 text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{latestResponse.message}</p>
                      <p className="text-surface-200/70 text-[11px] mt-0.5">
                        Would you like to reschedule to one of these free alternative slots?
                      </p>
                    </div>
                  </div>

                  {/* Suggested Slots */}
                  {latestResponse.suggestedSlots && latestResponse.suggestedSlots.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {latestResponse.suggestedSlots.map((slot, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectSlot(slot.label)}
                          className="px-2.5 py-1.5 rounded-lg bg-primary-500/20 hover:bg-primary-500/30 border border-primary-500/30 text-primary-200 font-medium flex items-center gap-1.5 transition-all text-xs"
                        >
                          <Clock className="w-3 h-3 text-primary-400" />
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Keep Original Anyway Button */}
                  <div className="flex items-center justify-between pt-1 border-t border-amber-500/10">
                    <button
                      onClick={handleKeepOriginal}
                      className="px-2.5 py-1 rounded-lg bg-surface-700/60 hover:bg-surface-700 text-surface-200/90 text-xs font-medium transition-all"
                    >
                      Keep original anyway
                    </button>
                    <button
                      onClick={handleClose}
                      className="text-surface-200/50 hover:text-surface-100 text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Needs Clarification Prompt */}
              {latestResponse.status === 'needs_clarification' && (
                <div className="flex items-center justify-between text-xs text-primary-300 bg-primary-500/10 border border-primary-500/20 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-primary-400" />
                    <span>Type your reply or use the microphone above</span>
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-surface-200/50 hover:text-surface-100 ml-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
