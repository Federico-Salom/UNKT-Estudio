"use client";

import { useState } from "react";

type AccountProfileFormProps = {
  initialEmail: string;
  initialName: string;
  initialPhone: string;
};

type Status = "idle" | "saving";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hasLettersAndNumbers = (value: string) => {
  return /[a-zA-Z]/.test(value) && /\d/.test(value);
};

export default function AccountProfileForm({
  initialEmail,
  initialName,
  initialPhone,
}: AccountProfileFormProps) {
  const canEditName = initialName.trim().length > 0;
  const canEditPhone = initialPhone.trim().length > 0;
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const validate = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return "Escribe tu correo.";
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return "Correo inválido.";
    }

    const normalizedPhone = phone.trim();
    if (normalizedPhone) {
      const digits = normalizedPhone.replace(/\D/g, "");
      if (digits.length < 7) {
        return "Teléfono inválido.";
      }
    }

    const wantsPasswordChange =
      newPassword.length > 0 || newPasswordConfirm.length > 0;

    if (wantsPasswordChange) {
      if (!newPassword) {
        return "Escribe una nueva contraseña.";
      }
      if (!newPasswordConfirm) {
        return "Repite la nueva contraseña.";
      }
      if (newPassword !== newPasswordConfirm) {
        return "Las contraseñas no coinciden.";
      }
      if (newPassword.length < 8) {
        return "La contraseña debe tener al menos 8 caracteres.";
      }
      if (!hasLettersAndNumbers(newPassword)) {
        return "La contraseña debe incluir letras y números.";
      }
    }

    return "";
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim(),
          phone: phone.trim(),
          newPassword,
          newPasswordConfirm,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "No se pudo actualizar el perfil.");
        setStatus("idle");
        return;
      }

      setEmail(typeof data.user?.email === "string" ? data.user.email : email);
      setName(typeof data.user?.name === "string" ? data.user.name : "");
      setPhone(typeof data.user?.phone === "string" ? data.user.phone : "");
      setNewPassword("");
      setNewPasswordConfirm("");
      setMessage(
        typeof data.message === "string" ? data.message : "Perfil actualizado."
      );
    } catch {
      setError("No se pudo actualizar el perfil. Intenta nuevamente.");
    } finally {
      setStatus("idle");
    }
  };

  const inputClass =
    "account-profile-input w-full min-w-0 rounded-2xl border border-accent/20 bg-white/95 px-4 py-3 text-sm text-fg outline-none transition placeholder:text-muted focus:border-accent disabled:cursor-not-allowed disabled:bg-white/70 disabled:text-muted";

  return (
    <form
      className="account-profile-form mt-8 grid gap-4"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div
          className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent"
          role="alert"
        >
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-emerald-300/50 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      )}

      <label className="grid gap-2 text-sm font-semibold text-fg">
        Mail
        <input
          className={inputClass}
          type="email"
          name="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-fg">
        Nombre
        <input
          className={inputClass}
          type="text"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={canEditName ? "Tu nombre" : "Se completa en tu primera reserva"}
          disabled={!canEditName}
          readOnly={!canEditName}
        />
        {!canEditName && (
          <span className="text-xs font-normal text-muted">
            Se completa automaticamente con tu primera reserva.
          </span>
        )}
      </label>

      <label className="grid gap-2 text-sm font-semibold text-fg">
        Teléfono
        <input
          className={inputClass}
          type="tel"
          name="phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder={canEditPhone ? "+54 9 ..." : "Se completa en tu primera reserva"}
          disabled={!canEditPhone}
          readOnly={!canEditPhone}
        />
        {!canEditPhone && (
          <span className="text-xs font-normal text-muted">
            Se completa automaticamente con tu primera reserva.
          </span>
        )}
      </label>

      <div className="account-profile-security-box rounded-2xl border border-white/15 bg-black/20 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
          Cambiar contraseña
        </p>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-2 text-sm font-semibold text-fg">
            Nueva contraseña
            <input
              className={inputClass}
              type="password"
              name="newPassword"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Solo si quieres cambiarla"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-fg">
            Repetir nueva contraseña
            <input
              className={inputClass}
              type="password"
              name="newPasswordConfirm"
              minLength={8}
              value={newPasswordConfirm}
              onChange={(event) => setNewPasswordConfirm(event.target.value)}
            />
          </label>
        </div>
      </div>

      <button
        className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-transparent bg-gradient-to-r from-accent to-accent2 px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_18px_34px_-20px_rgba(139,13,90,0.92)] transition hover:from-accent2 hover:to-accent hover:shadow-[0_22px_42px_-20px_rgba(139,13,90,0.95)] active:scale-[0.995] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2 disabled:cursor-not-allowed disabled:opacity-70"
        type="submit"
        disabled={status === "saving"}
      >
        {status === "saving" ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
