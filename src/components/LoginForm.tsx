"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LoginFormProps = {
  initialError?: string;
  registered?: boolean;
};

type Status = "idle" | "loading";

export default function LoginForm({ initialError, registered }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState(initialError ?? "");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Completa correo y contraseña.");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Credenciales inválidas.");
        setStatus("idle");
        return;
      }

      const redirectTo =
        typeof data.redirectTo === "string" ? data.redirectTo : "/admin";
      router.push(redirectTo);
    } catch {
      setError("No se pudo iniciar sesión. Intenta nuevamente.");
      setStatus("idle");
    }
  };

  return (
    <form className="mt-6 grid gap-4" onSubmit={handleSubmit} noValidate>
      {registered && (
        <div className="rounded-2xl border border-accent/20 bg-bg px-4 py-3 text-sm">
          Cuenta creada. Inicia sesión.
        </div>
      )}

      {error && (
        <div
          className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="alert"
        >
          {error}
        </div>
      )}

      <label className="grid gap-2 text-sm font-semibold">
        Correo
        <input
          className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm text-fg outline-none transition placeholder:text-muted focus:border-accent"
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Contraseña
        <input
          className="rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm text-fg outline-none transition placeholder:text-muted focus:border-accent"
          type="password"
          name="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button
        className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-transparent bg-gradient-to-r from-accent to-accent2 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_18px_34px_-20px_rgba(139,13,90,0.92)] transition hover:from-accent2 hover:to-accent hover:shadow-[0_22px_42px_-20px_rgba(139,13,90,0.95)] active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
        type="submit"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Ingresando..." : "Entrar"}
      </button>
    </form>
  );
}
