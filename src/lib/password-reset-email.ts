type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
};

type SendPasswordResetEmailResult = {
  delivered: boolean;
};

const RESEND_API_URL = "https://api.resend.com/emails";

const escapeHtml = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

const buildResetEmailHtml = (resetUrl: string) => {
  const safeUrl = escapeHtml(resetUrl);
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #171717;">
      <h2 style="margin: 0 0 12px;">Restablecer contrasena</h2>
      <p style="margin: 0 0 12px;">
        Recibimos una solicitud para cambiar tu contrasena de UNKT Estudio.
      </p>
      <p style="margin: 0 0 12px;">
        Abre este enlace para continuar:
      </p>
      <p style="margin: 0 0 16px;">
        <a href="${safeUrl}" target="_blank" rel="noreferrer noopener">${safeUrl}</a>
      </p>
      <p style="margin: 0 0 4px;">
        Si no pediste este cambio, ignora este correo.
      </p>
      <p style="margin: 0;">
        El enlace vence en 20 minutos.
      </p>
    </div>
  `;
};

export const sendPasswordResetEmail = async (
  input: PasswordResetEmailInput
): Promise<SendPasswordResetEmailResult> => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.PASSWORD_RESET_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.PASSWORD_RESET_REPLY_TO_EMAIL;

  if (!resendApiKey || !from) {
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[password-reset] Missing RESEND_API_KEY/PASSWORD_RESET_FROM_EMAIL. Link for ${input.to}: ${input.resetUrl}`
      );
      return { delivered: false };
    }
    throw new Error("Password reset email provider is not configured.");
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      reply_to: replyTo || undefined,
      subject: "Restablece tu contrasena en UNKT Estudio",
      html: buildResetEmailHtml(input.resetUrl),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(
      `Failed to send password reset email (${response.status}): ${details}`
    );
  }

  return { delivered: true };
};
