import { defineConfig } from "turbowatch";

export default defineConfig({
  project: __dirname,
  triggers: [
    {
      expression: [
        "allof",
        ["not", ["dirname", "dist"]],
        ["dirname", "src"],
        ["dirname", "node_modules"],
        ["match", "*.ts", "basename"],
      ],
      name: "build",
      onChange: async ({ spawn }) => {
        await spawn`pnpm run build`;
      },
    },
  ],
});
