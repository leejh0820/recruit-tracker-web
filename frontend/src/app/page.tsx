"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

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

const inferSourceFromUrl = (url: string): string => {
  try {
    const { hostname } = new URL(url);
    if (hostname.includes("rememberapp")) return "리멤버";
    if (hostname.includes("wanted.co.kr")) return "원티드";
    if (hostname.includes("saramin")) return "사람인";
    if (hostname.includes("jobkorea")) return "잡코리아";
    if (hostname.includes("linkedin")) return "링크드인";
    return hostname;
  } catch {
    return "";
  }
};

export default function Home() {
  const today = new Date().toISOString().slice(0, 10);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [duplicateWarning, setDuplicateWarning] = useState<Application | null>(null);

  const [form, setForm] = useState({
    applied_date: today,
    source: "",
    company: "",
    position_title: "",
    location: "",
    work_type: "",
    salary: "",
    applied: false,
    status: "interested",
    job_description: "",
    job_url: "",
    memo: "",
  });

  const apiBase = "/api";

  const filteredApplications = applications
    .filter((app) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (app.company || "").toLowerCase().includes(q) ||
          (app.position_title || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      if (statusFilter && app.status !== statusFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === "newest")
        return b.applied_date.localeCompare(a.applied_date);
      return a.applied_date.localeCompare(b.applied_date);
    });

  const statusLabel: Record<string, string> = {
    interested: "관심",
    applied: "지원완료",
    oa: "OA",
    interview1: "1차면접",
    interview2: "2차면접",
    offer: "오퍼",
    rejected: "리젝트",
  };

  const exportToCsv = () => {
    const headers = [
      "날짜",
      "출처",
      "회사",
      "직무/포지션",
      "위치",
      "근무형태",
      "연봉/페이",
      "단계",
      "지원완료",
    ];
    const escape = (v: string | null | undefined) => {
      const s = String(v ?? "").replace(/"/g, '""');
      return s.includes(",") || s.includes("\n") ? `"${s}"` : s;
    };
    const rows = filteredApplications.map((app) =>
      [
        app.applied_date,
        app.source,
        app.company,
        app.position_title,
        app.location,
        app.work_type,
        app.salary,
        statusLabel[app.status] ?? app.status,
        app.applied ? "Y" : "N",
      ].map(escape).join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recruit-tracker-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${apiBase}/applications`);
      if (!res.ok) {
        throw new Error(`서버 응답 오류 (${res.status})`);
      }
      const data: Application[] = await res.json();
      setApplications(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      const isConnectionError =
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Load failed") ||
        (err instanceof TypeError && msg === "Failed to fetch");
      setError(
        isConnectionError
          ? "백엔드 서버에 연결할 수 없습니다. 터미널에서 백엔드가 실행 중인지 확인해 주세요. (포트 8000)"
          : msg
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  useEffect(() => {
    const c = (form.company || "").trim().toLowerCase();
    const p = (form.position_title || "").trim().toLowerCase();
    const dup =
      c && p
        ? applications.find(
            (a) =>
              (a.company || "").trim().toLowerCase() === c &&
              (a.position_title || "").trim().toLowerCase() === p
          )
        : null;
    setDuplicateWarning(dup || null);
  }, [form.company, form.position_title, applications]);

  const findDuplicate = (company: string, position: string) => {
    const c = (company || "").trim().toLowerCase();
    const p = (position || "").trim().toLowerCase();
    if (!c || !p) return null;
    return applications.find(
      (a) =>
        (a.company || "").trim().toLowerCase() === c &&
        (a.position_title || "").trim().toLowerCase() === p
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.company || !form.position_title || !form.applied_date) {
      setError("날짜, 회사, 직무는 필수입니다.");
      return;
    }

    const dup = findDuplicate(form.company, form.position_title);
    if (dup) {
      const msg = `이미 등록된 지원입니다: ${dup.company} - ${dup.position_title} (${dup.applied_date}). 그래도 저장할까요?`;
      if (!confirm(msg)) return;
    }

    try {
      const payload = {
        applied_date: form.applied_date,
        source: form.source || undefined,
        company: form.company,
        position_title: form.position_title,
        location: form.location || undefined,
        work_type: form.work_type || undefined,
        salary: form.salary || undefined,
        applied: form.applied,
        status: form.status,
        job_description: form.job_description || undefined,
        job_url: form.job_url || undefined,
        memo: form.memo || undefined,
      };

      const res = await fetch(`${apiBase}/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Failed to create application (${res.status})`);
      }

      const created: Application = await res.json();
      setApplications((prev) => [...prev, created]);
      setForm((prev) => ({
        ...prev,
        applied_date: today,
        company: "",
        position_title: "",
        source: "",
        location: "",
        work_type: "",
        salary: "",
        job_description: "",
        job_url: "",
        memo: "",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const autoFillFromText = () => {
    if (!rawText.trim()) return;

    const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] || "";
    const text = rawText;

    // 회사명과 포지션 추출 (LinkedIn, 원티드 등 다양한 형식 지원)
    let company = form.company;
    let position_title = form.position_title;
    let locationFromFirstLine: string | null = null;

    if (!company || !position_title) {
      // LinkedIn: "직무 at 회사" 또는 "회사 · 직무"
      const atMatch = firstLine.match(/^(.+?)\s+at\s+(.+)$/i);
      if (atMatch) {
        if (!position_title) position_title = atMatch[1].trim();
        if (!company) company = atMatch[2].trim();
      } else {
        const dotSplit = firstLine.split(/[\u00B7·]/); // middle dot
        if (dotSplit.length >= 2) {
          const a = dotSplit[0].trim();
          const b = dotSplit.slice(1).join("·").trim();
          if (!company) company = a;
          if (!position_title) position_title = b;
        } else {
          const dashSplit = firstLine.split(/\s*[-–—]\s*/).map((s) => s.trim()).filter(Boolean);
          if (dashSplit.length >= 3) {
            // LinkedIn: "직무 - 회사 - 위치" (e.g. Solutions Architect - BytePlus - Seoul)
            const part1 = dashSplit[0];
            const part2 = dashSplit[1];
            const part3 = dashSplit.slice(2).join(" - ");
            const looksLikeLocation =
              part3.length < 35 ||
              /^(서울|Seoul|Busan|NYC|Remote|London|Singapore|Tokyo|Berlin|Paris|인천|대전|대구|광주)/i.test(part3);
            if (looksLikeLocation) {
              if (!position_title) position_title = part1;
              if (!company) company = part2;
              locationFromFirstLine = part3;
            } else {
              if (!company) company = part1;
              if (!position_title) position_title = [part2, part3].filter(Boolean).join(" - ");
            }
          } else if (dashSplit.length >= 2) {
            const left = dashSplit[0];
            const right = dashSplit.slice(1).join(" - ");
            if (!company) company = left;
            if (!position_title) position_title = right;
          }
        }
      }
    }

    // LinkedIn: 1줄=회사, 2줄=직무 형태
    if ((!company || !position_title) && lines.length >= 2) {
      const second = lines[1];
      if (!company && firstLine.length < 60) company = firstLine;
      if (!position_title && second && second.length < 80) position_title = second;
    }

    // 위치 추출: Location:, 위치:, 또는 도시명
    let location = locationFromFirstLine || form.location;
    if (!location) {
      const locLabel = text.match(/(?:Location|위치|근무지)\s*[:\：]\s*([^\n]+)/i);
      if (locLabel) {
        location = locLabel[1].trim().slice(0, 50);
      } else {
        const locMatch = text.match(
          /(서울|서울시|판교|수원|성남|성남시|분당구|부산|대전|대구|광주|인천|Seoul|Busan|Remote)[^\n]*/
        );
        if (locMatch) {
          let loc = locMatch[0].trim();
          const stopWords = ["경력", "학력", "마감일", "D-", "간편 지원하기", "회사소개", "Employment type"];
          for (const stop of stopWords) {
            const idx = loc.indexOf(stop);
            if (idx !== -1) loc = loc.slice(0, idx).trim();
          }
          if (loc.length > 40) loc = loc.slice(0, 40).trim();
          location = loc;
        }
      }
    }

    // 근무형태
    let work_type = form.work_type;
    if (!work_type) {
      const empMatch = text.match(/(?:Employment type|근무형태)\s*[:\：]\s*([^\n·]+)/i);
      if (empMatch) {
        const t = empMatch[1].trim().toLowerCase();
        if (t.includes("full") || t.includes("정규")) work_type = "정규직";
        else if (t.includes("part") || t.includes("계약")) work_type = "계약직";
        else if (t.includes("intern")) work_type = "인턴";
        else if (t.includes("contract")) work_type = "계약직";
        else work_type = empMatch[1].trim().slice(0, 20);
      } else {
        if (text.includes("정규직")) work_type = "정규직";
        else if (text.includes("인턴")) work_type = "인턴";
        else if (text.includes("Full-time") || text.includes("Full time")) work_type = "정규직";
        else if (text.includes("Part-time") || text.includes("Part time")) work_type = "계약직";
        else if (text.includes("Contract")) work_type = "계약직";
        else if (text.toLowerCase().includes("remote") || text.includes("리모트")) work_type = "리모트";
        else if (text.includes("Hybrid") || text.includes("하이브리드")) work_type = "하이브리드";
      }
    }

    setForm((prev) => ({
      ...prev,
      company: company || prev.company,
      position_title: position_title || prev.position_title,
      location: location || prev.location,
      work_type: work_type || prev.work_type,
      job_description: rawText,
    }));
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      const res = await fetch(`${apiBase}/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`단계 변경 실패 (${res.status})`);
      const updated: Application = await res.json();
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? updated : a))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "단계 변경 중 오류");
    }
  };

  const autoFillFromUrl = async () => {
    if (!form.job_url) {
      setError("먼저 공고 URL을 입력해 주세요.");
      return;
    }
    if (form.job_url.toLowerCase().includes("linkedin.com")) {
      setError(
        "LinkedIn 공고는 URL에서 직접 가져올 수 없습니다. 공고 내용을 복사해서 '공고 텍스트로 자동 채우기'를 사용해 주세요."
      );
      return;
    }

    try {
      setError(null);
      const res = await fetch(`${apiBase}/applications/parse-from-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: form.job_url }),
      });

      if (!res.ok) {
        throw new Error(`URL에서 정보 읽기 실패 (${res.status})`);
      }

      const data: {
        company?: string | null;
        position_title?: string | null;
        job_description?: string | null;
      } = await res.json();

      const text = data.job_description || form.job_description || "";

      // 위치, 근무형태는 공고 텍스트에서 추론
      let location = form.location;
      if (!location && text) {
        const locMatch = text.match(
          /(서울|서울시|판교|수원|성남|성남시|분당구|부산|대전|대구|광주|인천)[^\n]*/
        );
        if (locMatch) {
          let loc = locMatch[0].trim();
          const stopWords = ["경력", "학력", "마감일", "D-", "간편 지원하기", "회사소개"];
          for (const stop of stopWords) {
            const idx = loc.indexOf(stop);
            if (idx !== -1) {
              loc = loc.slice(0, idx).trim();
            }
          }
          if (loc.length > 30) {
            loc = loc.slice(0, 30).trim();
          }
          location = loc;
        }
      }

      let work_type = form.work_type;
      if (!work_type && text) {
        if (text.includes("정규직")) work_type = "정규직";
        else if (text.includes("인턴")) work_type = "인턴";
        else if (text.toLowerCase().includes("remote")) work_type = "리모트";
      }

      setForm((prev) => ({
        ...prev,
        company: data.company || prev.company,
        position_title: data.position_title || prev.position_title,
        job_description: data.job_description || prev.job_description,
        location: location || prev.location,
        work_type: work_type || prev.work_type,
        source: form.source || inferSourceFromUrl(form.job_url || ""),
      }));
      setRawText(data.job_description || rawText);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "URL에서 정보를 가져오는 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <div className="app-container">
      <section className="card">
        <div className="card-header">
          <div>
            <div className="card-title">새 지원 추가</div>
            <div className="card-caption">URL/텍스트 붙여넣고 빠르게 기록하기</div>
          </div>
          <span className="pill">
            <span className="pill-dot" />
            Today · {today}
          </span>
        </div>
        <form onSubmit={handleSubmit} className="form-grid">
          <label className="field">
            <span className="field-label">
              <strong>날짜</strong> (자동)
            </span>
            <input
              className="input"
              type="date"
              value={form.applied_date}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, applied_date: e.target.value }))
              }
            />
          </label>
          <label className="field">
            <span className="field-label">출처</span>
            <input
              className="input"
              type="text"
              value={form.source}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, source: e.target.value }))
              }
              placeholder="리멤버 / 원티드 / 지인추천 등"
            />
          </label>
          <label className="field">
            <span className="field-label">
              <strong>회사</strong> *
            </span>
            <input
              className="input"
              type="text"
              value={form.company}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, company: e.target.value }))
              }
            />
          </label>
          <label className="field">
            <span className="field-label">
              <strong>직무/포지션</strong> *
            </span>
            <input
              className="input"
              type="text"
              value={form.position_title}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  position_title: e.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <span className="field-label">위치</span>
            <input
              className="input"
              type="text"
              value={form.location}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, location: e.target.value }))
              }
              placeholder="서울 성동구 등"
            />
          </label>
          <label className="field">
            <span className="field-label">근무형태</span>
            <input
              className="input"
              type="text"
              value={form.work_type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, work_type: e.target.value }))
              }
              placeholder="정규직 / 인턴 / 리모트 등"
            />
          </label>
          <label className="field">
            <span className="field-label">연봉/페이</span>
            <input
              className="input"
              type="text"
              value={form.salary}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, salary: e.target.value }))
              }
              placeholder="예: 6000 / 협의"
            />
          </label>
          <div className="checkbox-row">
            <input
              type="checkbox"
              checked={form.applied}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, applied: e.target.checked }))
              }
            />
            <span>지원 완료로 표시</span>
          </div>
          <label className="field">
            <span className="field-label">단계(status)</span>
            <select
              className="select"
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, status: e.target.value }))
              }
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
              value={form.job_url}
              onChange={(e) => {
                const value = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  job_url: value,
                  source: prev.source || inferSourceFromUrl(value),
                }));
              }}
              placeholder="공고 주소를 붙여넣으세요"
            />
          </label>
          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="field-label">공고 내용 / 메모</span>
            <textarea
              className="textarea"
              rows={4}
              value={rawText || form.job_description || form.memo}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="공고 텍스트를 통째로 붙여넣거나, 면접 피드백/메모를 적어두세요"
            />
          </label>
          <div
            className="btn-row"
            style={{ gridColumn: "1 / -1", marginTop: 2 }}
          >
            <button type="button" onClick={autoFillFromUrl} className="btn">
              URL에서 자동 채우기
            </button>
            <button type="button" onClick={autoFillFromText} className="btn">
              공고 텍스트로 자동 채우기
            </button>
          </div>
          {duplicateWarning && (
            <div
              className="duplicate-warning"
              style={{ gridColumn: "1 / -1", marginTop: 4 }}
            >
              ⚠️ 이미 등록된 지원: {duplicateWarning.company} -{" "}
              {duplicateWarning.position_title} ({duplicateWarning.applied_date})
            </div>
          )}
          <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
            <button type="submit" className="btn-primary">
              지원 저장하기
            </button>
          </div>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>

      {applications.length > 0 && (
        <section className="card card--muted dashboard-section">
          <div className="card-header">
            <div>
              <div className="card-title">대시보드</div>
              <div className="card-caption">
                지원 현황 한눈에 보기
              </div>
            </div>
          </div>
          <div className="dashboard-grid">
            <div className="dashboard-chart">
              <div className="chart-title">단계별 지원 수</div>
              <div className="chart-bars">
                {(() => {
                  const statusOrder = [
                    "interested",
                    "applied",
                    "oa",
                    "interview1",
                    "interview2",
                    "offer",
                    "rejected",
                  ] as const;
                  const counts: Record<string, number> = {};
                  applications.forEach((a) => {
                    counts[a.status] = (counts[a.status] ?? 0) + 1;
                  });
                  const max = Math.max(1, ...Object.values(counts));
                  return statusOrder.map((status) => {
                    const count = counts[status] ?? 0;
                    return (
                      <div key={status} className="chart-row">
                        <span className="chart-label">
                          {statusLabel[status] ?? status}
                        </span>
                        <div className="chart-bar-wrap">
                          <div
                            className="chart-bar"
                            style={{
                              width: `${(count / max) * 100}%`,
                              minWidth: count > 0 ? "24px" : "0",
                            }}
                          />
                        </div>
                        <span className="chart-value">{count}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
            <div className="dashboard-chart">
              <div className="chart-title">월별 지원 수</div>
              <div className="chart-bars">
                {(() => {
                  const byMonth: Record<string, number> = {};
                  applications.forEach((a) => {
                    const m = a.applied_date.slice(0, 7);
                    byMonth[m] = (byMonth[m] ?? 0) + 1;
                  });
                  const months = Object.keys(byMonth).sort();
                  const max = Math.max(1, ...Object.values(byMonth));
                  return months.length > 0 ? (
                    months.map((m) => {
                      const count = byMonth[m];
                      const [y, mo] = m.split("-");
                      const label = `${y}년 ${parseInt(mo, 10)}월`;
                      return (
                        <div key={m} className="chart-row">
                          <span className="chart-label">{label}</span>
                          <div className="chart-bar-wrap">
                            <div
                              className="chart-bar chart-bar--month"
                              style={{
                                width: `${(count / max) * 100}%`,
                                minWidth: count > 0 ? "24px" : "0",
                              }}
                            />
                          </div>
                          <span className="chart-value">{count}</span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="card-caption">데이터 없음</p>
                  );
                })()}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card card--muted">
        <div className="card-header">
          <div>
            <div className="card-title">지원 리스트</div>
            <div className="card-caption">
              검색·필터·정렬로 원하는 지원만 골라보세요
            </div>
          </div>
        </div>
        {loading ? (
          <p className="card-caption">불러오는 중...</p>
        ) : error ? (
          <div className="connection-error">
            <p className="error-text">{error}</p>
            <p className="card-caption" style={{ marginTop: 6 }}>
              백엔드: <code>cd backend && uvicorn app.main:app --reload --port 8000</code>
            </p>
            <button type="button" onClick={fetchApplications} className="btn" style={{ marginTop: 8 }}>
              다시 시도
            </button>
          </div>
        ) : applications.length === 0 ? (
          <p className="card-caption">아직 등록된 지원이 없습니다.</p>
        ) : (
          <>
            <div className="list-toolbar">
              <input
                className="input"
                type="text"
                placeholder="회사·직무 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ maxWidth: 180 }}
              />
              <select
                className="select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ maxWidth: 120 }}
              >
                <option value="">전체 단계</option>
                <option value="interested">관심</option>
                <option value="applied">지원완료</option>
                <option value="oa">OA</option>
                <option value="interview1">1차면접</option>
                <option value="interview2">2차면접</option>
                <option value="offer">오퍼</option>
                <option value="rejected">리젝트</option>
              </select>
              <select
                className="select"
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as "newest" | "oldest")
                }
                style={{ maxWidth: 100 }}
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
              </select>
              <button
                type="button"
                onClick={exportToCsv}
                className="btn"
                style={{ marginLeft: "auto" }}
              >
                CSV 내보내기
              </button>
            </div>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>출처</th>
                    <th>회사</th>
                    <th>직무/포지션</th>
                    <th>위치</th>
                    <th>근무형태</th>
                    <th>연봉/페이</th>
                    <th>단계</th>
                    <th>지원</th>
                    <th>링크</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplications.map((app) => {
                  const statusClass =
                    app.status === "applied" || app.status === "oa"
                      ? "status-pill status-pill--applied"
                      : app.status.startsWith("interview")
                      ? "status-pill status-pill--interview"
                      : app.status === "offer"
                      ? "status-pill status-pill--offer"
                      : app.status === "rejected"
                      ? "status-pill status-pill--rejected"
                      : "status-pill";

                  return (
                    <tr
                      key={app.id}
                      className="table-row"
                      onClick={() =>
                        (window.location.href = `/applications/${app.id}`)
                      }
                    >
                      <td style={{ whiteSpace: "nowrap" }}>
                        {app.applied_date}
                      </td>
                      <td>{app.source}</td>
                      <td>
                        <span style={{ color: "var(--company-accent)" }}>{app.company}</span>
                      </td>
                      <td>{app.position_title}</td>
                      <td>{app.location}</td>
                      <td>{app.work_type}</td>
                      <td>{app.salary}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          className={`status-pill status-select ${statusClass}`}
                          value={app.status}
                          onChange={(e) =>
                            handleStatusChange(app.id, e.target.value)
                          }
                        >
                          <option value="interested">관심</option>
                          <option value="applied">지원완료</option>
                          <option value="oa">OA</option>
                          <option value="interview1">1차면접</option>
                          <option value="interview2">2차면접</option>
                          <option value="offer">오퍼</option>
                          <option value="rejected">리젝트</option>
                        </select>
                      </td>
                      <td>{app.applied ? "Y" : "N"}</td>
                      <td>
                        {app.job_url ? (
                          <a
                            href={app.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-muted"
                            onClick={(e) => e.stopPropagation()}
                          >
                            링크
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>
    </div>
  );
}
