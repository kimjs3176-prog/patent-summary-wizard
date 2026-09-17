import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Search, ArrowRight, Loader2 } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PotentialPatent {
  id: string;
  application_number: string;
  registration_number: string | null;
  title: string;
  grade: string | null;
  acquired_year: number | null;
  registration_date: string | null;
}

const GRADES = ["전체", "S", "A+", "A", "B+", "B", "C+", "C", "D+", "D"];
const PAGE_SIZE = 30;

const gradeClass = (g: string | null) => {
  if (!g) return "bg-muted text-muted-foreground";
  if (g.startsWith("S") || g.startsWith("A")) return "bg-primary/12 text-primary border-primary/25";
  if (g.startsWith("B")) return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  if (g.startsWith("C")) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
  return "bg-muted text-muted-foreground border-border";
};

const PotentialTech = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PotentialPatent[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("전체");
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.title = "잠재기술(무상기술이전) | Agri IP Summary";
    const load = async () => {
      const { data } = await supabase
        .from("potential_patents")
        .select("id, application_number, registration_number, title, grade, acquired_year, registration_date")
        .eq("is_active", true)
        .order("grade", { ascending: true })
        .order("acquired_year", { ascending: false })
        .limit(1000);
      setRows((data ?? []) as PotentialPatent[]);
      setLoading(false);
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (grade !== "전체" && r.grade !== grade) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.application_number.includes(q) ||
        (r.registration_number ?? "").includes(q)
      );
    });
  }, [rows, query, grade]);

  useEffect(() => setPage(1), [query, grade]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <PageLayout>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-10">
        <div className="max-w-5xl mx-auto">
          <header className="mb-6 md:mb-8">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-4 h-4 text-primary" />
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.18em]">
                Potential Technology
              </p>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              잠재기술 <span className="text-primary">무상기술이전</span>
            </h1>
            <p className="mt-2 text-[13px] md:text-sm text-muted-foreground leading-relaxed max-w-2xl">
              농촌진흥청이 보유한 미활용 특허 {rows.length}건입니다. 기술력 등급평가 결과와 함께 제공되며,
              관심 기술을 선택하면 AI 요약 분석 결과를 바로 확인할 수 있습니다.
            </p>
          </header>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="기술명 · 출원번호 · 등록번호 검색"
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-5">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGrade(g)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors ${
                  grade === g
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/60 hover:border-primary/40"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> <span className="text-sm">목록 불러오는 중...</span>
            </div>
          ) : (
            <>
              <p className="text-[12px] font-mono text-muted-foreground mb-2">
                {filtered.length}건 / {page}–{totalPages} 페이지
              </p>
              <ul className="rounded-2xl border border-border/50 bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                {pageRows.map((r) => (
                  <li key={r.id} className="border-b border-border/40 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => navigate(`/?patent=${encodeURIComponent(r.application_number)}`)}
                      className="w-full text-left px-4 py-3.5 hover:bg-muted/40 transition-colors flex items-start gap-3"
                    >
                      <span className={`shrink-0 mt-0.5 px-2 py-0.5 rounded-md border text-[11px] font-mono font-bold ${gradeClass(r.grade)}`}>
                        {r.grade ?? "-"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold leading-snug break-keep">{r.title}</span>
                        <span className="block mt-1 text-[11px] font-mono text-muted-foreground">
                          출원 {r.application_number}
                          {r.registration_number ? ` · 등록 ${r.registration_number}` : ""}
                          {r.acquired_year ? ` · ${r.acquired_year}년` : ""}
                        </span>
                      </span>
                      <ArrowRight className="shrink-0 w-4 h-4 text-muted-foreground mt-1" />
                    </button>
                  </li>
                ))}
                {pageRows.length === 0 && (
                  <li className="px-4 py-12 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</li>
                )}
              </ul>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-5">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    이전
                  </Button>
                  <span className="text-[12px] font-mono text-muted-foreground tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </PageLayout>
  );
};

export default PotentialTech;
