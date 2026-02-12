"use client";

import { useEffect, useState } from "react";

const HELP_GUIDE_PREF_KEY = "unkt_admin_agenda_hide_help_guides";

type AdminAgendaHelpButtonProps = {
  className?: string;
};

export default function AdminAgendaHelpButton({
  className = "",
}: AdminAgendaHelpButtonProps) {
  const [agendaHelpHidden, setAgendaHelpHidden] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncAgendaHelpPreference = () => {
      try {
        setAgendaHelpHidden(
          window.localStorage.getItem(HELP_GUIDE_PREF_KEY) === "1"
        );
      } catch {
        setAgendaHelpHidden(false);
      }
    };

    syncAgendaHelpPreference();
    window.addEventListener("storage", syncAgendaHelpPreference);
    return () => window.removeEventListener("storage", syncAgendaHelpPreference);
  }, []);

  const handleReactivateHelp = () => {
    try {
      window.localStorage.setItem(HELP_GUIDE_PREF_KEY, "0");
    } catch {
      // Ignore storage failures.
    }
    setAgendaHelpHidden(false);
  };

  return (
    <button
      type="button"
      onClick={handleReactivateHelp}
      disabled={!agendaHelpHidden}
      className={`inline-flex w-full items-center justify-center rounded-full border border-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent2 hover:text-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-55 md:w-auto ${className}`.trim()}
    >
      {agendaHelpHidden ? "Reactivar ayudas" : "Ayudas activas"}
    </button>
  );
}
