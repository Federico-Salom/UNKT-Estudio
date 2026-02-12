import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  createPasswordResetToken,
  getPasswordResetExpiration,
  hashPasswordResetToken,
} from "@/lib/password-recovery";
import { sendPasswordResetEmail } from "@/lib/password-reset-email";

export const runtime = "nodejs";

type RequestInput = {
  email: string;
};

type SQLiteCountRow = {
  count: bigint | number | string;
};

const GENERIC_SUCCESS_MESSAGE =
  "Si existe una cuenta con ese correo, enviamos instrucciones para recuperar la contrasena.";
const PASSWORD_RESET_REQUEST_WINDOW_MINUTES = 15;
const PASSWORD_RESET_MAX_REQUESTS_BY_IP = 10;
const PASSWORD_RESET_MAX_REQUESTS_BY_EMAIL = 3;
const PASSWORD_RESET_LOG_RETENTION_HOURS = 24;

const isMissingResetTableError = (error: unknown) => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
};

const getBaseUrl = (request: NextRequest) => {
  const parsed = new URL(request.url);
  const host = request.headers.get("host") || parsed.host;
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1");
  const protocol = isLocal
    ? "http"
    : forwardedProto || parsed.protocol.replace(":", "");
  return `${protocol}://${host}`;
};

const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
};

const toCount = (value: bigint | number | string | undefined) => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
};

const isEmailFormatValid = (value: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

const ensureRateLimitTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PasswordResetRequest" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "ipAddress" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PasswordResetRequest_createdAt_idx"
    ON "PasswordResetRequest" ("createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PasswordResetRequest_email_createdAt_idx"
    ON "PasswordResetRequest" ("email", "createdAt")
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PasswordResetRequest_ipAddress_createdAt_idx"
    ON "PasswordResetRequest" ("ipAddress", "createdAt")
  `);
};

const isRateLimited = async (email: string, ipAddress: string) => {
  await ensureRateLimitTable();

  const windowModifier = `-${PASSWORD_RESET_REQUEST_WINDOW_MINUTES} minutes`;
  const retentionModifier = `-${PASSWORD_RESET_LOG_RETENTION_HOURS} hours`;

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `
        DELETE FROM "PasswordResetRequest"
        WHERE "createdAt" < datetime('now', ?)
      `,
      retentionModifier
    );

    const ipRows = await tx.$queryRawUnsafe<SQLiteCountRow[]>(
      `
        SELECT COUNT(*) AS count
        FROM "PasswordResetRequest"
        WHERE "ipAddress" = ?
          AND "createdAt" >= datetime('now', ?)
      `,
      ipAddress,
      windowModifier
    );

    const emailRows = await tx.$queryRawUnsafe<SQLiteCountRow[]>(
      `
        SELECT COUNT(*) AS count
        FROM "PasswordResetRequest"
        WHERE "email" = ?
          AND "createdAt" >= datetime('now', ?)
      `,
      email,
      windowModifier
    );

    await tx.$executeRawUnsafe(
      `
        INSERT INTO "PasswordResetRequest" ("id", "email", "ipAddress", "createdAt")
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `,
      randomUUID(),
      email,
      ipAddress
    );

    const ipCount = toCount(ipRows[0]?.count);
    const emailCount = toCount(emailRows[0]?.count);

    return (
      ipCount >= PASSWORD_RESET_MAX_REQUESTS_BY_IP ||
      emailCount >= PASSWORD_RESET_MAX_REQUESTS_BY_EMAIL
    );
  });
};

const parseBody = async (request: NextRequest): Promise<RequestInput> => {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Partial<RequestInput>;
    return { email: String(body.email || "") };
  }

  const formData = await request.formData();
  return { email: String(formData.get("email") || "") };
};

export async function POST(request: NextRequest) {
  try {
    const { email } = await parseBody(request);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !isEmailFormatValid(normalizedEmail)) {
      return NextResponse.json(
        { error: "Escribe un correo valido." },
        { status: 400 }
      );
    }

    const ipAddress = getClientIp(request);
    const limited = await isRateLimited(normalizedEmail, ipAddress);
    if (limited) {
      return NextResponse.json(
        { ok: true, message: GENERIC_SUCCESS_MESSAGE },
        { status: 200 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (user) {
      const resetToken = createPasswordResetToken();
      const tokenHash = hashPasswordResetToken(resetToken);
      const expiresAt = getPasswordResetExpiration();

      const createdToken = await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      });

      await prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          id: { not: createdToken.id },
        },
      });

      const resetUrl = `${getBaseUrl(request)}/reset?token=${encodeURIComponent(resetToken)}`;

      try {
        await sendPasswordResetEmail({
          to: normalizedEmail,
          resetUrl,
        });
      } catch (error) {
        console.error("Failed to send password reset email:", error);
        await prisma.passwordResetToken
          .delete({ where: { id: createdToken.id } })
          .catch(() => null);
      }
    }

    return NextResponse.json(
      { ok: true, message: GENERIC_SUCCESS_MESSAGE },
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

    console.error("Password recovery request failed:", error);
    return NextResponse.json(
      { error: "No se pudo iniciar la recuperacion de contrasena." },
      { status: 500 }
    );
  }
}
