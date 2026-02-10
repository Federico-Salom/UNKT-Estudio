"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const THEME_KEY = "unkt-theme";
const THEME_EVENT = "unkt-theme-change";

const resolveTheme = (): Theme => {
  const rootTheme = document.documentElement.dataset.theme;
  if (rootTheme === "light" || rootTheme === "dark") {
    return rootTheme;
  }

  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

const applyTheme = (theme: Theme) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

const getClientThemeSnapshot = (): Theme => {
  if (typeof window === "undefined") return "light";
  return resolveTheme();
};

const getServerThemeSnapshot = (): Theme => "light";

const subscribeToTheme = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};

  const handleThemeChange = () => callback();
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== THEME_KEY) return;

    if (event.newValue === "light" || event.newValue === "dark") {
      applyTheme(event.newValue);
    }

    callback();
  };

  window.addEventListener(THEME_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(THEME_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorage);
  };
};

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getClientThemeSnapshot,
    getServerThemeSnapshot
  );
  const isDark = theme === "dark";

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`theme-toggle-btn inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 bg-bg/90 text-xs font-semibold uppercase tracking-wide text-accent shadow-[0_12px_26px_-18px_rgba(0,0,0,0.45)] transition hover:border-accent hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 ${className}`.trim()}
      aria-label="Cambiar tema"
      title="Cambiar tema"
      aria-pressed={isDark}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
        {isDark ? (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4.2" />
            <path d="M12 2.8v2.6" />
            <path d="M12 18.6v2.6" />
            <path d="m4.9 4.9 1.8 1.8" />
            <path d="m17.3 17.3 1.8 1.8" />
            <path d="M2.8 12h2.6" />
            <path d="M18.6 12h2.6" />
            <path d="m4.9 19.1 1.8-1.8" />
            <path d="m17.3 6.7 1.8-1.8" />
          </svg>
        )}
      </span>
      <span className="sr-only">Tema</span>
    </button>
  );
}
