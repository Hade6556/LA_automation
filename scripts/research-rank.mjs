// Tier-2 deep research + assessment with Claude Opus 4.8 + web search.
//
//   node --env-file=.env.local scripts/research-rank.mjs --top 5
//   node --env-file=.env.local scripts/research-rank.mjs --ids <uuid>,<uuid>
//   node --env-file=.env.local scripts/research-rank.mjs --min-score 70
//   node --env-file=.env.local scripts/research-rank.mjs --need-id <uuid> --top 5   # campaign-scoped
//
// For each shortlisted candidate: Opus researches them on the web (web_search +
// web_fetch), then returns a structured dossier + per-signal sub-scores + overall
// score via the strict `submit_assessment` tool. A final pass writes head-to-head
// comparison notes. Writes dossier, rank_breakdown, highlights, sources,
// rank_reason, rank_score, comparison_note, researched_at.

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const SIGNALS = [
  "seniority",
  "builder_track_record",
  "domain_fit",
  "availability",
  "pedigree",
  "social_presence",
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing Supabase env (use --env-file=.env.local)"); process.exit(1); }
if (!process.env.ANTHROPIC_API_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }
const supabase = createClient(url, key, { auth: { persistSession: false } });
const anthropic = new Anthropic();

// ---- shortlist selection ----
const argv = process.argv.slice(2);
function flag(name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}
const force = argv.includes("--force"); // re-research even already-done people
const top = Number(flag("--top") ?? (flag("--ids") || flag("--min-score") ? 0 : 10));
const ids = (flag("--ids") || "").split(",").map((s) => s.trim()).filter(Boolean);
const minScore = flag("--min-score") ? Number(flag("--min-score")) : null;
const needId = flag("--need-id") || null; // scope to one campaign's candidates

let query = supabase.from("candidates").select("*").order("rank_score", { ascending: false, nullsFirst: false });
// Skip people who already have a dossier, unless explicitly forced or targeted by --ids.
if (!force && !ids.length) query = query.is("researched_at", null);
if (needId) query = query.eq("need_id", needId);
if (ids.length) query = query.in("id", ids);
else if (minScore != null) query = query.gte("rank_score", minScore);
else if (top) query = query.limit(top);
const { data: cands, error: cErr } = await query;
if (cErr) { console.error(cErr.message); process.exit(1); }
if (!cands?.length) { console.error("No candidates to research."); process.exit(0); }

// ---- active ranking rubric ----
const { data: rubrics } = await supabase
  .from("rubrics").select("content").eq("kind", "ranking").eq("is_active", true).limit(1);
const rubric = rubrics?.[0]?.content;
if (!rubric) { console.error("No active ranking rubric."); process.exit(1); }

// ---- tools ----
const webSearch = { type: "web_search_20260209", name: "web_search", max_uses: 6 };
const webFetch = { type: "web_fetch_20260209", name: "web_fetch", max_uses: 4 };
const signalSchema = {
  type: "object",
  properties: { score: { type: "integer" }, note: { type: "string" } },
  required: ["score", "note"],
  additionalProperties: false,
};
const submitTool = {
  name: "submit_assessment",
  description: "Submit the final structured assessment. Call exactly once, AFTER researching the person on the web.",
  input_schema: {
    type: "object",
    properties: {
      one_liner: { type: "string", description: "<=12 words: who they are." },
      bottom_line: { type: "string", description: "ONE sentence: the core reason they are/aren't a fit." },
      top_strengths: { type: "array", items: { type: "string" }, description: "2-3 short concrete strength phrases." },
      watch_outs: { type: "array", items: { type: "string" }, description: "1-2 short risk/gap phrases." },
      summary: { type: "string", description: "2-4 sentence summary of who they are and what they've done." },
      key_achievements: { type: "array", items: { type: "string" } },
      education_summary: { type: "string" },
      current_focus: { type: "string" },
      signal_scores: {
        type: "object",
        properties: Object.fromEntries(SIGNALS.map((s) => [s, signalSchema])),
        required: SIGNALS,
        additionalProperties: false,
      },
      rank_score: { type: "integer", description: "Overall 0-100, weighted per the rubric." },
      rank_reason: { type: "string", description: "Why this overall score — strongest + weakest concrete signals." },
      sources: {
        type: "array",
        items: {
          type: "object",
          properties: { title: { type: "string" }, url: { type: "string" } },
          required: ["url"],
          additionalProperties: false,
        },
      },
      highlights: {
        type: "array",
        description: "0-4 rare, high-signal facts a recruiter would say first. Empty array if nothing genuinely stands out.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "<=4 words chip text, e.g. 'Harvard MBA', 'Exit to Datadog', 'NASDAQ CEO'." },
            category: { type: "string", enum: ["education", "exit", "scale", "pedigree", "recognition", "social"] },
            tier: { type: "integer", enum: [1, 2] },
            evidence: { type: "string", description: "One short sentence citing the source fact." },
          },
          required: ["label", "category", "tier"],
          additionalProperties: false,
        },
      },
    },
    required: ["one_liner", "bottom_line", "top_strengths", "watch_outs", "summary", "key_achievements", "education_summary", "signal_scores", "rank_score", "rank_reason", "sources", "highlights"],
    additionalProperties: false,
  },
};

