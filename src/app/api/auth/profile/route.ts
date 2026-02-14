import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  getSessionFromCookies,
  hashPassword,
  signSession,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ProfileInput = {
  email?: string;
  name?: string;
  phone?: string;
  newPassword?: string;
  newPasswordConfirm?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const hasLettersAndNumbers = (value: string) => {
  return /[a-zA-Z]/.test(value) && /\d/.test(value);
};

const jsonError = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) {
    return jsonError("Tu sesión expiró. Inicia sesión nuevamente.", 401);
  }

  const body = (await request.json().catch(() => ({}))) as ProfileInput;
  const email = String(body.email || "")
    .trim()
    .toLowerCase();
  const nameRaw = String(body.name || "").trim();
  const phoneRaw = String(body.phone || "").trim();
  const newPassword = String(body.newPassword || "");
  const newPasswordConfirm = String(body.newPasswordConfirm || "");

  if (!email) {
    return jsonError("Escribe tu correo.");
  }
  if (!EMAIL_REGEX.test(email)) {
    return jsonError("Correo inválido.");
  }

  const normalizedPhone = phoneRaw.replace(/\s+/g, " ");
  if (normalizedPhone) {
    const phoneDigits = normalizedPhone.replace(/\D/g, "");
    if (phoneDigits.length < 7) {
      return jsonError("Teléfono inválido.");
    }
  }

  const wantsPasswordChange = newPassword.length > 0 || newPasswordConfirm.length > 0;

  if (wantsPasswordChange) {
    if (!newPassword) {
      return jsonError("Escribe una nueva contraseña.");
    }
    if (!newPasswordConfirm) {
      return jsonError("Repite la nueva contraseña.");
    }
    if (newPassword !== newPasswordConfirm) {
      return jsonError("Las contraseñas no coinciden.");
    }
    if (newPassword.length < 8) {
      return jsonError("La contraseña debe tener al menos 8 caracteres.");
    }
    if (!hasLettersAndNumbers(newPassword)) {
      return jsonError("La contraseña debe incluir letras y números.");
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (!user) {
    return jsonError("Usuario no encontrado.", 404);
  }

  const hasStoredName = Boolean((user.name || "").trim());
  const hasStoredPhone = Boolean((user.phone || "").trim());

  if (!hasStoredName && nameRaw) {
    return jsonError(
      "El nombre se completa autom\u00e1ticamente al terminar tu primera reserva."
    );
  }

  if (!hasStoredPhone && normalizedPhone) {
    return jsonError(
      "El tel\u00e9fono se completa autom\u00e1ticamente al terminar tu primera reserva."
    );
  }

  if (email !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingUser && existingUser.id !== user.id) {
      return jsonError("Ese correo ya está en uso.", 409);
    }
  }

  let nextPasswordHash: string | undefined;
  if (wantsPasswordChange) {
    nextPasswordHash = await hashPassword(newPassword);
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      name: hasStoredName ? nameRaw || null : user.name,
      phone: hasStoredPhone ? normalizedPhone || null : user.phone,
      ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
    },
  });

  const token = signSession({
    userId: updatedUser.id,
    email: updatedUser.email,
    role: updatedUser.role,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      email: updatedUser.email,
      name: updatedUser.name,
      phone: updatedUser.phone,
    },
    message: "Perfil actualizado.",
  });
  response.cookies.set({
    name: AUTH_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
