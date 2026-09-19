import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Calendar,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import type {
  SatisfactionComment,
  SatisfactionRow,
  UsageStats,
  VisitorStats,
} from "./adminTypes";

interface StatsDashboardProps {
  usageStats: UsageStats | null;
  visitorStats: VisitorStats | null;
  satisfaction: SatisfactionRow[];
  satComments: SatisfactionComment[];
  statsLoading: boolean;
  onRefresh: () => void;
}

interface BarRow {
  label: string;
  count: number;
}

const BarList = memo(({ rows, color, labelWidth }: { rows: BarRow[]; color: string; labelWidth: string }) => {
  const max = useMemo(() => Math.max(...rows.map((r) => r.count), 1), [rows]);
  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">데이터 없음</p>;
  }
  return (
    <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
      {rows.map((row, i) => (
        <div key={`${row.label}-${i}`} className="flex items-center gap-2">
          <span className={`text-[11px] text-muted-foreground ${labelWidth} flex-shrink-0 font-mono`}>{row.label}</span>
          <div className="flex-1 h-5 bg-secondary/30 rounded overflow-hidden">
            <div className={`h-full ${color} rounded`} style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
          <span className="text-[11px] font-medium w-14 text-right">{row.count.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
});
BarList.displayName = "BarList";

const VisitorPanel = memo(({ visitorStats }: { visitorStats: VisitorStats }) => {
  const tabs = useMemo(
    () =>
      [
        {
          key: "daily",
          data: (visitorStats.last30 ?? []).map((d) => ({ label: d.date, count: d.count })),
          color: "bg-primary/70",
          w: "w-20",
        },
        {
          key: "monthly",
          data: (visitorStats.monthly ?? []).slice(-12).map((m) => ({ label: m.month, count: m.count })),
          color: "bg-accent/70",
          w: "w-16",
        },
        {
          key: "quarterly",
          data: (visitorStats.quarterly ?? []).map((q) => ({ label: q.quarter, count: q.count })),
          color: "bg-primary/60",
          w: "w-16",
        },
        {
          key: "yearly",
          data: (visitorStats.yearly ?? []).map((y) => ({ label: `${y.year}년`, count: y.count })),
          color: "bg-primary/80",
          w: "w-14",
        },
      ] as const,
    [visitorStats],
  );

  const cards = useMemo(
    () => [
      { label: "누적 접속자", value: visitorStats.total },
      { label: "올해 접속자", value: visitorStats.thisYear },
      { label: "이번 분기", value: visitorStats.thisQuarter ?? 0 },
      { label: "이번 달 접속자", value: visitorStats.thisMonth },
      { label: "오늘 접속자", value: visitorStats.today },
    ],
    [visitorStats],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {cards.map((s) => (
          <Card key={s.label} className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2 mb-2 text-primary">
              <BarChart3 className="w-4 h-4" />
              <span className="text-[10px] font-medium uppercase tracking-wider">{s.label}</span>
            </div>
            <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <Tabs defaultValue="daily" className="w-full">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> 접속자 추이
            </h3>
            <TabsList className="h-8">
              <TabsTrigger value="daily" className="text-xs h-6 px-2">일별</TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs h-6 px-2">월별</TabsTrigger>
              <TabsTrigger value="quarterly" className="text-xs h-6 px-2">분기별</TabsTrigger>
              <TabsTrigger value="yearly" className="text-xs h-6 px-2">연도별</TabsTrigger>
            </TabsList>
          </div>

          {tabs.map((tab) => (
            <TabsContent key={tab.key} value={tab.key} className="mt-0">
              <BarList rows={tab.data as BarRow[]} color={tab.color} labelWidth={tab.w} />
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </div>
  );
});
VisitorPanel.displayName = "VisitorPanel";

const SatisfactionPanel = memo(
  ({ satisfaction, satComments }: { satisfaction: SatisfactionRow[]; satComments: SatisfactionComment[] }) => {
    const { total, monthly, yearly } = useMemo(
      () => ({
        total: satisfaction.find((s) => s.bucket === "total"),
        monthly: satisfaction.filter((s) => s.bucket === "monthly").slice(0, 12),
        yearly: satisfaction.filter((s) => s.bucket === "yearly"),
      }),
      [satisfaction],
    );

    return (
      <Card className="p-4 space-y-4">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-amber-500" /> 만족도 조사
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">총 응답</p>
            <p className="text-2xl font-bold">{(total?.responses ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">평균 점수</p>
            <p className="text-2xl font-bold">{total?.avg_rating ? Number(total.avg_rating).toFixed(2) : "-"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">긍정(4~5점)</p>
            <p className="text-2xl font-bold">
              {total && total.responses > 0 ? `${Math.round(((total.r4 + total.r5) / total.responses) * 100)}%` : "-"}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">부정(1~2점)</p>
            <p className="text-2xl font-bold">
              {total && total.responses > 0 ? `${Math.round(((total.r1 + total.r2) / total.responses) * 100)}%` : "-"}
            </p>
          </div>
        </div>

        {total && total.responses > 0 && (
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((n) => {
              const c = (total as unknown as Record<string, number>)[`r${n}`];
              return (
                <div key={n} className="flex items-center gap-2">
                  <span className="text-[11px] w-8 font-mono text-muted-foreground">{n}점</span>
                  <div className="flex-1 h-4 bg-secondary/30 rounded overflow-hidden">
                    <div className="h-full bg-amber-400 rounded" style={{ width: `${(c / total.responses) * 100}%` }} />
                  </div>
                  <span className="text-[11px] w-10 text-right font-medium">{c}</span>
                </div>
              );
            })}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {([{ label: "월별", rows: monthly }, { label: "연도별", rows: yearly }] as const).map((g) => (
            <div key={g.label}>
              <p className="text-[11px] font-semibold mb-2">{g.label} 만족도</p>
              {g.rows.length ? (
                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {g.rows.map((r) => (
                    <div key={r.period} className="flex items-center gap-2">
                      <span className="text-[11px] w-16 font-mono text-muted-foreground">{r.period}</span>
                      <div className="flex-1 h-4 bg-secondary/30 rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/70 rounded"
                          style={{ width: `${((Number(r.avg_rating) || 0) / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] w-20 text-right font-medium">
                        {Number(r.avg_rating).toFixed(2)} ({r.responses})
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-2">데이터 없음</p>
              )}
            </div>
          ))}
        </div>

        <div>
          <p className="text-[11px] font-semibold mb-2">최근 의견</p>
          {satComments.length ? (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {satComments.map((c, i) => (
                <div key={i} className="rounded-lg border p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-[10px]">{c.rating}점</Badge>
                    {c.patent_number && (
                      <span className="text-[10px] font-mono text-muted-foreground">{c.patent_number}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(c.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  <p className="text-xs whitespace-pre-wrap">{c.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">등록된 의견이 없습니다.</p>
          )}
        </div>
      </Card>
    );
  },
);
SatisfactionPanel.displayName = "SatisfactionPanel";

const UsagePanel = memo(({ usageStats }: { usageStats: UsageStats }) => {
  const cards = useMemo(
    () => [
      { label: "AI 요약 생성", value: usageStats.totalSummaries, icon: <FileText className="w-4 h-4" /> },
      { label: "사업화 점수 분석", value: usageStats.totalScores, icon: <TrendingUp className="w-4 h-4" /> },
      { label: "총 검색 횟수", value: usageStats.totalSearches, icon: <Search className="w-4 h-4" /> },
      { label: "KIPRIS 데이터 캐시", value: usageStats.totalDataCache, icon: <Database className="w-4 h-4" /> },
    ],
    [usageStats],
  );

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-2 mb-2 text-primary">
              {stat.icon}
              <span className="text-[10px] font-medium uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium">현재 AI 모델</span>
        </div>
        <p className="text-sm font-mono font-semibold">{usageStats.currentModel || "google/gemini-3.6-flash"}</p>
        <p className="text-[10px] text-muted-foreground mt-1">분석 성능 대비 비용이 가장 우수한 모델로 고정 적용됩니다.</p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> 최근 7일 AI 요약 생성
          </h3>
          <BarList
            rows={usageStats.recentSummaries.map((d) => ({ label: d.date, count: d.count }))}
            color="bg-primary/60"
            labelWidth="w-12"
          />
        </Card>

        <Card className="p-4">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> 최근 7일 검색 활동
          </h3>
          <BarList
            rows={usageStats.recentSearches.map((d) => ({ label: d.date, count: d.count }))}
            color="bg-accent/60"
            labelWidth="w-12"
          />
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5" /> 인기 검색 특허 TOP 10
        </h3>
        {usageStats.topSearched.length > 0 ? (
          <div className="space-y-2">
            {usageStats.topSearched.map((item, i) => (
              <div key={`${item.patent_number}-${i}`} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20">
                <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono truncate">{item.patent_number}</p>
                  {item.patent_title && (
                    <p className="text-[10px] text-muted-foreground truncate">{item.patent_title}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                  {item.search_count}회
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">검색 데이터 없음</p>
        )}
      </Card>

      <p className="text-[10px] text-muted-foreground">
        ※ AI 사용량은 캐시된 분석 결과 기준이며, 실제 API 호출 비용과는 차이가 있을 수 있습니다.
      </p>
    </>
  );
});
UsagePanel.displayName = "UsagePanel";

export const StatsDashboard = memo(
  ({ usageStats, visitorStats, satisfaction, satComments, statsLoading, onRefresh }: StatsDashboardProps) => (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={statsLoading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${statsLoading ? "animate-spin" : ""}`} /> 새로고침
        </Button>
      </div>

      {visitorStats && <VisitorPanel visitorStats={visitorStats} />}

      <SatisfactionPanel satisfaction={satisfaction} satComments={satComments} />

      {statsLoading && !usageStats ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          통계 로딩 중...
        </div>
      ) : usageStats ? (
        <UsagePanel usageStats={usageStats} />
      ) : (
        <div className="text-center py-16 text-muted-foreground text-sm">
          통계 탭을 클릭하면 데이터를 불러옵니다.
        </div>
      )}
    </div>
  ),
);
StatsDashboard.displayName = "StatsDashboard";
