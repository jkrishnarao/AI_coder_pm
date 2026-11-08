import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssistantPanel } from "@/components/AssistantPanel";

describe("AssistantPanel", () => {
  it("sends a message and renders the assistant reply", async () => {
    const onSend = vi.fn().mockResolvedValue("I moved the card to Review.");
    render(<AssistantPanel onSend={onSend} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Message the assistant"), "Move the card");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("I moved the card to Review.")).toBeInTheDocument();
    expect(screen.getByText("Move the card")).toBeInTheDocument();
    expect(onSend).toHaveBeenCalledWith("Move the card", []);
    expect(screen.getByLabelText("Message the assistant")).toHaveValue("");
  });

  it("disables duplicate submissions while waiting", async () => {
    let resolveSend!: (reply: string) => void;
    const onSend = vi.fn(
      () => new Promise<string>((resolve) => (resolveSend = resolve))
    );
    render(<AssistantPanel onSend={onSend} onClose={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Message the assistant"), "Add a task");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByRole("status")).toHaveTextContent("Thinking...");
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
    expect(onSend).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Sending..." }));
    expect(onSend).toHaveBeenCalledTimes(1);

    resolveSend("Added.");
    expect(await screen.findByText("Added.")).toBeInTheDocument();
  });

  it("keeps the draft and reports failures", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("The AI assistant could not respond."));
    render(<AssistantPanel onSend={onSend} onClose={vi.fn()} />);
    const input = screen.getByLabelText("Message the assistant");

    await userEvent.type(input, "Keep this request");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The AI assistant could not respond."
    );
    expect(input).toHaveValue("Keep this request");
  });

  it("closes from the panel control", async () => {
    const onClose = vi.fn();
    render(<AssistantPanel onSend={vi.fn()} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Close assistant" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("focuses the composer and closes on Escape", async () => {
    const onClose = vi.fn();
    render(<AssistantPanel onSend={vi.fn()} onClose={onClose} />);

    const composer = screen.getByLabelText("Message the assistant");
    await waitFor(() => expect(composer).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("complementary"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
  });
});