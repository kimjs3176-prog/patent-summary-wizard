import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Pencil, Trash2, Eye, EyeOff, Save, X, Loader2, Search, Star, Megaphone } from "lucide-react";
import { NoticeManager } from "@/components/admin/NoticeManager";
import { type FeaturedPatent, EMPTY_FORM } from './adminPageConstants';
import type { Dispatch, SetStateAction } from "react";

interface AdminContentPanelProps {
  patents: FeaturedPatent[];
  isLoading: boolean;
  editingId: string;
  setEditingId: Dispatch<SetStateAction<string>>;
  showForm: boolean;
  setShowForm: Dispatch<SetStateAction<boolean>>;
  form: { patent_number: string; title: string; description: string; recommendation_reason: string; category: string; transfer_status: string; contact_info: string; thumbnail_url: string; display_order: number; is_active: boolean; };
  setForm: Dispatch<SetStateAction<{ patent_number: string; title: string; description: string; recommendation_reason: string; category: string; transfer_status: string; contact_info: string; thumbnail_url: string; display_order: number; is_active: boolean; }>>;
  isFetchingPatent: boolean;
  categoryOptions: string[];
  apiCall: (action: string, data?: Record<string, unknown>) => Promise<any>;
  handleFetchPatentInfo: () => Promise<void>;
  handleSave: () => Promise<void>;
  handleEdit: (patent: FeaturedPatent) => void;
  handleDelete: (id: string) => Promise<void>;
  handleToggleActive: (patent: FeaturedPatent) => Promise<void>;
}

export function AdminContentPanel({ patents, isLoading, editingId, setEditingId, showForm, setShowForm, form, setForm, isFetchingPatent, categoryOptions, apiCall, handleFetchPatentInfo, handleSave, handleEdit, handleDelete, handleToggleActive }: AdminContentPanelProps) {
  return (
          <TabsContent value="content">
            <Accordion type="multiple" defaultValue={["patents", "notices"]} className="space-y-3">
              <AccordionItem value="patents" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> 이달의 특허 관리</span>
                </AccordionTrigger>
                <AccordionContent>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">이달의 특허 관리</h2>
              <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}>
                <Plus className="w-4 h-4 mr-1" /> 추가
              </Button>
            </div>

            {showForm && (
              <Card className="p-5 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-sm">{editingId ? "특허 수정" : "특허 등록"}</h2>
                  <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setEditingId(null); }}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid gap-3">
                  {/* Patent number with auto-fetch */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">특허번호 *</label>
                    <div className="flex gap-2">
                      <Input placeholder="10-1234567" value={form.patent_number} onChange={e => setForm(f => ({ ...f, patent_number: e.target.value }))} />
                      <Button variant="outline" size="sm" onClick={handleFetchPatentInfo} disabled={isFetchingPatent} className="flex-shrink-0">
                        {isFetchingPatent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        <span className="ml-1 hidden sm:inline">자동입력</span>
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">특허번호 입력 후 '자동입력'을 클릭하면 제목과 도면을 자동으로 가져옵니다</p>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">카테고리</label>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {categoryOptions.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setForm(f => ({ ...f, category: f.category === cat ? "" : cat }))}
                          className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                            form.category === cat
                              ? "bg-foreground text-background border-foreground"
                              : "bg-secondary/50 text-muted-foreground border-border/50 hover:bg-secondary"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <Input placeholder="직접 입력" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="mt-1" />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">제목 *</label>
                    <Input placeholder="특허 제목" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">설명</label>
                    <Textarea placeholder="특허 설명" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">추천 이유</label>
                    <Textarea placeholder="기술이전 추천 이유" rows={2} value={form.recommendation_reason} onChange={e => setForm(f => ({ ...f, recommendation_reason: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">기술이전 상태</label>
                      <Input placeholder="기술이전 가능" value={form.transfer_status} onChange={e => setForm(f => ({ ...f, transfer_status: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">연락처</label>
                      <Input placeholder="담당자 연락처" value={form.contact_info} onChange={e => setForm(f => ({ ...f, contact_info: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">도면 URL (자동 수집됨)</label>
                      <Input placeholder="https://..." value={form.thumbnail_url} onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))} />
                      {form.thumbnail_url && (
                        <img
                          src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(form.thumbnail_url)}`}
                          alt="도면 미리보기"
                          className="mt-2 w-20 h-20 rounded-lg object-cover bg-muted"
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">표시 순서</label>
                      <Input type="number" value={form.display_order} onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                    <label htmlFor="is_active" className="text-xs">활성화 (메인 페이지에 표시)</label>
                  </div>
                  <Button onClick={handleSave} disabled={isLoading} className="mt-2">
                    <Save className="w-4 h-4 mr-1" /> {editingId ? "수정" : "등록"}
                  </Button>
                </div>
              </Card>
            )}

            {patents.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                등록된 특허가 없습니다. '추가' 버튼으로 특허를 등록하세요.
              </div>
            ) : (
              <div className="space-y-3">
                {patents.map((patent) => (
                  <Card key={patent.id} className={`p-4 ${!patent.is_active ? "opacity-50" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {patent.thumbnail_url && (
                          <img
                            src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(patent.thumbnail_url)}`}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover bg-muted flex-shrink-0"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-mono text-muted-foreground">{patent.patent_number}</span>
                            {patent.category && <Badge variant="secondary" className="text-[10px]">{patent.category}</Badge>}
                            <Badge variant={patent.is_active ? "default" : "outline"} className="text-[10px]">
                              {patent.is_active ? "활성" : "비활성"}
                            </Badge>
                          </div>
                          <h3 className="text-sm font-medium line-clamp-1">{patent.title}</h3>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleActive(patent)}>
                          {patent.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(patent)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(patent.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="notices" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> 공지사항 관리</span>
                </AccordionTrigger>
                <AccordionContent>
                  <NoticeManager apiCall={apiCall} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
  );
}
