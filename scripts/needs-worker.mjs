// Executes 'queued' needs from the /needs page: polls Supabase, runs
// OpenOutreach's faceted search + profile scrape on this Mac, and upserts the
// found people into `candidates` (status 'sourced') with need provenance.
//
// PREREQS (once, in a separate shell, with YOUR creds):
//   export LINKEDIN_USERNAME='you@example.com'
//   export LINKEDIN_PASSWORD='********'
//   ~/OpenOutreach/.venv/bin/linkedin-cli session open --name la   # leave running
//   ~/OpenOutreach/.venv/bin/linkedin-cli login --session la       # solve any checkpoint
//
// THEN (from the lost-astronaut project root):
//   node --env-file=.env.local scripts/needs-worker.mjs            # watch mode (default)
//   node --env-file=.env.local scripts/needs-worker.mjs --once     # single pass
//
// Optional env: LINKEDIN_CLI_SESSION (default 'la'), OPENOUTREACH_DIR
// (default ~/OpenOutreach), NEEDS_SCAN_LIMIT (profiles per scan, default 25).
//
// NOTE: legacy fallback. Campaigns started from the app spawn
// campaign-pipeline.mjs per need — don't run this worker alongside the app,
// or both may scan the same need over the single LinkedIn session.

import { createClient } from "@supabase/supabase-js";
import { scanNeed } from "./_scan.mjs";

const LIMIT = Number(process.env.NEEDS_SCAN_LIMIT || 25);
const ONCE = process.argv.includes("--once");
const INTERVAL_MS = 10_000;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

async function runNeed(need) {
  console.error(`\n▶ scan "${need.label}" (need ${need.id})`);
  await supabase.from("needs").update({ status: "scanning" }).eq("id", need.id);

  try {
    const { scraped, inserted } = await scanNeed(supabase, need, { limit: LIMIT });

    await supabase.from("needs").update({
      status: "done",
      found_count: inserted,
      scanned_at: new Date().toISOString(),
      error: null,
    }).eq("id", need.id);
    console.error(`✓ "${need.label}": ${scraped} scraped, ${inserted} new candidates (duplicates skipped)`);
  } catch (e) {
    const message = String(e.message || e).slice(0, 500);
    await supabase.from("needs").update({ status: "error", error: message }).eq("id", need.id);
    console.error(`✗ "${need.label}" FAILED: ${message}`);
  }
}

async function pass() {
  const { data: queued, error } = await supabase
    .from("needs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to fetch queued needs:", error.message);
    return 0;
  }
  for (const need of queued ?? []) await runNeed(need);
  return queued?.length ?? 0;
}

// Recover needs stuck in 'scanning' from a previous crashed run — but only
// stale ones (no recent heartbeat), so we never steal a need from a live
// campaign-pipeline process.
const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
await supabase
  .from("needs")
  .update({ status: "queued" })
  .eq("status", "scanning")
  .or(`heartbeat_at.is.null,heartbeat_at.lt.${staleBefore}`);

if (ONCE) {
  const n = await pass();
  console.error(n === 0 ? "No queued needs." : `\nDone — ${n} need(s) processed.`);
} else {
  console.error(`needs-worker watching (session '${SESSION}', every ${INTERVAL_MS / 1000}s) — Ctrl-C to stop.`);
  for (;;) {
    await pass();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}
