import { loadBoard, saveBoard } from "@/lib/board-api";
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
});