#!/usr/bin/env node
/**
 * Dev helper: watch proof/definition text files and rebuild manifests automatically,
 * then run the Vite dev server. Keeps existing videos; only text/metadata refresh.
 */

import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(process.cwd());
const WATCH_PATHS = [
  resolve(ROOT, "data/proofs"),
  resolve(ROOT, "data/definitions"),
];

let refreshing = false;
let pending = false;

function runCommand(cmd, args, name) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("exit", (code, signal) => {
      if (signal) {
        return rejectPromise(new Error(`${name} terminated with signal ${signal}`));
      }
      if (code !== 0) {
        return rejectPromise(new Error(`${name} exited with code ${code}`));
      }
      resolvePromise();
    });
  });
}

async function refreshText() {
  if (refreshing) {
    pending = true;
    return;
  }
  refreshing = true;
  pending = false;
  try {
    await runCommand("python3", ["scripts/render_manim.py", "--text-only"], "render_manim --text-only");
    await runCommand("python3", ["scripts/build_definitions.py"], "build_definitions");
    console.log("[dev] Refreshed proof/definition manifests.");
  } catch (err) {
    console.error("[dev] Text refresh failed:", err?.message || err);
  } finally {
    refreshing = false;
    if (pending) {
      refreshText();
    }
  }
}

function startVite() {
  const vite = spawn("npm", ["run", "dev:plain"], { stdio: "inherit" });
  const stop = () => {
    vite.kill("SIGTERM");
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

function startWatchers() {
  WATCH_PATHS.forEach((dir) => {
    try {
      const watcher = watch(dir, { recursive: false }, (eventType, filename) => {
        if (!filename) return;
        const lower = filename.toLowerCase();
        const isTextFile =
          lower.endsWith(".proof.json") ||
          (dir.includes("definitions") && lower.endsWith(".json"));
        if (isTextFile) {
          refreshText();
        }
      });
      watcher.on("error", (err) => {
        console.warn(`[dev] Watcher error on ${dir}:`, err?.message || err);
      });
      console.log(`[dev] Watching ${dir} for text changes...`);
    } catch (err) {
      console.warn(`[dev] Unable to watch ${dir}:`, err?.message || err);
    }
  });
}

async function start() {
  await refreshText();
  startWatchers();
  startVite();
}

start();
