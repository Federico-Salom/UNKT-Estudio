CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PasswordResetRequest_createdAt_idx" ON "PasswordResetRequest"("createdAt");
CREATE INDEX "PasswordResetRequest_email_createdAt_idx" ON "PasswordResetRequest"("email", "createdAt");
CREATE INDEX "PasswordResetRequest_ipAddress_createdAt_idx" ON "PasswordResetRequest"("ipAddress", "createdAt");
