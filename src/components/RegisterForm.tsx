"use client";

import { useState } from "react";

type RegisterFormProps = {
  serverError?: string;
};

const hasLettersAndNumbers = (value: string) => {
  return /[a-zA-Z]/.test(value) && /\d/.test(value);
};

export default function RegisterForm({ serverError }: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [attempted, setAttempted] = useState(false);

  const getEmailError = () => {
    if (!email) return "Escribe tu correo.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return "Correo inválido.";
    }
    return null;
  };

  const getPasswordError = () => {
    if (!password) return "Escribe una contraseña.";
    if (password.length < 8) return "Debe tener al menos 8 caracteres.";
    if (!hasLettersAndNumbers(password)) {
      return "Debe incluir letras y números.";
    }
    return null;
  };

  const getConfirmError = () => {
    if (!passwordConfirm) return "Repite la contraseña.";
    if (password !== passwordConfirm) return "Las contraseñas no coinciden.";
    return null;
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    setAttempted(true);
    const emailError = getEmailError();
    const passwordError = getPasswordError();
    const confirmError = getConfirmError();
    if (emailError || passwordError || confirmError) {
      event.preventDefault();
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
      "rounded-2xl border px-4 py-3 text-sm outline-none transition focus:border-accent",
      invalid ? "border-accent bg-accent/10" : "border-accent/20 bg-white",
    ].join(" ");

  return (
    <form
      className="mt-6 grid gap-4"
      action="/api/auth/register"
      method="post"
      onSubmit={handleSubmit}
      noValidate
    >
      {serverError && (
        <div
          className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="alert"
        >
          {serverError}
        </div>
      )}

      <label className="grid gap-2 text-sm font-semibold">
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
      <label className="grid gap-2 text-sm font-semibold">
        Contraseña
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
      <label className="grid gap-2 text-sm font-semibold">
        Repetir contraseña
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
        Mínimo 8 caracteres. Usa letras y números.
      </p>
      <button
        className="mt-2 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
        type="submit"
      >
        Crear cuenta
      </button>
    </form>
  );
}