const SYSTEM = `You are an elite talent researcher for Lost Astronaut, a venture builder.
Your job: deeply research one person on the public web, then assess their fit.

Score against this rubric (JSON):
${JSON.stringify(rubric, null, 2)}

Research process — BE THOROUGH (do NOT stop after one search):
1. Run AT LEAST 3-4 DISTINCT web searches, e.g.: "<name> <current company>",
   "<name> interview OR podcast OR talk", "<name> founder OR CEO OR news", and the company's
   background. Use web_fetch to open the most useful results.
2. Corroborate across sources. Gather: current role, full career history, companies built/led,
   concrete achievements (with numbers where possible), education, talks/press/interviews, and
   public/online presence.
3. Then call submit_assessment EXACTLY ONCE. Do not answer in plain prose.

Output rules:
- one_liner: <=12 words on who they are (e.g. "CIO at Bella Aurora, ex-Affinity Petcare").
- bottom_line: ONE sentence — the core reason they are / aren't a fit.
- top_strengths: 2-3 short concrete phrases (e.g. "Scaled D2C at Royal Canin").
- watch_outs: 1-2 short phrases naming the main risk/gap (e.g. "No hands-on building lately").
- signal_scores: rate seniority, builder_track_record, domain_fit, availability, pedigree,
  social_presence 0-100, each with a one-line note citing a concrete fact.
- rank_score: overall 0-100 using the rubric weights.
- sources: include AT LEAST 3 real source URLs you actually used (fewer ONLY if the person has
  almost no web presence — then say so in bottom_line). Never invent URLs or facts.
- highlights: AT MOST 4 facts so rare/impressive a recruiter would mention them first.
  Tier 1 = top-1% signals ONLY: HBS/Stanford GSB/Wharton MBA or elite PhD; company exit,
  acquisition, or IPO; public-company/NASDAQ CEO; ex-DeepMind/OpenAI/Google Brain; 100k+ followers.
  Tier 2 = strong but more common: other top-school degrees (MIT, Oxbridge, INSEAD, LBS, IIT,
  Polytechnique, CMU), ex-FAANG/Stripe-tier companies, scaled a team/product past a notable bar.
  "VP at a startup", a generic BSc, or ordinary seniority are NOT highlights — return [] rather
  than pad. Labels <=4 words. Never invent facts; every highlight needs a source you saw.
- Unknown data (availability, follower counts) is UNKNOWN, not negative — say so; don't penalize.`;

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

function userPrompt(c) {
  const seed = {
    full_name: c.full_name,
    headline: c.headline,
    current_title: c.current_title,
    current_company: c.current_company,
    linkedin_url: c.linkedin_url,
    linkedin_background: c.background,
    location: c.signals?.location ?? null,
  };
  return `Research and assess this person. LinkedIn starting data:\n${JSON.stringify(seed, null, 2)}`;
}

