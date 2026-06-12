"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { swipeCandidateAction } from "@/app/campaigns/actions";

// Tinder-style screening deck. Pure pointer-events + CSS transforms — no
// animation lib. Commits are optimistic: the deck advances immediately (the
// next card is already fully rendered beneath), the swiped card flies off as a
// transient ghost, and the server action fires in a transition.

export type SwipeCard = {
  id: string;
  name: string;
  photo: string | null;
  initials: string;
  headline: string | null;
  summary: string | null;
  score: number | null;
  verdictLabel: string;
  verdictChip: string;
  highlights: { label: string; tier: number }[];
  facts: string[]; // scraped extras: positions, education, followers, availability
  linkedinUrl: string;
};

// Gesture tuning. Distance commits a deliberate drag; a flick commits sooner
// but only with real distance behind it and matching direction.
const COMMIT_PX = (w: number) => Math.min(w * 0.28, 110);
const FLICK_V = 0.5; // px/ms of *recent* (smoothed) velocity
const FLICK_MIN_PX = 48;
const DEAD_ZONE = 8; // px before the card visually follows the pointer

function Stamp({ dir, solid }: { dir: "yes" | "no"; solid?: boolean }) {
  return (
    <div
      data-stamp={solid ? undefined : ""}
      className={`pointer-events-none absolute top-6 z-20 rounded-lg border-4 px-4 py-1 font-mono text-3xl font-bold tracking-widest ${
        solid ? "" : "opacity-0"
      } ${
        dir === "yes"
          ? "left-6 -rotate-12 border-emerald-400 text-emerald-300"
          : "right-6 rotate-12 border-rose-400 text-rose-400"
      }`}
    >
      {dir === "yes" ? "YES" : "NO"}
    </div>
  );
}

