#!/usr/bin/env node

const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const cli = require(path.join(packageRoot, "dist", "src", "cli", "index.js"));

Promise.resolve(cli.runCli(process.argv.slice(2), {
  packageRoot,
  stdout: process.stdout,
  stderr: process.stderr,
})).then((exitCode) => {
  process.exitCode = typeof exitCode === "number" ? exitCode : 0;
}).catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
