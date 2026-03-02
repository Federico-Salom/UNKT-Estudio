import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "unkt_session";

export class AuthConfigError extends Error {
  constructor(message = "AUTH_SECRET is not configured.") {
    super(message);
    this.name = "AuthConfigError";
  }
}

export type SessionPayload = {
  userId: string;
  email: string;
  role: string;
};

const getAuthSecret = () => {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new AuthConfigError();
  }
  return secret;
};

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, 10);
};

export const verifyPassword = async (password: string, hash: string) => {
  return bcrypt.compare(password, hash);
};

export const signSession = (payload: SessionPayload) => {
  return jwt.sign(payload, getAuthSecret(), { expiresIn: "7d" });
};

export const verifySession = (token: string): SessionPayload | null => {
  try {
    return jwt.verify(token, getAuthSecret()) as SessionPayload;
  } catch {
    return null;
  }
};

export const getSessionFromCookies = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
};
