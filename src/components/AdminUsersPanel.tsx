"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
  unauthorized: "Tu sesion expiro. Inicia sesion nuevamente.",
  forbidden: "No tienes permisos para editar roles.",
  self: "No puedes cambiar tu propio rol.",
  last_admin: "Debe quedar al menos un administrador.",
  invalid_role: "Rol invalido.",
  missing_user: "Usuario invalido.",
  not_found: "Usuario no encontrado.",
};

function getStatusLabel(status: RowStatus) {
  if (status === "saving") return "Guardando";
  if (status === "saved") return "Guardado";
  if (status === "error") return "Error";
  return "";
}

export default function AdminUsersPanel({
  users,
  currentUserId,
}: AdminUsersPanelProps) {
  const initialRolesRef = useRef<Record<string, Role>>({});
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [statusById, setStatusById] = useState<Record<string, RowStatus>>({});
  const [messageById, setMessageById] = useState<Record<string, string>>({});
  const [searchValue, setSearchValue] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    const initial = Object.fromEntries(
      users.map((item) => [item.id, item.role])
    ) as Record<string, Role>;
    initialRolesRef.current = initial;
    setRoles(initial);
  }, [users]);

  useEffect(() => {
    if (users.length === 0) {
      setSelectedUserId("");
      return;
    }

    setSelectedUserId((current) => {
      if (current && users.some((item) => item.id === current)) {
        return current;
      }
      return users[0].id;
    });
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

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return users;
    }

    return users.filter((item) => {
      const roleValue = roles[item.id] ?? item.role;
      const roleLabel = roleLabels[roleValue].toLowerCase();

      return (
        item.email.toLowerCase().includes(query) ||
        roleLabel.includes(query) ||
        item.createdAtLabel.toLowerCase().includes(query)
      );
    });
  }, [roles, searchValue, users]);

  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectedUserId("");
      return;
    }

    setSelectedUserId((current) => {
      if (current && filteredUsers.some((item) => item.id === current)) {
        return current;
      }
      return filteredUsers[0].id;
    });
  }, [filteredUsers]);

  const selectedUser = users.find((item) => item.id === selectedUserId) ?? null;
  const selectedRoleValue: Role = selectedUser
    ? roles[selectedUser.id] ?? selectedUser.role
    : "user";
  const selectedIsSelf = selectedUser
    ? selectedUser.id === currentUserId
    : false;
  const selectedIsDirty = selectedUser
    ? selectedRoleValue !== initialRolesRef.current[selectedUser.id]
    : false;
  const selectedRowStatus: RowStatus = selectedUser
    ? (statusById[selectedUser.id] ?? "idle")
    : "idle";
  const selectedMessage = selectedUser ? messageById[selectedUser.id] : "";

  useEffect(() => {
    if (!isDetailOpen) {
      return;
    }
    if (!selectedUser) {
      setIsDetailOpen(false);
    }
  }, [isDetailOpen, selectedUser]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDetailOpen) {
      root.classList.add("admin-users-modal-open");
    } else {
      root.classList.remove("admin-users-modal-open");
    }

    return () => {
      root.classList.remove("admin-users-modal-open");
    };
  }, [isDetailOpen]);

  useEffect(() => {
    if (!isDetailOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsDetailOpen(false);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDetailOpen]);

  return (
    <div className="admin-users-panel rounded-3xl border border-accent/20 bg-white/70 p-5 shadow-[0_30px_60px_-45px_rgba(30,15,20,0.6)] backdrop-blur sm:p-8">
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

      <div className="mt-8">
        <label
          htmlFor="users-search"
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
        >
          Buscar usuario
        </label>
        <input
          id="users-search"
          className="admin-users-search mt-2 w-full rounded-2xl border border-accent/20 bg-white px-4 py-3 text-sm text-fg placeholder:text-muted outline-none transition focus:border-accent"
          type="search"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Correo, rol o fecha"
          autoComplete="off"
        />
      </div>

      <div className="admin-users-table mt-6 overflow-hidden rounded-2xl border border-accent/15 bg-white/80 p-3">
        <div className="admin-users-list overflow-hidden rounded-2xl border border-accent/15 bg-bg/70">
          <ul className="max-h-[26rem] space-y-2 overflow-y-auto p-2">
            {filteredUsers.length === 0 ? (
              <li className="rounded-xl border border-accent/15 bg-white/70 px-4 py-5 text-sm text-muted">
                No hay usuarios que coincidan con tu busqueda.
              </li>
            ) : (
              filteredUsers.map((item) => {
                const isSelected = item.id === selectedUserId;
                const roleValue = roles[item.id] ?? item.role;
                const rowStatus = statusById[item.id] ?? "idle";
                const statusLabel = getStatusLabel(rowStatus);

                return (
                  <li key={item.id}>
                    <button
                      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-accent/45 bg-accent/10 shadow-[0_12px_28px_-22px_rgba(30,15,20,0.7)]"
                          : "border-accent/20 bg-white/70 hover:border-accent/35 hover:bg-accent/5"
                      }`}
                      type="button"
                      onClick={() => {
                        setSelectedUserId(item.id);
                        setIsDetailOpen(true);
                      }}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <p className="min-w-0 truncate text-sm font-semibold leading-snug text-fg sm:whitespace-normal sm:[overflow-wrap:anywhere]">
                          {item.email}
                        </p>
                        <span className="self-start rounded-full border border-accent/20 bg-bg/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted sm:shrink-0">
                          {roleLabels[roleValue]}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                        <span>Creado: {item.createdAtLabel}</span>
                        {item.id === currentUserId && (
                          <span className="rounded-full border border-accent/20 bg-bg/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            Tu cuenta
                          </span>
                        )}
                        {statusLabel && (
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide ${
                              rowStatus === "error"
                                ? "text-accent"
                                : "text-muted"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {isDetailOpen && selectedUser && typeof document !== "undefined"
        ? createPortal(
            <div
              className="admin-users-modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
              onClick={() => setIsDetailOpen(false)}
            >
              <div
                className="admin-users-modal relative w-full max-w-xl overflow-hidden rounded-3xl border border-accent/20 bg-white/90 p-5 shadow-[0_34px_72px_-34px_rgba(0,0,0,0.75)] backdrop-blur sm:p-6"
                role="dialog"
                aria-modal="true"
                aria-label={`Editar usuario ${selectedUser.email}`}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="admin-users-close absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-accent/25 bg-bg/80 text-xl leading-none text-accent transition hover:border-accent hover:bg-accent/10"
                  type="button"
                  aria-label="Cerrar modal"
                  onClick={() => setIsDetailOpen(false)}
                >
                  X
                </button>

                <div className="space-y-5">
                  <div className="pr-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      Usuario seleccionado
                    </p>
                    <h2 className="mt-2 text-xl font-semibold leading-snug text-fg [overflow-wrap:anywhere]">
                      {selectedUser.email}
                    </h2>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-accent/15 bg-white/70 px-3 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Rol actual
                      </span>
                      <p className="mt-1 text-sm font-semibold text-fg">
                        {roleLabels[selectedRoleValue]}
                      </p>
                    </div>
                    <div className="rounded-xl border border-accent/15 bg-white/70 px-3 py-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        Creado
                      </span>
                      <p className="mt-1 text-sm font-semibold text-fg">
                        {selectedUser.createdAtLabel}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="selected-user-role"
                        className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"
                      >
                        Cambiar rol
                      </label>
                      <select
                        id="selected-user-role"
                        className="admin-users-role-select w-full"
                        value={selectedRoleValue}
                        onChange={(event) =>
                          handleRoleChange(
                            selectedUser.id,
                            event.target.value as Role
                          )
                        }
                        disabled={selectedIsSelf}
                      >
                        <option value="admin">{roleLabels.admin}</option>
                        <option value="user">{roleLabels.user}</option>
                      </select>
                      {selectedIsSelf && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                          Tu cuenta no se puede editar desde aca.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="admin-users-save-button inline-flex min-w-28 items-center justify-center rounded-full border border-accent/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-accent transition hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={() => handleSave(selectedUser.id)}
                        disabled={
                          selectedIsSelf ||
                          !selectedIsDirty ||
                          selectedRowStatus === "saving"
                        }
                      >
                        {selectedRowStatus === "saving"
                          ? "Guardando..."
                          : selectedRowStatus === "saved"
                            ? "Guardado"
                            : "Guardar"}
                      </button>
                      {!selectedMessage &&
                        !selectedIsSelf &&
                        !selectedIsDirty &&
                        selectedRowStatus === "idle" && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                            Sin cambios
                          </span>
                        )}
                    </div>

                    {selectedMessage && (
                      <p
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          selectedRowStatus === "error"
                            ? "text-accent"
                            : "text-muted"
                        }`}
                      >
                        {selectedMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
