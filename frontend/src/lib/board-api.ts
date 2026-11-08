import type { BoardData } from "@/lib/kanban";

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