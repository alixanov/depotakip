"use strict";

// Loaded as plain CJS by migrate-mongo CLI.
const fs = require("node:fs");
const path = require("node:path");

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

module.exports = {
  mongodb: {
    url: process.env.MONGODB_URI || "mongodb://localhost:27017/sadiyakargo",
    options: {},
  },
  migrationsDir: "migrations",
  changelogCollectionName: "_migrations",
  migrationFileExtension: ".cjs",
};
