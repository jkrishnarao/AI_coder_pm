import { expect, test } from "@playwright/test";

async function stubAuthApi(page: import("@playwright/test").Page) {
  let authenticated = false;
  let board = {
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
