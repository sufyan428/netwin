import { test, expect } from "@playwright/test";

// These tests exercise the deterministic, offline-safe parts of the app —
// topology editing, what-if simulation, undo/redo, and the tools panel.
// The AI Engineer panel is excluded here since it calls a live external
// API; that path is verified manually / in Phase 3 QA notes instead.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("NetTwin")).toBeVisible();
});

test("loads the seed topology healthy", async ({ page }) => {
  await expect(page.getByText("Healthy")).toBeVisible();
  await expect(page.getByText("6", { exact: true }).first()).toBeVisible(); // device count stat
});

test("adding a router increases the device count and is undoable", async ({ page }) => {
  const deviceCount = page.locator("text=DEVICES").locator("..").locator("div").first();
  await page.getByRole("button", { name: /^Router$/ }).click();
  await expect(page.getByText("7", { exact: true }).first()).toBeVisible();

  await page.keyboard.press("Control+z");
  await expect(page.getByText("6", { exact: true }).first()).toBeVisible();

  await page.keyboard.press("Control+Shift+z");
  await expect(page.getByText("7", { exact: true }).first()).toBeVisible();
  void deviceCount;
});

test("what-if router failure degrades the network and Restore recovers it", async ({ page }) => {
  await page.getByText("R2", { exact: true }).first().click();
  await page.getByRole("button", { name: /What-if: Fail this device/i }).click();

  await expect(page.getByText(/Partitioned|Degraded/).first()).toBeVisible();

  await page.getByRole("button", { name: "Restore" }).first().click();
  await expect(page.getByText("Healthy")).toBeVisible();
});

test("command palette opens with Ctrl+K and runs a command", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await expect(page.getByPlaceholder("Type a command…")).toBeVisible();
  await page.getByPlaceholder("Type a command…").fill("Add host");
  await page.getByRole("button", { name: /^Add host/ }).click();
  await expect(page.getByText("7", { exact: true }).first()).toBeVisible();
});

test("theme toggle switches data-theme on <html>", async ({ page }) => {
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.getByRole("button", { name: /toggle theme/i }).click();
  await expect(html).not.toHaveAttribute("data-theme", before ?? "");
});

test("subnet calculator computes a live result in the Tools tab", async ({ page }) => {
  await page.getByRole("button", { name: "Tools", exact: true }).click();
  const input = page.getByPlaceholder("10.0.0.0/24").first();
  await input.fill("192.168.0.0/28");
  await expect(page.getByText("192.168.0.15")).toBeVisible(); // broadcast
});

test("projects modal saves and lists a project", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Type a command…").fill("projects");
  await page.getByRole("button", { name: /Open projects/i }).click();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await page.getByRole("button", { name: /Save as new/i }).click();
  await expect(page.getByText(/Saved projects \(1\)/)).toBeVisible();
});

test("mobile viewport: sidebar starts hidden and opens via the menu button", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("Devices", { exact: false }).first()).toBeHidden();

  await page.getByRole("button", { name: /toggle sidebar/i }).click();
  await expect(page.getByText("Overview", { exact: false }).first()).toBeVisible();
});
