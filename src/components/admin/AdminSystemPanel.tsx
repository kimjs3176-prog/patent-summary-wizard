import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Trash2, Loader2, Database, RefreshCw, KeyRound, BarChart3 } from "lucide-react";
import { StatsDashboard } from "@/components/admin/StatsDashboard";
import type { UsageStats, VisitorStats } from "@/components/admin/adminTypes";
import { type CacheItem, type CacheCounts } from './adminPageConstants';
import type { Dispatch, SetStateAction } from "react";

interface AdminSystemPanelProps {
  cacheCounts: CacheCounts;
  cacheItems: CacheItem[];
  cacheLoading: boolean;
  cachePage: number;
  selectedCacheIds: Set<string>;
  setSelectedCacheIds: Dispatch<SetStateAction<Set<string>>>;
  usageStats: UsageStats;
  statsLoading: boolean;
  visitorStats: VisitorStats;
  satisfaction: { bucket: string; period: string; responses: number; avg_rating: number | null; r1: number; r2: number; r3: number; r4: number; r5: number; }[];
  satComments: { rating: number; comment: string; patent_number: string | null; created_at: string; }[];
  loadUsageStats: () => Promise<void>;
  newAdminPassword: string;
  setNewAdminPassword: Dispatch<SetStateAction<string>>;
  confirmAdminPassword: string;
  setConfirmAdminPassword: Dispatch<SetStateAction<string>>;
  isChangingPassword: boolean;
  loadCache: (page?: number) => Promise<void>;
  handleDeleteCache: () => Promise<void>;
  handleDeleteAllCache: () => Promise<void>;
  handleChangePassword: () => Promise<void>;
}

export function AdminSystemPanel({ cacheCounts, cacheItems, cacheLoading, cachePage, selectedCacheIds, setSelectedCacheIds, usageStats, statsLoading, visitorStats, satisfaction, satComments, loadUsageStats, newAdminPassword, setNewAdminPassword, confirmAdminPassword, setConfirmAdminPassword, isChangingPassword, loadCache, handleDeleteCache, handleDeleteAllCache, handleChangePassword }: AdminSystemPanelProps) {
  return (
          <TabsContent value="system">
            <Accordion type="multiple" defaultValue={["stats"]} className="space-y-3">
              <AccordionItem value="stats" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> 통계 대시보드</span>
                </AccordionTrigger>
                <AccordionContent>
                  <StatsDashboard
                    usageStats={usageStats}
                    visitorStats={visitorStats}
                    satisfaction={satisfaction}
                    satComments={satComments}
                    statsLoading={statsLoading}
                    onRefresh={loadUsageStats}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cache" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> 캐시 관리</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-end">
                      <Button variant="outline" size="sm" onClick={() => loadCache(cachePage)} disabled={cacheLoading}>
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${cacheLoading ? "animate-spin" : ""}`} /> 새로고침
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "특허 원본 데이터", count: cacheCounts.data },
                        { label: "AI 요약 캐시", count: cacheCounts.ai },
                        { label: "사업화 점수 캐시", count: cacheCounts.score },
                      ].map(item => (
                        <Card key={item.label} className="p-3 text-center">
                          <p className="text-2xl font-bold">{item.count}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">{item.label}</p>
                        </Card>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="destructive" size="sm" onClick={handleDeleteCache} disabled={selectedCacheIds.size === 0 || cacheLoading}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> 선택 삭제 ({selectedCacheIds.size})
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleDeleteAllCache} disabled={cacheLoading || cacheCounts.data === 0} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> 전체 삭제
                      </Button>
                    </div>

                    {cacheItems.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        {cacheLoading ? "로딩 중..." : "캐시된 데이터가 없습니다."}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground border-b border-border/50">
                          <input type="checkbox" checked={selectedCacheIds.size === cacheItems.length && cacheItems.length > 0} onChange={(e) => {
                            if (e.target.checked) setSelectedCacheIds(new Set(cacheItems.map(i => i.id)));
                            else setSelectedCacheIds(new Set());
                          }} />
                          <span className="flex-1">특허번호</span>
                          <span>캐시 일시</span>
                        </div>
                        {cacheItems.map(item => (
                          <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/30 transition-colors">
                            <input type="checkbox" checked={selectedCacheIds.has(item.id)} onChange={(e) => {
                              const next = new Set(selectedCacheIds);
                              if (e.target.checked) next.add(item.id); else next.delete(item.id);
                              setSelectedCacheIds(next);
                            }} />
                            <span className="flex-1 text-sm font-mono">{item.patent_number}</span>
                            <span className="text-[11px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("ko-KR")}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {cacheCounts.data > 20 && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <Button variant="outline" size="sm" disabled={cachePage === 0 || cacheLoading} onClick={() => loadCache(cachePage - 1)}>이전</Button>
                        <span className="text-xs text-muted-foreground">{cachePage + 1} / {Math.ceil(cacheCounts.data / 20)}</span>
                        <Button variant="outline" size="sm" disabled={(cachePage + 1) * 20 >= cacheCounts.data || cacheLoading} onClick={() => loadCache(cachePage + 1)}>다음</Button>
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground">
                      캐시 삭제 시 해당 특허의 AI 요약과 사업화 점수 캐시도 함께 삭제됩니다.
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="security" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /> 보안 설정</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <p className="text-[11px] text-muted-foreground">현재 로그인된 관리자 비밀번호를 새 비밀번호로 변경합니다.</p>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">새 비밀번호</label>
                      <Input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} placeholder="4~100자 입력" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">새 비밀번호 확인</label>
                      <Input type="password" value={confirmAdminPassword} onChange={(e) => setConfirmAdminPassword(e.target.value)} placeholder="비밀번호를 다시 입력" />
                    </div>
                    <Button onClick={handleChangePassword} disabled={isChangingPassword}>
                      {isChangingPassword ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <KeyRound className="w-4 h-4 mr-1" />}
                      비밀번호 변경
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
  );
}
