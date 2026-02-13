import { readFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
};

export type PasswordResetEmailMode = "smtp" | "disabled" | "manual" | "dev-log";

type SendPasswordResetEmailResult = {
  delivered: boolean;
  mode: PasswordResetEmailMode;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
};

const DEFAULT_SMTP_PORT = 587;
const PASSWORD_RESET_SUBJECT = "Restablece tu contraseña en UNKT Estudio";
const PASSWORD_RESET_LOGO_CID = "password-reset-logo@unkt";
const PASSWORD_RESET_PATTERN_CID = "password-reset-pattern@unkt";

const isProduction = process.env.NODE_ENV === "production";

const normalizeProvider = (
  value: string | undefined
): Exclude<PasswordResetEmailMode, "dev-log"> | null => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "smtp") return "smtp";
  if (normalized === "disabled") return "disabled";
  if (normalized === "manual") return "manual";
  return null;
};

const parseSmtpPort = (value: string | undefined) => {
  const parsed = Number(value || String(DEFAULT_SMTP_PORT));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_SMTP_PORT;
  }
  return parsed;
};

const getSmtpConfig = (): SmtpConfig | null => {
  const host = process.env.SES_SMTP_HOST?.trim();
  const user = process.env.SES_SMTP_USER?.trim();
  const pass = process.env.SES_SMTP_PASS;
  const from = process.env.PASSWORD_RESET_FROM_EMAIL?.trim();
  const replyTo = process.env.PASSWORD_RESET_REPLY_TO_EMAIL?.trim();

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    user,
    pass,
    from,
    replyTo: replyTo || undefined,
    port: parseSmtpPort(process.env.SES_SMTP_PORT),
  };
};

export const getPasswordResetEmailMode = (): PasswordResetEmailMode => {
  const configuredProvider = normalizeProvider(
    process.env.PASSWORD_RESET_EMAIL_PROVIDER
  );

  if (configuredProvider === "disabled" || configuredProvider === "manual") {
    return configuredProvider;
  }

  if (configuredProvider === "smtp") {
    const smtpConfig = getSmtpConfig();
    if (smtpConfig) {
      return "smtp";
    }

    if (!isProduction) {
      return "dev-log";
    }

    console.warn(
      "[password-reset] PASSWORD_RESET_EMAIL_PROVIDER=smtp but SMTP config is incomplete. Password recovery email is disabled."
    );
    return "disabled";
  }

  if (!isProduction) {
    return "dev-log";
  }

  console.warn(
    "[password-reset] PASSWORD_RESET_EMAIL_PROVIDER is missing or invalid. Password recovery email is disabled in production."
  );
  return "disabled";
};

const escapeHtml = (value: string) => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
};

type InlineAttachment = {
  cid: string;
  filename: string;
  content: Buffer;
  contentType: string;
};

const getInlineAttachment = async (
  relativePath: string,
  cid: string,
  contentType: string
): Promise<InlineAttachment | null> => {
  try {
    const absolutePath = path.join(process.cwd(), "public", relativePath);
    const content = await readFile(absolutePath);
    return {
      cid,
      filename: path.basename(relativePath),
      content,
      contentType,
    };
  } catch (error) {
    console.warn(
      `[password-reset] Could not embed inline email asset "${relativePath}".`,
      error
    );
    return null;
  }
};

const getPasswordResetInlineAttachments = async (): Promise<
  InlineAttachment[]
> => {
  const [logo, pattern] = await Promise.all([
    getInlineAttachment(
      "apple-touch-icon.png",
      PASSWORD_RESET_LOGO_CID,
      "image/png"
    ),
    getInlineAttachment(
      "patron-flores.png",
      PASSWORD_RESET_PATTERN_CID,
      "image/png"
    ),
  ]);

  return [logo, pattern].filter(
    (item): item is InlineAttachment => Boolean(item)
  );
};

