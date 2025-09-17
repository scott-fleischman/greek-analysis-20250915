#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");

function parsePositiveNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function getCoverageThreshold() {
  const candidate = firstDefined(
    process.env.VIEWER_COVERAGE_THRESHOLD,
    process.env.COVERAGE_THRESHOLD,
    process.env.npm_config_viewer_coverage_threshold,
    process.env.npm_package_config_viewerCoverageThreshold,
  );
  const parsed = parsePositiveNumber(candidate);
  return parsed === null ? 80 : parsed;
}

function getCoverageTarget() {
  const candidate = firstDefined(
    process.env.VIEWER_COVERAGE_TARGET,
    process.env.npm_config_viewer_coverage_target,
    process.env.npm_package_config_viewerCoverageTarget,
  );
  if (typeof candidate === "string" && candidate.trim() !== "") {
    return candidate.trim();
  }
  return "js/main.js";
}

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const minimum = getCoverageThreshold();
const coverageTarget = getCoverageTarget();

const extraArgs =
  typeof process.env.VIEWER_TEST_ARGS === "string" && process.env.VIEWER_TEST_ARGS.trim() !== ""
    ? process.env.VIEWER_TEST_ARGS.trim().split(/\s+/)
    : [];

const result = spawnSync(
  process.execPath,
  ["--test", "--experimental-test-coverage", ...extraArgs],
  {
    cwd: projectRoot,
    env: process.env,
    encoding: "utf8",
  },
);

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status);
}

const coveragePattern = new RegExp(
  `${escapeForRegex(coverageTarget)}\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)\\s*\\|\\s*([\\d.]+)`,
);
const match = coveragePattern.exec(result.stdout);

if (!match) {
  console.error(`Unable to find coverage results for ${coverageTarget}`);
  process.exit(1);
}

const thresholds = {
  lines: parseFloat(match[1]),
  branches: parseFloat(match[2]),
  functions: parseFloat(match[3]),
};

const failures = Object.entries(thresholds)
  .filter(([, value]) => Number.isFinite(value) && value < minimum)
  .map(([metric, value]) => `${metric} ${value.toFixed(2)}%`);

if (failures.length > 0) {
  console.error(
    `Coverage for ${coverageTarget} is below the required ${minimum}% for: ${failures.join(", ")}`,
  );
  process.exit(1);
}
