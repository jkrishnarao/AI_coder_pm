import { expect, test } from "@playwright/test";

async function stubAuthApi(page: import("@playwright/test").Page) {
  let authenticated = false;
  let board: {
    columns: { id: string; title: string; cardIds: string[] }[];
    cards: Record<string, { id: string; title: string; details: string }>;
  } = {
    columns: [
      { id: "col-backlog", title: "Backlog", cardIds: ["card-1"] },
      { id: "col-discovery", title: "Discovery", cardIds: [] },
      { id: "col-progress", title: "In Progress", cardIds: [] },
      { id: "col-review", title: "Review", cardIds: [] },
      { id: "col-done", title: "Done", cardIds: [] },
    ],
    cards: {
      "card-1": {
        id: "card-1",
        title: "Align roadmap themes",
        details: "Draft quarterly themes with impact statements and metrics.",
      },
    },
  };

  await page.route("**/api/auth/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const respond = (status: number, body: Record<string, string>) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/api/auth/me") {
      return authenticated
        ? respond(200, { username: "user" })
        : respond(401, { detail: "Not authenticated" });
    }

    if (path === "/api/auth/login") {
      const credentials = request.postDataJSON() as { username: string; password: string };
      authenticated = credentials.username === "user" && credentials.password === "password";
      return authenticated
        ? respond(200, { username: "user" })
        : respond(401, { detail: "Invalid username or password" });
    }

    if (path === "/api/auth/logout") {
      authenticated = false;
      return respond(200, { status: "ok" });
    }

    return route.continue();
  });

  await page.route("**/api/board", async (route) => {
    if (route.request().method() === "PUT") {
      board = route.request().postDataJSON();
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(board) });
  });

  await page.route("**/api/assistant", async (route) => {
    const request = route.request().postDataJSON() as { message: string };
    if (request.message.toLowerCase().includes("summarize")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply: "The board has one task in Backlog.",
          board,
        }),
      });
    }
    const cardId = "card-assistant-1";
    board.cards[cardId] = {
      id: cardId,
      title: "Assistant task",
      details: "Created from chat.",
    };
    board.columns[0].cardIds.push(cardId);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "Added Assistant task to Backlog.",
        board,
      }),
    });
  });
}

async function signIn(page: import("@playwright/test").Page) {
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
}

async function openBoard(page: import("@playwright/test").Page) {
  await stubAuthApi(page);
  await page.goto("/");
  await signIn(page);
}

test("requires a login before showing the board", async ({ page }) => {
  await stubAuthApi(page);
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toHaveCount(0);
});

test("rejects invalid credentials", async ({ page }) => {
  await stubAuthApi(page);
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByText("Username or password is incorrect.", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toHaveCount(0);
});

test("keeps the session on reload and signs out", async ({ page }) => {
  await stubAuthApi(page);
  await page.goto("/");
  await signIn(page);
  await page.reload();

  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toHaveCount(0);
});

test("restores board edits after sign-out and sign-in", async ({ page }) => {
  await openBoard(page);
  const firstColumn = page.locator('[data-testid="column-col-backlog"]');
  const card = firstColumn.getByTestId("card-card-1");
  await card.getByRole("button", { name: /edit align roadmap themes/i }).click();
  await card.getByLabel("Card title").fill("Persisted roadmap update");
  await card.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(card.getByText("Persisted roadmap update")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page);

  await expect(
    page.getByTestId("column-col-backlog").getByText("Persisted roadmap update")
  ).toBeVisible();
});

test("persists board edits through the real database", async ({ page }) => {
  test.skip(
    process.env.PLAYWRIGHT_REAL_BACKEND !== "1",
    "Set PLAYWRIGHT_REAL_BACKEND=1 to run against an isolated live backend."
  );

  await page.goto("/");
  await signIn(page);
  const card = page.getByTestId("card-card-1");
  await card.getByRole("button", { name: /edit align roadmap themes/i }).click();
  await card.getByLabel("Card title").fill("Verified in SQLite from dashboard");
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/board") && response.request().method() === "PUT"
  );
  await card.getByRole("button", { name: "Save changes", exact: true }).click();
  expect((await saveResponse).ok()).toBe(true);

  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page);

  await expect(
    page.getByTestId("column-col-backlog").getByText("Verified in SQLite from dashboard")
  ).toBeVisible();
});

test("loads the kanban board", async ({ page }) => {
  await openBoard(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("uses the assistant to create a board card", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "AI assistant" }).click();
  await page.getByLabel("Message the assistant").fill("Create a task for the launch");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Added Assistant task to Backlog.")).toBeVisible();
  await expect(
    page.getByTestId("column-col-backlog").getByText("Assistant task")
  ).toBeVisible();
});

test("shows a reply-only assistant response without changing the board", async ({ page }) => {
  await openBoard(page);
  await page.getByRole("button", { name: "AI assistant" }).click();
  await page.getByLabel("Message the assistant").fill("Summarize the board");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("The board has one task in Backlog.")).toBeVisible();
  await expect(page.getByTestId("column-col-backlog").getByTestId("card-card-1")).toBeVisible();
  await expect(page.getByTestId("card-card-assistant-1")).toHaveCount(0);
});

test("retains the message when the assistant request fails", async ({ page }) => {
  await openBoard(page);
  await page.route("**/api/assistant", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ detail: "AI assistant provider request failed" }),
    })
  );
  await page.getByRole("button", { name: "AI assistant" }).click();
  const composer = page.getByLabel("Message the assistant");
  await composer.fill("Keep this available to retry");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(
    page.getByRole("complementary", { name: "Board assistant" }).getByRole("alert")
  ).toHaveText(
    "The AI assistant could not respond. Please try again."
  );
  await expect(composer).toHaveValue("Keep this available to retry");
});

test("shows the assistant drawer at a narrow viewport", async ({ page }) => {
  await openBoard(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "AI assistant" }).click();

  const panel = page.getByRole("complementary", { name: "Board assistant" });
  const bounds = await panel.boundingBox();
  expect(bounds?.width).toBeLessThanOrEqual(390);
  await expect(page.getByLabel("Message the assistant")).toBeVisible();
});

test("adds a card to a column", async ({ page }) => {
  await openBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("renames a column", async ({ page }) => {
  await openBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const title = firstColumn.getByLabel("Column title");

  await title.fill("Ready for Review");
  await expect(title).toHaveValue("Ready for Review");
});

test("deletes a card", async ({ page }) => {
  await openBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const card = firstColumn.getByTestId("card-card-1");

  await card.getByRole("button", { name: /delete align roadmap themes/i }).click();
  await expect(card).toHaveCount(0);
});

test("edits a card", async ({ page }) => {
  await openBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  const card = firstColumn.getByTestId("card-card-1");

  await card.getByRole("button", { name: /edit align roadmap themes/i }).click();
  await card.getByLabel("Card title").fill("Updated roadmap");
  await card.getByLabel("Card details").fill("Updated planning notes");
  await card.getByRole("button", { name: "Save changes", exact: true }).click();

  await expect(card.getByText("Updated roadmap")).toBeVisible();
  await expect(card.getByText("Updated planning notes")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await openBoard(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});
