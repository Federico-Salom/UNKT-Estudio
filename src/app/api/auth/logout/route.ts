import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-errors";
import { AUTH_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set({
      name: AUTH_COOKIE,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return handleApiError("api/auth/logout", error, {
      defaultMessage: "No se pudo cerrar sesion.",
    });
  }
}
