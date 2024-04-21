import { defineConfig } from "turbowatch";

export default defineConfig({
  project: __dirname,
  triggers: [
    {
      expression: [
        "allof",
        ["not", ["dirname", "node_modules"]],
        ["not", ["dirname", "dist"]],
        ["dirname", "src"],
        ["match", "*.ts", "basename"],
      ],
      name: "build",
      onChange: async ({ spawn }) => {
        await spawn`pnpm run build`;
      },
    },
  ],
});
