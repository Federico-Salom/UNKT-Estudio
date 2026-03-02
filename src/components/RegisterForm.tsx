"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readApiResult } from "@/lib/client-api";

type RegisterFormProps = {
  serverError?: string;
};

type RegisterApiResponse = {
  redirectTo?: string;
};

const hasLettersAndNumbers = (value: string) => {
  return /[a-zA-Z]/.test(value) && /\d/.test(value);
};

export default function RegisterForm({ serverError }: RegisterFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [apiError, setApiError] = useState("");

  const getEmailError = () => {
    if (!email) return "Escribe tu correo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Correo invalido.";
    }
    return null;
  };

  const getPasswordError = () => {
    if (!password) return "Escribe una contrasena.";
    if (password.length < 8) return "Debe tener al menos 8 caracteres.";
    if (!hasLettersAndNumbers(password)) {
      return "Debe incluir letras y numeros.";
    }
    return null;
  };

  const getConfirmError = () => {
    if (!passwordConfirm) return "Repite la contrasena.";
    if (password !== passwordConfirm) return "Las contrasenas no coinciden.";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    setAttempted(true);
    const emailError = getEmailError();
    const passwordError = getPasswordError();
    const confirmError = getConfirmError();
    if (emailError || passwordError || confirmError) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    setApiError("");
    setStatus("loading");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password, passwordConfirm }),
      });

      const result = await readApiResult<RegisterApiResponse>(
        response,
        "No se pudo crear la cuenta."
      );

      if (!result.ok) {
        setApiError(result.error);
        setStatus("idle");
        return;
      }

      const redirectTo =
        typeof result.data?.redirectTo === "string" ? result.data.redirectTo : "/";
      router.push(redirectTo);
    } catch {
      setApiError("No se pudo crear la cuenta. Intenta nuevamente.");
      setStatus("idle");
    }
  };

  const emailError = attempted ? getEmailError() : null;
  const passwordError = attempted ? getPasswordError() : null;
  const confirmError = attempted ? getConfirmError() : null;
  const showEmailError = Boolean(emailError);
  const showPasswordError = Boolean(passwordError);
  const showConfirmError = Boolean(confirmError);

  const inputClass = (invalid: boolean) =>
    [
      "w-full min-w-0 rounded-2xl border px-4 py-3 text-sm text-fg outline-none transition placeholder:text-muted focus:border-accent",
      invalid ? "border-accent bg-accent/10" : "border-accent/20 bg-white",
    ].join(" ");

  return (
    <form className="mt-6 grid min-w-0 gap-4" onSubmit={handleSubmit} noValidate>
      {(serverError || apiError) && (
        <div
          className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="alert"
        >
          {apiError || serverError}
        </div>
      )}

      <label className="grid min-w-0 gap-2 text-sm font-semibold">
        Correo
        <input
          className={inputClass(showEmailError)}
          type="email"
          name="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={showEmailError}
          aria-describedby={showEmailError ? "email-error" : undefined}
        />
        {showEmailError && (
          <span id="email-error" className="text-xs text-accent">
            {emailError}
          </span>
        )}
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold">
        Contrasena
        <input
          className={inputClass(showPasswordError)}
          type="password"
          name="password"
          minLength={8}
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          aria-invalid={showPasswordError}
          aria-describedby={showPasswordError ? "password-error" : undefined}
        />
        {showPasswordError && (
          <span id="password-error" className="text-xs text-accent">
            {passwordError}
          </span>
        )}
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold">
        Repetir contrasena
        <input
          className={inputClass(showConfirmError)}
          type="password"
          name="passwordConfirm"
          minLength={8}
          required
          value={passwordConfirm}
          onChange={(event) => {
            setPasswordConfirm(event.target.value);
          }}
          aria-invalid={showConfirmError}
          aria-describedby={showConfirmError ? "password-confirm-error" : undefined}
        />
        {showConfirmError && (
          <span id="password-confirm-error" className="text-xs text-accent">
            {confirmError}
          </span>
        )}
      </label>
      <p className="text-xs text-muted">
        Minimo 8 caracteres. Usa letras y numeros.
      </p>
      <button
        className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-transparent bg-gradient-to-r from-accent to-accent2 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_18px_34px_-20px_rgba(139,13,90,0.92)] transition hover:from-accent2 hover:to-accent hover:shadow-[0_22px_42px_-20px_rgba(139,13,90,0.95)] active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
        type="submit"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Creando..." : "Crear cuenta"}
      </button>
    </form>
  );
}
