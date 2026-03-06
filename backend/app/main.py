from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl
from datetime import date
from typing import Optional, List
from fastapi.middleware.cors import CORSMiddleware
import httpx
import re
from html import unescape
import sqlite3
from pathlib import Path


app = FastAPI(title="Recruit Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ApplicationBase(BaseModel):
    applied_date: date
    source: Optional[str] = None
    company: str
    position_title: str
    location: Optional[str] = None
    work_type: Optional[str] = None
    salary: Optional[str] = None
    applied: bool = False
    status: str = "interested"
    job_description: Optional[str] = None
    job_url: Optional[HttpUrl] = None
    memo: Optional[str] = None


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    applied_date: Optional[date] = None
    source: Optional[str] = None
    company: Optional[str] = None
    position_title: Optional[str] = None
    location: Optional[str] = None
    work_type: Optional[str] = None
    salary: Optional[str] = None
    applied: Optional[bool] = None
    status: Optional[str] = None
    job_description: Optional[str] = None
    job_url: Optional[HttpUrl] = None
    memo: Optional[str] = None


class Application(ApplicationBase):
    id: int


DB_PATH = Path(__file__).resolve().parent.parent / "recruit_tracker.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                applied_date TEXT NOT NULL,
                source TEXT,
                company TEXT NOT NULL,
                position_title TEXT NOT NULL,
                location TEXT,
                work_type TEXT,
                salary TEXT,
                applied INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL,
                job_description TEXT,
                job_url TEXT,
                memo TEXT
            )
            """
        )


init_db()


class ParseFromUrlRequest(BaseModel):
    url: HttpUrl


class ParsedApplication(BaseModel):
    company: Optional[str] = None
    position_title: Optional[str] = None
    job_description: Optional[str] = None


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/applications", response_model=List[Application])
def list_applications():
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                id,
                applied_date,
                source,
                company,
                position_title,
                location,
                work_type,
                salary,
                applied,
                status,
                job_description,
                job_url,
                memo
            FROM applications
            ORDER BY applied_date DESC, id DESC
            """
        ).fetchall()

    applications: List[Application] = []
    for row in rows:
        applications.append(
            Application(
                id=row["id"],
                applied_date=date.fromisoformat(row["applied_date"]),
                source=row["source"],
                company=row["company"],
                position_title=row["position_title"],
                location=row["location"],
                work_type=row["work_type"],
                salary=row["salary"],
                applied=bool(row["applied"]),
                status=row["status"],
                job_description=row["job_description"],
                job_url=row["job_url"],
                memo=row["memo"],
            )
        )
    return applications


@app.get("/applications/{application_id}", response_model=Application)
def get_application(application_id: int):
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT
                id,
                applied_date,
                source,
                company,
                position_title,
                location,
                work_type,
                salary,
                applied,
                status,
                job_description,
                job_url,
                memo
            FROM applications
            WHERE id = ?
            """,
            (application_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Application not found")

    return Application(
        id=row["id"],
        applied_date=date.fromisoformat(row["applied_date"]),
        source=row["source"],
        company=row["company"],
        position_title=row["position_title"],
        location=row["location"],
        work_type=row["work_type"],
        salary=row["salary"],
        applied=bool(row["applied"]),
        status=row["status"],
        job_description=row["job_description"],
        job_url=row["job_url"],
        memo=row["memo"],
    )


@app.post("/applications/parse-from-url", response_model=ParsedApplication)
def parse_from_url(payload: ParseFromUrlRequest):
    try:
        resp = httpx.get(str(payload.url), timeout=10.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {exc}") from exc

    html = resp.text

    title_match = re.search(
        r"<title[^>]*>(.*?)</title>", html, flags=re.IGNORECASE | re.DOTALL
    )
    title = unescape(title_match.group(1)).strip() if title_match else ""

    company: Optional[str] = None
    position: Optional[str] = None

    if title:
        parts = re.split(r"[-|·]", title)
        if len(parts) >= 2:
            company = parts[0].strip()
            position = parts[1].strip()
        else:
            position = title

    cleaned = re.sub(
        r"<(script|style)[^>]*>.*?</\1>",
        "",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    return ParsedApplication(
        company=company,
        position_title=position,
        job_description=cleaned[:8000],
    )


@app.post("/applications", response_model=Application)
def create_application(app_data: ApplicationCreate):
    data = app_data.model_dump()
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO applications (
                applied_date,
                source,
                company,
                position_title,
                location,
                work_type,
                salary,
                applied,
                status,
                job_description,
                job_url,
                memo
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["applied_date"].isoformat(),
                data.get("source"),
                data["company"],
                data["position_title"],
                data.get("location"),
                data.get("work_type"),
                data.get("salary"),
                1 if data.get("applied") else 0,
                data["status"],
                data.get("job_description"),
                str(data.get("job_url")) if data.get("job_url") else None,
                data.get("memo"),
            ),
        )
        app_id = cur.lastrowid

    return Application(id=app_id, **app_data.model_dump())


@app.patch("/applications/{application_id}", response_model=Application)
def update_application(application_id: int, app_data: ApplicationUpdate):
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM applications WHERE id = ?", (application_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Application not found")

        data = app_data.model_dump(exclude_unset=True)
        if not data:
            return get_application(application_id)

        set_parts = []
        values = []
        for key, val in data.items():
            if key == "applied_date":
                set_parts.append("applied_date = ?")
                values.append(val.isoformat())
            elif key == "applied":
                set_parts.append("applied = ?")
                values.append(1 if val else 0)
            elif key == "job_url":
                set_parts.append("job_url = ?")
                values.append(str(val) if val else None)
            else:
                set_parts.append(f"{key} = ?")
                values.append(val)

        values.append(application_id)
        conn.execute(
            f"UPDATE applications SET {', '.join(set_parts)} WHERE id = ?",
            values,
        )
        conn.commit()

    return get_application(application_id)


@app.delete("/applications/{application_id}")
def delete_application(application_id: int):
    with get_connection() as conn:
        cur = conn.execute(
            "DELETE FROM applications WHERE id = ?", (application_id,)
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Application not found")
    return {"ok": True}

