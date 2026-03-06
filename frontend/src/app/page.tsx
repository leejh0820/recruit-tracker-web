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

  const apiBase = "http://127.0.0.1:8000";

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/applications`);
        if (!res.ok) {
          throw new Error(`Failed to fetch applications (${res.status})`);
        }
        const data: Application[] = await res.json();
        setApplications(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.company || !form.position_title || !form.applied_date) {
      setError("날짜, 회사, 직무는 필수입니다.");
      return;
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

    // 회사명과 포지션은 첫 줄에서 괄호/대시 기준으로 대략 추출
    let company = form.company;
    let position_title = form.position_title;

    if (!company || !position_title) {
      const dashSplit = firstLine.split(/[-–—]/);
      if (dashSplit.length >= 2) {
        const left = dashSplit[0].trim();
        const right = dashSplit.slice(1).join("-").trim();
        if (!company) company = left;
        if (!position_title) position_title = right;
      }
    }

    // 위치, 근무형태는 키워드 기반으로 대충 추출
    let location = form.location;
    if (!location) {
      const locMatch = rawText.match(
        /(서울|서울시|판교|수원|성남|성남시|분당구|부산|대전|대구|광주|인천)[^\n]*/
      );
      if (locMatch) {
        let loc = locMatch[0].trim();
        // '경력', '학력', '마감일' 같은 키워드에서 잘라내기
        const stopWords = ["경력", "학력", "마감일", "D-", "간편 지원하기", "회사소개"];
        for (const stop of stopWords) {
          const idx = loc.indexOf(stop);
          if (idx !== -1) {
            loc = loc.slice(0, idx).trim();
          }
        }
        // 문장 끝의 회사 주소 등은 과감히 잘라내기 위해 최대 길이 제한
        if (loc.length > 30) {
          loc = loc.slice(0, 30).trim();
        }
        location = loc;
      }
    }

    let work_type = form.work_type;
    if (!work_type) {
      if (rawText.includes("정규직")) work_type = "정규직";
      else if (rawText.includes("인턴")) work_type = "인턴";
      else if (rawText.toLowerCase().includes("remote"))
        work_type = "리모트";
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

  const autoFillFromUrl = async () => {
    if (!form.job_url) {
      setError("먼저 공고 URL을 입력해 주세요.");
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
          <div style={{ gridColumn: "1 / -1", marginTop: 8 }}>
            <button type="submit" className="btn-primary">
              지원 저장하기
            </button>
          </div>
        </form>
        {error && <p className="error-text">{error}</p>}
      </section>

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
                  {applications
                    .filter((app) => {
                      if (searchQuery.trim()) {
                        const q = searchQuery.toLowerCase().trim();
                        const match =
                          (app.company || "").toLowerCase().includes(q) ||
                          (app.position_title || "").toLowerCase().includes(q);
                        if (!match) return false;
                      }
                      if (statusFilter && app.status !== statusFilter)
                        return false;
                      return true;
                    })
                    .sort((a, b) => {
                      if (sortOrder === "newest")
                        return b.applied_date.localeCompare(a.applied_date);
                      return a.applied_date.localeCompare(b.applied_date);
                    })
                    .map((app) => {
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
                        <span style={{ color: "#a5b4fc" }}>{app.company}</span>
                      </td>
                      <td>{app.position_title}</td>
                      <td>{app.location}</td>
                      <td>{app.work_type}</td>
                      <td>{app.salary}</td>
                      <td>
                        <span className={statusClass}>{app.status}</span>
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
