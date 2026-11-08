"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createId } from "@/lib/kanban";
import type { AssistantMessage } from "@/lib/board-api";

type DisplayMessage = AssistantMessage & { id: string };

type AssistantPanelProps = {
  onSend: (message: string, history: AssistantMessage[]) => Promise<string>;
  onClose: () => void;
};

export const AssistantPanel = ({ onSend, onClose }: AssistantPanelProps) => {
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    messageInputRef.current?.focus();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending) {
      return;
    }

    setError(null);
    setIsSending(true);
    try {
      const history = messages.slice(-20).map(({ role, content }) => ({ role, content }));
      const reply = await onSend(message, history);
      const userMessage: DisplayMessage = {
        id: createId("message"),
        role: "user",
        content: message,
      };
      const assistantMessage: DisplayMessage = {
        id: createId("message"),
        role: "assistant",
        content: reply,
      };
      setMessages((current) =>
        [...current, userMessage, assistantMessage].slice(-40)
      );
      setDraft("");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to send your message. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside
      id="board-assistant-panel"
      aria-label="Board assistant"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
      className="flex h-full min-h-0 flex-col border-l border-[var(--stroke)] bg-white shadow-[var(--shadow)] 2xl:sticky 2xl:top-4 2xl:h-[calc(100vh-2rem)] 2xl:rounded-lg 2xl:border"
    >
      <header className="flex items-start justify-between gap-4 border-b border-[var(--stroke)] px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gray-text)]">
            Kanban Studio
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[var(--navy-dark)]">
            Board assistant
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assistant"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--stroke)] text-lg text-[var(--navy-dark)] hover:border-[var(--primary-blue)]"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>

      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
      >
        {messages.length === 0 ? (
          <p className="max-w-[30ch] text-sm leading-6 text-[var(--gray-text)]">
            What would you like to change on this board?
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={message.role === "user" ? "ml-8 text-right" : "mr-6"}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--gray-text)]">
                {message.role === "user" ? "You" : "Assistant"}
              </p>
              <p
                className={
                  message.role === "user"
                    ? "inline-block max-w-full rounded-lg bg-[var(--navy-dark)] px-3 py-2 text-left text-sm leading-5 text-white"
                    : "text-sm leading-6 text-[var(--navy-dark)]"
                }
              >
                {message.content}
              </p>
            </div>
          ))
        )}
        {isSending && (
          <p role="status" className="text-sm text-[var(--gray-text)]">
            Thinking...
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-[var(--stroke)] p-4">
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <label htmlFor="assistant-message" className="sr-only">
          Message the assistant
        </label>
        <textarea
          ref={messageInputRef}
          id="assistant-message"
          rows={3}
          maxLength={2000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask for a board update..."
          disabled={isSending}
          className="w-full resize-none rounded-md border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-5 outline-none focus:border-[var(--primary-blue)] disabled:opacity-70"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--gray-text)]">
            {draft.length}/2000
          </span>
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="rounded-md bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </form>
    </aside>
  );
};