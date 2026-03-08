#!/bin/bash
# recruit-tracker-web 실행 스크립트
# 터미널 1: ./run.sh backend
# 터미널 2: ./run.sh frontend

cd "$(dirname "$0")"

case "${1:-}" in
  backend)
    echo "백엔드 시작: http://127.0.0.1:8000"
    cd backend && (source .venv/bin/activate 2>/dev/null || true) && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
    ;;
  frontend)
    echo "프론트엔드 시작: http://localhost:3000"
    cd frontend && npm run dev
    ;;
  *)
    echo "사용법:"
    echo "  터미널 1: ./run.sh backend"
    echo "  터미널 2: ./run.sh frontend"
    echo ""
    echo "또는 수동 실행:"
    echo "  cd backend && source .venv/bin/activate && python -m uvicorn app.main:app --reload --port 8000"
    echo "  cd frontend && npm run dev"
    ;;
esac
