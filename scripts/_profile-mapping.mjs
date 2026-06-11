// Shared LinkedIn profile → candidate-row mapping, used by both
// ingest-linkedin.mjs (manual freetext ingest) and needs-worker.mjs
// (needs-driven faceted scans).

// The profile verb's canonical dict may carry the parsed fields at top level or
// nested under a key — find the object that has positions/full_name.
export function unwrapProfile(d) {
  if (d && (d.positions || d.full_name || d.headline)) return d;
  for (const v of Object.values(d || {})) {
    if (v && typeof v === "object" && (v.positions || v.full_name)) return v;
  }
  return d || {};
}

function isFounderTitle(t = "") {
  return /found(er|ing)|co-?founder/i.test(t);
}

// Pull the profile photo from the raw Voyager blob (the parser drops it).
export function extractPhoto(d, fullName) {
  const pics = [];
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.profilePicture) pics.push(o.profilePicture);
    for (const v of Object.values(o)) walk(v);
  })(d);
  let fallback = null;
  for (const p of pics) {
    const vi = p?.displayImageReference?.vectorImage;
    if (!vi?.rootUrl || !/displayphoto/.test(vi.rootUrl)) continue;
    const arts = (vi.artifacts || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0));
    const seg = arts[0]?.fileIdentifyingUrlPathSegment;
    if (!seg) continue;
    const url = vi.rootUrl + seg;
    if (fullName && p.a11yText && p.a11yText.trim() === fullName.trim()) return url; // exact person
    if (!fallback) fallback = url;
  }
  return fallback;
}

// Map a parsed profile dict to a candidates row (status 'sourced').
// *photoSource* is whatever blob may contain the raw Voyager profilePicture —
// pass the full raw response when you have it. Callers add their own
// `source` / `provenance` / `need_id` on top.
export function mapProfile(p, photoSource) {
  const positions = Array.isArray(p.positions) ? p.positions : [];
  const educations = Array.isArray(p.educations) ? p.educations : [];
  const current = positions[0] || {};
  const linkedin_url =
    p.url || (p.public_identifier ? `https://www.linkedin.com/in/${p.public_identifier}/` : null);

  return {
    linkedin_url,
    full_name: p.full_name || null,
    headline: p.headline || null,
    current_company: current.company_name || null,
    current_title: current.title || null,
    company_domain: null,
    background: {
      ex_companies: [...new Set(positions.map((x) => x.company_name).filter(Boolean))],
      education: educations.map((e) =>
        [e.school_name, e.degree_name, e.field_of_study].filter(Boolean).join(" — "),
      ),
      ex_ventures: positions
        .filter((x) => isFounderTitle(x.title))
        .map((x) => `${x.title} @ ${x.company_name}`),
      positions: positions.map((x) => ({
        title: x.title,
        company: x.company_name,
        dates: x.date_range || null,
      })),
      summary: p.summary || null,
    },
    // A profile scrape has no follower data — record the photo + url, leave reach empty.
    social: { linkedin: { url: linkedin_url }, photo_url: extractPhoto(photoSource, p.full_name) },
    current_focus: p.headline || null,
    signals: {
      location: p.location_name || null,
      industry: p.industry?.name || null,
      connection_degree: p.connection_degree ?? null,
    },
    status: "sourced",
  };
}
