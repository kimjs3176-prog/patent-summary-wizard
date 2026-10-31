import { useMemo } from "react";
import { Check, RotateCcw, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EMPTY_SEARCH_FILTERS, isFilterActive, topOrgs, yearRange,
  type RegisteredFilter, type SearchFilterState, type SearchResultRow, type SearchSort,
} from "./searchFilters";

interface Props {
  results: SearchResultRow[];
  state: SearchFilterState;
  onChange: (next: SearchFilterState) => void;
  filteredCount: number;
}

function Segmented<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label={label}>
      <span className="text-[11px] font-semibold text-muted-foreground shrink-0">{label}</span>
      <div className="inline-flex rounded-full border border-border/60 bg-secondary/40 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
              value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const SORTS: { value: SearchSort; label: string }[] = [
  { value: "relevance", label: "관련도" },
  { value: "newest", label: "최신순" },
];
const REGISTERED: { value: RegisteredFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "registered", label: "등록" },
  { value: "unregistered", label: "미등록" },
];

/** Client-side filters/sort over the fetched search results. */
export function SearchFilterBar({ results, state, onChange, filteredCount }: Props) {
  const orgs = useMemo(() => topOrgs(results, 8, state.orgs), [results, state.orgs]);
  const range = useMemo(() => yearRange(results), [results]);
  const years = useMemo(() => {
    if (!range) return [];
    const out: number[] = [];
    for (let y = range.max; y >= range.min; y--) out.push(y);
    return out;
  }, [range]);
  const active = isFilterActive(state);
  const set = (patch: Partial<SearchFilterState>) => onChange({ ...state, ...patch });
  const toggleOrg = (name: string) =>
    set({ orgs: state.orgs.includes(name) ? state.orgs.filter((o) => o !== name) : [...state.orgs, name] });
  const selectClass = "h-7 rounded-lg border border-border/60 bg-card px-1.5 text-[11px] font-medium text-foreground tabular-nums";

  return (
    <section aria-label="검색 결과 필터" className="max-w-5xl mx-auto mb-4 rounded-2xl border border-border/50 bg-card px-3 py-3 md:px-4" style={{ boxShadow: "var(--shadow-xs)" }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
          <span aria-live="polite">
            {active ? (
              <>필터 적용 <span className="text-primary tabular-nums">{filteredCount}</span>건 / 전체 <span className="tabular-nums">{results.length}</span>건</>
            ) : (
              <>전체 <span className="tabular-nums">{results.length}</span>건</>
            )}
          </span>
        </span>
        <Segmented label="정렬" value={state.sort} options={SORTS} onChange={(sort) => set({ sort })} />
        <Segmented label="등록 여부" value={state.registered} options={REGISTERED} onChange={(registered) => set({ registered })} />
        {years.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground shrink-0">출원연도</span>
            <select
              aria-label="시작 연도"
              className={selectClass}
              value={state.yearFrom ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                set({ yearFrom: v, yearTo: v !== null && state.yearTo !== null && state.yearTo < v ? v : state.yearTo });
              }}
            >
              <option value="">처음</option>
              {[...years].reverse().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="text-[11px] text-muted-foreground">~</span>
            <select
              aria-label="끝 연도"
              className={selectClass}
              value={state.yearTo ?? ""}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                set({ yearTo: v, yearFrom: v !== null && state.yearFrom !== null && state.yearFrom > v ? v : state.yearFrom });
              }}
            >
              <option value="">최근</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
        {(active || state.sort !== "relevance") && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_SEARCH_FILTERS)}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" /> 초기화
          </button>
        )}
      </div>
      {orgs.length > 1 || state.orgs.length > 0 ? (
        <div className="mt-2.5 flex items-start gap-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0 pt-1">기관</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="기관·출원인 선택">
            {orgs.map((o) => {
              const on = state.orgs.includes(o.name);
              return (
                <button
                  key={o.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleOrg(o.name)}
                  className={cn("finder-chip inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors", on && "finder-chip-active")}
                  title={o.name}
                >
                  {on && <Check className="w-3 h-3 shrink-0" aria-hidden="true" />}
                  <span className="truncate max-w-[14rem]">{o.name}</span>
                  <span className="tabular-nums opacity-70">{o.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
