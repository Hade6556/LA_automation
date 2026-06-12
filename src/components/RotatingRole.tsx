"use client";

import { useEffect, useRef, useState } from "react";

// Typewriter-cycles evocative needs after "I want to find ___". Doubles as
// inspiration for what to type. SSR-safe: renders ROLES[0] on the server and
// only starts animating after mount, so no hydration mismatch. Honors
// prefers-reduced-motion (instant swaps, no per-char typing).
const ROLES = [
  "a fintech CEO in Asia",
  "a CTO who shipped 0→1",
  "a design lead in Berlin",
  "a growth lead at a seed startup",
  "an ML engineer from a top lab",
  "a founder who already exited",
  "a Head of Product in NYC",
  "a climate-tech operator",
];

const TYPE_MS = 55;
const DELETE_MS = 28;
const HOLD_MS = 1600;

export default function RotatingRole() {
  const [text, setText] = useState(ROLES[0]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let i = 0; // role index
    let phase: "typing" | "holding" | "deleting" = "holding";
    let n = ROLES[0].length; // chars shown

    if (reduced) {
      const swap = () => {
        i = (i + 1) % ROLES.length;
        setText(ROLES[i]);
        timer.current = setTimeout(swap, HOLD_MS + 600);
      };
      timer.current = setTimeout(swap, HOLD_MS + 600);
      return () => clearTimeout(timer.current);
    }

    const tick = () => {
      const role = ROLES[i];
      if (phase === "holding") {
        phase = "deleting";
        timer.current = setTimeout(tick, HOLD_MS);
        return;
      }
      if (phase === "deleting") {
        n -= 1;
        setText(role.slice(0, n));
        if (n <= 0) {
          i = (i + 1) % ROLES.length;
          phase = "typing";
        }
        timer.current = setTimeout(tick, DELETE_MS);
        return;
      }
      // typing
      n += 1;
      setText(ROLES[i].slice(0, n));
      if (n >= ROLES[i].length) {
        phase = "holding";
      }
      timer.current = setTimeout(tick, TYPE_MS);
    };

    timer.current = setTimeout(tick, HOLD_MS);
    return () => clearTimeout(timer.current);
  }, []);

  return (
    <span className="text-gradient font-medium">
      {text}
      <span className="caret" aria-hidden>.</span>
    </span>
  );
}
