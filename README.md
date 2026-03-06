# Recruit Tracker Web

> **GitHub**: [leejh0820/recruit-tracker-web](https://github.com/leejh0820/recruit-tracker-web)

개인/친구들이 함께 쓸 수 있는 **채용 지원 현황 관리 웹앱**입니다.  
URL과 공고 텍스트를 붙여넣으면 날짜·출처·위치·근무형태 등을 최대한 자동으로 채워주고,  
지원 리스트/상세 페이지에서 깔끔하게 확인할 수 있습니다.

---

## 1. 기술 스택

- **Frontend**
  - Next.js (App Router, TypeScript)
  - Custom CSS (Cloud Dancer 기반 파스텔 팔레트)
- **Backend**
  - FastAPI
  - SQLite (로컬 영구 저장)
- **기타**
  - REST API (JSON)

---

## 2. 주요 기능

- **지원 등록**
  - 오늘 날짜 자동 입력 (수정 가능)
  - 회사 / 포지션 / 위치 / 근무형태 / 연봉 / 단계 / 지원 여부 / URL / 공고 내용
- **반자동 입력 보조**
  - 공고 URL에서 화면 HTML을 가져와
    - 회사/직무 후보
    - 공고 전체 텍스트
  - 공고 텍스트 분석으로
    - 위치(도시/구)
    - 근무형태(정규직/인턴/리모트)
  - 출처(source)를 도메인으로부터 추론
    - `rememberapp` → 리멤버, `wanted.co.kr` → 원티드 등
- **리스트 & 상세 페이지**
  - 최근 지원 순 리스트
  - **검색**: 회사·직무 텍스트로 필터
  - **필터**: 단계(status)별 보기
  - **정렬**: 최신순 / 오래된순
  - 행 클릭 시 상세 페이지로 이동
  - 공고 텍스트를 섹션 키워드(`주요업무`, `자격요건` 등)와 문장 길이에 따라 자동 분할해 가독성 높임

---

## 3. 로컬 실행 방법

### 3-1. 백엔드 (FastAPI + SQLite)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows라면 .venv\Scripts\activate
pip install fastapi "uvicorn[standard]" httpx

uvicorn app.main:app --reload
```

- 기본 주소: `http://127.0.0.1:8000`
- 헬스체크: `GET /health`
- 문서: `http://127.0.0.1:8000/docs`
- DB 파일: `backend/../recruit_tracker.db` (자동 생성)

### 3-2. 프론트엔드 (Next.js)

```bash
cd frontend
npm install
npm run dev
```

- 기본 주소: `http://localhost:3000`
- 백엔드 주소는 현재 `src/app/page.tsx` 에서 `http://127.0.0.1:8000` 로 고정되어 있음

---

## 4. API 개요

- `GET /health`  
  - 서버 상태 체크
- `GET /applications`  
  - 전체 지원 리스트 반환 (최신 날짜 순)
- `GET /applications/{id}`  
  - 단일 지원 상세
- `POST /applications`  
  - 지원 생성
  - 요청 바디: `ApplicationCreate` (날짜, 회사, 포지션 등)
- `POST /applications/parse-from-url`  
  - `{ "url": "..." }`를 보내면
    - `company`, `position_title`, `job_description` 후보를 반환

---

## 5. 프로젝트 구조

```text
recruit-tracker-web/
  backend/
    app/
      main.py
    .venv/              # .gitignore 제외
    recruit_tracker.db  # .gitignore 제외 (로컬 DB)
  frontend/
    src/app/...
  updates/
    2026-03-05-initial.md
    2026-03-05-search-filter-sort.md
  .gitignore
  README.md
```

---

## 6. 업데이트 로그 & TODO

업데이트 내역과 앞으로의 개선 아이디어는 `updates/` 폴더에 날짜별 마크다운 파일로 쌓아갑니다.

### 현재까지 구현

- FastAPI + SQLite 기반 Application CRUD
- Next.js 기반 UI (Cloud Dancer 팔레트)
- URL/텍스트 기반 자동 채우기
- 상세 페이지에서 공고 텍스트 자동 문단화

### 다음으로 고려 중인 개선점 (초안)

- 리멤버/원티드 등 **사이트별 전용 파서** 추가
  - `공고소개 / 주요업무 / 자격요건 / 우대사항 / 복지 / 채용절차` 등을 카드로 분리
- **검색/필터/정렬**
  - 회사/직무 텍스트 검색
  - 단계별(status) 필터
  - 날짜 기준 정렬
- **배포 준비**
  - SQLite → Postgres 마이그레이션
  - FastAPI: Render / Railway
  - Next.js: Vercel

---

## 7. GitHub

- **리포**: [leejh0820/recruit-tracker-web](https://github.com/leejh0820/recruit-tracker-web)
- 크롬 확장 버전(`recruit-tracker`)과 구분되는 웹앱 버전입니다.

