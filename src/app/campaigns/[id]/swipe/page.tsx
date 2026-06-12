import Link from "next/link";
import { notFound } from "next/navigation";
import SwipeDeck, { type SwipeCard } from "@/components/swipe/SwipeDeck";
import { getCandidatesByNeed } from "@/lib/candidates";
import { getNeed } from "@/lib/needs";
import { selectHighlights } from "@/lib/highlights";
import { availability, fmt, followerTotal, initials, photoUrl } from "@/lib/people";
import { verdictFor } from "@/lib/pipeline/labels";
import type { Candidate } from "@/lib/types";

// Phone-first screening deck for one campaign: every ranked, not-yet-swiped
// candidate, best score first. The card carries the whiteboard's four key
// things: picture, profile summary, scraped extras, and the AI score.

function firstSentence(s: string | null): string | null {
  if (!s) return null;
  return s.split(/(?<=[.!?])\s/)[0] ?? null;
}

function facts(c: Candidate): string[] {
  const out: string[] = [];
  const bg = c.background as {
    positions?: { title?: string; company?: string }[];
    education?: string[];
  };
  for (const p of (bg?.positions ?? []).slice(0, 2)) {
    const line = [p.title, p.company].filter(Boolean).join(" @ ");
    if (line) out.push(line);
  }
  const edu = c.dossier?.education_summary ?? bg?.education?.[0];
  if (edu) out.push(edu);
  const followers = followerTotal(c.social);
  if (followers) out.push(`${fmt(followers)} followers`);
  const avail = availability(c.signals);
  if (avail) out.push(`Availability: ${avail}`);
  return out.slice(0, 5);
}

function toCard(c: Candidate): SwipeCard {
  const verdict = verdictFor(c.rank_score);
  return {
    id: c.id,
    name: c.full_name ?? "—",
    photo: photoUrl(c.social),
    initials: initials(c.full_name),
    headline:
      c.headline ??
      [c.current_title, c.current_company].filter(Boolean).join(" · ") ??
      null,
    summary:
      c.dossier?.one_liner ?? c.dossier?.bottom_line ?? firstSentence(c.rank_reason),
    score: c.rank_score,
    verdictLabel: verdict.label,
    verdictChip: verdict.chip,
    highlights: selectHighlights(c, c.dossier?.top_strengths ?? [], { max: 4 }).map(
      (h) => ({ label: h.label, tier: h.tier }),
    ),
    facts: facts(c),
    linkedinUrl: c.linkedin_url,
  };
}

export default async function SwipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const need = await getNeed(id);
  if (!need) notFound();

  const deck = (await getCandidatesByNeed(id))
    .filter((c) => c.rank_score != null && (c.swipe_decision ?? "pending") === "pending")
    .map(toCard);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link
          href={`/campaigns/${id}`}
          className="truncate font-mono text-xs text-muted hover:text-ink"
          title={need.need_text}
        >
          ← {need.need_text}
        </Link>
        <Link href={`/campaigns/${id}/review`} className="btn btn-ghost shrink-0 text-xs">
          Review board
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
        <SwipeDeck
          cards={deck}
          needId={id}
          reviewHref={`/campaigns/${id}/review`}
          backHref={`/campaigns/${id}`}
        />
      </main>
    </div>
  );
}
