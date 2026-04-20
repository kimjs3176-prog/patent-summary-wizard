import { ArrowRight, ScanSearch, Compass, BookOpenCheck } from "lucide-react";
import { Link } from "react-router-dom";

interface QuickActionCardsProps {
  onFocusSearch?: () => void;
}

export function QuickActionCards({ onFocusSearch }: QuickActionCardsProps) {
  const actions = [
    {
      title: "특허 번호로 즉시 분석",
      desc: "10-2023-... 번호 또는 명칭으로 AI 요약·점수 확인",
      icon: ScanSearch,
      color: "hsl(158 64% 40%)",
      bg: "hsl(158 64% 40% / 0.08)",
      onClick: () => {
        onFocusSearch?.();
        document.querySelector<HTMLInputElement>("input[name='patent-input'], input[type='search'], input[type='text']")?.focus();
      },
      cta: "검색창으로 이동",
    },
    {
      title: "주제·키워드로 탐색",
      desc: "스마트팜·기능성식품 등 카테고리에서 둘러보기",
      icon: Compass,
      color: "hsl(200 70% 50%)",
      bg: "hsl(200 70% 50% / 0.08)",
      to: "/search",
      cta: "키워드 탐색",
    },
    {
      title: "기술이전 절차 학습",
      desc: "신청부터 계약까지 6단계 절차를 한 눈에",
      icon: BookOpenCheck,
      color: "hsl(280 50% 55%)",
      bg: "hsl(280 50% 55% / 0.08)",
      anchor: "#tech-transfer",
      cta: "안내 보기",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {actions.map((a) => {
        const Icon = a.icon;
        const inner = (
          <div
            className="group h-full rounded-2xl border border-border/40 bg-card p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1 hover:border-border/80 cursor-pointer flex flex-col"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
              style={{ background: a.bg, color: a.color }}
            >
              <Icon className="w-5 h-5" />
            </div>
            <h4 className="text-[14px] font-bold text-foreground mb-1.5 tracking-tight">{a.title}</h4>
            <p className="text-[12px] text-muted-foreground leading-[1.65] flex-1">{a.desc}</p>
            <div className="mt-3 flex items-center gap-1 text-[12px] font-semibold" style={{ color: a.color }}>
              {a.cta}
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        );

        if (a.to) return <Link key={a.title} to={a.to}>{inner}</Link>;
        if (a.anchor) {
          return (
            <a
              key={a.title}
              href={a.anchor}
              onClick={(e) => {
                e.preventDefault();
                document.querySelector(a.anchor!)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {inner}
            </a>
          );
        }
        return (
          <button key={a.title} onClick={a.onClick} className="text-left">
            {inner}
          </button>
        );
      })}
    </div>
  );
}
