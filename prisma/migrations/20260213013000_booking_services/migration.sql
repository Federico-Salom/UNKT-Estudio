-- Add services payload storage for reservations
ALTER TABLE "Booking"
ADD COLUMN "services" TEXT NOT NULL DEFAULT '[]';
