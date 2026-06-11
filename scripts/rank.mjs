// Rank candidates with Claude Opus 4.8 against the active ranking rubric.
//   node --env-file=.env.local scripts/rank.mjs                   # ranks status='sourced' → 'ranked'
//   node --env-file=.env.local scripts/rank.mjs --all             # re-ranks every candidate
//   node --env-file=.env.local scripts/rank.mjs --need-id <uuid>  # only that campaign's people
//
// Sets rank_score (0-100) + rank_reason, and advances sourced → ranked.
// The rubric is sent as a cached system prompt (reused across candidates).

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

const rankAll = process.argv.includes("--all");
const needIdIdx = process.argv.indexOf("--need-id");
const needId = needIdIdx === -1 ? null : process.argv[needIdIdx + 1];

const { data: rubrics, error: rErr } = await supabase
  .from("rubrics")
  .select("content")
  .eq("kind", "ranking")
  .eq("is_active", true)
  .limit(1);
if (rErr) { console.error(rErr.message); process.exit(1); }
const rubric = rubrics?.[0]?.content;
if (!rubric) { console.error("No active ranking rubric found."); process.exit(1); }

let q = supabase.from("candidates").select("*");
if (!rankAll) q = q.eq("status", "sourced");
if (needId) q = q.eq("need_id", needId);
const { data: cands, error: cErr } = await q;
if (cErr) { console.error(cErr.message); process.exit(1); }
if (!cands?.length) { console.error("No candidates to rank."); process.exit(0); }

const SYSTEM = `You are an expert talent scout for Lost Astronaut, a venture builder.
Score how well a candidate fits, using this rubric (JSON):

${JSON.stringify(rubric, null, 2)}

Rules:
- Return an integer rank_score from 0 (no fit) to 100 (ideal fit), plus a concise rank_reason
  (2-4 sentences) citing the strongest and weakest CONCRETE signals for this person.
- Apply the rubric weights. Reward genuine builder/leadership pedigree and domain (adjacent_space) fit.
- Missing data (e.g. follower counts, stated availability) is UNKNOWN, not negative — do not penalize
  for absent data; note it briefly if it matters.`;

const SCHEMA = {
  type: "object",
  properties: {
    rank_score: { type: "integer" },
    rank_reason: { type: "string" },
  },
  required: ["rank_score", "rank_reason"],
  additionalProperties: false,
};

console.error(`Ranking ${cands.length} candidate(s) with claude-opus-4-8…`);
let ok = 0;
for (const c of cands) {
  const facts = {
    full_name: c.full_name,
    headline: c.headline,
    current_title: c.current_title,
    current_company: c.current_company,
    background: c.background,
    social: c.social,
    signals: c.signals,
  };
  try {
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { format: { type: "json_schema", schema: SCHEMA }, effort: "medium" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        { role: "user", content: `Candidate to score:\n${JSON.stringify(facts, null, 2)}` },
      ],
    });
    const text = resp.content.find((b) => b.type === "text")?.text;
    const out = JSON.parse(text);
    const score = Math.max(0, Math.min(100, Math.round(Number(out.rank_score))));
    const { error } = await supabase
      .from("candidates")
      .update({ rank_score: score, rank_reason: out.rank_reason, status: "ranked" })
      .eq("id", c.id);
    if (error) throw new Error(error.message);
    ok++;
    console.error(`  ${String(score).padStart(3)}  ${c.full_name} — ${c.current_title ?? ""}`);
  } catch (e) {
    console.error(`  FAILED ${c.full_name}: ${e.message}`);
  }
}
console.error(`\n✓ Ranked ${ok}/${cands.length}. Status → 'ranked'.`);
