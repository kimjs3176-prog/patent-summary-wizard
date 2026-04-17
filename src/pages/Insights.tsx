import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, TrendingUp, Award, Building2, Layers, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout/PageLayout";
import { useFavoritePatents } from "@/hooks/useFavoritePatents";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";

const SCORE_BANDS = [
  { label: "S (90+)", min: 90, color: "hsl(158, 64%, 40%)" },
  { label: "A (80-89)", min: 80, color: "hsl(190, 70%, 45%)" },
  { label: "B (70-79)", min: 70, color: "hsl(45, 93%, 47%)" },
  { label: "C (60-69)", min: 60, color: "hsl(25, 90%, 55%)" },
  { label: "D (<60)", min: 0, color: "hsl(350, 65%, 55%)" },
];

function getBand(score: number) {
  return SCORE_BANDS.find((b) => score >= b.min) || SCORE_BANDS[SCORE_BANDS.length - 1];
}

export default function Insights() {
  const { favorites } = useFavoritePatents();
  const { history } = useSearchHistory();

  // Combine analyzed patents from both sources (dedupe by patent number)
  const allAnalyzed = useMemo(() => {
    const map = new Map<string, { patentNumber: string; score: number | null; ipcs: string[]; assignee?: string; trl?: number }>();
    favorites.forEach((f) => {
      map.set(f.patentNumber, {
        patentNumber: f.patentNumber,
        score: f.commercializationScore ?? null,
        ipcs: f.patentData.classifications || [],
        assignee: f.patentData.assignee,
        trl: f.commercializationDetails?.trl,
      });
    });
    history.forEach((h) => {
      if (!map.has(h.patentNumber)) {
        map.set(h.patentNumber, {
          patentNumber: h.patentNumber,
          score: h.commercializationScore ?? null,
          ipcs: h.patentData.classifications || [],
          assignee: h.patentData.assignee,
          trl: undefined,
        });
      }
    });
    return Array.from(map.values());
  }, [favorites, history]);

  const scored = allAnalyzed.filter((p) => p.score != null) as Array<typeof allAnalyzed[0] & { score: number }>;

  // Aggregate stats
  const stats = useMemo(() => {
    const total = allAnalyzed.length;
    const scoredCount = scored.length;
    const avg = scoredCount > 0 ? scored.reduce((s, p) => s + p.score, 0) / scoredCount : 0;
    const max = scoredCount > 0 ? Math.max(...scored.map((p) => p.score)) : 0;
    const trls = allAnalyzed.map((p) => p.trl).filter((t): t is number => t != null);
    const avgTrl = trls.length > 0 ? trls.reduce((s, t) => s + t, 0) / trls.length : 0;
    return { total, scoredCount, avg, max, avgTrl };
  }, [allAnalyzed, scored]);

  // Score distribution
  const scoreDistribution = useMemo(() => {
    const counts = SCORE_BANDS.map((b) => ({ ...b, value: 0 }));
    scored.forEach((p) => {
      const band = getBand(p.score);
      const item = counts.find((c) => c.label === band.label);
      if (item) item.value += 1;
    });
    return counts.filter((c) => c.value > 0);
  }, [scored]);

  // IPC distribution (top 8)
  const ipcDistribution = useMemo(() => {
    const map = new Map<string, number>();
    allAnalyzed.forEach((p) => {
      p.ipcs.forEach((c) => {
        const section = c.trim().slice(0, 4);
        if (section) map.set(section, (map.get(section) || 0) + 1);
      });
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [allAnalyzed]);

  // Top assignees
  const topAssignees = useMemo(() => {
    const map = new Map<string, { count: number; totalScore: number; scoredCount: number }>();
    allAnalyzed.forEach((p) => {
      const a = p.assignee?.trim();
      if (!a) return;
      const cur = map.get(a) || { count: 0, totalScore: 0, scoredCount: 0 };
      cur.count += 1;
      if (p.score != null) {
        cur.totalScore += p.score;
        cur.scoredCount += 1;
      }
      map.set(a, cur);
    });
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5)
      .map(([name, v]) => ({
        name,
        count: v.count,
        avgScore: v.scoredCount > 0 ? Math.round(v.totalScore / v.scoredCount) : null,
      }));
  }, [allAnalyzed]);

  // TRL gauge data for radial chart
  const trlGaugeData = [{ name: "TRL", value: stats.avgTrl, fill: "hsl(var(--primary))" }];

  const COLORS = [
    "hsl(158, 64%, 40%)",
    "hsl(220, 70%, 55%)",
    "hsl(45, 93%, 47%)",
    "hsl(350, 65%, 55%)",
    "hsl(280, 60%, 55%)",
    "hsl(190, 70%, 45%)",
    "hsl(25, 90%, 55%)",
    "hsl(160, 50%, 60%)",
  ];

  const headerRight = (
    <Link to="/">
      <Button variant="ghost" size="sm" className="gap-2 rounded-full">
        <ArrowLeft className="w-4 h-4" /> 홈으로
      </Button>
    </Link>
  );

  if (allAnalyzed.length === 0) {
    return (
      <PageLayout headerRight={headerRight}>
        <main className="container mx-auto px-4 md:px-6 py-8 relative z-10">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg text-foreground">분석 인사이트</h2>
          </div>
          <div className="text-center py-20">
            <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
            <p className="text-muted-foreground mb-4">아직 분석한 특허가 없습니다.</p>
            <Link to="/"><Button>특허 분석 시작하기</Button></Link>
          </div>
        </main>
      </PageLayout>
    );
  }

  return (
    <PageLayout headerRight={headerRight}>
      <main className="container mx-auto px-4 md:px-6 py-8 relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg text-foreground">분석 인사이트</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">최근 분석한 특허들의 통계와 트렌드를 한눈에 확인하세요</p>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard icon={<Layers className="w-4 h-4" />} label="분석 특허" value={stats.total} unit="건" />
          <KpiCard icon={<Award className="w-4 h-4" />} label="평균 사업화 점수" value={Math.round(stats.avg)} unit="점" accent />
          <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="최고 점수" value={stats.max} unit="점" />
          <KpiCard icon={<Activity className="w-4 h-4" />} label="평균 TRL" value={stats.avgTrl.toFixed(1)} unit="단계" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Score Distribution Pie */}
          <Section title="점수 등급 분포" icon={<Award className="w-4 h-4 text-primary" />}>
            {scoreDistribution.length === 0 ? (
              <EmptyMini text="점수 데이터가 부족합니다" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={scoreDistribution}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={3}
                    label={(entry) => `${entry.label} (${entry.value})`}
                    labelLine={false}
                    style={{ fontSize: "10px" }}
                  >
                    {scoreDistribution.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border) / 0.5)",
                      background: "hsl(var(--card))",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* Average TRL Gauge */}
          <Section title="평균 기술성숙도 (TRL)" icon={<Activity className="w-4 h-4 text-primary" />}>
            {stats.avgTrl === 0 ? (
              <EmptyMini text="TRL 데이터가 부족합니다" />
            ) : (
              <div className="relative" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="90%"
                    barSize={20}
                    data={trlGaugeData}
                    startAngle={180}
                    endAngle={0}
                  >
                    <PolarAngleAxis type="number" domain={[0, 9]} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={10} fill="hsl(var(--primary))" background={{ fill: "hsl(var(--muted))" }} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 pointer-events-none">
                  <span className="text-3xl font-bold text-primary">{stats.avgTrl.toFixed(1)}</span>
                  <span className="text-[10px] text-muted-foreground">/ 9 단계</span>
                </div>
              </div>
            )}
          </Section>

          {/* IPC Distribution */}
          <Section title="주요 기술분야 (IPC)" icon={<Layers className="w-4 h-4 text-primary" />}>
            {ipcDistribution.length === 0 ? (
              <EmptyMini text="IPC 데이터가 부족합니다" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ipcDistribution} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border) / 0.5)",
                      background: "hsl(var(--card))",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value}건`, "특허 수"]}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={20}>
                    {ipcDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Section>

          {/* Top Assignees */}
          <Section title="주요 출원기관" icon={<Building2 className="w-4 h-4 text-primary" />}>
            {topAssignees.length === 0 ? (
              <EmptyMini text="출원인 데이터가 부족합니다" />
            ) : (
              <div className="space-y-2.5 py-1">
                {topAssignees.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                        <div className="flex items-baseline gap-1.5 shrink-0">
                          <span className="text-xs text-muted-foreground">{a.count}건</span>
                          {a.avgScore != null && (
                            <span className="text-xs font-bold" style={{ color: getBand(a.avgScore).color }}>
                              평균 {a.avgScore}점
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(a.count / topAssignees[0].count) * 100}%`,
                            background: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Recent High-Scorers */}
        {scored.length > 0 && (
          <section className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">상위 분석 특허</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...scored]
                .sort((a, b) => b.score - a.score)
                .slice(0, 6)
                .map((p) => {
                  const band = getBand(p.score);
                  return (
                    <Link
                      key={p.patentNumber}
                      to={`/?patent=${encodeURIComponent(p.patentNumber)}`}
                      className="rounded-2xl border border-border/40 bg-card/50 p-4 hover:border-primary/40 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[10px] text-muted-foreground font-mono">{p.patentNumber}</p>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-md"
                          style={{ background: `${band.color}20`, color: band.color }}
                        >
                          {p.score}점
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{p.assignee || "출원인 정보 없음"}</p>
                      {p.ipcs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {p.ipcs.slice(0, 3).map((c, i) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">
                              {c.slice(0, 4)}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })}
            </div>
          </section>
        )}
      </main>
    </PageLayout>
  );
}

function KpiCard({ icon, label, value, unit, accent }: { icon: React.ReactNode; label: string; value: number | string; unit: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${
        accent ? "border-primary/30 bg-primary/5" : "border-border/40 bg-card/50"
      }`}
      style={{ boxShadow: "0 1px 3px hsl(var(--foreground) / 0.03)" }}
    >
      <div className="flex items-center gap-1.5 mb-2 text-muted-foreground">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</span>
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/50 p-4" style={{ boxShadow: "0 1px 3px hsl(var(--foreground) / 0.03)" }}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="text-center py-12 text-xs text-muted-foreground">{text}</div>;
}
