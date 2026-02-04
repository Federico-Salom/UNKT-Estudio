import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, signSession, verifyPassword } from "@/lib/auth";

export const runtime = "nodejs";

type AuthInput = {
  email: string;
  password: string;
};

const getAuthInput = async (request: NextRequest): Promise<AuthInput> => {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as Partial<AuthInput>;
    return {
      email: String(body.email || ""),
      password: String(body.password || ""),
    };
  }

  const formData = await request.formData();
  return {
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
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
    const url = new URL("/login", request.url);
    url.searchParams.set("error", message);
    return NextResponse.redirect(url, { status: 303 });
  }
  return NextResponse.json({ error: message }, { status });
};

export async function POST(request: NextRequest) {
  const { email, password } = await getAuthInput(request);
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !password) {
    return errorResponse(request, "Correo y contraseña son requeridos.");
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return errorResponse(request, "Credenciales inválidas.", 401);
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return errorResponse(request, "Credenciales inválidas.", 401);
  }

  const token = signSession({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const redirectPath = user.role === "admin" ? "/admin" : "/account";

  if (isFormRequest(request)) {
    const url = new URL(redirectPath, request.url);
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
    { status: 200 }
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
