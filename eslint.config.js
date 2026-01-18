import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const packageDirs = [
  "packages/app-web",
  "packages/kobalte-core",
  "packages/devtools",
  "packages/exec-engine",
  "packages/graph-core",
  "packages/plugin-system",
  "packages/shared",
  "packages/storage-idb",
  "packages/ui-canvas",
  "packages/ui-overlay",
];

const baseTypeScriptRules = {
  "simple-import-sort/imports": "error",
  "simple-import-sort/exports": "error",
  "import/no-default-export": "error",
  "prettier/prettier": "error",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", disallowTypeAnnotations: false },
  ],
  "@typescript-eslint/no-floating-promises": "error",
  "@typescript-eslint/no-misused-promises": [
    "error",
    { checksVoidReturn: { arguments: false, attributes: false } },
  ],
};

const baseTypeScriptConfig = packageDirs.map((packageDir) => ({
  files: [`${packageDir}/src/**/*.{ts,tsx}`],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      project: [`${packageDir}/tsconfig.json`],
      tsconfigRootDir: __dirname,
      sourceType: "module",
    },
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
  plugins: {
    "@typescript-eslint": tsPlugin,
    import: importPlugin,
    "simple-import-sort": simpleImportSort,
    prettier: prettierPlugin,
  },
  rules: baseTypeScriptRules,
}));

export default [
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"] },
  js.configs.recommended,
  ...baseTypeScriptConfig,
  {
    files: ["packages/app-web/app.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["packages/app-web/src/**/*.{ts,tsx}"],
    rules: {
      "import/no-default-export": "off",
    },
  },
  {
    files: [
      "packages/graph-core/src/**/*.{ts,tsx}",
      "packages/exec-engine/src/**/*.{ts,tsx}",
      "packages/shared/src/**/*.{ts,tsx}",
      "packages/plugin-system/src/**/*.{ts,tsx}",
      "packages/storage-idb/src/**/*.{ts,tsx}",
      "packages/ui-canvas/src/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  prettierConfig,
  eslintPluginPrettierRecommended,
];
