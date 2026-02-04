import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, hashPassword, signSession } from "@/lib/auth";

export const runtime = "nodejs";

type AuthInput = {
  email: string;
  password: string;
  passwordConfirm: string;
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

const getAuthInput = async (request: NextRequest): Promise<AuthInput> => {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Partial<AuthInput>;
    return {
      email: String(body.email || ""),
      password: String(body.password || ""),
      passwordConfirm: String(body.passwordConfirm || ""),
    };
  }

  const formData = await request.formData();
  return {
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
    passwordConfirm: String(formData.get("passwordConfirm") || ""),
  };
};

const isFormRequest = (request: NextRequest) => {
  const contentType = request.headers.get("content-type") || "";
  return (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  );
};

const errorResponse = (
  request: NextRequest,
  message: string,
  status = 400
) => {
  if (isFormRequest(request)) {
    const url = new URL("/register", getBaseUrl(request));
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ error: message }, { status });
};

export async function POST(request: NextRequest) {
  const { email, password, passwordConfirm } = await getAuthInput(request);
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return errorResponse(request, "Correo y contraseña son requeridos.");
  }
  if (!passwordConfirm) {
    return errorResponse(request, "Repite la contraseña.");
  }
  if (password !== passwordConfirm) {
    return errorResponse(request, "Las contraseñas no coinciden.");
  }
  if (password.length < 8) {
    return errorResponse(
      request,
      "La contraseña debe tener al menos 8 caracteres."
    );
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return errorResponse(
      request,
      "La contraseña debe incluir letras y números."
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    return errorResponse(request, "El correo ya está registrado.", 409);
  }

  const isFirstUser = (await prisma.user.count()) === 0;
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      role: isFirstUser ? "admin" : "user",
    },
  });

  const token = signSession({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const redirectPath = user.role === "admin" ? "/admin" : "/account";

  if (isFormRequest(request)) {
    const url = new URL(redirectPath, getBaseUrl(request));
    const response = NextResponse.redirect(url, { status: 303 });
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

  const response = NextResponse.json(
    {
      ok: true,
      redirectTo: redirectPath,
      user: { id: user.id, email: user.email, role: user.role },
    },
    { status: 201 }
  );
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
