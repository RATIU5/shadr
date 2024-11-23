// scripts/version.ts
import { walk } from "jsr:@std/fs";

interface PackageJson {
  name: string;
  version: string;
  imports?: Record<string, string>;
}

async function updateVersions(newVersion?: string, packageName?: string) {
  // Walk through all deno.json files in the workspace
  for await (
    const entry of walk(".", {
      match: [/deno\.json$/],
      skip: [/node_modules/, /\.git/],
    })
  ) {
    const content = await Deno.readTextFile(entry.path);
    let config: PackageJson;

    try {
      config = JSON.parse(content);
    } catch (e) {
      console.error(`Error parsing ${entry.path}:`, e);
      continue;
    }

    // Skip files without a name (like root deno.json)
    if (!config.name) continue;

    // If a specific package is targeted, skip others
    if (packageName && config.name !== packageName) continue;

    const oldVersion = config.version;

    // Update version if needed
    if (newVersion) {
      config.version = newVersion;
      console.log(
        `Updating ${config.name} from ${oldVersion} to ${newVersion}`,
      );

      // Write back to file
      await Deno.writeTextFile(
        entry.path,
        JSON.stringify(config, null, 2) + "\n",
      );
    } else {
      // Just list current version
      console.log(`${config.name}: ${oldVersion}`);
    }
  }
}

// Parse command line arguments
const args = Deno.args;
let newVersion: string | undefined;
let packageName: string | undefined;

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--version":
    case "-v":
      newVersion = args[++i];
      break;
    case "--package":
    case "-p":
      packageName = args[++i];
      break;
    case "--help":
    case "-h":
      console.log(`
Usage: deno run -A version.ts [options]

Options:
  -v, --version <version>  New version to set
  -p, --package <name>     Package name to update (optional)
  -h, --help              Show this help message

Examples:
  # List all package versions
  deno run -A version.ts

  # Update all packages to version 1.2.0
  deno run -A version.ts -v 1.2.0

  # Update specific package to version 1.2.0
  deno run -A version.ts -v 1.2.0 -p @editor/core
      `);
      Deno.exit(0);
  }
}

// Run the update
await updateVersions(newVersion, packageName);
