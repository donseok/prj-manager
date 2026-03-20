#!/bin/bash
# Supabase DB 마이그레이션 스크립트
# 사용법: npm run db:migrate

set -e

PROJECT_REF="nzhulesyeqdsxbkjbriw"

echo "=== DK Flow DB 마이그레이션 ==="
echo ""

# Supabase CLI 확인
if ! command -v supabase &> /dev/null; then
  echo "❌ Supabase CLI가 설치되어 있지 않습니다."
  echo "   brew install supabase/tap/supabase"
  exit 1
fi

# 로그인 확인
if ! supabase projects list &> /dev/null 2>&1; then
  echo "📌 Supabase 로그인이 필요합니다."
  supabase login
fi

# 프로젝트 연결
if [ ! -f "supabase/.temp/project-ref" ] || [ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "$PROJECT_REF" ]; then
  echo "🔗 Supabase 프로젝트 연결 중..."
  supabase link --project-ref "$PROJECT_REF"
fi

# 마이그레이션 실행 (충돌 시 자동 repair)
echo "🚀 마이그레이션 적용 중..."
if ! supabase db push 2>&1; then
  echo ""
  echo "⚠️  기존 마이그레이션 충돌 감지 — 자동 repair 후 재시도..."
  for f in supabase/migrations/*.sql; do
    ts=$(basename "$f" | grep -oE '^[0-9]+')
    supabase migration repair "$ts" --status applied 2>/dev/null || true
  done
  # 마지막 마이그레이션만 다시 reverted → push
  LAST_TS=$(ls supabase/migrations/*.sql | sort | tail -1 | xargs basename | grep -oE '^[0-9]+')
  supabase migration repair "$LAST_TS" --status reverted 2>/dev/null || true
  supabase db push
fi

echo ""
echo "✅ 마이그레이션 완료!"
