// Shared LinkedIn scan: runs OpenOutreach's `manage.py search_scan` for one
// need and upserts the people it finds into `candidates` (status 'sourced')
// with need provenance. Writes NO needs.status — callers own the lifecycle.
//
// Handles both search_scan output shapes, line by line:
//   - {"profile": …, "raw": …}        one JSONL line per person (--stream),
//     upserted as it arrives so the campaign page shows people live
//   - {"query": …, "profiles": […]}   final envelope (legacy batch mode)

import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { mapProfile } from "./_profile-mapping.mjs";

const OPENOUTREACH = process.env.OPENOUTREACH_DIR || `${process.env.HOME}/OpenOutreach`;
const PYTHON = `${OPENOUTREACH}/.venv/bin/python`;
const MANAGE = `${OPENOUTREACH}/manage.py`;
const SESSION = process.env.LINKEDIN_CLI_SESSION || "la";

function toRow(need, via, { profile, raw }) {
  const row = {
    ...mapProfile(profile, raw),
    need_id: need.id,
    source: via,
    provenance: { via, need_id: need.id, scraped_at: new Date().toISOString() },
  };
  return row.linkedin_url ? row : null;
}

async function upsertRows(supabase, rows) {
  if (!rows.length) return 0;
  const { data, error } = await supabase
    .from("candidates")
    .upsert(rows, { onConflict: "linkedin_url", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(`candidates upsert failed: ${error.message}`);
  return data?.length ?? 0;
}

// Returns { scraped, inserted } — inserted excludes already-known linkedin_urls.
export async function scanNeed(supabase, need, { limit = 25, stream = false, via = "needs_worker" } = {}) {
  const args = [
    MANAGE, "search_scan",
    "--filters-json", JSON.stringify(need.filters),
    "--session", SESSION,
    "--limit", String(limit),
  ];
  if (stream) args.push("--stream");

  // Progress logs pass through to our stderr so the operator (or the pipeline
  // log file) sees the scan happen live.
  const child = spawn(PYTHON, args, { stdio: ["ignore", "pipe", "inherit"] });

  let scraped = 0;
  let inserted = 0;
  let upsertError = null; // first failure; rejections must be caught as they
  const pending = [];     // happen or Node treats them as unhandled and dies

  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    const text = line.trim();
    if (!text.startsWith("{")) return;
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      return; // stray non-JSON stdout — ignore
    }
    const items = obj.profile ? [obj] : Array.isArray(obj.profiles) ? obj.profiles : [];
    if (!items.length) return;
    scraped += items.length;
    const rows = items.map((p) => toRow(need, via, p)).filter(Boolean);
    pending.push(
      upsertRows(supabase, rows)
        .then((n) => { inserted += n; })
        .catch((e) => { upsertError ??= e; }),
    );
  });

  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  await new Promise((r) => rl.once("close", r));
  await Promise.all(pending);

  if (upsertError) throw upsertError;
  if (code !== 0) throw new Error(`search_scan exited with code ${code}`);
  return { scraped, inserted };
}
