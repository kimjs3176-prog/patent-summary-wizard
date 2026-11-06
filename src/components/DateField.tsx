import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * 날짜 한 칸 (YYYY-MM-DD). 칸을 누르면 바로 숫자를 칠 수 있고(하이픈은 자동), 아래에 달력도 함께 열린다.
 * 달력에서 날짜를 누르거나 8자리를 다 치면 값이 정해진다. value 는 완성된 날짜이거나 "".
 */
export function DateField({ value, onChange, label, min = "1980-01-01", max, align = "start" }: {
  value: string; onChange: (v: string) => void; label: string; min?: string; max?: string;
  /** 달력을 칸 왼쪽(start)과 오른쪽(end) 중 어디에 맞출지. 줄 오른쪽 칸은 end 로 화면 밖에 나가지 않게 */
  align?: "start" | "end";
}) {
  const today = useMemo(() => new Date(), []);
  const maxDate = max ?? iso(today);
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthOf(value || maxDate));
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const gridId = useId();

  // 밖에서 정해진 날짜만 칸에 옮긴다 (치는 중에 값이 ""가 되어도 친 글자는 그대로 둔다)
  useEffect(() => { if (value) { setText(value); setView(monthOf(value)); } }, [value]);
  // 바깥을 누르면 달력을 닫는다
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const commit = (v: string) => { setText(v); onChange(v); if (v) setView(monthOf(v)); };
  const typed = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    const t = [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)].filter(Boolean).join("-");
    setText(t);
    if (d.length === 8) {
      const ok = validDate(t) && t >= min && t <= maxDate;
      onChange(ok ? t : "");
      if (ok) setView(monthOf(t));
    } else if (value) onChange("");
    if (d.length >= 6 && validDate(`${t.slice(0, 7)}-01`)) setView(monthOf(`${t.slice(0, 7)}-01`));
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") setOpen(false);
    if (e.key === "Enter") { e.preventDefault(); setOpen(false); }
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); }
  };

  const [y, m] = view;
  const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const minY = Number(min.slice(0, 4)), maxY = Number(maxDate.slice(0, 4));
  const shift = (n: number) => { const d = new Date(y, m + n, 1); setView([d.getFullYear(), d.getMonth()]); };
  const bad = text.length === 10 && !value;

  return (
    <div ref={box} className="relative min-w-0">
      <div className={`flex h-10 items-center rounded-md border bg-background pl-2.5 pr-0.5 transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1 ${bad ? "border-destructive" : "border-input"}`}>
        <input
          ref={input}
          value={text}
          onChange={(e) => typed(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKey}
          inputMode="numeric"
          placeholder="YYYY-MM-DD"
          aria-label={label}
          aria-invalid={bad || undefined}
          aria-expanded={open}
          aria-controls={gridId}
          className="w-full min-w-0 bg-transparent text-sm tabular-nums outline-none placeholder:text-muted-foreground"
        />
        <button type="button" tabIndex={-1} aria-label={`${label} 달력 열기`} onClick={() => { setOpen((o) => !o); input.current?.focus(); }}
          className="grid h-8 w-7 shrink-0 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {open && (
        <div id={gridId} role="dialog" aria-label={`${label} 달력`}
          className={`absolute ${align === "end" ? "right-0" : "left-0"} top-full z-30 mt-1.5 w-[17rem] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg`}>
          <div className="mb-2 flex items-center gap-1">
            <button type="button" onClick={() => shift(-1)} aria-label="이전 달" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <select value={y} onChange={(e) => setView([Number(e.target.value), m])} aria-label="연도" className="h-8 flex-1 rounded-md border border-input bg-background px-1 text-sm tabular-nums">
              {Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i).map((yy) => <option key={yy} value={yy}>{yy}년</option>)}
            </select>
            <select value={m} onChange={(e) => setView([y, Number(e.target.value)])} aria-label="월" className="h-8 w-[4.5rem] rounded-md border border-input bg-background px-1 text-sm tabular-nums">
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{i + 1}월</option>)}
            </select>
            <button type="button" onClick={() => shift(1)} aria-label="다음 달" className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] text-muted-foreground">
            {["일", "월", "화", "수", "목", "금", "토"].map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const v = iso(new Date(y, m, d)), on = v === value, off = v < min || v > maxDate, now = v === iso(today);
              return (
                <button key={v} type="button" disabled={off} onClick={() => { commit(v); setOpen(false); }} aria-pressed={on} aria-label={v}
                  className={`h-8 rounded-md text-sm tabular-nums transition-colors disabled:opacity-30 ${on ? "bg-primary text-primary-foreground font-semibold" : now ? "font-semibold text-primary hover:bg-muted" : "hover:bg-muted"}`}>
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs">
            <button type="button" onClick={() => { commit(""); setOpen(false); }} className="rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">지우기</button>
            <button type="button" onClick={() => { commit(iso(today) > maxDate ? maxDate : iso(today)); setOpen(false); }} className="rounded px-2 py-1 font-semibold text-primary hover:bg-muted">오늘</button>
          </div>
        </div>
      )}
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthOf = (v: string): [number, number] => [Number(v.slice(0, 4)), Number(v.slice(5, 7)) - 1];
function validDate(v: string) {
  const [yy, mm, dd] = v.split("-").map(Number);
  const d = new Date(yy, mm - 1, dd);
  return d.getFullYear() === yy && d.getMonth() === mm - 1 && d.getDate() === dd;
}
