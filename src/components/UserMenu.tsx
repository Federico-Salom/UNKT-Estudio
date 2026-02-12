"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";

type UserMenuProps = {
  user: {
    email: string;
    roleLabel?: string;
    id?: string;
    createdAtLabel?: string;
    name?: string;
  };
  triggerClassName?: string;
};

export default function UserMenu({ user, triggerClassName = "" }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const desktopMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      const target = event.target as Node;
      if (wrapperRef.current.contains(target)) return;
      if (desktopMenuRef.current?.contains(target)) return;
      if (mobileMenuRef.current?.contains(target)) return;
      setOpen(false);
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
  const isInAdminArea = pathname.startsWith("/admin");
  const showActionButton = !isAdmin || !isInAdminArea;
  const canUsePortal = typeof document !== "undefined";
  const panelToneClassName = isAdmin
    ? "border-accent/55 bg-[#150910] shadow-[0_28px_64px_-36px_rgba(0,0,0,0.9),0_0_0_1px_rgba(207,63,105,0.18)]"
    : "border-white/20 bg-[#130a0f] shadow-[0_22px_50px_-34px_rgba(0,0,0,0.85)]";
  const profileToneClassName = isAdmin
    ? "border-accent/35 bg-[#24121d]"
    : "border-white/15 bg-[#1b1118]";
  const dividerToneClassName = isAdmin ? "bg-accent/20" : "bg-fg/12";
  const secondaryButtonToneClassName = isAdmin
    ? "border-accent/45 bg-accent/[0.08] text-accent hover:border-accent hover:bg-accent/16"
    : "border-white/20 bg-white/[0.03] text-fg hover:border-white/30 hover:bg-white/[0.08]";
  const logoutButtonToneClassName = isAdmin
    ? "border-accent text-accent hover:border-accent2 hover:text-accent2 hover:bg-accent/12"
    : "border-white/20 bg-white/[0.03] text-fg/90 hover:border-white/30 hover:bg-white/[0.08]";
  const menuContent = (
    <Fragment>
      <div className={`rounded-2xl border p-3.5 ${profileToneClassName}`}>
        <div className="break-all text-base font-semibold leading-snug text-fg">
          {displayName}
        </div>
        {showSecondaryEmail ? (
          <div className="mt-1 break-all text-xs text-muted">{user.email}</div>
        ) : null}
      </div>
      <div className={`mt-4 h-px ${dividerToneClassName}`} />
      {showActionButton ? (
        <a
          href={actionHref}
          className={`mt-4 inline-flex w-full items-center justify-center rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${secondaryButtonToneClassName}`}
        >
          {actionLabel}
        </a>
      ) : null}
      <a
        href="/api/auth/logout"
        className={`${showActionButton ? "mt-3" : "mt-4"} inline-flex w-full items-center justify-center rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${logoutButtonToneClassName}`}
      >
        Cerrar sesion
      </a>
    </Fragment>
  );

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-label="Cuenta"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`user-menu-trigger inline-flex h-9 w-9 items-center justify-center rounded-full border border-accent/30 bg-bg/90 text-accent shadow-[0_12px_26px_-18px_rgba(0,0,0,0.45)] transition hover:border-accent hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 md:h-10 md:w-10 ${triggerClassName}`.trim()}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
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
        <Fragment>
          <div
            ref={desktopMenuRef}
            className={`absolute right-0 top-full z-[80] mt-3 hidden w-[20rem] rounded-3xl border p-5 text-left md:block ${panelToneClassName}`}
          >
            {menuContent}
          </div>
          {canUsePortal
            ? createPortal(
                <div className="md:hidden">
                  <button
                    type="button"
                    aria-label="Cerrar menu de cuenta"
                    onClick={() => setOpen(false)}
                    className="fixed inset-0 z-[85] bg-black/60"
                  />
                  <div
                    ref={mobileMenuRef}
                    className={`fixed left-1/2 top-1/2 z-[90] max-h-[calc(100dvh-1.5rem)] w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border p-5 text-left ${panelToneClassName}`}
                  >
                    {menuContent}
                  </div>
                </div>,
                document.body,
              )
            : null}
        </Fragment>
      ) : null}
    </div>
  );
}
