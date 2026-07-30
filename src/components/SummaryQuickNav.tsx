import { useEffect, useState } from "react";
import { ArrowUp, List } from "lucide-react";

interface Item { id: string; label: string }

interface Props {
  /** 목차 재계산 트리거 (요약 본문 변경 시) */
  deps?: unknown;
  className?: string;
}

export const SummaryQuickNav = ({ deps, className = "" }: Props) => {
  const [items, setItems] = useState<Item[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const scan = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-summary-section]"));
      setItems(
        nodes
          .map((n) => ({ id: n.id, label: n.dataset.summaryLabel || "" }))
          .filter((i) => i.id && i.label),
      );
    };
    scan();
    const t = window.setTimeout(scan, 600);
    const t2 = window.setTimeout(scan, 1800);
    return () => { window.clearTimeout(t); window.clearTimeout(t2); };
  }, [deps]);

  useEffect(() => {
    if (!items.length) return;
    const onScroll = () => {
      let current = items[0].id;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= 140) current = it.id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  if (items.length < 2) return null;

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className={`w-[196px] rounded-[20px] border border-[#F2F4F6] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${className}`}>
      <p className="flex items-center gap-1.5 px-1 pb-2 text-[11px] font-bold text-[#8B95A1]">
        <List className="w-3.5 h-3.5" /> 섹션 바로가기
      </p>
      <ul className="space-y-0.5 max-h-[60vh] overflow-y-auto">
        {items.map((it) => {
          const on = active === it.id;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => go(it.id)}
                className={`w-full text-left rounded-[10px] px-2.5 py-2 text-[12.5px] leading-snug transition-colors border-l-2 ${
                  on
                    ? "border-primary bg-primary/5 font-bold text-[#191F28]"
                    : "border-transparent text-[#6B7684] hover:bg-[#F9FAFB]"
                }`}
              >
                {it.label}
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[#E5E8EB] py-2 text-[11.5px] font-semibold text-[#4E5968] hover:bg-[#F9FAFB]"
      >
        <ArrowUp className="w-3.5 h-3.5" /> 맨 위로
      </button>
    </nav>
  );
};
