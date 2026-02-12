"use client";

import { useEffect } from "react";

const VISIT_KEY = "unkt_visit_ts";
const VISIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function VisitTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (
      path.startsWith("/admin") ||
      path.startsWith("/account") ||
      path.startsWith("/mis-reservas") ||
      path.startsWith("/login")
    ) {
      return;
    }

    const now = Date.now();
    const last = Number(window.localStorage.getItem(VISIT_KEY) || 0);
    if (now - last < VISIT_WINDOW_MS) return;

    window.localStorage.setItem(VISIT_KEY, String(now));
    fetch("/api/metrics/visit", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
