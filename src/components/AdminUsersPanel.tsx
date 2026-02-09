"use client";

import { useEffect, useRef, useState } from "react";

type Role = "admin" | "user";

type UserRow = {
  id: string;
  email: string;
  role: Role;
  createdAtLabel: string;
};

type AdminUsersPanelProps = {
  users: UserRow[];
  currentUserId: string;
};

type RowStatus = "idle" | "saving" | "saved" | "error";

const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  user: "Usuario",
};

const errorMessages: Record<string, string> = {
  unauthorized: "Tu sesión expiró. Inicia sesión nuevamente.",
  forbidden: "No tienes permisos para editar roles.",
  self: "No puedes cambiar tu propio rol.",
  last_admin: "Debe quedar al menos un administrador.",
  invalid_role: "Rol inválido.",
  missing_user: "Usuario inválido.",
  not_found: "Usuario no encontrado.",
};

export default function AdminUsersPanel({
  users,
  currentUserId,
}: AdminUsersPanelProps) {
  const initialRolesRef = useRef<Record<string, Role>>({});
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [statusById, setStatusById] = useState<Record<string, RowStatus>>({});
  const [messageById, setMessageById] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    const initial = Object.fromEntries(
      users.map((item) => [item.id, item.role])
    ) as Record<string, Role>;
    initialRolesRef.current = initial;
    setRoles(initial);
  }, [users]);

  useEffect(() => {
    const timersSnapshot = timers.current;
    return () => {
      Object.values(timersSnapshot).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  const handleRoleChange = (userId: string, value: Role) => {
    setRoles((prev) => ({ ...prev, [userId]: value }));
  };

  const handleSave = async (userId: string) => {
    if (timers.current[userId]) {
      window.clearTimeout(timers.current[userId]);
    }
    setStatusById((prev) => ({ ...prev, [userId]: "saving" }));
    setMessageById((prev) => ({ ...prev, [userId]: "" }));

    try {
      const response = await fetch("/api/admin/users/role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ userId, role: roles[userId] }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const code = typeof data.error === "string" ? data.error : "error";
        const message =
          errorMessages[code] ||
          data.message ||
          "No se pudo actualizar el rol.";
        setStatusById((prev) => ({ ...prev, [userId]: "error" }));
        setMessageById((prev) => ({ ...prev, [userId]: message }));
        return;
      }

      const nextRole =
        typeof data.role === "string" ? (data.role as Role) : roles[userId];
      initialRolesRef.current = {
        ...initialRolesRef.current,
        [userId]: nextRole,
      };
      setRoles((prev) => ({ ...prev, [userId]: nextRole }));
      setStatusById((prev) => ({ ...prev, [userId]: "saved" }));
      setMessageById((prev) => ({ ...prev, [userId]: "Rol actualizado." }));
    } catch {
      setStatusById((prev) => ({ ...prev, [userId]: "error" }));
      setMessageById((prev) => ({
        ...prev,
        [userId]: "No se pudo actualizar el rol.",
      }));
    } finally {
      timers.current[userId] = window.setTimeout(() => {
        setStatusById((prev) => ({ ...prev, [userId]: "idle" }));
        setMessageById((prev) => ({ ...prev, [userId]: "" }));
      }, 1600);
    }
  };

  return (
    <div className="rounded-3xl border border-accent/20 bg-white/70 p-8 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-[0.2em]">
            Usuarios
          </h1>
          <p className="mt-2 text-sm text-muted">
            {users.length} usuario{users.length === 1 ? "" : "s"} en total.
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-accent/15">
        <div className="grid grid-cols-[1.6fr_0.9fr_1fr_0.7fr] gap-4 bg-bg px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <div>Correo</div>
          <div>Rol</div>
          <div>Creado</div>
          <div>Acciones</div>
        </div>
        <div className="divide-y divide-accent/10 bg-white/80">
          {users.map((item) => {
            const roleValue = roles[item.id] ?? item.role;
            const isSelf = item.id === currentUserId;
            const isDirty = roleValue !== initialRolesRef.current[item.id];
            const rowStatus = statusById[item.id] ?? "idle";
            const message = messageById[item.id];

            return (
              <div
                key={item.id}
                className="grid grid-cols-[1.6fr_0.9fr_1fr_0.7fr] gap-4 px-4 py-3 text-sm"
              >
                <div className="font-semibold">{item.email}</div>
                <div className="flex flex-col gap-2">
                  <select
                    className="rounded-full border border-accent/20 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-fg outline-none transition focus:border-accent disabled:cursor-not-allowed disabled:bg-bg"
                    value={roleValue}
                    onChange={(event) =>
                      handleRoleChange(item.id, event.target.value as Role)
                    }
                    disabled={isSelf}
                  >
                    <option value="admin">{roleLabels.admin}</option>
                    <option value="user">{roleLabels.user}</option>
                  </select>
                  {isSelf && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Tu cuenta
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted">{item.createdAtLabel}</div>
                <div className="flex flex-col items-start gap-2">
                  <button
                    className="inline-flex items-center justify-center rounded-full border border-accent/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    onClick={() => handleSave(item.id)}
                    disabled={isSelf || !isDirty || rowStatus === "saving"}
                  >
                    {rowStatus === "saving"
                      ? "Guardando..."
                      : rowStatus === "saved"
                        ? "Guardado"
                        : "Guardar"}
                  </button>
                  {message && (
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide ${
                        rowStatus === "error" ? "text-accent" : "text-muted"
                      }`}
                    >
                      {message}
                    </span>
                  )}
                  {!message && !isSelf && !isDirty && rowStatus === "idle" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      Sin cambios
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
