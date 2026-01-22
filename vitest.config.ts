import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "solid-js/h",
    jsxDev: false,
  },
  resolve: {
    conditions: ["browser", "development"],
    alias: [
      {
        find: /^~\//,
        replacement: `${path.resolve(
          __dirname,
          "packages/app-web/src",
        )}/`,
      },
      {
        find: /^solid-js$/,
        replacement: "solid-js/dist/solid.js",
      },
      {
        find: /^solid-js\/web$/,
        replacement: "solid-js/web/dist/web.js",
      },
      {
        find: /^@shadr\/([^/]+)$/,
        replacement: `${path.resolve(__dirname, "packages")}/$1`,
      },
    ],
  },
  ssr: {
    resolve: {
      conditions: ["browser", "development"],
    },
    noExternal: ["solid-js", "solid-js/web", "solid-js/h", "lucide-solid"],
  },
  test: {
    include: ["packages/*/test/**/*.test.ts", "packages/*/test/**/*.test.tsx"],
    environment: "jsdom",
    // Avoid fork pool timeouts when running monorepo tests in parallel.
    pool: "threads",
    fileParallelism: false,
    deps: {
      optimizer: {
        ssr: {
          include: ["solid-js", "solid-js/web", "solid-js/h", "lucide-solid"],
        },
      },
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html", "lcov"],
    },
  },
});
