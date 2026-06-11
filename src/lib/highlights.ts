// Profile highlights — which rare, high-signal facts to surface as chips.
//
// Stored LLM-extracted highlights (candidates.highlights, written by
// research-rank.mjs / backfill-highlights.mjs) always win. When a candidate has
// none yet, deriveHighlights() pattern-matches their raw LinkedIn background at
// render time so elite credentials never sit invisible. Rules output is never
// persisted.

import type { Candidate, Highlight, HighlightCategory } from "@/lib/types";
import { HIGHLIGHT_CATEGORIES } from "@/lib/types";

type Pattern = { re: RegExp; name: string; tier: 1 | 2 };

const ELITE_SCHOOLS: Pattern[] = [
  { re: /\bharvard\b|\bHBS\b/i, name: "Harvard", tier: 1 },
  { re: /\bstanford\b|\bGSB\b/i, name: "Stanford", tier: 1 },
  { re: /\bwharton\b/i, name: "Wharton", tier: 1 },
  { re: /\bMIT\b|massachusetts institute/i, name: "MIT", tier: 1 },
  { re: /\boxford\b/i, name: "Oxford", tier: 1 },
  { re: /\bcambridge\b/i, name: "Cambridge", tier: 1 },
  { re: /\bINSEAD\b/i, name: "INSEAD", tier: 2 },
  { re: /\bLBS\b|london business school/i, name: "LBS", tier: 2 },
  { re: /\bIIT\b/i, name: "IIT", tier: 2 },
  { re: /polytechnique/i, name: "Polytechnique", tier: 2 },
  { re: /carnegie mellon|\bCMU\b/i, name: "CMU", tier: 2 },
  { re: /\bberkeley\b/i, name: "Berkeley", tier: 2 },
  { re: /\bETH\b|eth z[uü]rich/i, name: "ETH Zürich", tier: 2 },
  { re: /\bcaltech\b/i, name: "Caltech", tier: 2 },
  { re: /\bprinceton\b/i, name: "Princeton", tier: 2 },
  { re: /\byale\b/i, name: "Yale", tier: 2 },
  { re: /\bkellogg\b/i, name: "Kellogg", tier: 2 },
  { re: /\bimperial college\b/i, name: "Imperial", tier: 2 },
  { re: /\bcolumbia\b/i, name: "Columbia", tier: 2 },
  { re: /\btokyo university\b|university of tokyo/i, name: "Tokyo University", tier: 2 },
];

const ELITE_COMPANIES: Pattern[] = [
  { re: /deepmind/i, name: "DeepMind", tier: 1 },
  { re: /openai/i, name: "OpenAI", tier: 1 },
  { re: /google brain/i, name: "Google Brain", tier: 1 },
  { re: /anthropic/i, name: "Anthropic", tier: 1 },
  { re: /\bgoogle\b/i, name: "Google", tier: 2 },
  { re: /\bmeta\b|facebook/i, name: "Meta", tier: 2 },
  { re: /\bamazon\b|\bAWS\b/i, name: "Amazon", tier: 2 },
  { re: /\bapple\b/i, name: "Apple", tier: 2 },
  { re: /\bmicrosoft\b/i, name: "Microsoft", tier: 2 },
  { re: /\bnetflix\b/i, name: "Netflix", tier: 2 },
  { re: /\bstripe\b/i, name: "Stripe", tier: 2 },
  { re: /\bairbnb\b/i, name: "Airbnb", tier: 2 },
  { re: /\buber\b/i, name: "Uber", tier: 2 },
  { re: /\btesla\b/i, name: "Tesla", tier: 2 },
  { re: /\bspacex\b/i, name: "SpaceX", tier: 2 },
  { re: /\bgithub\b/i, name: "GitHub", tier: 2 },
  { re: /\bdatadog\b/i, name: "Datadog", tier: 2 },
  { re: /\bmckinsey\b/i, name: "McKinsey", tier: 2 },
  { re: /\brevolut\b/i, name: "Revolut", tier: 2 },
];

const EXIT_RE = /\bacq(?:uired|uisition)?\b|\bexit(?:ed)?\b|\bsold\b/i;
const ACQUIRER_RE = /acq(?:uired)?\.?\s+by\s+([\w&.-]+(?:\s+[\w&.-]+)?)/i;
const IPO_RE = /\bIPO\b|\bNASDAQ\b|\bNYSE\b|public compan/i;

const DEGREE_RE = /\b(MBA|PhD|postdoc|MSc|MEng|MS|MA|BSc|BS|BA)\b/i;
const DEGREE_CASE: Record<string, string> = {
  mba: "MBA", phd: "PhD", postdoc: "postdoc", msc: "MSc", meng: "MEng",
  ms: "MS", ma: "MA", bsc: "BSc", bs: "BS", ba: "BA",
};

