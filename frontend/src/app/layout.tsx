import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recruit Tracker",
  description: "채용 지원 현황 관리",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="app-shell">
        <header className="app-header">
          <div className="app-header-inner">
            <div className="app-title">
              <span className="app-logo-pill" />
              <div>
                <div>Recruit Tracker</div>
                <div className="app-subtitle">
                  내 지원 현황을 한 눈에 정리하는 개인용 대시보드
                </div>
              </div>
            </div>
            <span className="badge-tag">
              <span className="badge-dot" />
              Personal tool
            </span>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </body>
    </html>
  );
}
