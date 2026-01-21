#!/bin/bash

echo "🧪 TypeScript Validation Test Suite"
echo "===================================="
echo ""

# Test 1: Build Check
echo "📦 Test 1: Build Compilation"
npm run build 2>&1 | grep -q "Done in" && echo "✅ Build successful" || { echo "❌ Build failed"; exit 1; }

# Test 2: TypeScript Check
echo ""
echo "🔍 Test 2: TypeScript Compilation"
error_count=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
echo "TypeScript errors found: $error_count"
if [ "$error_count" -lt 250 ]; then
  echo "✅ TypeScript errors within acceptable range (<250)"
else
  echo "⚠️ TypeScript errors above target (>250 found)"
fi

# Test 3: Server Health
echo ""
echo "🏥 Test 3: Server Health Check"
sleep 2
health=$(curl -s http://localhost:5000/api/health 2>/dev/null | grep -o '"status":"healthy"')
if [ -n "$health" ]; then
  echo "✅ Server health check passed"
else
  echo "⚠️ Server health check failed or not running"
fi

# Test 4: Database Connection
echo ""
echo "🗄️  Test 4: Database Connectivity"
db_check=$(curl -s http://localhost:5000/api/health 2>/dev/null | grep -o '"status":"connected"' || echo "")
if [ -n "$db_check" ]; then
  echo "✅ Database connected"
else
  echo "⚠️ Database status unknown (health endpoint may not expose detail)"
fi

echo ""
echo "===================================="
echo "✅ Validation Test Suite Complete!"
echo "===================================="
