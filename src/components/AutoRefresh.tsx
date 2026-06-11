"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Soft-refreshes the server component on an interval so live state (e.g. a
// candidate flipping to "researching…" / "researched") shows without a manual
// reload. Cheap, single-operator internal tool.
export default function AutoRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, router]);
  return null;
}
