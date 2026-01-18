import { expect, test } from "@playwright/test";

const appUrl = new URL(
  "../../packages/app-web/index.html",
  import.meta.url,
).toString();

test("app boots and can create/connect nodes", async ({ page }) => {
  await page.goto(appUrl);

  await expect(page.getByRole("heading", { name: "Shadr" })).toBeVisible();

  const addNode = page.getByTestId("add-node");
  await addNode.click();
  await addNode.click();

  const nodes = page.getByTestId("node");
  await expect(nodes).toHaveCount(2);

  await nodes.nth(0).click();
  await nodes.nth(1).click();
  await page.getByTestId("connect-nodes").click();

  await expect(page.getByTestId("connection")).toHaveCount(1);
});
