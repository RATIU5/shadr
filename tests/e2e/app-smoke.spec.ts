import { expect, test, type Page } from "@playwright/test";

const appUrl = new URL(
  "../../packages/app-web/index.html",
  import.meta.url,
).toString();

const waitForTestApi = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() => Boolean(window.__SHADR_TEST__?.getNodeIds)),
    )
    .toBe(true);

const getNodeIds = (page: Page) =>
  page.evaluate(() => window.__SHADR_TEST__?.getNodeIds() ?? []);

const getWireIds = (page: Page) =>
  page.evaluate(() => window.__SHADR_TEST__?.getWireIds() ?? []);

const getNodePosition = (page: Page, nodeId: string) =>
  page.evaluate(
    (id) => window.__SHADR_TEST__?.getNodePosition(id) ?? null,
    nodeId,
  );

const getNodeScreenCenter = (page: Page, nodeId: string) =>
  page.evaluate(
    (id) => window.__SHADR_TEST__?.getNodeScreenCenter(id) ?? null,
    nodeId,
  );

const getSocketsForNode = (page: Page, nodeId: string) =>
  page.evaluate(
    (id) => window.__SHADR_TEST__?.getSocketsForNode(id) ?? null,
    nodeId,
  );

const getSocketScreenPosition = (page: Page, socketId: string) =>
  page.evaluate(
    (id) => window.__SHADR_TEST__?.getSocketScreenPosition(id) ?? null,
    socketId,
  );

test("app boots and can create/drag/connect/delete nodes", async ({ page }) => {
  await page.goto(appUrl);

  await expect(page.getByRole("heading", { name: "Shadr" })).toBeVisible();
  await waitForTestApi(page);

  const canvas = page.getByTestId("editor-canvas");
  await expect(canvas).toBeVisible();

  await canvas.dblclick({ position: { x: 220, y: 220 } });
  await canvas.dblclick({ position: { x: 520, y: 220 } });

  await expect.poll(() => getNodeIds(page).then((ids) => ids.length)).toBe(2);

  const [firstNodeId, secondNodeId] = await getNodeIds(page);
  if (!firstNodeId || !secondNodeId) {
    throw new Error("Expected two nodes after double-clicking the canvas.");
  }

  const initialPosition = await getNodePosition(page, firstNodeId);
  if (!initialPosition) {
    throw new Error("Missing node position for drag test.");
  }

  const startCenter = await getNodeScreenCenter(page, firstNodeId);
  if (!startCenter) {
    throw new Error("Missing node screen position for drag test.");
  }

  await page.mouse.move(startCenter.x, startCenter.y);
  await page.mouse.down();
  await page.mouse.move(startCenter.x + 140, startCenter.y + 60);
  await page.mouse.up();

  await expect
    .poll(async () => {
      const nextPosition = await getNodePosition(page, firstNodeId);
      if (!nextPosition) {
        return "missing";
      }
      const delta =
        Math.abs(nextPosition.x - initialPosition.x) +
        Math.abs(nextPosition.y - initialPosition.y);
      return delta > 1 ? "moved" : "same";
    })
    .toBe("moved");

  const sourceSockets = await getSocketsForNode(page, firstNodeId);
  const targetSockets = await getSocketsForNode(page, secondNodeId);
  const fromSocket = sourceSockets?.outputs[0];
  const toSocket = targetSockets?.inputs[0];
  if (!fromSocket || !toSocket) {
    throw new Error("Missing sockets for connection test.");
  }

  const fromPosition = await getSocketScreenPosition(page, fromSocket);
  const toPosition = await getSocketScreenPosition(page, toSocket);
  if (!fromPosition || !toPosition) {
    throw new Error("Missing socket screen positions for connection test.");
  }

  await page.mouse.move(fromPosition.x, fromPosition.y);
  await page.mouse.down();
  await page.mouse.move(toPosition.x, toPosition.y);
  await page.mouse.up();

  await expect.poll(() => getWireIds(page).then((ids) => ids.length)).toBe(1);

  const secondCenter = await getNodeScreenCenter(page, secondNodeId);
  if (!secondCenter) {
    throw new Error("Missing node screen position for delete test.");
  }
  await page.mouse.click(secondCenter.x, secondCenter.y);
  await page.keyboard.press("Delete");

  await expect.poll(() => getNodeIds(page).then((ids) => ids.length)).toBe(1);
});

test("context menu can add and delete nodes", async ({ page }) => {
  await page.goto(appUrl);

  await expect(page.getByRole("heading", { name: "Shadr" })).toBeVisible();
  await waitForTestApi(page);

  const canvas = page.getByTestId("editor-canvas");
  await expect(canvas).toBeVisible();

  await canvas.click({ button: "right", position: { x: 300, y: 320 } });
  await expect(page.getByTestId("canvas-context-menu")).toBeVisible();
  await page.getByTestId("canvas-menu-add-node").click();

  await expect.poll(() => getNodeIds(page).then((ids) => ids.length)).toBe(1);

  const [nodeId] = await getNodeIds(page);
  if (!nodeId) {
    throw new Error("Expected node from context menu create action.");
  }
  const nodeCenter = await getNodeScreenCenter(page, nodeId);
  if (!nodeCenter) {
    throw new Error("Missing node screen position for context menu delete.");
  }

  await page.mouse.click(nodeCenter.x, nodeCenter.y, { button: "right" });
  await expect(page.getByTestId("canvas-context-menu")).toBeVisible();
  await page.getByTestId("canvas-menu-delete-node").click();

  await expect.poll(() => getNodeIds(page).then((ids) => ids.length)).toBe(0);
});
