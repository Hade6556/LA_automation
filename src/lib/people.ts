// Small display helpers for rendering people, shared by the cockpit table,
// campaign cards, and dossier page.

export function followerTotal(social: Record<string, unknown>): number | null {
  const s = social as {
    x?: { followers?: number };
    linkedin?: { followers?: number };
  };
  const total = (Number(s?.x?.followers) || 0) + (Number(s?.linkedin?.followers) || 0);
  return total || null;
}

export function fmt(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n % 1000 >= 100 ? 1 : 0)}k` : String(n);
}

export function availability(signals: Record<string, unknown>): string | null {
  const a = (signals as { availability?: unknown })?.availability;
  return typeof a === "string" ? a : null;
}

export function photoUrl(social: Record<string, unknown>): string | null {
  const u = (social as { photo_url?: unknown })?.photo_url;
  return typeof u === "string" ? u : null;
}

export function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
