// Campaign orchestrator: drives ONE need end-to-end.
//
//   scanning (OpenOutreach scrape) → ranking (rank.mjs --need-id)
//     → researching (research-rank.mjs --need-id --top N) → done
//
//   node --env-file=.env.local scripts/campaign-pipeline.mjs --need-id <uuid>
//
// Spawned detached by the app when a campaign starts (src/lib/pipeline/spawn.ts),
// so it survives Next dev-server restarts; also runnable by hand. Heartbeats
// needs.heartbeat_at every 30s so the UI can detect a dead pipeline. Waits for
// any other live scan to finish first — there is only one LinkedIn browser
// session. Rank/research phases (Anthropic-only) may overlap freely.
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY,
// plus the needs-worker scan vars (OPENOUTREACH_DIR, LINKEDIN_CLI_SESSION,
// NEEDS_SCAN_LIMIT). Optional CAMPAIGN_RESEARCH_TOP (default 5).

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { scanNeed } from "./_scan.mjs";

const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));
const LIMIT = Number(process.env.NEEDS_SCAN_LIMIT || 25);
const RESEARCH_TOP = Number(process.env.CAMPAIGN_RESEARCH_TOP || 5);
const HEARTBEAT_MS = 30_000;
const STALE_MS = 2 * 60 * 1000; // heartbeat older than this = dead pipeline
const SCAN_WAIT_POLL_MS = 15_000;
const SCAN_WAIT_MAX_MS = 30 * 60 * 1000;

const idIdx = process.argv.indexOf("--need-id");
const needId = idIdx === -1 ? null : process.argv[idIdx + 1];
if (!needId) {
  console.error("Usage: campaign-pipeline.mjs --need-id <uuid>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function setNeed(fields) {
  const { error } = await supabase.from("needs").update(fields).eq("id", needId);
  if (error) throw new Error(`needs update failed: ${error.message}`);
}

// Async spawn (not execFileSync) so heartbeat timers keep firing while a
// phase runs. stdio inherits — everything lands in the pipeline log file.
function runNode(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(SCRIPTS_DIR, script), ...args], {
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

// Only one LinkedIn browser session exists — wait while any OTHER need is
// actively scanning (fresh heartbeat). Stale scanners are ignored.
async function waitForScanSlot() {
  const deadline = Date.now() + SCAN_WAIT_MAX_MS;
  for (;;) {
    const staleBefore = new Date(Date.now() - STALE_MS).toISOString();
    const { data: live, error } = await supabase
      .from("needs")
      .select("id,label")
      .eq("status", "scanning")
      .neq("id", needId)
      .gte("heartbeat_at", staleBefore);
    if (error) throw new Error(`scan-slot check failed: ${error.message}`);
    if (!live?.length) return;
    if (Date.now() > deadline) {
      throw new Error(`gave up waiting for the LinkedIn session ("${live[0].label}" still scanning)`);
    }
    console.error(`… waiting for scan slot ("${live[0].label}" is scanning)`);
    await new Promise((r) => setTimeout(r, SCAN_WAIT_POLL_MS));
  }
}

const { data: needRows, error: nErr } = await supabase
  .from("needs").select("*").eq("id", needId).limit(1);
if (nErr) { console.error(nErr.message); process.exit(1); }
const need = needRows?.[0];
if (!need) { console.error(`No need with id ${needId}`); process.exit(1); }

console.error(`▶ campaign "${need.label}" (${need.id})`);
const heartbeat = setInterval(() => {
  supabase.from("needs").update({ heartbeat_at: new Date().toISOString() }).eq("id", needId)
    .then(({ error }) => { if (error) console.error(`heartbeat failed: ${error.message}`); });
}, HEARTBEAT_MS);

try {
  await setNeed({ heartbeat_at: new Date().toISOString(), started_at: new Date().toISOString(), error: null });

  await waitForScanSlot();
  await setNeed({ status: "scanning" });
  const { scraped, inserted } = await scanNeed(supabase, need, {
    limit: LIMIT,
    stream: true,
    via: "campaign_pipeline",
  });
  await setNeed({ found_count: inserted, scanned_at: new Date().toISOString() });
  console.error(`✓ scan: ${scraped} scraped, ${inserted} new (duplicates skipped)`);

  await setNeed({ status: "ranking" });
  await runNode("rank.mjs", ["--need-id", needId]);

  await setNeed({ status: "researching" });
  await runNode("research-rank.mjs", ["--need-id", needId, "--top", String(RESEARCH_TOP)]);

  await setNeed({ status: "done" });
  console.error(`✓ campaign "${need.label}" done`);
} catch (e) {
  const message = String(e?.message || e).slice(0, 500);
  console.error(`✗ campaign "${need.label}" FAILED: ${message}`);
  await supabase.from("needs").update({ status: "error", error: message }).eq("id", needId);
  process.exitCode = 1;
} finally {
  clearInterval(heartbeat);
}
