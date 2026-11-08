import {
  loadBoard,
  saveBoard,
  sendAssistantMessage,
  type AssistantMessage,
} from "@/lib/board-api";
import { initialData } from "@/lib/kanban";

const response = (ok: boolean, status: number, body: unknown = {}) =>
  ({ ok, status, json: async () => body }) as Response;

describe("board API", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the signed-in user's board without caching", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(true, 200, initialData));

    await expect(loadBoard()).resolves.toEqual(initialData);
    expect(fetchMock).toHaveBeenCalledWith("/api/board", { cache: "no-store" });
  });

  it("reports an expired session when loading is unauthorized", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(false, 401));

    await expect(loadBoard()).rejects.toThrow("Your session has expired.");
  });

  it("reports a server error when loading fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(false, 500));

    await expect(loadBoard()).rejects.toThrow("Unable to load the board.");
  });

  it("saves the full board with PUT", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(true, 200));

    await expect(saveBoard(initialData)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/board", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(initialData),
    });
  });

  it("reports a failed board save", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(false, 500));

    await expect(saveBoard(initialData)).rejects.toThrow("Unable to save the board.");
  });

  it("sends an assistant message with bounded conversation history", async () => {
    const result = { reply: "Done.", board: initialData };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(true, 200, result));
    const history: AssistantMessage[] = Array.from({ length: 22 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Message ${index}`,
    }));

    await expect(sendAssistantMessage("Update the board", history)).resolves.toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Update the board", history: history.slice(-20) }),
    });
  });

  it.each([
    [401, "Your session has expired."],
    [503, "The AI assistant is not configured."],
    [502, "The AI assistant could not respond. Please try again."],
  ])("reports assistant HTTP %i with a useful message", async (status, error) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(false, status));

    await expect(sendAssistantMessage("Hello", [])).rejects.toThrow(error);
  });

  it("reports assistant network failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));

    await expect(sendAssistantMessage("Hello", [])).rejects.toThrow(
      "Unable to contact the AI assistant."
    );
  });
});