import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { hashPasswordResetToken } from "@/lib/password-recovery";

export const runtime = "nodejs";

type ResetInput = {
  token: string;
  password: string;
  passwordConfirm: string;
};

const isMissingResetTableError = (error: unknown) => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
};

const hasLettersAndNumbers = (value: string) => {
  return /[a-zA-Z]/.test(value) && /\d/.test(value);
};

const parseBody = async (request: NextRequest): Promise<ResetInput> => {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Partial<ResetInput>;
    return {
      token: String(body.token || ""),
      password: String(body.password || ""),
      passwordConfirm: String(body.passwordConfirm || ""),
    };
  }

  const formData = await request.formData();
  return {
    token: String(formData.get("token") || ""),
    password: String(formData.get("password") || ""),
    passwordConfirm: String(formData.get("passwordConfirm") || ""),
  };
};

export async function POST(request: NextRequest) {
  try {
    const { token, password, passwordConfirm } = await parseBody(request);
    const normalizedToken = token.trim();

    if (!normalizedToken || !password || !passwordConfirm) {
      return NextResponse.json(
        { error: "Completa todos los campos requeridos." },
        { status: 400 }
      );
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { error: "Las contrasenas no coinciden." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contrasena debe tener al menos 8 caracteres." },
        { status: 400 }
      );
    }

    if (!hasLettersAndNumbers(password)) {
      return NextResponse.json(
        { error: "La contrasena debe incluir letras y numeros." },
        { status: 400 }
      );
    }

    const tokenHash = hashPasswordResetToken(normalizedToken);
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    const now = new Date();
    if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
      return NextResponse.json(
        { error: "El enlace de recuperacion es invalido o vencio." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: now },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          id: { not: resetToken.id },
        },
      }),
    ]);

    return NextResponse.json(
      { ok: true, message: "Contrasena actualizada. Ya puedes iniciar sesion." },
      { status: 200 }
    );
  } catch (error) {
    if (isMissingResetTableError(error)) {
      return NextResponse.json(
        {
          error:
            "La base de datos no esta actualizada para recuperar contrasena. Ejecuta las migraciones de Prisma.",
        },
        { status: 503 }
      );
    }

    console.error("Password reset failed:", error);
    return NextResponse.json(
      { error: "No se pudo restablecer la contrasena." },
      { status: 500 }
    );
  }
}
