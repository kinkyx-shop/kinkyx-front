/**
 * Reconstruction déclenchée par webhook (voir server/static.mjs).
 *   git pull → fetch catalogue+pages → astro build (vers dist.new) → bascule atomique
 *
 * Build hors-ligne dans dist.new puis renommage : le serveur ne sert jamais
 * un dist/ à moitié écrit. Lancé par le serveur, pas par un humain.
 * Sortie streamée (stdio hérité) pour suivre l'avancement dans les logs.
 */
import { spawn } from "node:child_process";
import { rename, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const APP = fileURLToPath(new URL("../", import.meta.url));
const NODE = process.execPath;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: APP, stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} → code ${code}`)),
    );
  });
}

async function main() {
  const t0 = Date.now();

  console.log("[rebuild] git pull…");
  await run("git", ["pull", "--ff-only"]);

  console.log("[rebuild] fetch catalogue + pages…");
  await run(NODE, ["--env-file-if-exists=.env", "scripts/fetch-catalog.mjs"]);

  console.log("[rebuild] astro build → dist.new…");
  await rm(`${APP}dist.new`, { recursive: true, force: true });
  await run(NODE, ["node_modules/astro/astro.js", "build", "--outDir", "dist.new"]);

  console.log("[rebuild] bascule dist.new → dist…");
  await rm(`${APP}dist.old`, { recursive: true, force: true });
  await rename(`${APP}dist`, `${APP}dist.old`).catch(() => {});
  await rename(`${APP}dist.new`, `${APP}dist`);
  await rm(`${APP}dist.old`, { recursive: true, force: true });

  console.log(`[rebuild] OK en ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("[rebuild] ÉCHEC :", err?.message || err);
  process.exit(1);
});
