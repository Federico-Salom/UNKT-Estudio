import Link from "next/link";

type UserRow = {
  id: string;
  email: string;
  role: "admin" | "user";
  createdAtLabel: string;
};

type AdminUsersPanelProps = {
  users: UserRow[];
};

export default function AdminUsersPanel({ users }: AdminUsersPanelProps) {
  const rows = users.map((item) => ({
    ...item,
    roleLabel: item.role === "admin" ? "Administrador" : "Usuario",
  }));

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
        <Link
          className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-bg transition hover:bg-accent2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent2"
          href="/register"
        >
          Crear usuario
        </Link>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-accent/15">
        <div className="grid grid-cols-[1.6fr_0.8fr_1fr] gap-4 bg-bg px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <div>Correo</div>
          <div>Rol</div>
          <div>Creado</div>
        </div>
        <div className="divide-y divide-accent/10 bg-white/80">
          {rows.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[1.6fr_0.8fr_1fr] gap-4 px-4 py-3 text-sm"
            >
              <div className="font-semibold">{item.email}</div>
              <div className="uppercase text-xs font-semibold text-muted">
                {item.roleLabel}
              </div>
              <div className="text-xs text-muted">{item.createdAtLabel}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
