import { createHash, randomBytes } from "crypto";

const PASSWORD_RESET_TOKEN_BYTES = 32;
export const PASSWORD_RESET_TTL_MINUTES = 20;

export const normalizePasswordResetToken = (value: string) => {
  return value.trim();
};

export const createPasswordResetToken = () => {
  return randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
};

export const hashPasswordResetToken = (value: string) => {
  return createHash("sha256")
    .update(normalizePasswordResetToken(value))
    .digest("hex");
};

export const getPasswordResetExpiration = () => {
  return new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);
};
