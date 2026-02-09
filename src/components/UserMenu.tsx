"use client";

import { useEffect, useRef, useState } from "react";

type UserMenuProps = {
  user: {
    email: string;
    roleLabel?: string;
    id?: string;
    createdAtLabel?: string;
    name?: string;
  };
};

export default function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const displayName = user.name || user.email;
  const showSecondaryEmail = user.name && user.name !== user.email;
  const isAdmin =
    user.roleLabel && user.roleLabel.toLowerCase().includes("admin");
  const actionLabel = isAdmin ? "Gestion" : "Reservas";
  const actionHref = isAdmin ? "/admin" : "/account";

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Cuenta"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="user-menu-trigger inline-flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 bg-bg text-accent transition hover:border-accent hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21a8 8 0 0 0-16 0" />
          <circle cx="12" cy="8" r="4" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-3 w-72 rounded-2xl border border-accent/20 bg-bg/95 p-4 text-left shadow-[0_24px_50px_-32px_rgba(0,0,0,0.6)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
            Cuenta
          </p>
          <div className="mt-3">
            <div className="text-sm font-semibold text-fg">{displayName}</div>
            {showSecondaryEmail ? (
              <div className="text-xs text-muted">{user.email}</div>
            ) : null}
          </div>
          <div className="mt-4 grid gap-1 text-xs text-muted">
            {user.roleLabel ? (
              <div>
                <span className="font-semibold text-fg/80">Rol:</span>{" "}
                {user.roleLabel}
              </div>
            ) : null}
          </div>
          <a
            href={actionHref}
            className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-accent/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
          >
            {actionLabel}
          </a>
          <a
            href="/api/auth/logout"
            className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-accent/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10"
          >
            Cerrar sesion
          </a>
        </div>
      ) : null}
    </div>
  );
}
