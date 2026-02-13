"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
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
  authenticated?: boolean;
  showHomeButton?: boolean;
};

export default function UserMenu({
  user,
  triggerClassName = "",
  authenticated = true,
  showHomeButton = false,
}: UserMenuProps) {
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

  const isAdmin =
    authenticated &&
    user.roleLabel &&
    user.roleLabel.toLowerCase().includes("admin");
  const actionLabel = authenticated
    ? isAdmin
      ? "Gestión"
      : "Cuenta"
    : "Ingresar";
  const actionHref = authenticated ? (isAdmin ? "/admin" : "/account") : "/login";
  const showBookingsButton = authenticated && !isAdmin;
  const isInAdminArea = pathname.startsWith("/admin");
  const showActionButton = !authenticated || !isAdmin || !isInAdminArea;
  const showAdminHomeButton = showHomeButton && authenticated;
  const showLogoutButton = authenticated;
  const canUsePortal = typeof document !== "undefined";
  const panelToneClassName = isAdmin
    ? "border-accent/55 bg-bg/80 shadow-[0_28px_64px_-36px_rgba(0,0,0,0.95),0_0_0_1px_rgba(207,63,105,0.18)]"
    : "border-accent/30 bg-bg/95 shadow-[0_22px_50px_-34px_rgba(0,0,0,0.85)]";
  const secondaryButtonToneClassName = isAdmin
    ? "border-accent/60 bg-accent/[0.08] text-accent hover:border-accent hover:bg-accent/20"
    : "border-accent/45 bg-accent/[0.08] text-accent hover:border-accent/60 hover:bg-accent/20";
  const bookingsButtonToneClassName = isAdmin
    ? "border-accent/55 bg-accent/[0.06] text-accent hover:border-accent hover:bg-accent/20"
    : "border-accent/40 bg-accent/[0.06] text-accent hover:border-accent/60 hover:bg-accent/20";
  const logoutButtonToneClassName = isAdmin
    ? "border-fg/30 bg-bg/70 text-fg hover:border-fg/50 hover:bg-bg/80"
    : "border-fg/30 bg-bg/70 text-fg hover:border-fg/60 hover:bg-bg/85";
  const menuContent = (
    <Fragment>
      {showBookingsButton ? (
        <a
          href="/mis-reservas"
          className={`inline-flex w-full items-center justify-center rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${bookingsButtonToneClassName}`}
        >
          Mis reservas
        </a>
      ) : null}
      {showActionButton ? (
        <a
          href={actionHref}
          className={`${showBookingsButton ? "mt-3" : "mt-4"} inline-flex w-full items-center justify-center rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${secondaryButtonToneClassName}`}
        >
          {actionLabel}
        </a>
      ) : null}
      {showAdminHomeButton ? (
        <Link
          href="/"
          className={`${showActionButton || showBookingsButton ? "mt-3" : "mt-4"} inline-flex w-full items-center justify-center rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${secondaryButtonToneClassName}`}
        >
          Ir al home
        </Link>
      ) : null}
      {showLogoutButton ? (
        <a
          href="/auth/logout"
          className={`${showAdminHomeButton || showActionButton || showBookingsButton ? "mt-3" : "mt-4"} inline-flex w-full items-center justify-center rounded-full border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${logoutButtonToneClassName}`}
        >
          Cerrar sesión
        </a>
      ) : null}
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
                    aria-label="Cerrar menú de cuenta"
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