// Category order when tiers are equal: rarest signal first.
const CATEGORY_PRIORITY: HighlightCategory[] = [
  "exit", "education", "pedigree", "scale", "recognition", "social",
];

type Background = {
  ex_companies?: unknown;
  ex_employers?: unknown;
  education?: unknown;
  ex_ventures?: unknown;
  notable?: unknown;
};

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Derive highlights from raw stored data — deterministic, render-time fallback.
export function deriveHighlights(c: Candidate): Highlight[] {
  const out: Highlight[] = [];
  const bg = (c.background ?? {}) as Background;
  const education = strings(bg.education);
  const companies = [...strings(bg.ex_companies), ...strings(bg.ex_employers)];
  const ventureFacts = [...strings(bg.ex_ventures), ...strings(bg.notable)];

  // Education: best (lowest-tier) school match, one highlight max.
  let best: { school: Pattern; degree: string | null } | null = null;
  for (const e of education) {
    const school = ELITE_SCHOOLS.find((p) => p.re.test(e));
    if (!school) continue;
    const degree = e.match(DEGREE_RE)?.[1] ?? null;
    if (!best || school.tier < best.school.tier) best = { school, degree };
  }
  if (best) {
    const degree = best.degree ? DEGREE_CASE[best.degree.toLowerCase()] ?? best.degree : null;
    out.push({
      label: degree ? `${best.school.name} ${degree}` : best.school.name,
      category: "education",
      tier: best.school.tier,
    });
  }

  // Pedigree: elite ex-companies, max 2.
  const seen = new Set<string>();
  for (const raw of companies) {
    const hit = ELITE_COMPANIES.find((p) => p.re.test(raw));
    if (!hit || seen.has(hit.name)) continue;
    seen.add(hit.name);
    out.push({ label: `Ex-${hit.name}`, category: "pedigree", tier: hit.tier });
    if (seen.size === 2) break;
  }

  // Exit / IPO from venture + notable facts.
  const exitFact = ventureFacts.find((s) => EXIT_RE.test(s));
  if (exitFact) {
    const acquirer = exitFact.match(ACQUIRER_RE)?.[1]?.replace(/[).,;]+$/, "");
    out.push({
      label: acquirer ? `Exit to ${acquirer}` : "Founder exit",
      category: "exit",
      tier: 1,
      evidence: exitFact,
    });
  }
  const ipoFact = ventureFacts.find((s) => IPO_RE.test(s));
  if (ipoFact) {
    out.push({ label: "IPO / public co", category: "scale", tier: 1, evidence: ipoFact });
  } else if (c.headline && IPO_RE.test(c.headline) && /\bCEO\b/i.test(c.headline)) {
    out.push({ label: "Public-company CEO", category: "scale", tier: 1, evidence: c.headline });
  }

  // Social reach.
  const social = c.social as { x?: { followers?: number }; linkedin?: { followers?: number } };
  const followers =
    (Number(social?.x?.followers) || 0) + (Number(social?.linkedin?.followers) || 0);
  if (followers >= 100_000) {
    out.push({ label: "100k+ followers", category: "social", tier: 1 });
  } else if (followers >= 25_000) {
    out.push({ label: "25k+ followers", category: "social", tier: 2 });
  }

  return out;
}

function isValid(h: unknown): h is Highlight {
  if (!h || typeof h !== "object") return false;
  const x = h as Partial<Highlight>;
  return (
    typeof x.label === "string" &&
    x.label.trim().length > 0 &&
    (x.tier === 1 || x.tier === 2) &&
    HIGHLIGHT_CATEGORIES.includes(x.category as HighlightCategory)
  );
}

// The "what to actually show" brain: stored LLM highlights win over derived;
// dedupe against strengths chips; tier 1 first, then rarest category; cap.
// Strength dedupe is exact-match only — a highlight that merely appears inside
// a longer strength phrase must still render (hiding it is this feature's bug).
export function selectHighlights(
  c: Candidate,
  strengths: string[],
  opts: { max: number; tier1Only?: boolean },
): Highlight[] {
  const stored = (c.highlights ?? []).filter(isValid);
  const pool = stored.length ? stored : deriveHighlights(c);
  const normStrengths = new Set(strengths.map(normalize));

  const seen = new Set<string>();
  return pool
    .filter((h) => {
      const n = normalize(h.label);
      if (!n || seen.has(n) || normStrengths.has(n)) return false;
      seen.add(n);
      return true;
    })
    .filter((h) => !opts.tier1Only || h.tier === 1)
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category) ||
        a.label.localeCompare(b.label),
    )
    .slice(0, opts.max);
}
