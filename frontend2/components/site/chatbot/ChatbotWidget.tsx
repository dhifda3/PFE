"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, RotateCcw, Send, ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/authStore";
// ─── Types ───────────────────────────────────────────────────────────────────

type FeedbackValue = 1 | -1;

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  logId: string | null;
  feedback: FeedbackValue | null;
  isStreaming: boolean;
  isError: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  const KEY = "lacuna_chat_session_id";
  const stored = window.localStorage.getItem(KEY);
  if (stored) return stored;
  const id =
    "anon-" +
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  window.localStorage.setItem(KEY, id);
  return id;
}

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "bot",
  text: "hi! I'm your Lumière beauty advisor. Ask me about skincare, product recommendations, or your order status.",
  logId: null,
  feedback: null,
  isStreaming: false,
  isError: false,
};

const MAX_LEN = 500;

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChatbotWidget() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput]         = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const endRef    = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const abortRef  = useRef<AbortController | null>(null);
  const sessionId = useRef<string>("ssr");
  const { user } = useAuthStore();

  useEffect(() => { sessionId.current = getOrCreateSessionId(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Reset chat on auth change (login or logout)
  useEffect(() => {
    reset();
  }, [user]);

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([WELCOME]);
    setInput("");
    setIsLoading(false);
  };

  const patchMsg = (id: string, patch: Partial<ChatMessage>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput("");
    setIsLoading(true);

    const ts    = Date.now();
    const botId = `${ts}_bot`;

    const userMsg: ChatMessage = {
      id: `${ts}_user`, role: "user", text,
      logId: null, feedback: null, isStreaming: false, isError: false,
    };
    const botMsg: ChatMessage = {
      id: botId, role: "bot", text: "",
      logId: null, feedback: null, isStreaming: true, isError: false,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId: sessionId.current }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader   = res.body.getReader();
      const decoder  = new TextDecoder();
      let buffer     = "";
      let fullText   = "";
      let receivedDone   = false;
      let finalLogId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const raw = part.startsWith("data: ") ? part.slice(6) : part.trim();
          if (!raw) continue;

          let payload: Record<string, unknown>;
          try { payload = JSON.parse(raw) as Record<string, unknown>; }
          catch { continue; }

          if (typeof payload.token === "string") {
            fullText += payload.token;
            patchMsg(botId, { text: fullText });
          }
          if (payload.done === true) {
            receivedDone = true;
            finalLogId = typeof payload.logId === "string" ? payload.logId : null;
          }
          if (typeof payload.error === "string") {
            patchMsg(botId, { text: payload.error, isStreaming: false, isError: true });
            setIsLoading(false);
            return;
          }
        }
        if (receivedDone) break;
      }

      patchMsg(botId, {
        text: fullText || "Sorry, I received an empty response. Please try again.",
        logId: finalLogId,
        isStreaming: false,
        isError: false,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      patchMsg(botId, {
        text: "Connection error — please check your connection and try again.",
        isStreaming: false,
        isError: true,
      });
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [input, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const submitFeedback = async (logId: string, rating: FeedbackValue, msgId: string) => {
    patchMsg(msgId, { feedback: rating });
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId, sessionId: sessionId.current, rating }),
      });
    } catch { /* silent */ }
  };

  return (
    <>
      {/* ── Scoped styles using the site's CSS variables ───────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .cw-panel {
          position: fixed;
          bottom: 88px; right: 24px; z-index: 50;
          width: 370px; max-height: 580px;
          display: flex; flex-direction: column;
          background: var(--bg-secondary);
          border: 1px solid var(--border-hover);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          overflow: hidden;
        }
        .cw-panel::before {
          content: '';
          position: absolute; inset: 0;
          pointer-events: none; z-index: 0;
          background-image: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,255,255,0.012) 2px, rgba(0,255,255,0.012) 4px
          );
        }
        .cw-panel::after {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0; width: 2px;
          background: linear-gradient(to bottom, var(--amber), var(--cyan));
          z-index: 2;
        }
        .cw-header {
          position: relative; z-index: 1; flex-shrink: 0;
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 1.25rem 1rem 1.5rem;
          border-bottom: 1px solid var(--border);
        }
        .cw-corner { position: absolute; width: 10px; height: 10px; }
        .cw-corner-tl { top: 8px; left: 10px; border-top: 1px solid var(--amber); border-left: 1px solid var(--amber); opacity: 0.5; }
        .cw-corner-tr { top: 8px; right: 8px; border-top: 1px solid var(--cyan);  border-right: 1px solid var(--cyan);  opacity: 0.4; }
        .cw-eyebrow {
          font-family: var(--font-label); font-size: 0.42rem;
          letter-spacing: 0.32em; text-transform: uppercase;
          color: var(--amber); opacity: 0.85; margin-bottom: 0.3rem;
        }
        .cw-title {
          font-family: var(--font-display); font-size: 1.1rem;
          font-weight: 300; color: var(--text-primary);
          letter-spacing: 0.04em; line-height: 1;
        }
        .cw-online-dot {
          width: 5px; height: 5px;
          background: var(--cyan); border-radius: 50%; opacity: 0.75;
        }
        .cw-online-txt {
          font-family: var(--font-label); font-size: 0.38rem;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--cyan); opacity: 0.6;
        }
        .cw-icon-btn {
          background: none; border: none; padding: 6px;
          cursor: pointer; color: var(--text-muted);
          display: flex; transition: color 0.2s;
        }
        .cw-icon-btn:hover     { color: var(--amber); }
        .cw-icon-btn.x:hover   { color: var(--cyan); }
        .cw-messages {
          position: relative; z-index: 1; flex: 1; overflow-y: auto;
          padding: 1.25rem 1.25rem 1rem 1.5rem;
          display: flex; flex-direction: column; gap: 0.75rem; min-height: 0;
        }
        .cw-bot-lbl {
          font-family: var(--font-label); font-size: 0.38rem;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--cyan); opacity: 0.55; margin-bottom: 0.3rem;
        }
        .cw-bubble {
          padding: 0.65rem 0.9rem;
          font-size: 0.85rem; line-height: 1.65;
          font-family: var(--font-display);
          color: var(--text-primary);
        }
        .cw-bot   { background: var(--bg-card); border: 1px solid var(--border); border-left: 2px solid var(--amber); }
        .cw-user  { background: var(--chat-user-bg); border: 1px solid var(--chat-user-border); }
        .cw-err   { background: var(--amber-honey); border: 1px solid var(--amber-soft); color: var(--amber-soft); }
        .cw-dot {
          display: inline-block; width: 4px; height: 4px;
          background: var(--cyan); border-radius: 50%;
          margin-left: 2px; vertical-align: middle;
          animation: cwBounce 0.8s ease-in-out infinite;
        }
        .cw-dot:nth-child(2) { animation-delay: 0.15s; }
        .cw-dot:nth-child(3) { animation-delay: 0.30s; }
        @keyframes cwBounce {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-4px); }
        }
        .cw-fb {
          background: none; border: none; padding: 4px;
          cursor: pointer; color: var(--text-muted);
          display: flex; transition: color 0.2s;
        }
        .cw-fb.up:hover,  .cw-fb.up.on  { color: var(--cyan); }
        .cw-fb.dn:hover,  .cw-fb.dn.on  { color: var(--amber); }
        .cw-input-area {
          position: relative; z-index: 1; flex-shrink: 0;
          border-top: 1px solid var(--border);
          padding: 0.85rem 1.25rem 0.85rem 1.5rem;
        }
        .cw-input-wrap {
          display: flex; align-items: flex-end; gap: 0.75rem;
          background: var(--input-bg); border: 1px solid var(--input-border);
          padding: 0.6rem 0.75rem;
        }
        .cw-ta {
          flex: 1; resize: none; background: transparent;
          border: none; outline: none;
          font-size: 0.82rem; font-family: var(--font-display);
          color: var(--text-primary); line-height: 1.55;
          min-height: 22px; max-height: 88px; overflow-y: auto;
        }
        .cw-ta::placeholder { color: var(--text-muted); }
        .cw-send {
          flex-shrink: 0; width: 30px; height: 30px;
          display: flex; align-items: center; justify-content: center;
          background: var(--amber); border: 1px solid var(--amber);
          color: #000; cursor: pointer; transition: opacity 0.2s;
        }
        .cw-send:disabled {
          background: transparent; border-color: var(--border);
          color: var(--text-muted); cursor: not-allowed; opacity: 0.4;
        }
        .cw-foot {
          display: flex; justify-content: space-between; margin-top: 0.45rem;
        }
        .cw-foot span {
          font-family: var(--font-label); font-size: 0.38rem;
          letter-spacing: 0.12em; color: var(--text-muted);
        }
        .cw-foot .warn { color: var(--amber); }
        .cw-fab {
          position: fixed; bottom: 24px; right: 24px; z-index: 50;
          width: 52px; height: 52px;
          display: flex; align-items: center; justify-content: center;
          background: var(--amber); color: #000;
          border: none; cursor: pointer;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          transition: background 0.3s;
        }
        .cw-fab.open { background: var(--cyan); }
      ` }} />

      {/* ── Panel ────────────────────────────────────────────────────────── */}
      {open && (
        <div className="cw-panel" role="dialog" aria-label="Lumière beauty advisor chat">

          {/* Header */}
          <div className="cw-header">
            <div className="cw-corner cw-corner-tl" />
            <div className="cw-corner cw-corner-tr" />

            <div>
              <p className="cw-eyebrow">Lumière</p>
              <p className="cw-title">Beauty Advisor</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginRight: "6px" }}>
                <div className="cw-online-dot" />
                <span className="cw-online-txt">Online</span>
              </div>
              <button className="cw-icon-btn" onClick={reset} title="Reset">
                <RotateCcw size={13} />
              </button>
              <button className="cw-icon-btn x" onClick={() => setOpen(false)} title="Close">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="cw-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
              >
                <div style={{ maxWidth: "85%" }}>
                  {msg.role === "bot" && <p className="cw-bot-lbl">Advisor</p>}

                  <div className={`cw-bubble ${
                    msg.role === "user" ? "cw-user"
                    : msg.isError       ? "cw-err"
                    :                     "cw-bot"
                  }`}>
                    {msg.text}
                    {msg.isStreaming && (
                      <span>
                        <span className="cw-dot" />
                        <span className="cw-dot" />
                        <span className="cw-dot" />
                      </span>
                    )}
                  </div>

                  {msg.role === "bot" && msg.logId && !msg.isStreaming && !msg.isError && (
                    <div style={{ display: "flex", gap: "2px", marginTop: "5px", justifyContent: "flex-end" }}>
                      <button
                        className={`cw-fb up ${msg.feedback === 1 ? "on" : ""}`}
                        onClick={() => void submitFeedback(msg.logId as string, 1, msg.id)}
                        disabled={msg.feedback !== null}
                        title="Helpful"
                      >
                        <ThumbsUp size={11} />
                      </button>
                      <button
                        className={`cw-fb dn ${msg.feedback === -1 ? "on" : ""}`}
                        onClick={() => void submitFeedback(msg.logId as string, -1, msg.id)}
                        disabled={msg.feedback !== null}
                        title="Not helpful"
                      >
                        <ThumbsDown size={11} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="cw-input-area">
            <div className="cw-input-wrap">
              <textarea
                ref={inputRef}
                className="cw-ta"
                value={input}
                rows={1}
                disabled={isLoading}
                maxLength={MAX_LEN}
                placeholder="Ask about skincare, products, orders…"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ opacity: isLoading ? 0.5 : 1 }}
              />
              <button
                className="cw-send"
                onClick={() => void sendMessage()}
                disabled={!input.trim() || isLoading}
                title="Send"
              >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              </button>
            </div>
            <div className="cw-foot">
              <span>Enter · Shift+Enter newline</span>
              <span className={input.length > MAX_LEN * 0.9 ? "warn" : ""}>
                {input.length}/{MAX_LEN}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      <button
        className={`cw-fab ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Open beauty advisor"}
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
      </button>
    </>
  );
}