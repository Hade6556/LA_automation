// Ingest real LinkedIn profiles into `candidates` via OpenOutreach's linkedin_cli.
//
// PREREQS (you do these once, in a separate shell, with YOUR creds):
//   export LINKEDIN_USERNAME='you@example.com'
//   export LINKEDIN_PASSWORD='********'
//   ~/OpenOutreach/.venv/bin/linkedin-cli session open --name la   # leave running (opens a browser)
//   ~/OpenOutreach/.venv/bin/linkedin-cli login --session la       # solve any checkpoint in that window
//
// THEN run this (from the lost-astronaut project root):
//   node --env-file=.env.local scripts/ingest-linkedin.mjs "CTO fintech London" --limit 25
//
// It runs `search` then `profile --json` per hit, maps to candidates (status
// 'sourced'), and upserts on linkedin_url (existing rows are left untouched).
// NO connecting/messaging — scrape only.

import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const CLI = process.env.LINKEDIN_CLI_BIN || `${process.env.HOME}/OpenOutreach/.venv/bin/linkedin-cli`;
const SESSION = process.env.LINKEDIN_CLI_SESSION || "la";

const args = process.argv.slice(2);
const query = args.find((a) => !a.startsWith("--"));
const limit = Number((args.find((a) => a.startsWith("--limit")) || "").split("=")[1] || args[args.indexOf("--limit") + 1] || 25);
const netFlag = args.find((a) => a.startsWith("--network"));
const network = netFlag ? netFlag.split("=")[1] || args[args.indexOf("--network") + 1] : null;

if (!query) {
  console.error('Usage: node --env-file=.env.local scripts/ingest-linkedin.mjs "<search query>" [--limit N] [--network first|second|third]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

function cli(verb, ...rest) {
  const out = execFileSync(CLI, [verb, "--session", SESSION, "--json", ...rest], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"], // logs/errors → our stderr
  });
  return JSON.parse(out);
}

// Profile → candidate-row mapping shared with needs-worker.mjs.
import { mapProfile as mapProfileBase, unwrapProfile } from "./_profile-mapping.mjs";

function mapProfile(p) {
  return {
    ...mapProfileBase(p, p),
    source: "linkedin_cli",
    provenance: { via: "linkedin_cli", scraped_at: new Date().toISOString() },
  };
}

console.error(`Searching "${query}" (network=${network ?? "all"}, limit=${limit}) via session '${SESSION}'…`);
const result = cli("search", query, ...(network ? ["--network", network] : []));
const hits = (result.profiles || []).slice(0, limit);
console.error(`Found ${result.profiles?.length ?? 0} hits; scraping ${hits.length} profiles…`);

const rows = [];
for (const [i, hit] of hits.entries()) {
  const handle = hit.public_identifier || hit.url;
  if (!handle) continue;
  try {
    const prof = unwrapProfile(cli("profile", handle, "--raw"));
    const row = mapProfile(prof);
    if (!row.linkedin_url) {
      console.error(`  [${i + 1}/${hits.length}] skip ${handle}: no URL`);
      continue;
    }
    rows.push(row);
    console.error(`  [${i + 1}/${hits.length}] ${row.full_name ?? handle} — ${row.current_title ?? ""} @ ${row.current_company ?? ""}`);
  } catch (e) {
    console.error(`  [${i + 1}/${hits.length}] FAILED ${handle}: ${e.message}`);
  }
}

if (rows.length === 0) {
  console.error("No profiles scraped — nothing to ingest.");
  process.exit(1);
}

const { data, error } = await supabase
  .from("candidates")
  .upsert(rows, { onConflict: "linkedin_url", ignoreDuplicates: true })
  .select("id");

if (error) {
  console.error("Supabase upsert failed:", error.message);
  process.exit(1);
}
console.error(`\n✓ Ingested ${data?.length ?? 0} new candidates (status 'sourced'). Duplicates skipped.`);
