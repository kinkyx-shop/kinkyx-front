/**
 * Reconstruction déclenchée par webhook (voir server/static.mjs).
 *   git pull → npm run fetch → astro build (vers dist.new) → bascule atomique
 *
 * Build hors-ligne dans dist.new puis renommage : le serveur ne sert jamais
 * un dist/ à moitié écrit. Lancé par le serveur, pas par un humain.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const APP = fileURLToPath(new URL("../", import.meta.url));
const sh = (cmd) => run("sh", ["-lc", cmd], { cwd: APP, maxBuffer: 32 * 1024 * 1024 });

async function main() {
  const t0 = Date.now();
  console.log("[rebuild] git pull…");
  console.log((await sh("git pull --ff-only")).stdout.trim());

  console.log("[rebuild] fetch catalogue + pages…");
  await sh("npm run fetch");

  console.log("[rebuild] astro build → dist.new…");
  await rm(`${APP}dist.new`, { recursive: true, force: true });
  await sh("npx --no-install astro build --outDir dist.new");

  console.log("[rebuild] bascule dist.new → dist…");
  await rm(`${APP}dist.old`, { recursive: true, force: true });
  await rename(`${APP}dist`, `${APP}dist.old`).catch(() => {});
  await rename(`${APP}dist.new`, `${APP}dist`);
  await rm(`${APP}dist.old`, { recursive: true, force: true });

  console.log(`[rebuild] OK en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("[rebuild] ÉCHEC :", err?.stderr || err?.message || err);
  process.exit(1);
});
