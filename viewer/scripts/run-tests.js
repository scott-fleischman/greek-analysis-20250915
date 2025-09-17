#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

const result = spawnSync(process.execPath, ["--test", "--experimental-test-coverage"], {
  cwd: projectRoot,
  env: process.env,
  encoding: "utf8",
});

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status);
}

const coveragePattern = /js\/main\.js\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)/;
const match = coveragePattern.exec(result.stdout);

if (!match) {
  console.error("Unable to find coverage results for js/main.js");
  process.exit(1);
}

const thresholds = {
  lines: parseFloat(match[1]),
  branches: parseFloat(match[2]),
  functions: parseFloat(match[3]),
};

const minimum = 80;
const failures = Object.entries(thresholds)
  .filter(([, value]) => Number.isFinite(value) && value < minimum)
  .map(([metric, value]) => `${metric} ${value.toFixed(2)}%`);

if (failures.length > 0) {
  console.error(
    `Coverage for js/main.js is below the required ${minimum}% for: ${failures.join(", ")}`,
  );
  process.exit(1);
}
