"use client";

import Link from "next/link";
import { useState } from "react";

type Status = "idle" | "loading";

export default function PasswordRecoveryForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [apiError, setApiError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const getEmailError = () => {
    if (!email) return "Escribe tu correo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Correo invalido.";
    }
    return "";
  };

  const requestResetLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError("");
    setInfoMessage("");

    const emailError = getEmailError();
    if (emailError) {
      setApiError(emailError);
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/auth/password-recovery/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setApiError(data.error || "No se pudo iniciar la recuperacion.");
        setStatus("idle");
        return;
      }

      setInfoMessage(
        typeof data.message === "string"
          ? data.message
          : "Si existe una cuenta con ese correo, enviamos instrucciones para recuperar la contrasena."
      );
    } catch {
      setApiError("No se pudo iniciar la recuperacion. Intenta nuevamente.");
    } finally {
      setStatus("idle");
    }
  };

  const inputClass =
    "w-full min-w-0 rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm text-fg outline-none transition placeholder:text-muted focus:border-accent";

  return (
    <>
      {apiError && (
        <div
          className="mt-6 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="alert"
        >
          {apiError}
        </div>
      )}

      {infoMessage && (
        <div className="mt-6 rounded-2xl border border-accent/20 bg-bg px-4 py-3 text-sm">
          <p>{infoMessage}</p>
          <p className="mt-2 text-xs text-muted">
            Revisa tu bandeja de entrada y spam. El enlace vence rapido y solo se puede usar una vez.
          </p>
        </div>
      )}

      <form className="mt-6 grid min-w-0 gap-4" onSubmit={requestResetLink} noValidate>
        <label className="grid min-w-0 gap-2 text-sm font-semibold">
          Correo
          <input
            className={inputClass}
            type="email"
            name="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <button
          className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-transparent bg-gradient-to-r from-accent to-accent2 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_18px_34px_-20px_rgba(139,13,90,0.92)] transition hover:from-accent2 hover:to-accent hover:shadow-[0_22px_42px_-20px_rgba(139,13,90,0.95)] active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
          type="submit"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-muted">
        <Link
          className="font-semibold text-accent transition hover:text-accent2"
          href="/login"
        >
          Volver al inicio de sesion
        </Link>
      </div>
    </>
  );
}
