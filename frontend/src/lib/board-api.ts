import type { BoardData } from "@/lib/kanban";

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantResult = {
  reply: string;
  board: BoardData;
};

export async function loadBoard(): Promise<BoardData> {
  const response = await fetch("/api/board", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? "Your session has expired." : "Unable to load the board."
    );
  }
  return response.json() as Promise<BoardData>;
}

export async function saveBoard(board: BoardData): Promise<void> {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(board),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 401 ? "Your session has expired." : "Unable to save the board."
    );
  }
}

export async function sendAssistantMessage(
  message: string,
  history: AssistantMessage[]
): Promise<AssistantResult> {
  let response: Response;
  try {
    response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history: history.slice(-20) }),
    });
  } catch {
    throw new Error("Unable to contact the AI assistant.");
  }

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Your session has expired."
        : response.status === 503
          ? "The AI assistant is not configured."
          : "The AI assistant could not respond. Please try again."
    );
  }
  return response.json() as Promise<AssistantResult>;
}