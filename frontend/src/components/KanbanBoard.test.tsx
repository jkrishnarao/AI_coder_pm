import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData, type BoardData } from "@/lib/kanban";

let storedBoard: BoardData;

const getFirstColumn = async () => (await screen.findAllByTestId(/column-/i))[0];

describe("KanbanBoard", () => {
  beforeEach(() => {
    storedBoard = structuredClone(initialData);
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (_input === "/api/assistant") {
        const cardId = "card-assistant-test";
        storedBoard.cards[cardId] = {
          id: cardId,
          title: "Assistant task",
          details: "Created from chat.",
        };
        storedBoard.columns[0].cardIds.push(cardId);
        return {
          ok: true,
          status: 200,
          json: async () => ({ reply: "Added Assistant task to Backlog.", board: structuredClone(storedBoard) }),
        } as Response;
      }
      if (init?.method === "PUT") {
        storedBoard = JSON.parse(init.body as string) as BoardData;
      }
      return {
        ok: true,
        status: 200,
        json: async () => structuredClone(storedBoard),
      } as Response;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders five columns", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    await waitFor(() => expect(storedBoard.columns[0].title).toBe("New Name"));
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();
    await waitFor(() => {
      expect(Object.values(storedBoard.cards).some((card) => card.title === "New card")).toBe(true);
    });

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(Object.values(storedBoard.cards).some((card) => card.title === "New card")).toBe(false);
    });
  });

  it("edits a card title and details", async () => {
    render(<KanbanBoard />);
    const column = await getFirstColumn();
    await userEvent.click(
      within(column).getByRole("button", { name: /edit align roadmap themes/i })
    );

    await userEvent.clear(within(column).getByLabelText("Card title"));
    await userEvent.type(within(column).getByLabelText("Card title"), "Updated roadmap");
    await userEvent.clear(within(column).getByLabelText("Card details"));
    await userEvent.type(within(column).getByLabelText("Card details"), "Revised notes");
    await userEvent.click(
      within(column).getByRole("button", { name: "Save changes", exact: true })
    );

    expect(within(column).getByText("Updated roadmap")).toBeInTheDocument();
    expect(within(column).getByText("Revised notes")).toBeInTheDocument();
    await waitFor(() => {
      expect(storedBoard.cards["card-1"]).toMatchObject({
        title: "Updated roadmap",
        details: "Revised notes",
      });
    });
  });

  it("opens the assistant and renders a returned card without reloading", async () => {
    render(<KanbanBoard />);
    await screen.findAllByTestId(/column-/i);
    await userEvent.click(screen.getByRole("button", { name: "AI assistant" }));
    await userEvent.type(
      screen.getByLabelText("Message the assistant"),
      "Create a task"
    );
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Added Assistant task to Backlog.")).toBeInTheDocument();
    expect(screen.getByText("Assistant task")).toBeInTheDocument();
    expect(storedBoard.cards["card-assistant-test"]).toMatchObject({
      title: "Assistant task",
      details: "Created from chat.",
    });
  });
});
