// Tier-2 deep research + assessment with Claude Opus 4.8 + web search.
//
//   node --env-file=.env.local scripts/research-rank.mjs --top 5
//   node --env-file=.env.local scripts/research-rank.mjs --ids <uuid>,<uuid>
//   node --env-file=.env.local scripts/research-rank.mjs --min-score 70
//   node --env-file=.env.local scripts/research-rank.mjs --need-id <uuid> --top 5   # campaign-scoped
//
// For each shortlisted candidate: 3 parallel Sonnet gatherers research one angle
// each on the web (web_search + web_fetch), then a single Opus call assesses the
// merged findings and returns a structured dossier + per-signal sub-scores +
// overall score via the strict `submit_assessment` tool (forced, one turn).
// A final Sonnet pass writes head-to-head comparison notes. Writes dossier,
// rank_breakdown, highlights, sources, rank_reason, rank_score, comparison_note,
// researched_at.

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
const anthropic = new Anthropic({ maxRetries: 5 });

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
const CONCURRENCY = Math.max(1, Number(flag("--concurrency")) || 5);

// Run fn over items with at most `limit` in flight. fn must not throw.
async function mapLimit(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

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
const gatherTools = [
  { type: "web_search_20260209", name: "web_search", max_uses: 2 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 1 },
];
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

const SYSTEM = `You are an elite talent assessor for Lost Astronaut, a venture builder.
Your job: assess one person's fit from web research findings gathered for you.

Score against this rubric (JSON):
${JSON.stringify(rubric, null, 2)}

You will receive the person's LinkedIn seed data plus findings from parallel web researchers
(career history, public presence, education — each fact with its source URL). Rules of evidence:
- Trust only facts that carry a source URL or come from the LinkedIn seed. Never invent facts.
- If a finding looks like it may be about a DIFFERENT person with the same name, discard it.
- If findings are thin, assess from what exists, note the limited web presence in bottom_line,
  and treat the gaps as UNKNOWN — not negative.
Call submit_assessment exactly once. Do not answer in plain prose.

Output rules:
- one_liner: <=12 words on who they are (e.g. "CIO at Bella Aurora, ex-Affinity Petcare").
- bottom_line: ONE sentence — the core reason they are / aren't a fit.
- top_strengths: 2-3 short concrete phrases (e.g. "Scaled D2C at Royal Canin").
- watch_outs: 1-2 short phrases naming the main risk/gap (e.g. "No hands-on building lately").
- signal_scores: rate seniority, builder_track_record, domain_fit, availability, pedigree,
  social_presence 0-100, each with a one-line note citing a concrete fact.
- rank_score: overall 0-100 using the rubric weights.
- sources: the source URLs from the findings you actually relied on — at least 3 when available
  (fewer ONLY if the person has almost no web presence — then say so in bottom_line).
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
  return JSON.stringify(seed, null, 2);
}

const GATHER_SYSTEM = `You are a fast web researcher. Research ONE assigned angle about one person.
Run 1-2 targeted web searches (web_fetch the single most useful page if needed), then return
concise bullet-point facts — each bullet MUST end with its source URL in parentheses.
Only report facts about THIS person: match the name AND company/background from the LinkedIn seed;
if a result is about a same-named different person, skip it. Never invent facts or URLs.
If almost nothing is found, return one line: "Little public info found for this angle."
No intro, no conclusion — bullets only.`;

const GATHER_ANGLES = [
  `Career & companies: current role, full career history, companies founded/led/built, exits,
acquisitions, IPOs, team/revenue scale (with numbers where possible). Search e.g. "<name> <current company>", "<name> founder OR CEO".`,
  `Public presence: interviews, podcasts, talks, press coverage, awards, recognition, social
following / audience size. Search e.g. "<name> interview OR podcast OR talk", "<name> news".`,
  `Education & achievements: degrees and schools (flag elite programs like HBS/Stanford GSB/MIT),
notable concrete achievements, publications, patents. Search e.g. "<name> education OR MBA OR university".`,
];

async function gather(c, angle) {
  const messages = [
    { role: "user", content: `Assigned angle:\n${angle}\n\nPerson (LinkedIn seed data):\n${userPrompt(c)}` },
  ];
  for (let i = 0; i < 4; i++) {
    // Hung gatherer must not stall the candidate: hard 60s per attempt, no retry —
    // a failed angle is swallowed by the caller and assessment proceeds without it.
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: GATHER_SYSTEM,
      tools: gatherTools,
      messages,
    }, { timeout: 60_000, maxRetries: 0, signal: AbortSignal.timeout(70_000) });
    messages.push({ role: "assistant", content: resp.content });
    if (resp.stop_reason === "pause_turn") continue; // server tool loop — resume
    return resp.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
  }
  return "";
}

async function research(c) {
  const findings = await Promise.all(GATHER_ANGLES.map((angle) => gather(c, angle).catch(() => "")));
  const merged = ["## Career & companies", findings[0], "## Public presence", findings[1], "## Education & achievements", findings[2]]
    .join("\n\n");
  const resp = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [submitTool],
    tool_choice: { type: "tool", name: "submit_assessment" },
    messages: [{ role: "user", content: `Assess this person. LinkedIn seed data:\n${userPrompt(c)}\n\nWeb research findings:\n${merged}` }],
  }, { timeout: 120_000, maxRetries: 1, signal: AbortSignal.timeout(150_000) });
  const submit = resp.content.find((b) => b.type === "tool_use" && b.name === "submit_assessment");
  if (!submit) throw new Error("did not submit assessment");
  return submit.input;
}

console.error(`Deep-researching ${cands.length} candidate(s) — sonnet-4-6 gatherers + opus-4-8 assessor (concurrency ${CONCURRENCY})…\n`);
const tStart = Date.now();
const elapsed = () => `${Math.round((Date.now() - tStart) / 1000)}s`;
const researched = [];
async function researchOne(c) {
  const t0 = Date.now();
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
    console.error(`  ✓ ${score}  ${c.full_name} — ${(a.sources ?? []).length} sources (${Math.round((Date.now() - t0) / 1000)}s)`);
  } catch (e) {
    await supabase.from("candidates").update({ researching: false }).eq("id", c.id);
    console.error(`  ✗ FAILED ${c.full_name}: ${e.message}`);
  }
}
await mapLimit(cands, CONCURRENCY, researchOne);
console.error(`\n[${elapsed()}] research loop done`);

// ---- head-to-head comparison pass ----
if (researched.length >= 2) {
  console.error(`Writing head-to-head comparison notes…`);
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
    console.error(`  [${elapsed()}] comparison call starting…`);
    // Opus, not Sonnet: the gatherers saturate Sonnet's rate-limit bucket, so a
    // Sonnet call here queues for minutes. Opus has headroom and returns fast.
    const resp = await anthropic.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      system: "You compare ranked candidates for a venture builder. For each, write a 1-2 sentence comparison_note making it CLEAR why they rank where they do versus the people directly above and below them — cite the decisive signal differences (e.g. stronger builder track record, weaker domain fit). Be concrete and specific to each person.",
      output_config: { format: { type: "json_schema", schema: COMP_SCHEMA } },
      messages: [{ role: "user", content: `Ranked candidates (highest first):\n${JSON.stringify(list, null, 2)}` }],
    }, { timeout: 60_000, maxRetries: 1, signal: AbortSignal.timeout(90_000) });
    console.error(`  [${elapsed()}] comparison response received`);
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
    console.error(`  [${elapsed()}] comparison pass skipped: ${e.message}`);
  }
}

console.error(`\n[${elapsed()}] ✓ Deep-researched ${researched.length}/${cands.length}.`);
// Timed-out gather sockets can keep the event loop alive long after the work is
// done — and the pipeline waits on this process's exit. Leave nothing dangling.
process.exit(0);
