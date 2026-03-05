"use client";

import { useEffect, useMemo, useState } from "react";
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

const apiBase = "http://127.0.0.1:8000";

const formatBlocks = (text: string): string[] => {
  if (!text) return [];

  // 1단계: 자주 나오는 섹션 헤더 앞에 강제로 줄바꿈 넣기 (한 줄짜리 텍스트 대응)
  const headingTokens =
    "(공고소개|주요업무|담당업무|주요 업무|역할|자격요건|자격 요건|지원자격|우대사항|우대 사항|채용절차|채용 절차|기타안내|복지 제도|복리후생|근무조건|근무 조건|일과 건강|음식과 건강|성장|가족|생활 복지)";
  let normalized = text.replace(/\r\n/g, "\n");
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

export default function ApplicationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const blocks = useMemo(() => {
    if (!application) return [];
    const raw = application.job_description || application.memo || "";
    return formatBlocks(raw);
  }, [application]);

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

  return (
    <div className="app-container" style={{ maxWidth: 900 }}>
      <section className="card card--muted">
        <button
          onClick={() => router.push("/")}
          className="btn-ghost"
          style={{ marginBottom: 12 }}
        >
          ← 목록으로
        </button>

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

            <section>
              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  marginBottom: 8,
                }}
              >
                공고 내용 / 메모
              </h2>
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  maxHeight: 520,
                  overflowY: "auto",
                  paddingRight: 4,
                }}
              >
                {blocks.length === 0 ? (
                  <p className="card-caption">내용이 없습니다.</p>
                ) : (
                  blocks.map((block, idx) => {
                    const headingRegex =
                      /^(주요업무|담당업무|주요 업무|역할|자격 요건|지원자격|우대사항|우대 사항|복지 제도|복리후생|근무조건|근무 조건)/;
                    const isHeading = headingRegex.test(block);
                    const isBullet = /^[-•·▪︎]/.test(block);

                    if (isHeading) {
                      return (
                        <h3
                          key={idx}
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            marginTop: idx === 0 ? 0 : 14,
                            marginBottom: 4,
                            color: "var(--text-primary)",
                          }}
                        >
                          {block}
                        </h3>
                      );
                    }

                    if (isBullet) {
                      return (
                        <p
                          key={idx}
                          style={{
                            marginLeft: 12,
                            marginBottom: 3,
                          }}
                        >
                          {block}
                        </p>
                      );
                    }

                    return (
                      <p
                        key={idx}
                        style={{
                          marginBottom: 8,
                        }}
                      >
                        {block}
                      </p>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}