async function research(c) {
  const tools = [webSearch, webFetch, submitTool];
  const messages = [{ role: "user", content: userPrompt(c) }];
  for (let i = 0; i < 8; i++) {
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });
    const submit = resp.content.find((b) => b.type === "tool_use" && b.name === "submit_assessment");
    if (submit) return submit.input;

    messages.push({ role: "assistant", content: resp.content });
    if (resp.stop_reason === "pause_turn") continue; // server tool loop — resume
    if (resp.stop_reason === "end_turn") {
      // didn't submit on its own — force the tool call once
      const forced = await anthropic.messages.create({
        model: "claude-opus-4-8",
        max_tokens: 8000,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools,
        tool_choice: { type: "tool", name: "submit_assessment" },
        messages: [...messages, { role: "user", content: "Call submit_assessment now with your final assessment." }],
      });
      const s = forced.content.find((b) => b.type === "tool_use" && b.name === "submit_assessment");
      if (s) return s.input;
      throw new Error("did not submit assessment");
    }
    // stop_reason === 'tool_use' but not our submit (shouldn't happen) — nudge
    messages.push({ role: "user", content: "Call submit_assessment now." });
  }
  throw new Error("research loop exhausted");
}

console.error(`Deep-researching ${cands.length} candidate(s) with claude-opus-4-8 + web search…\n`);
const researched = [];
for (const c of cands) {
  try {
    console.error(`→ ${c.full_name} …`);
    await supabase.from("candidates").update({ researching: true }).eq("id", c.id);
    const a = await research(c);
    const score = Math.max(0, Math.min(100, Math.round(Number(a.rank_score))));
    const breakdown = {};
    for (const s of SIGNALS) breakdown[s] = a.signal_scores?.[s] ?? null;
    const dossier = {
      one_liner: a.one_liner ?? null,
      bottom_line: a.bottom_line ?? null,
      top_strengths: a.top_strengths ?? [],
      watch_outs: a.watch_outs ?? [],
      summary: a.summary,
      key_achievements: a.key_achievements ?? [],
      education_summary: a.education_summary ?? null,
      current_focus: a.current_focus ?? null,
    };
    const { error } = await supabase.from("candidates").update({
      dossier,
      rank_breakdown: breakdown,
      highlights: sanitizeHighlights(a.highlights),
      sources: a.sources ?? [],
      rank_score: score,
      rank_reason: a.rank_reason,
      researched_at: new Date().toISOString(),
      researching: false,
      status: c.status === "sourced" ? "ranked" : c.status,
    }).eq("id", c.id);
    if (error) throw new Error(error.message);
    researched.push({ id: c.id, full_name: c.full_name, rank_score: score, summary: a.summary, signal_scores: breakdown });
    console.error(`  ✓ ${score}  ${c.full_name} — ${(a.sources ?? []).length} sources`);
  } catch (e) {
    await supabase.from("candidates").update({ researching: false }).eq("id", c.id);
    console.error(`  ✗ FAILED ${c.full_name}: ${e.message}`);
  }
}

// ---- head-to-head comparison pass ----
if (researched.length >= 2) {
  console.error(`\nWriting head-to-head comparison notes…`);
  researched.sort((a, b) => b.rank_score - a.rank_score);
  const COMP_SCHEMA = {
    type: "object",
    properties: {
      rankings: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, comparison_note: { type: "string" } },
          required: ["name", "comparison_note"],
          additionalProperties: false,
        },
      },
    },
    required: ["rankings"],
    additionalProperties: false,
  };
  const list = researched.map((r, i) => ({
    rank: i + 1,
    name: r.full_name,
    score: r.rank_score,
    summary: r.summary,
    signal_scores: r.signal_scores,
  }));
  try {
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      system: "You compare ranked candidates for a venture builder. For each, write a 1-2 sentence comparison_note making it CLEAR why they rank where they do versus the people directly above and below them — cite the decisive signal differences (e.g. stronger builder track record, weaker domain fit). Be concrete and specific to each person.",
      output_config: { format: { type: "json_schema", schema: COMP_SCHEMA } },
      messages: [{ role: "user", content: `Ranked candidates (highest first):\n${JSON.stringify(list, null, 2)}` }],
    });
    const text = resp.content.find((b) => b.type === "text")?.text;
    const out = JSON.parse(text);
    for (const r of out.rankings ?? []) {
      const match = researched.find((x) => x.full_name === r.name);
      if (match) {
        await supabase.from("candidates").update({ comparison_note: r.comparison_note }).eq("id", match.id);
        console.error(`  ✓ ${r.name}`);
      }
    }
  } catch (e) {
    console.error(`  comparison pass failed: ${e.message}`);
  }
}

console.error(`\n✓ Deep-researched ${researched.length}/${cands.length}.`);
