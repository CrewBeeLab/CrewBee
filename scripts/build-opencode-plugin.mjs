import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/adapters/opencode/plugin.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: ["node18"],
  outfile: "dist/opencode-plugin.mjs",
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; import { fileURLToPath as __fileURLToPath } from 'node:url'; import { dirname as __pathDirname } from 'node:path'; const require = __createRequire(import.meta.url); const __dirname = __pathDirname(__fileURLToPath(import.meta.url));",
  },
});