const buildResetEmailHtml = (resetUrl: string) => {
  const safeUrl = escapeHtml(resetUrl);
  const safeLogoUrl = escapeHtml(`cid:${PASSWORD_RESET_LOGO_CID}`);
  const safeSecondaryLogoUrl = safeLogoUrl;
  const safePatternUrl = escapeHtml(`cid:${PASSWORD_RESET_PATTERN_CID}`);
  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="dark only" />
        <meta name="supported-color-schemes" content="dark" />
        <title>${PASSWORD_RESET_SUBJECT}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #130a0f; color: #f9edf1;">
        <span
          style="
            display: none;
            visibility: hidden;
            opacity: 0;
            color: transparent;
            height: 0;
            width: 0;
            overflow: hidden;
            mso-hide: all;
          "
        >
          Usa este enlace para restablecer tu contraseña en UNKT Estudio.
        </span>
        <table
          role="presentation"
          width="100%"
          cellspacing="0"
          cellpadding="0"
          border="0"
          style="
            width: 100%;
            background-color: #130a0f;
            background-image:
              radial-gradient(circle at 18% -6%, rgba(255, 79, 195, 0.26), transparent 42%),
              radial-gradient(circle at 84% 2%, rgba(200, 108, 255, 0.18), transparent 38%),
              url('${safePatternUrl}');
            background-repeat: no-repeat, no-repeat, repeat;
            background-size: auto, auto, 1500px auto;
            background-position: left top, right top, center top;
          "
        >
          <tr>
            <td align="center" style="padding: 34px 14px;">
              <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="width: 100%; max-width: 620px;"
              >
                <tr>
                  <td align="center" style="padding: 0 0 18px;">
                    <table
                      role="presentation"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                      style="margin: 0 auto;"
                    >
                      <tr>
                        <td align="left" style="padding: 0; vertical-align: middle;">
                          <img
                            src="${safeLogoUrl}"
                            alt="Logo UNKT Estudio"
                            width="72"
                            height="72"
                            style="
                              display: block;
                              border-radius: 999px;
                              border: 2px solid #cf3f69;
                              box-shadow: 0 14px 28px -18px rgba(0, 0, 0, 0.88);
                            "
                          />
                        </td>
                        <td align="left" style="padding: 0 0 0 12px; vertical-align: middle;">
                          <span
                            style="
                              display: inline-block;
                              border-radius: 999px;
                              border: 1px solid #c95f84;
                              background-color: rgba(207, 63, 105, 0.12);
                              padding: 8px 15px;
                              font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                              font-size: 11px;
                              font-weight: 700;
                              letter-spacing: 0.18em;
                              text-transform: uppercase;
                              color: #f4d6de;
                            "
                          >
                            UNKT ESTUDIO
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td
                    style="
                      overflow: hidden;
                      border-radius: 30px;
                      border: 1px solid #cf3f69;
                      background-color: #180d12;
                      box-shadow: 0 34px 70px -42px rgba(0, 0, 0, 0.92);
                    "
                  >
                    <table
                      role="presentation"
                      width="100%"
                      cellspacing="0"
                      cellpadding="0"
                      border="0"
                    >
                      <tr>
                        <td
                          style="
                            height: 7px;
                            font-size: 0;
                            line-height: 0;
                            background: linear-gradient(90deg, #cf3f69 0%, #e0658b 100%);
                          "
                        >
                          &nbsp;
                        </td>
                      </tr>
                      <tr>
                        <td
                          style="
                            padding: 30px 26px 10px;
                            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                            background-image: url('${safePatternUrl}');
                            background-repeat: repeat;
                            background-size: 980px auto;
                            background-position: center top;
                          "
                        >
                          <h1
                            style="
                              margin: 0 0 14px;
                              font-size: 39px;
                              line-height: 1.1;
                              font-weight: 700;
                              letter-spacing: 0.02em;
                              color: #f9edf1;
                            "
                          >
                            Restablece tu contraseña
                          </h1>
                          <p
                            style="
                              margin: 0;
                              font-size: 16px;
                              line-height: 1.55;
                              color: #ddb5c2;
                            "
                          >
                            Recibimos una solicitud para cambiar la contraseña de tu cuenta.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 22px 26px 0; background-color: #180d12;">
                          <table
                            role="presentation"
                            cellspacing="0"
                            cellpadding="0"
                            border="0"
                            style="width: 100%;"
                          >
                            <tr>
                              <td align="center">
                                <a
                                  href="${safeUrl}"
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  style="
                                    display: inline-block;
                                    min-width: 246px;
                                    border-radius: 999px;
                                    border: 1px solid #ea87ab;
                                    background: linear-gradient(90deg, #cf3f69 0%, #e0658b 100%);
                                    box-shadow: 0 18px 34px -20px rgba(139, 13, 90, 0.92);
                                    padding: 14px 30px;
                                    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                                    font-size: 12px;
                                    font-weight: 700;
                                    letter-spacing: 0.1em;
                                    text-transform: uppercase;
                                    text-decoration: none;
                                    color: #130a0f;
                                  "
                                >
                                  Restablecer contraseña
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td
                          style="
                            padding: 20px 26px 0;
                            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                            background-color: #180d12;
                          "
                        >
                          <p
                            style="
                              margin: 0 0 10px;
                              font-size: 13px;
                              line-height: 1.5;
                              color: #c89ca9;
                            "
                          >
                            Si el botón no funciona, copia y pega este enlace:
                          </p>
                          <p
                            style="
                              margin: 0;
                              border-radius: 14px;
                              border: 1px solid #ba4b73;
                              background-color: #24121a;
                              padding: 12px 14px;
                              font-size: 13px;
                              line-height: 1.45;
                              word-break: break-all;
                            "
                          >
                            <a
                              href="${safeUrl}"
                              target="_blank"
                              rel="noreferrer noopener"
                              style="color: #f3bfd0; text-decoration: underline;"
                            >
                              ${safeUrl}
                            </a>
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td
                          style="
                            padding: 18px 26px 28px;
                            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                            background-color: #180d12;
                          "
                        >
                          <table
                            role="presentation"
                            width="100%"
                            cellspacing="0"
                            cellpadding="0"
                            border="0"
                            style="
                              border-radius: 15px;
                              border: 1px solid #b85279;
                              background-color: #211019;
                            "
                          >
                            <tr>
                              <td
                                style="
                                  padding: 12px 14px;
                                  font-size: 13px;
                                  line-height: 1.45;
                                  color: #f6d8e2;
                                "
                              >
                                El enlace vence en 20 minutos.
                              </td>
                            </tr>
                            <tr>
                              <td
                                style="
                                  border-top: 1px solid #9f3c60;
                                  padding: 12px 14px;
                                  font-size: 13px;
                                  line-height: 1.45;
                                  color: #d4b3be;
                                "
                              >
                                Si no pediste este cambio, ignora este correo.
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td
                    style="
                      padding: 16px 6px 0;
                      text-align: center;
                      font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                      font-size: 11px;
                      line-height: 1.5;
                      color: #c89cab;
                    "
                  >
                    <img
                      src="${safeSecondaryLogoUrl}"
                      alt="UNKT"
                      width="18"
                      height="18"
                      style="
                        display: inline-block;
                        vertical-align: -4px;
                        margin-right: 6px;
                        border-radius: 999px;
                        border: 1px solid #ba4b73;
                      "
                    />
                    Correo automático de UNKT Estudio. Por favor no respondas este mensaje.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

const buildResetEmailText = (resetUrl: string) => {
  return [
    "Recibimos una solicitud para cambiar tu contraseña de UNKT Estudio.",
    "",
    `Abre este enlace para continuar: ${resetUrl}`,
    "",
    "El enlace vence en 20 minutos.",
    "Si no pediste este cambio, ignora este correo.",
    "Correo automático de UNKT Estudio. Por favor no respondas este mensaje.",
  ].join("\n");
};

export const sendPasswordResetEmail = async (
  input: PasswordResetEmailInput
): Promise<SendPasswordResetEmailResult> => {
  const mode = getPasswordResetEmailMode();

  if (mode === "disabled" || mode === "manual") {
    return { delivered: false, mode };
  }

  if (mode === "dev-log") {
    console.info(
      `[password-reset] Email provider not configured. Link for ${input.to}: ${input.resetUrl}`
    );
    return { delivered: false, mode };
  }

  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    if (!isProduction) {
      console.info(
        `[password-reset] SMTP config incomplete. Link for ${input.to}: ${input.resetUrl}`
      );
      return { delivered: false, mode: "dev-log" };
    }

    console.warn(
      "[password-reset] SMTP mode active but SMTP config is incomplete. Password recovery email is disabled."
    );
    return { delivered: false, mode: "disabled" };
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465,
    requireTLS: smtpConfig.port !== 465,
    auth: {
      user: smtpConfig.user,
      pass: smtpConfig.pass,
    },
  });
  const inlineAttachments = await getPasswordResetInlineAttachments();

  await transporter.sendMail({
    from: smtpConfig.from,
    to: input.to,
    replyTo: smtpConfig.replyTo,
    subject: PASSWORD_RESET_SUBJECT,
    text: buildResetEmailText(input.resetUrl),
    html: buildResetEmailHtml(input.resetUrl),
    attachments: inlineAttachments,
  });

  return { delivered: true, mode: "smtp" };
};

