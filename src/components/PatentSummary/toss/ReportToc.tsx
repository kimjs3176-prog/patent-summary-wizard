export interface TocItem { id: string; label: string }

/** 보고서 목차: 휴대폰·인쇄에서 쓴다 (넓은 화면은 옆의 '섹션 바로가기'가 맡아 CSS로 숨긴다) */
export function ReportToc({ toc, isStreaming, hasSections }: { toc: TocItem[]; isStreaming: boolean; hasSections: boolean }) {
  if (!toc.length || (isStreaming && !hasSections)) return null;
  return (
    <nav className="report-toc report-toc-solo mb-8" aria-label="요약서 목차">
      <span className="report-toc-title">목차</span>
      <ol>
        {toc.map((t, i) => (
          <li key={t.id}>
            <a
              href={`#${t.id}`}
              onClick={(e) => { const el = document.getElementById(t.id); if (!el) return; e.preventDefault(); el.scrollIntoView({ behavior: "smooth", block: "start" }); }}
            >
              <span className="n tabular-nums">{i + 1}</span>{t.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
