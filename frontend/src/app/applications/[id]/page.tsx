"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Application = {
  id: number;
  applied_date: string;
  source?: string | null;
  company: string;
  position_title: string;
  location?: string | null;
  work_type?: string | null;
  salary?: string | null;
  applied: boolean;
  status: string;
  job_description?: string | null;
  job_url?: string | null;
  memo?: string | null;
};

const apiBase = "/api";

const formatBlocks = (text: string): string[] => {
  if (!text) return [];

  // 1단계: 섹션 헤더 앞에 줄바꿈 (문장 중간 '성장'·'가족' 등은 제외)
  const headingTokens =
    "(공고소개|주요업무|담당업무|주요 업무|역할|자격요건|자격 요건|지원자격|우대사항|우대 사항|채용절차|채용 절차|기타안내|복지 제도|복리후생|근무조건|근무 조건|일과 건강|음식과 건강|생활 복지)";
  let normalized = text.replace(/\r\n/g, "\n");
  normalized = normalized.replace(/\[\s*채용\s*절차\s*\]/g, "\n채용절차\n");
  normalized = normalized.replace(
    new RegExp(headingTokens, "g"),
    "\n$1\n",
  );

  // HTML 엔티티 일부 정리
  normalized = normalized
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

  const lines = normalized.split("\n").map((l) => l.trim());

  const blocks: string[] = [];
  let current = "";
  const headingRegex = new RegExp(
    `^${headingTokens}`,
  );

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current) {
        blocks.push(current.trim());
        current = "";
      }
      continue;
    }

    if (headingRegex.test(line)) {
      if (current) {
        blocks.push(current.trim());
        current = "";
      }
      blocks.push(line);
      continue;
    }

    const isBullet = /^[-•·▪︎]/.test(line);
    if (isBullet) {
      if (current) {
        blocks.push(current.trim());
        current = "";
      }
      blocks.push(line);
      continue;
    }

    // 마침표·따옴표·물음표 뒤에서 문장 경계를 나누어 너무 긴 문단 방지
    current += (current ? " " : "") + line;
    if (/[.?!]("|”)?$/.test(line) && current.length > 80) {
      blocks.push(current.trim());
      current = "";
    }
  }

  if (current) {
    blocks.push(current.trim());
  }

  return blocks;
};

const HEADING_REGEX =
  /^(공고소개|주요업무|담당업무|주요 업무|역할|자격요건|자격 요건|지원자격|우대사항|우대 사항|채용절차|채용 절차|기타안내|복지 제도|복리후생|근무조건|근무 조건|일과 건강|음식과 건강|생활 복지)/;

type JDSection = { title: string; items: string[] };

