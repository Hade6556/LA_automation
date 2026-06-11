import { spawn } from "node:child_process";
import { closeSync, mkdirSync, openSync } from "node:fs";
import path from "node:path";

// Launch pipeline scripts as detached children of the Next server so they
// survive dev-server restarts. Env (Supabase/Anthropic/OpenOutreach vars) is
// inherited — Next loads .env.local into process.env. Output goes to logs/
// (gitignored); liveness is tracked via needs.heartbeat_at, not the process.

function launch(script: string, args: string[], logName: string): void {
  const root = process.cwd();
  mkdirSync(path.join(root, "logs"), { recursive: true });
  const fd = openSync(path.join(root, "logs", `${logName}.log`), "a");
  try {
    const child = spawn(
      process.execPath,
      [path.join(root, "scripts", script), ...args],
      { cwd: root, detached: true, stdio: ["ignore", fd, fd] },
    );
    child.unref();
  } finally {
    closeSync(fd); // the child holds its own copy
  }
}

function safeId(id: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error(`not a uuid: ${id}`);
  return id.toLowerCase();
}

export function spawnCampaignPipeline(needId: string): void {
  const id = safeId(needId);
  launch("campaign-pipeline.mjs", ["--need-id", id], `pipeline-${id}`);
}

export function spawnResearch(ids: string[], opts: { force?: boolean } = {}): void {
  const clean = ids.map(safeId);
  if (!clean.length) return;
  const args = ["--ids", clean.join(",")];
  if (opts.force) args.push("--force");
  launch("research-rank.mjs", args, `research-${Date.now()}`);
}
