#!/bin/bash

# VEX Platform - Agent Quick Health Check
# فحص سريع لحالة النظام (30 ثانية)

set -e

echo "🏥 فحص سريع لحالة نظام VEX Platform"
echo "========================================"

# الألوان
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

check_status=0

# 1. فحص package.json
echo -n "📦 فحص package.json... "
if [ -f "package.json" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  check_status=1
fi

# 2. فحص tsconfig.json
echo -n "⚙️  فحص tsconfig.json... "
if [ -f "tsconfig.json" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  check_status=1
fi

# 3. فحص ملفات الإعدادات
echo -n "🔧 فحص ملفات الإعدادات... "
missing=0
for file in "vite.config.ts" "drizzle.config.ts" "tailwind.config.ts"; do
  if [ ! -f "$file" ]; then
    missing=$((missing + 1))
  fi
done

if [ $missing -eq 0 ]; then
  echo -e "${GREEN}✓ (جميع الملفات موجودة)${NC}"
else
  echo -e "${YELLOW}⚠ ($missing ملف مفقود)${NC}"
fi

# 4. فحص المجلدات الرئيسية
echo -n "📁 فحص بنية المشروع... "
missing_dirs=0
for dir in "client" "server" "shared" "script"; do
  if [ ! -d "$dir" ]; then
    missing_dirs=$((missing_dirs + 1))
  fi
done

if [ $missing_dirs -eq 0 ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗ ($missing_dirs مجلد مفقود)${NC}"
  check_status=1
fi

# 5. فحص node_modules
echo -n "📚 فحص التبعيات... "
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${YELLOW}⚠ (يحتاج npm install)${NC}"
fi

# 6. فحص .env (وجوده فقط)
echo -n "🔐 فحص ملف البيئة... "
if [ -f ".env" ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${YELLOW}⚠ (ملف .env مفقود)${NC}"
fi

echo ""
echo "========================================"

if [ $check_status -eq 0 ]; then
  echo -e "${GREEN}✅ كل شيء على ما يرام!${NC}"
  exit 0
else
  echo -e "${RED}❌ توجد مشاكل تحتاج إلى مراجعة${NC}"
  exit 1
fi
