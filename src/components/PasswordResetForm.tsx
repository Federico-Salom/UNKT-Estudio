"use client";

import Link from "next/link";
import { useState } from "react";
import { readApiResult } from "@/lib/client-api";

type PasswordResetFormProps = {
  token: string;
};

type Status = "idle" | "loading";

type PasswordResetApiResponse = {
  message?: string;
};

const hasLettersAndNumbers = (value: string) => {
  return /[a-zA-Z]/.test(value) && /\d/.test(value);
};

export default function PasswordResetForm({ token }: PasswordResetFormProps) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [apiError, setApiError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [done, setDone] = useState(false);

  const getPasswordError = () => {
    if (!password) return "Escribe una nueva contrasena.";
    if (password.length < 8) return "Debe tener al menos 8 caracteres.";
    if (!hasLettersAndNumbers(password)) {
      return "Debe incluir letras y numeros.";
    }
    return "";
  };

  const getPasswordConfirmError = () => {
    if (!passwordConfirm) return "Repite la nueva contrasena.";
    if (passwordConfirm !== password) return "Las contrasenas no coinciden.";
    return "";
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError("");
    setInfoMessage("");

    const passwordError = getPasswordError();
    const confirmError = getPasswordConfirmError();
    const firstError = passwordError || confirmError;
    if (firstError) {
      setApiError(firstError);
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/auth/password-recovery/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          token,
          password,
          passwordConfirm,
        }),
      });

      const result = await readApiResult<PasswordResetApiResponse>(
        response,
        "No se pudo restablecer la contrasena."
      );

      if (!result.ok) {
        setApiError(result.error);
        setStatus("idle");
        return;
      }

      setDone(true);
      setPassword("");
      setPasswordConfirm("");
      setInfoMessage(
        typeof result.data?.message === "string"
          ? result.data.message
          : "Contrasena actualizada. Ya puedes iniciar sesion."
      );
    } catch {
      setApiError("No se pudo restablecer la contrasena. Intenta nuevamente.");
    } finally {
      setStatus("idle");
    }
  };

  if (done) {
    return (
      <div className="mt-6 grid gap-4">
        <div className="rounded-2xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm text-accent">
          {infoMessage}
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-full border border-accent/35 bg-accent/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/20"
          href="/login"
        >
          Iniciar sesion
        </Link>
      </div>
    );
  }

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

      <form className="mt-6 grid min-w-0 gap-4" onSubmit={onSubmit} noValidate>
        <label className="grid min-w-0 gap-2 text-sm font-semibold">
          Nueva contrasena
          <input
            className={inputClass}
            type="password"
            name="password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <label className="grid min-w-0 gap-2 text-sm font-semibold">
          Repetir nueva contrasena
          <input
            className={inputClass}
            type="password"
            name="passwordConfirm"
            minLength={8}
            required
            value={passwordConfirm}
            onChange={(event) => setPasswordConfirm(event.target.value)}
          />
        </label>

        <p className="text-xs text-muted">Minimo 8 caracteres. Usa letras y numeros.</p>

        <button
          className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-transparent bg-gradient-to-r from-accent to-accent2 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_18px_34px_-20px_rgba(139,13,90,0.92)] transition hover:from-accent2 hover:to-accent hover:shadow-[0_22px_42px_-20px_rgba(139,13,90,0.95)] active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
          type="submit"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Guardando..." : "Guardar nueva contrasena"}
        </button>
      </form>
    </>
  );
}
