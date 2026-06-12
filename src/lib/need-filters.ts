import Anthropic from "@anthropic-ai/sdk";
import type { SearchFilters } from "@/lib/types";

// Convert a plain-text need ("CTO of petcare worldwide") into structured
// LinkedIn search filters. Port of OpenOutreach's need_to_filters.j2 prompt —
// keeping each concept in its own field is what makes the search precise
// (LinkedIn's free `keywords` box matches the whole profile).

const SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "The job title / role only, e.g. 'CTO'. Feeds LinkedIn's current-job-title filter. Never an industry or location.",
    },
    industries: { type: "array", items: { type: "string" } },
    locations: {
      type: "array",
      items: { type: "string" },
      description: "Empty if worldwide/global/unspecified.",
    },
    current_companies: { type: "array", items: { type: "string" } },
    keywords: {
      type: "string",
      description: "Residual freetext only (skills/products) — not title/industry/location.",
    },
    network: {
      type: "array",
      items: { type: "string", enum: ["F", "S", "O"] },
    },
  },
  required: ["title", "industries", "locations", "current_companies", "keywords", "network"],
  additionalProperties: false,
} as const;

const SYSTEM = `You are a B2B research expert. Convert the user's stated prospecting need into structured LinkedIn People-search filters.

Rules:
- title: the JOB TITLE / role only — e.g. "CTO", "Head of Marketing". Use the bare title as it would appear on a profile. Never put an industry or a location here.
- industries: industry terms, e.g. ["Veterinary", "Pet Care"]. Empty if not implied.
- locations: geographic targets as COUNTRIES or cities — never a continent or multi-country region. LinkedIn search does not match coarse regions ("Asia" returns nobody), so if the need names a continent or broad region (Asia, Europe, Africa, Middle East, Southeast Asia, Latin America, Nordics, etc.) expand it into the ~8-10 biggest market countries for that region, listed individually. Keep a specific country or city as-is. If the need says worldwide / global / no specific place, leave EMPTY (empty = worldwide). Examples: "Asia" → ["China","India","Japan","Singapore","South Korea","Indonesia","Hong Kong","United Arab Emirates","Vietnam","Thailand"]; "Europe" → ["United Kingdom","Germany","France","Netherlands","Spain","Italy","Sweden","Switzerland","Poland","Ireland"]; "London" → ["London"].
- current_companies: specific employers, only if the need names them. Usually empty.
- keywords: residual freetext ONLY — skills, products, specialties that are not the title, industry, or location. Often empty.
- network: connection-degree codes (F=1st, S=2nd, O=3rd+), only if the need explicitly mentions connection degree.

Stay faithful to the need — do not invent industries, locations, or seniority the user did not state or clearly imply.`;

export async function needToFilters(needText: string): Promise<SearchFilters> {
  const anthropic = new Anthropic();
  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `The need:\n${needText}` }],
  });
  const text = resp.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Claude returned no text for need conversion");
  return JSON.parse(text) as SearchFilters;
}
