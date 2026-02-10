UPDATE "AvailabilitySlot"
SET "status" = 'available'
WHERE "status" NOT IN ('available', 'booked');