// Pure presentation of one candidate card — shared by the live top card, the
// under-stack, and the fly-off ghost so every layer looks identical.
function CardFace({ card }: { card: SwipeCard }) {
  return (
    <>
      {/* ① picture + ④ score */}
      <div className="relative h-[45%] shrink-0 bg-surface-2">
        {card.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.photo}
            alt=""
            referrerPolicy="no-referrer"
            draggable={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center font-display text-6xl text-faint">
            {card.initials}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-3 pt-12">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-2xl leading-tight text-white">
                {card.name}
              </p>
              {card.headline ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-white/75">{card.headline}</p>
              ) : null}
            </div>
            {card.score != null ? (
              <div className="shrink-0 text-right">
                <div className="text-3xl font-bold tabular-nums leading-none text-white">
                  {card.score}
                </div>
                <span className={`chip mt-1 ${card.verdictChip}`}>{card.verdictLabel}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ② summary + ③ scraped info */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {card.summary ? (
          <p className="text-sm leading-relaxed text-ink">{card.summary}</p>
        ) : null}
        {card.highlights.length ? (
          <div className="flex flex-wrap gap-1.5">
            {card.highlights.map((h, i) => (
              <span
                key={i}
                className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[11px] font-medium text-violet-200 ring-1 ring-violet-500/25"
              >
                {h.tier === 1 ? "★ " : ""}
                {h.label}
              </span>
            ))}
          </div>
        ) : null}
        {card.facts.length ? (
          <ul className="space-y-1.5">
            {card.facts.map((f, i) => (
              <li key={i} className="flex gap-2 text-xs leading-snug text-muted">
                <span className="mt-0.5 shrink-0 text-faint">·</span>
                {f}
              </li>
            ))}
          </ul>
        ) : null}
        <a
          href={card.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-auto inline-flex w-fit items-center gap-1 rounded border border-border-soft px-2 py-1 text-xs text-muted hover:border-border hover:text-ink"
        >
          LinkedIn ↗
        </a>
      </div>
    </>
  );
}

export default function SwipeDeck({
  cards,
  needId,
  reviewHref,
  backHref,
}: {
  cards: SwipeCard[];
  needId: string;
  reviewHref: string;
  backHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  // ghost = the just-swiped card flying off above the (already live) next card
  const [ghost, setGhost] = useState<{ card: SwipeCard; dir: 1 | -1; fromX: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // drag state in refs — no re-render per pointermove
  const drag = useRef({ startX: 0, x: 0, lastX: 0, lastT: 0, v: 0, active: false, moved: false });
  const [, startTransition] = useTransition();

  const current = cards[index];
  const done = index >= cards.length;

  const setCardStyle = (x: number, withTransition: boolean) => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transition = withTransition ? "transform 0.22s ease" : "none";
    el.style.transform = x === 0 ? "" : `translateX(${x}px) rotate(${x / 18}deg)`;
    const stamps = el.querySelectorAll<HTMLElement>("[data-stamp]");
    const w = frameRef.current?.clientWidth ?? 360;
    const p = Math.min(Math.abs(x) / COMMIT_PX(w), 1);
    stamps.forEach((s) => {
      const isYes = s.textContent === "YES";
      s.style.opacity = (x > 0 && isYes) || (x < 0 && !isYes) ? String(p) : "0";
    });
  };

  const commit = useCallback(
    (dir: 1 | -1, fromX = 0) => {
      const card = cards[index];
      if (!card) return;
      const decision = dir === 1 ? ("approved" as const) : ("skipped" as const);
      setGhost({ card, dir, fromX });
      setHistory((h) => [...h, card.id]);
      setIndex((i) => i + 1); // next card is live immediately — no pop-in gap
      startTransition(() => swipeCandidateAction(card.id, decision, needId));
    },
    [cards, index, needId],
  );

  const undo = useCallback(() => {
    const lastId = history[history.length - 1];
    if (!lastId) return;
    setGhost(null);
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    startTransition(() => swipeCandidateAction(lastId, "pending", needId));
  }, [history, needId]);

  // keyboard: ← no, → yes, u undo (desktop convenience)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") commit(1);
      else if (e.key === "ArrowLeft") commit(-1);
      else if (e.key.toLowerCase() === "u") undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, undo]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = {
      startX: e.clientX, x: 0, lastX: e.clientX, lastT: performance.now(), v: 0,
      active: true, moved: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const now = performance.now();
    const dt = Math.max(now - d.lastT, 1);
    // smoothed recent velocity — a late slow-down kills the flick, as it should
    d.v = 0.8 * ((e.clientX - d.lastX) / dt) + 0.2 * d.v;
    d.lastX = e.clientX;
    d.lastT = now;
    const raw = e.clientX - d.startX;
    if (!d.moved && Math.abs(raw) < DEAD_ZONE) return; // tap jitter
    d.moved = true;
    d.x = raw - Math.sign(raw) * DEAD_ZONE;
    setCardStyle(d.x, false);
  };
  const endDrag = (cancelled: boolean) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    if (!d.moved) return; // plain tap — nothing to do
    const w = frameRef.current?.clientWidth ?? 360;
    const distance = Math.abs(d.x) > COMMIT_PX(w);
    const flick =
      Math.abs(d.v) > FLICK_V &&
      Math.abs(d.x) > FLICK_MIN_PX &&
      Math.sign(d.v) === Math.sign(d.x);
    if (!cancelled && (distance || flick)) {
      commit(d.x >= 0 ? 1 : -1, d.x);
      // reset the (now reused-for-next-card) element's transform instantly
      requestAnimationFrame(() => setCardStyle(0, false));
    } else {
      setCardStyle(0, true); // spring back
    }
  };

  if (done) {
    return (
      <div className="relative w-full max-w-sm">
        {ghost ? <GhostCard ghost={ghost} onDone={() => setGhost(null)} /> : null}
        <div className="card mx-auto flex w-full flex-col items-center gap-4 p-10 text-center">
          <span className="text-4xl">🛰</span>
          <p className="font-display text-2xl text-ink">All caught up</p>
          <p className="text-sm text-muted">
            Every ranked candidate in this campaign has been swiped.
          </p>
          <div className="mt-2 flex gap-2">
            <Link href={reviewHref} className="btn btn-primary">Review board</Link>
            <Link href={backHref} className="btn btn-ghost">Campaign</Link>
          </div>
          {history.length ? (
            <button onClick={undo} className="btn btn-ghost text-xs">↩ Undo last swipe</button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div ref={frameRef} className="relative h-[34rem] w-full max-w-sm select-none">
        {/* under-stack: next cards fully rendered so a commit reveals a real card */}
        {cards.slice(index + 1, index + 3).map((c, i) => (
          <div
            key={c.id}
            aria-hidden
            className="card pointer-events-none absolute inset-0 flex flex-col overflow-hidden"
            style={{
              transform: `translateY(${(i + 1) * 10}px) scale(${1 - (i + 1) * 0.035})`,
              zIndex: 2 - i,
            }}
          >
            <CardFace card={c} />
          </div>
        ))}

        {/* live top card */}
        <div
          key={current.id}
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => endDrag(false)}
          onPointerCancel={() => endDrag(true)}
          className="card absolute inset-0 z-10 flex touch-pan-y flex-col overflow-hidden"
        >
          <Stamp dir="yes" />
          <Stamp dir="no" />
          <CardFace card={current} />
        </div>

        {/* the just-swiped card flying off above everything */}
        {ghost ? <GhostCard ghost={ghost} onDone={() => setGhost(null)} /> : null}
      </div>

      {/* controls */}
      <div className="flex items-center gap-6">
        <button
          onClick={() => commit(-1)}
          aria-label="No — skip this candidate"
          className="grid h-16 w-16 place-items-center rounded-full border border-rose-500/40 bg-rose-500/10 text-2xl text-rose-300 transition hover:bg-rose-500/25 active:scale-95"
        >
          ✕
        </button>
        <button
          onClick={undo}
          disabled={!history.length}
          aria-label="Undo last swipe"
          className="grid h-11 w-11 place-items-center rounded-full border border-border-soft bg-surface-2/60 text-base text-muted transition hover:text-ink active:scale-95 disabled:opacity-30"
        >
          ↩
        </button>
        <button
          onClick={() => commit(1)}
          aria-label="Yes — approve this candidate"
          className="grid h-16 w-16 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-2xl text-emerald-300 transition hover:bg-emerald-500/25 active:scale-95"
        >
          ✓
        </button>
      </div>

      <p className="font-mono text-xs text-faint">
        {index + 1} of {cards.length}
      </p>
    </div>
  );
}

// The fly-off ghost. Mounts at the release position (inline transform) and the
// keyframe animation — which has no `from` — takes over from there.
function GhostCard({
  ghost,
  onDone,
}: {
  ghost: { card: SwipeCard; dir: 1 | -1; fromX: number };
  onDone: () => void;
}) {
  return (
    <div
      key={ghost.card.id}
      aria-hidden
      onAnimationEnd={onDone}
      className="card pointer-events-none absolute inset-0 z-20 flex flex-col overflow-hidden"
      style={{
        transform: `translateX(${ghost.fromX}px) rotate(${ghost.fromX / 18}deg)`,
        animation: `${ghost.dir === 1 ? "fly-off-right" : "fly-off-left"} 0.3s ease-in forwards`,
      }}
    >
      <Stamp dir={ghost.dir === 1 ? "yes" : "no"} solid />
      <CardFace card={ghost.card} />
    </div>
  );
}
