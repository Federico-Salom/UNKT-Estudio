#!/bin/sh
set -e

mkdir -p /app/database
chown -R nextjs:nodejs /app/database 2>/dev/null || true

exec su-exec nextjs sh -c "./node_modules/.bin/prisma migrate deploy && ./node_modules/.bin/next start -p ${PORT:-3000}"
