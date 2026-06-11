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

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { mapProfile } from "./_profile-mapping.mjs";

const OPENOUTREACH = process.env.OPENOUTREACH_DIR || `${process.env.HOME}/OpenOutreach`;
const PYTHON = `${OPENOUTREACH}/.venv/bin/python`;
const MANAGE = `${OPENOUTREACH}/manage.py`;
const SESSION = process.env.LINKEDIN_CLI_SESSION || "la";
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

function searchScan(filters) {
  // OpenOutreach prints the JSON envelope to stdout; its progress logs pass
  // through to our stderr so the operator sees the scan happen live.
  const out = execFileSync(
    PYTHON,
    [MANAGE, "search_scan", "--filters-json", JSON.stringify(filters),
     "--session", SESSION, "--limit", String(LIMIT)],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] },
  );
  return JSON.parse(out);
}

async function runNeed(need) {
  console.error(`\n▶ scan "${need.label}" (need ${need.id})`);
  await supabase.from("needs").update({ status: "scanning" }).eq("id", need.id);

  try {
    const result = searchScan(need.filters);
    const rows = result.profiles
      .map(({ profile, raw }) => ({
        ...mapProfile(profile, raw),
        need_id: need.id,
        source: "needs_worker",
        provenance: { via: "needs_worker", need_id: need.id, scraped_at: new Date().toISOString() },
      }))
      .filter((r) => r.linkedin_url);

    let inserted = 0;
    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("candidates")
        .upsert(rows, { onConflict: "linkedin_url", ignoreDuplicates: true })
        .select("id");
      if (error) throw new Error(`candidates upsert failed: ${error.message}`);
      inserted = data?.length ?? 0;
    }

    await supabase.from("needs").update({
      status: "done",
      found_count: inserted,
      scanned_at: new Date().toISOString(),
      error: null,
    }).eq("id", need.id);
    console.error(`✓ "${need.label}": ${rows.length} scraped, ${inserted} new candidates (duplicates skipped)`);
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

// Recover needs stuck in 'scanning' from a previous crashed worker run.
await supabase.from("needs").update({ status: "queued" }).eq("status", "scanning");

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
