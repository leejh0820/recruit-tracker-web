# 2026-03-05 - 검색·필터·정렬 & 정리

## 변경 사항

### 1. 지원 리스트 검색·필터·정렬

- **검색**: 회사명·직무/포지션 텍스트로 실시간 필터
- **필터**: 단계(status) 드롭다운 — 전체 / 관심 / 지원완료 / OA / 1차면접 / 2차면접 / 오퍼 / 리젝트
- **정렬**: 최신순 / 오래된순 (날짜 기준)

### 2. 버그 수정

- `autoFillFromUrl`에서 `prev` 참조 오류 수정 → `form` 사용

### 3. 프로젝트 정리

- **루트 `.gitignore`** 추가
  - `backend/.venv/`, `__pycache__/`, `recruit_tracker.db`
  - `frontend/node_modules/`, `.next/`
  - `.DS_Store`, `.env` 등
- **README** 업데이트
  - GitHub 링크 추가
  - 검색·필터·정렬 기능 설명
  - 프로젝트 구조 정리

### 4. 폴더/리포 이름

- `recruit-tracker` → `recruit-tracker-web` (크롬 확장 `recruit-tracker`와 구분)

---

## 다음 개선 후보

- 리멤버 전용 섹션 카드 (공고소개/주요업무/자격요건 등 카드 분리)
- 배포 (Postgres + Render + Vercel)
- 지원 수정/삭제 API & UI
