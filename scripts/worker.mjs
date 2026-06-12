// Cockpit dispatcher: ONE long-lived process on the Mac that executes work
// queued from ANY app instance — localhost or the deployed Vercel app:
//
//   needs.status = 'queued'                      → campaign-pipeline.mjs
//   candidates.research_requested_at IS NOT NULL → research-rank.mjs --ids
//
//   node --env-file=.env.local scripts/worker.mjs     (or: npm run worker)
//
// Auto-started by the Next dev/prod server on this machine via
// src/instrumentation.ts; a pid lock (logs/worker.pid) keeps it singular.
// Claims are atomic conditional UPDATEs, so even two workers can't
// double-spawn. A campaign whose pipeline died before leaving 'queued'
// (stale heartbeat) gets re-claimed automatically after STALE_MS.

import { spawn } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(SCRIPTS_DIR);
const LOGS = path.join(ROOT, "logs");
const PID_FILE = path.join(LOGS, "worker.pid");
const POLL_MS = 5_000;
const STALE_MS = 2 * 60 * 1000; // matches campaign-pipeline.mjs heartbeat staleness

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env (run with --env-file=.env.local)");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

// ---- single-instance lock ----
mkdirSync(LOGS, { recursive: true });
if (existsSync(PID_FILE)) {
  const pid = Number(readFileSync(PID_FILE, "utf8"));
  if (pid && isAlive(pid)) {
    console.error(`worker already running (pid ${pid}) — exiting`);
    process.exit(0);
  }
}
writeFileSync(PID_FILE, String(process.pid));
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    try { unlinkSync(PID_FILE); } catch {}
    process.exit(0);
  });
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// Same detached-spawn pattern as src/lib/pipeline/spawn.ts.
function launch(script, args, logName) {
  const fd = openSync(path.join(LOGS, `${logName}.log`), "a");
  try {
    const child = spawn(process.execPath, [path.join(SCRIPTS_DIR, script), ...args], {
      cwd: ROOT,
      detached: true,
      stdio: ["ignore", fd, fd],
    });
    child.unref();
  } finally {
    closeSync(fd);
  }
}

const stamp = () => new Date().toISOString().slice(11, 19);

// Queued campaigns: claim by stamping heartbeat_at — only wins if the need is
// still 'queued' and unclaimed (or its previous claimer's heartbeat went stale).
async function dispatchCampaigns() {
  const { data: queued, error } = await supabase
    .from("needs").select("id, need_text").eq("status", "queued");
  if (error) throw new Error(`queued needs: ${error.message}`);
  for (const n of queued ?? []) {
    const cutoff = new Date(Date.now() - STALE_MS).toISOString();
    const { data: claimed, error: cErr } = await supabase
      .from("needs")
      .update({ heartbeat_at: new Date().toISOString() })
      .eq("id", n.id)
      .eq("status", "queued")
      .or(`heartbeat_at.is.null,heartbeat_at.lt.${cutoff}`)
      .select("id");
    if (cErr) throw new Error(`claim need: ${cErr.message}`);
    if (claimed?.length) {
      console.log(`[${stamp()}] campaign queued → pipeline: ${n.need_text} (${n.id})`);
      launch("campaign-pipeline.mjs", ["--need-id", n.id], `pipeline-${n.id}`);
    }
  }
}

// Research requests: claim by clearing the marker, then research the batch.
async function dispatchResearch() {
  const { data: requested, error } = await supabase
    .from("candidates").select("id")
    .not("research_requested_at", "is", null)
    .limit(20);
  if (error) throw new Error(`research queue: ${error.message}`);
  if (!requested?.length) return;
  const ids = requested.map((r) => r.id);
  const { data: claimed, error: cErr } = await supabase
    .from("candidates")
    .update({ research_requested_at: null })
    .in("id", ids)
    .not("research_requested_at", "is", null)
    .select("id");
  if (cErr) throw new Error(`claim research: ${cErr.message}`);
  if (claimed?.length) {
    const list = claimed.map((c) => c.id);
    console.log(`[${stamp()}] research queued → research-rank: ${list.length} candidate(s)`);
    launch("research-rank.mjs", ["--ids", list.join(","), "--force"], `research-${Date.now()}`);
  }
}

console.log(`[${stamp()}] cockpit worker up (pid ${process.pid}) — polling every ${POLL_MS / 1000}s`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (;;) {
  try {
    await dispatchCampaigns();
    await dispatchResearch();
  } catch (e) {
    console.error(`[${stamp()}] tick failed: ${e.message}`);
  }
  await sleep(POLL_MS);
}
