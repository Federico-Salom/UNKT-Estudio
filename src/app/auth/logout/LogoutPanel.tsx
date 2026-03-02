"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readApiResult } from "@/lib/client-api";

type LogoutStatus = "loading" | "done" | "error";

const statusCopy: Record<LogoutStatus, { title: string; description: string }> = {
  loading: {
    title: "Cerrando sesion...",
    description:
      "Estamos liberando tus datos y preparando todo para tu proxima visita.",
  },
  done: {
    title: "Hasta pronto",
    description: "La sesion se cerro correctamente. Puedes volver cuando quieras.",
  },
  error: {
    title: "Algo salio mal",
    description:
      "No pudimos cerrar sesion en este momento. Reintenta en unos segundos.",
  },
};

export default function LogoutPanel() {
  const [status, setStatus] = useState<LogoutStatus>("loading");

  useEffect(() => {
    let isMounted = true;

    const doLogout = async () => {
      try {
        const response = await fetch("/api/auth/logout", {
          method: "GET",
          cache: "no-store",
        });

        const result = await readApiResult(response, "No se pudo cerrar sesion.");
        if (!result.ok) {
          throw new Error(result.error);
        }

        if (isMounted) {
          setStatus("done");
        }
      } catch {
        if (isMounted) {
          setStatus("error");
        }
      }
    };

    doLogout();

    return () => {
      isMounted = false;
    };
  }, []);

  const { title, description } = statusCopy[status];

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="logout-portal">
        <div className="logout-orb" />
        <div className="logout-core" />
        <div className="logout-dots">
          {[0, 1, 2].map((dotIndex) => (
            <span
              key={dotIndex}
              className="logout-dot"
              style={{ animationDelay: `${dotIndex * 120}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-2xl font-display uppercase tracking-[0.16em]">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-full border border-accent/40 bg-bg/90 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-accent transition hover:border-accent hover:bg-bg"
        >
          Ir al inicio
        </Link>
        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-full border border-transparent bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-bg transition hover:bg-accent2"
        >
          Iniciar sesion
        </Link>
      </div>
      {status === "error" ? (
        <p className="mt-2 text-xs text-muted">
          Si el problema persiste, prueba borrando cookies o revisando tu conexion.
        </p>
      ) : null}
    </div>
  );
}
