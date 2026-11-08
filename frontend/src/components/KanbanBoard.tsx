"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AssistantPanel } from "@/components/AssistantPanel";
import { createId, moveCard, type BoardData } from "@/lib/kanban";
import {
  loadBoard,
  saveBoard,
  sendAssistantMessage,
  type AssistantMessage,
} from "@/lib/board-api";

export const KanbanBoard = () => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const assistantButtonRef = useRef<HTMLButtonElement>(null);
  const lastQueuedBoard = useRef<string | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    loadBoard()
      .then((loadedBoard) => {
        if (active) {
          lastQueuedBoard.current = JSON.stringify(loadedBoard);
          setBoard(loadedBoard);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load the board."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!board) {
      return;
    }

    const serializedBoard = JSON.stringify(board);
    if (serializedBoard === lastQueuedBoard.current) {
      return;
    }
    const previousBoard = lastQueuedBoard.current;
    lastQueuedBoard.current = serializedBoard;
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => saveBoard(board))
      .then(() => setSaveError(null))
      .catch((error: unknown) => {
        if (lastQueuedBoard.current === serializedBoard) {
          lastQueuedBoard.current = previousBoard;
        }
        setSaveError(
          error instanceof Error ? error.message : "Unable to save the board."
        );
      });
  }, [board]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);

    if (!over || active.id === over.id) {
      return;
    }

    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        columns: moveCard(prev.columns, active.id as string, over.id as string),
      };
    });
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        columns: prev.columns.map((column) =>
          column.id === columnId ? { ...column, title } : column
        ),
      };
    });
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [id]: { id, title, details: details || "No details yet." },
        },
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? { ...column, cardIds: [...column.cardIds, id] }
            : column
        ),
      };
    });
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        cards: Object.fromEntries(
          Object.entries(prev.cards).filter(([id]) => id !== cardId)
        ),
        columns: prev.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cardIds: column.cardIds.filter((id) => id !== cardId),
              }
            : column
        ),
      };
    });
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    setBoard((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: { ...prev.cards[cardId], title, details },
        },
      };
    });
  };

  const handleAssistantSend = async (
    message: string,
    history: AssistantMessage[]
  ): Promise<string> => {
    await saveQueue.current;
    const result = await sendAssistantMessage(message, history);
    lastQueuedBoard.current = JSON.stringify(result.board);
    setBoard(result.board);
    return result.reply;
  };

  const closeAssistant = () => {
    setIsAssistantOpen(false);
    requestAnimationFrame(() => assistantButtonRef.current?.focus());
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (loadError) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-6">
        <p role="alert" className="max-w-md text-center text-sm text-red-700">
          {loadError}
        </p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-6" aria-busy="true">
        <p role="status" className="text-sm font-medium text-[var(--gray-text)]">
          Loading your board...
        </p>
      </main>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, drag cards between stages,
                and capture quick notes without getting buried in settings.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
              <button
                ref={assistantButtonRef}
                type="button"
                aria-controls="board-assistant-panel"
                aria-expanded={isAssistantOpen}
                onClick={() => setIsAssistantOpen((open) => !open)}
                className="rounded-md bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white hover:brightness-110"
              >
                AI assistant
              </button>
            </div>
          </div>
          {saveError && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {saveError}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <div
          className={
            isAssistantOpen
              ? "2xl:grid 2xl:grid-cols-[minmax(0,1fr)_360px] 2xl:items-start 2xl:gap-6"
              : ""
          }
        >
          <div className="min-w-0">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <section className="grid gap-6 lg:grid-cols-5">
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId])}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onEditCard={handleEditCard}
                    onDeleteCard={handleDeleteCard}
                  />
                ))}
              </section>
              <DragOverlay>
                {activeCard ? (
                  <div className="w-[260px]">
                    <KanbanCardPreview card={activeCard} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
          {isAssistantOpen && (
            <>
              <button
                type="button"
                aria-label="Dismiss assistant drawer"
                onClick={closeAssistant}
                className="fixed inset-0 z-40 bg-black/30 2xl:hidden"
              />
              <div className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] 2xl:static 2xl:z-auto 2xl:w-auto 2xl:max-w-none">
                <AssistantPanel
                  onSend={handleAssistantSend}
                  onClose={closeAssistant}
                />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
