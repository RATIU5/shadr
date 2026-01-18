import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..", "..");
const indexPath = path.join(rootDir, "packages", "app-web", "index.html");
const indexUrl = pathToFileURL(indexPath).toString();

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });

  try {
    await page.goto(indexUrl, { waitUntil: "load" });
    await page.waitForSelector("[data-testid='add-node']");

    const metrics = await page.evaluate(async () => {
      const button = document.querySelector("[data-testid='add-node']");
      if (!button) {
        return { error: "Add node button not found." };
      }

      const start = performance.now();
      for (let i = 0; i < 1000; i += 1) {
        button.click();
      }
      const afterClicks = performance.now();

      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );

      const total = performance.now();
      const nodeCount = document.querySelectorAll(
        "[data-testid='node']",
      ).length;

      return {
        nodeCount,
        clickDurationMs: afterClicks - start,
        totalDurationMs: total - start,
      };
    });

    if ("error" in metrics) {
      console.error(metrics.error);
      process.exitCode = 1;
      return;
    }

    console.log("Render perf benchmark (1000 nodes)");
    console.log(`Node count: ${metrics.nodeCount}`);
    console.log(`Click duration: ${metrics.clickDurationMs.toFixed(2)} ms`);
    console.log(
      `Total duration (2 rAF): ${metrics.totalDurationMs.toFixed(2)} ms`,
    );

    if (metrics.nodeCount !== 1000) {
      console.warn("Warning: expected 1000 nodes to be created.");
    }
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
