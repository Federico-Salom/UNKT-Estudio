import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const errorResponse = (code: string, message: string, status = 400) =>
  NextResponse.json({ ok: false, error: code, message }, { status });

export async function POST(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return errorResponse(
      "unauthorized",
      "Tu sesión expiró. Inicia sesión nuevamente.",
      401
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || user.role !== "admin") {
    return errorResponse("forbidden", "No tienes permisos para editar roles.", 403);
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = typeof body.role === "string" ? body.role : "";

  if (!userId) {
    return errorResponse("missing_user", "Usuario inválido.");
  }

  if (role !== "admin" && role !== "user") {
    return errorResponse("invalid_role", "Rol inválido.");
  }

  if (userId === session.userId) {
    return errorResponse("self", "No puedes cambiar tu propio rol.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!target) {
    return errorResponse("not_found", "Usuario no encontrado.", 404);
  }

  if (target.role === role) {
    return NextResponse.json({ ok: true, role: target.role });
  }

  if (target.role === "admin" && role === "user") {
    const adminCount = await prisma.user.count({
      where: { role: "admin" },
    });
    if (adminCount <= 1) {
      return errorResponse(
        "last_admin",
        "Debe quedar al menos un administrador."
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  return NextResponse.json({ ok: true, role: updated.role });
}
