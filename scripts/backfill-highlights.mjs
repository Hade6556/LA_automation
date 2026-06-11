// Backfill highlights for existing candidates from ALREADY-STORED data
// (dossier + background) — no web re-research.
//
//   node --env-file=.env.local scripts/backfill-highlights.mjs           # researched rows without highlights
//   node --env-file=.env.local scripts/backfill-highlights.mjs --all     # also non-researched rows (background only)
//   node --env-file=.env.local scripts/backfill-highlights.mjs --force   # re-extract even if highlights exist
//   node --env-file=.env.local scripts/backfill-highlights.mjs --ids <uuid>,<uuid>
//
// Note: research-rank.mjs writes highlights itself going forward; a --force
// re-research overwrites what this script wrote (intended).

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env (run with --env-file=.env.local)");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });
const anthropic = new Anthropic();

const argv = process.argv.slice(2);
const all = argv.includes("--all");
const force = argv.includes("--force");
const idsArg = argv[argv.indexOf("--ids") + 1];
const ids = argv.includes("--ids") ? idsArg.split(",").map((s) => s.trim()).filter(Boolean) : [];

const { data: rows, error } = await supabase.from("candidates").select("*");
if (error) { console.error(error.message); process.exit(1); }
const cands = (rows ?? []).filter((c) => {
  if (ids.length) return ids.includes(c.id);
  if (!force && Array.isArray(c.highlights) && c.highlights.length) return false;
  return all || c.researched_at != null;
});
if (!cands.length) { console.error("No candidates need highlight extraction."); process.exit(0); }

const HIGHLIGHT_CATEGORIES = ["education", "exit", "scale", "pedigree", "recognition", "social"];
function sanitizeHighlights(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (h) =>
        h &&
        typeof h.label === "string" &&
        h.label.trim() &&
        HIGHLIGHT_CATEGORIES.includes(h.category) &&
        [1, 2].includes(Number(h.tier)),
    )
    .map((h) => ({
      label: h.label.trim(),
      category: h.category,
      tier: Number(h.tier),
      ...(typeof h.evidence === "string" && h.evidence.trim() ? { evidence: h.evidence.trim() } : {}),
    }))
    .slice(0, 4);
}

const SYSTEM = `You extract profile highlights for Lost Astronaut, a venture builder.
Given stored facts about one person, pick the rare, high-signal facts a recruiter would
mention FIRST when describing them. Use ONLY the provided data — never infer or invent.

Rules:
- highlights: AT MOST 4 facts so rare/impressive a recruiter would mention them first.
  Tier 1 = top-1% signals ONLY: HBS/Stanford GSB/Wharton MBA or elite PhD; company exit,
  acquisition, or IPO; public-company/NASDAQ CEO; ex-DeepMind/OpenAI/Google Brain; 100k+ followers.
  Tier 2 = strong but more common: other top-school degrees (MIT, Oxbridge, INSEAD, LBS, IIT,
  Polytechnique, CMU), ex-FAANG/Stripe-tier companies, scaled a team/product past a notable bar.
  "VP at a startup", a generic BSc, or ordinary seniority are NOT highlights — return [] rather
  than pad. Labels <=4 words (e.g. 'Harvard MBA', 'Exit to Datadog', 'NASDAQ CEO').
- evidence: one short sentence quoting/citing the provided fact the highlight comes from.`;

const SCHEMA = {
  type: "object",
  properties: {
    highlights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          category: { type: "string", enum: HIGHLIGHT_CATEGORIES },
          tier: { type: "integer", enum: [1, 2] },
          evidence: { type: "string" },
        },
        required: ["label", "category", "tier"],
        additionalProperties: false,
      },
    },
  },
  required: ["highlights"],
  additionalProperties: false,
};

function facts(c) {
  const social = c.social ?? {};
  const followers =
    (Number(social?.x?.followers) || 0) + (Number(social?.linkedin?.followers) || 0);
  return {
    full_name: c.full_name,
    headline: c.headline,
    current_title: c.current_title,
    current_company: c.current_company,
    background: c.background,
    social_followers: followers || null,
    dossier: c.dossier
      ? {
          summary: c.dossier.summary,
          bottom_line: c.dossier.bottom_line,
          key_achievements: c.dossier.key_achievements,
          education_summary: c.dossier.education_summary,
        }
      : null,
    pedigree_note: c.rank_breakdown?.pedigree?.note ?? null,
  };
}

console.error(`Extracting highlights for ${cands.length} candidate(s) with claude-opus-4-8…`);
let ok = 0;
for (const c of cands) {
  try {
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA }, effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        { role: "user", content: `Extract highlights for this person:\n${JSON.stringify(facts(c), null, 2)}` },
      ],
    });
    const text = resp.content.find((b) => b.type === "text")?.text;
    const out = JSON.parse(text);
    const highlights = sanitizeHighlights(out.highlights);
    const { error: uErr } = await supabase
      .from("candidates")
      .update({ highlights })
      .eq("id", c.id);
    if (uErr) throw new Error(uErr.message);
    ok++;
    const chips = highlights.map((h) => `${h.tier === 1 ? "★" : "·"}${h.label}`).join("  ") || "(none)";
    console.error(`  ✓ ${c.full_name} — ${chips}`);
  } catch (e) {
    console.error(`  ✗ FAILED ${c.full_name}: ${e.message}`);
  }
}
console.error(`\n✓ Backfilled ${ok}/${cands.length}.`);