function groupBlocksIntoSections(blocks: string[]): JDSection[] {
  const sections: JDSection[] = [];
  let current: JDSection = { title: "공고 내용", items: [] };
  let tocHeadings: string[] = [];
  let lastPushedTitle = "";

  for (const block of blocks) {
    const isHeading = HEADING_REGEX.test(block);

    if (isHeading) {
      if (current.items.length > 0) {
        sections.push(current);
        lastPushedTitle = current.title;
        if (block === current.title) {
          current = { title: block, items: [] };
          tocHeadings = [];
          continue;
        }
        current = { title: block, items: [] };
        tocHeadings = [];
      } else if (block === lastPushedTitle) {
        continue;
      } else {
        tocHeadings = tocHeadings.length === 0 ? [block] : [...tocHeadings, block];
        current = { title: block, items: [] };
      }
    } else {
      if (tocHeadings.length > 0) {
        current = { title: tocHeadings[0], items: [block] };
        tocHeadings = [];
      } else {
        current.items.push(block);
      }
    }
  }
  if (current.items.length > 0 || current.title) {
    sections.push(current);
  }
  return sections;
}

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string | boolean>>({});

  const blocks = useMemo(() => {
    if (!application) return [];
    const raw = application.job_description || application.memo || "";
    return formatBlocks(raw);
  }, [application]);

  const sections = useMemo(
    () => groupBlocksIntoSections(blocks),
    [blocks]
  );

  useEffect(() => {
    const fetchApplication = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/applications/${params.id}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch application (${res.status})`);
        }
        const data: Application = await res.json();
        setApplication(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchApplication();
    }
  }, [params.id]);

  useEffect(() => {
    if (application && isEditing) {
      setEditForm({
        applied_date: application.applied_date,
        source: application.source || "",
        company: application.company,
        position_title: application.position_title,
        location: application.location || "",
        work_type: application.work_type || "",
        salary: application.salary || "",
        applied: application.applied,
        status: application.status,
        job_description: application.job_description || "",
        job_url: application.job_url || "",
        memo: application.memo || "",
      });
    }
  }, [application, isEditing]);

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!application) return;
    try {
      setError(null);
      const payload: Record<string, unknown> = {
        applied_date: editForm.applied_date,
        source: (editForm.source as string) || undefined,
        company: editForm.company,
        position_title: editForm.position_title,
        location: (editForm.location as string) || undefined,
        work_type: (editForm.work_type as string) || undefined,
        salary: (editForm.salary as string) || undefined,
        applied: editForm.applied,
        status: editForm.status,
        job_description: (editForm.job_description as string) || undefined,
        job_url: (editForm.job_url as string) || undefined,
        memo: (editForm.memo as string) || undefined,
      };
      const res = await fetch(`${apiBase}/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`수정 실패 (${res.status})`);
      const updated = await res.json();
      setApplication(updated);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 중 오류");
    }
  };

  const handleDelete = async () => {
    if (!application) return;
    if (!confirm("정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    try {
      setError(null);
      const res = await fetch(`${apiBase}/applications/${application.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`삭제 실패 (${res.status})`);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 중 오류");
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: 900 }}>
      <section className="card card--muted">
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => router.push("/")}
            className="btn-ghost"
          >
            ← 목록으로
          </button>
          {application && (
            <>
              <button
                onClick={() => setIsEditing((v) => !v)}
                className="btn"
              >
                {isEditing ? "취소" : "수정"}
              </button>
              <button
                onClick={handleDelete}
                className="btn"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                삭제
              </button>
            </>
          )}
        </div>

        {loading ? (
          <p className="card-caption">불러오는 중...</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : !application ? (
          <p className="card-caption">데이터가 없습니다.</p>
        ) : (
          <>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 650,
                marginBottom: 6,
              }}
            >
              {application.company} · {application.position_title}
            </h1>
            <p
              style={{
                marginBottom: 10,
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              {application.applied_date} · {application.location || "-"} ·{" "}
              {application.work_type || "-"} · 단계: {application.status}
            </p>

            {application.job_url && (
              <p style={{ marginBottom: 14 }}>
                <a
                  href={application.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-muted"
                >
                  공고 링크 열기
                </a>
              </p>
            )}

            {isEditing ? (
              <form onSubmit={handleUpdate} className="form-grid" style={{ marginTop: 16 }}>
                <label className="field">
                  <span className="field-label">날짜</span>
                  <input
                    className="input"
                    type="date"
                    value={String(editForm.applied_date || "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, applied_date: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span className="field-label">출처</span>
                  <input
                    className="input"
                    type="text"
                    value={String(editForm.source || "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, source: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span className="field-label">회사 *</span>
                  <input
                    className="input"
                    type="text"
                    value={String(editForm.company || "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, company: e.target.value }))}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">직무/포지션 *</span>
                  <input
                    className="input"
                    type="text"
                    value={String(editForm.position_title || "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, position_title: e.target.value }))}
                    required
                  />
                </label>
                <label className="field">
                  <span className="field-label">위치</span>
                  <input
                    className="input"
                    type="text"
                    value={String(editForm.location || "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span className="field-label">근무형태</span>
                  <input
                    className="input"
                    type="text"
                    value={String(editForm.work_type || "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, work_type: e.target.value }))}
                  />
                </label>
                <label className="field">
                  <span className="field-label">연봉/페이</span>
                  <input
                    className="input"
                    type="text"
                    value={String(editForm.salary || "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, salary: e.target.value }))}
                  />
                </label>
                <label className="field" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(editForm.applied)}
                    onChange={(e) => setEditForm((p) => ({ ...p, applied: e.target.checked }))}
                  />
                  <span className="field-label">지원 완료</span>
                </label>
                <label className="field">
                  <span className="field-label">단계</span>
                  <select
                    className="select"
                    value={String(editForm.status || "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="interested">관심</option>
                    <option value="applied">지원완료</option>
                    <option value="oa">OA</option>
                    <option value="interview1">1차면접</option>
                    <option value="interview2">2차면접</option>
                    <option value="offer">오퍼</option>
                    <option value="rejected">리젝트</option>
                  </select>
                </label>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span className="field-label">공고 URL</span>
                  <input
                    className="input"
                    type="url"
                    value={String(editForm.job_url || "")}
                    onChange={(e) => setEditForm((p) => ({ ...p, job_url: e.target.value }))}
                  />
                </label>
                <label className="field" style={{ gridColumn: "1 / -1" }}>
                  <span className="field-label">공고 내용 / 메모</span>
                  <textarea
                    className="textarea"
                    rows={6}
                    value={String(editForm.job_description || editForm.memo || "")}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        job_description: e.target.value,
                        memo: e.target.value,
                      }))
                    }
                  />
                </label>
                <div style={{ gridColumn: "1 / -1" }}>
                  <button type="submit" className="btn-primary">
                    저장
                  </button>
                </div>
              </form>
            ) : (
            <div className="jd-sections">
              {sections.length === 0 ? (
                <p className="card-caption">내용이 없습니다.</p>
              ) : (
                sections.map((sec, idx) => (
                  <div key={idx} className="jd-section-card">
                    <h3 className="jd-section-title">{sec.title}</h3>
                    <div className="jd-section-body">
                      {sec.items.map((item, i) => (
                        <p
                          key={i}
                          className={
                            /^[-•·▪︎]/.test(item)
                              ? "jd-section-bullet"
                              : "jd-section-para"
                          }
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

