#!/bin/bash
# Test migration system health

echo "🔍 Testing Migration System Health"
echo "=================================="
echo ""

echo "1. Testing DEV database..."
node scripts/run-with-env.js .env.dev.migrate node scripts/test-shadow-db.js
if [ $? -ne 0 ]; then
  echo "❌ DEV database has migration issues"
  exit 1
fi

echo ""
echo "2. Testing PROD database..."
node scripts/run-with-env.js .env.prod.migrate node scripts/test-shadow-db.js
if [ $? -ne 0 ]; then
  echo "❌ PROD database has migration issues"
  exit 1
fi

echo ""
echo "3. Checking migration status..."
echo "   DEV:"
node scripts/run-with-env.js .env.dev.migrate npx prisma migrate status --schema=prisma/schema.prisma 2>&1 | tail -3
echo ""
echo "   PROD:"
node scripts/run-with-env.js .env.prod.migrate npx prisma migrate status --schema=prisma/schema.prisma 2>&1 | tail -3

echo ""
echo "✅ All migration system checks passed!"
echo "✅ You can safely run 'npm run db:dev:migrate' for new migrations"
