import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { AuthConfigError } from "@/lib/auth";

export type NormalizedApiError = {
  status: number;
  message: string;
  code: string;
};

type LogContext = Record<string, unknown>;

const DEFAULT_INTERNAL_ERROR_MESSAGE =
  "No pudimos procesar la solicitud. Intenta nuevamente.";
const AUTH_CONFIG_ERROR_MESSAGE =
  "No se puede iniciar sesion en este momento. Contacta al equipo.";
const DATABASE_UNAVAILABLE_MESSAGE =
  "La base de datos no esta disponible. Intenta nuevamente en unos minutos.";
const DATABASE_ERROR_CODES = new Set(["P1000", "P1001", "P1002", "P1017"]);

const toLoggableError = (error: unknown) => {
  if (error instanceof Error) {
    const codedError = error as Error & { code?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: codedError.code,
    };
  }

  return error;
};

const isDatabaseUnavailableError = (error: unknown) => {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return true;
  }

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    DATABASE_ERROR_CODES.has(error.code)
  );
};

export const resolveApiError = (
  error: unknown,
  defaultMessage = DEFAULT_INTERNAL_ERROR_MESSAGE
): NormalizedApiError => {
  if (error instanceof AuthConfigError) {
    return {
      status: 503,
      message: AUTH_CONFIG_ERROR_MESSAGE,
      code: "AUTH_CONFIG_ERROR",
    };
  }

  if (isDatabaseUnavailableError(error)) {
    return {
      status: 503,
      message: DATABASE_UNAVAILABLE_MESSAGE,
      code: "DATABASE_UNAVAILABLE",
    };
  }

  return {
    status: 500,
    message: defaultMessage,
    code: "INTERNAL_ERROR",
  };
};

export const logApiError = (
  scope: string,
  error: unknown,
  normalized: NormalizedApiError,
  context?: LogContext
) => {
  console.error(`[${scope}]`, {
    ...context,
    status: normalized.status,
    code: normalized.code,
    error: toLoggableError(error),
  });
};

export const jsonApiError = (
  message: string,
  status = 400,
  code?: string
) => {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(code ? { code } : {}),
    },
    { status }
  );
};

export const handleApiError = (
  scope: string,
  error: unknown,
  options?: {
    defaultMessage?: string;
    context?: LogContext;
  }
) => {
  const normalized = resolveApiError(error, options?.defaultMessage);
  logApiError(scope, error, normalized, options?.context);
  return jsonApiError(normalized.message, normalized.status, normalized.code);
};

export const safeJsonBody = async <T extends Record<string, unknown>>(
  request: Request
): Promise<Partial<T>> => {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
};
