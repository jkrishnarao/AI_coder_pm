import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { initialData } from "@/lib/kanban";

type AuthApiOptions = {
  loginStatus?: number;
  logoutStatus?: number;
  sessionFailure?: boolean;
};

function apiResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function mockAuthApi(options: AuthApiOptions = {}) {
  let authenticated = false;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/auth/me")) {
      if (options.sessionFailure) {
        throw new Error("Network unavailable");
      }
      return apiResponse(
        authenticated ? 200 : 401,
        authenticated ? { username: "user" } : { detail: "Not authenticated" }
      );
    }
    if (url.endsWith("/api/auth/login")) {
      const status = options.loginStatus ?? 200;
      authenticated = status === 200;
      return apiResponse(status, { username: "user" });
    }
    if (url.endsWith("/api/auth/logout")) {
      const status = options.logoutStatus ?? 200;
      if (status === 200) {
        authenticated = false;
      }
      return apiResponse(status, { status: "ok" });
    }
    if (url.endsWith("/api/board")) {
      return apiResponse(200, structuredClone(initialData));
    }
    throw new Error(`Unexpected request: ${url} (${init?.method ?? "GET"})`);
  });
}

describe("AuthGate", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the board hidden when there is no session", async () => {
    mockAuthApi();

    render(<AuthGate />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("shows the board after login and hides it after logout", async () => {
    mockAuthApi();
    const user = userEvent.setup();

    render(<AuthGate />);
    await screen.findByRole("heading", { name: "Sign in" });
    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("shows an error when credentials are rejected", async () => {
    mockAuthApi({ loginStatus: 401 });

    render(<AuthGate />);
    await screen.findByRole("heading", { name: "Sign in" });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Username or password is incorrect."
    );
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).not.toBeInTheDocument();
  });

  it("reports an unavailable login service", async () => {
    mockAuthApi({ loginStatus: 503 });

    render(<AuthGate />);
    await screen.findByRole("heading", { name: "Sign in" });
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in is unavailable. Please try again."
    );
  });

  it("keeps the board visible when logout fails", async () => {
    mockAuthApi({ logoutStatus: 503 });
    const user = userEvent.setup();

    render(<AuthGate />);
    await screen.findByRole("heading", { name: "Sign in" });
    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Kanban Studio" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to sign out. Please try again."
    );
    expect(screen.getByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });

  it("allows sign-in after the initial session check fails", async () => {
    mockAuthApi({ sessionFailure: true });
    const user = userEvent.setup();

    render(<AuthGate />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to check your session. Please try signing in again."
    );
    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Kanban Studio" })).toBeInTheDocument();
  });
});