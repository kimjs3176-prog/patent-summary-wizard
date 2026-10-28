import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Save, X, Loader2, Video, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { type SiteSettings, SETTINGS_FIELDS } from './adminPageConstants';
import type { Dispatch, SetStateAction } from "react";

interface AdminHomepagePanelProps {
  siteSettings: SiteSettings;
  setSiteSettings: Dispatch<SetStateAction<SiteSettings>>;
  isSavingSettings: boolean;
  categoryOptions: string[];
  setCategoryOptions: Dispatch<SetStateAction<string[]>>;
  techVideos: { title: string; url: string; description?: string; category?: string; }[];
  setTechVideos: Dispatch<SetStateAction<{ title: string; url: string; description?: string; category?: string; }[]>>;
  dragVideoIdx: number;
  setDragVideoIdx: Dispatch<SetStateAction<number>>;
  homepageVisibleSections: Record<string, boolean>;
  setHomepageVisibleSections: Dispatch<SetStateAction<Record<string, boolean>>>;
  handleSaveSettings: () => Promise<void>;
}

export function AdminHomepagePanel({ siteSettings, setSiteSettings, isSavingSettings, categoryOptions, setCategoryOptions, techVideos, setTechVideos, dragVideoIdx, setDragVideoIdx, homepageVisibleSections, setHomepageVisibleSections, handleSaveSettings }: AdminHomepagePanelProps) {
  return (
          <TabsContent value="settings">
            <div className="space-y-4">
              <h2 className="font-semibold text-sm mb-4">홈페이지 문구 · 디자인 설정</h2>
              {SETTINGS_FIELDS.map(field => (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
                  <Input
                    type={(field as any).isSecret ? "password" : "text"}
                    value={siteSettings[field.key] || ""}
                    onChange={e => setSiteSettings(s => ({ ...s, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                </div>
              ))}

              {/* Color Settings */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">🎨 컬러 설정</h3>
                <div className="space-y-3">
                  {[
                    { key: "primary_color", label: "메인 컬러 (히어로 그라데이션)", placeholder: "#00aba2" },
                    { key: "accent_color", label: "액센트 컬러 (강조 요소)", placeholder: "#3b82f6" },
                  ].map(color => (
                    <div key={color.key}>
                      <label className="text-xs text-muted-foreground mb-1 block">{color.label}</label>
                      <div className="flex items-center gap-2">
                        <Input
                          value={siteSettings[color.key] || ""}
                          onChange={e => setSiteSettings(s => ({ ...s, [color.key]: e.target.value }))}
                          placeholder={color.placeholder}
                          className="flex-1"
                        />
                        <input
                          type="color"
                          value={siteSettings[color.key] || color.placeholder}
                          onChange={e => setSiteSettings(s => ({ ...s, [color.key]: e.target.value }))}
                          className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">기능 활성화/비활성화</h3>
                <div className="space-y-3">
                  {[
                    { key: "feature_pdf", label: "PDF 내보내기", desc: "특허 요약서를 PDF로 다운로드하는 기능" },
                    { key: "feature_favorites", label: "관심 특허(즐겨찾기)", desc: "요약 화면의 '담기' 버튼 및 비교 페이지" },
                    { key: "feature_search_history", label: "최근 검색 기록", desc: "메인 화면의 검색 기록 카드 노출" },
                    { key: "feature_glossary", label: "용어집 자동 주석", desc: "AI 요약 본문의 학술 용어 툴팁 자동 표시" },
                    { key: "feature_competitor_analysis", label: "경쟁 특허 비교 분석", desc: "요약 하단의 유사 특허 비교 표 노출" },
                  ].map(feat => {
                    const isOn = siteSettings[feat.key] !== "false";
                    return (
                      <div key={feat.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
                        <div>
                          <p className="text-sm font-medium">{feat.label}</p>
                          <p className="text-[11px] text-muted-foreground">{feat.desc}</p>
                        </div>
                        <button
                          onClick={() => setSiteSettings(s => ({ ...s, [feat.key]: isOn ? "false" : "true" }))}
                          className="flex-shrink-0"
                        >
                          {isOn ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Homepage Section Visibility */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">홈페이지 섹션 표시/숨김</h3>
                <div className="space-y-3">
                  {[
                    { key: "featuredPatents", label: "이달의 특허", desc: "기술이전 추천 특허 카드 섹션" },
                    { key: "techVideos", label: "기술소개 영상", desc: "유튜브 영상 카드 섹션" },
                    { key: "techTransferGuide", label: "기술이전 가이드", desc: "기술이전 절차 안내 섹션" },
                    { key: "popularSearches", label: "인기 검색 특허", desc: "자주 검색되는 특허 버튼" },
                    { key: "notices", label: "공지사항", desc: "공지사항 섹션 표시" },
                  ].map(item => {
                    const isOn = homepageVisibleSections[item.key] !== false;
                    return (
                      <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <button onClick={() => setHomepageVisibleSections(prev => ({ ...prev, [item.key]: !isOn }))} className="flex-shrink-0">
                          {isOn ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Search Helper Texts */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-1">🔄 검색창 랜덤 안내 문구</h3>
                <p className="text-[11px] text-muted-foreground mb-3">검색창 아래에 랜덤으로 표시되는 안내 문구를 관리합니다. 비워두면 기본 문구가 사용됩니다.</p>
                {(() => {
                  let helperTexts: string[] = [];
                  try { helperTexts = JSON.parse(siteSettings.search_helper_texts || "[]"); } catch { helperTexts = []; }
                  if (!Array.isArray(helperTexts)) helperTexts = [];
                  const updateTexts = (newTexts: string[]) => setSiteSettings(s => ({ ...s, search_helper_texts: JSON.stringify(newTexts) }));
                  return (
                    <div className="space-y-2">
                      {helperTexts.map((text, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <Input
                            value={text}
                            onChange={e => { const t = [...helperTexts]; t[i] = e.target.value; updateTexts(t); }}
                            placeholder={`안내 문구 ${i + 1}`}
                            className="flex-1 text-sm"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => { const t = helperTexts.filter((_, idx) => idx !== i); updateTexts(t); }}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => updateTexts([...helperTexts, ""])}>
                        <Plus className="w-3 h-3" /> 문구 추가
                      </Button>
                    </div>
                  );
                })()}
              </div>

              {/* Category Management */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">기술분류 카테고리 관리</h3>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {categoryOptions.map((cat, idx) => (
                    <div key={idx} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-secondary border border-border/50">
                      <span>{cat}</span>
                      <button onClick={() => setCategoryOptions(prev => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="새 카테고리명 입력" id="new-category-input" onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val && !categoryOptions.includes(val)) { setCategoryOptions(prev => [...prev, val]); (e.target as HTMLInputElement).value = ""; }
                    }
                  }} />
                  <Button variant="outline" size="sm" onClick={() => {
                    const input = document.getElementById("new-category-input") as HTMLInputElement;
                    const val = input?.value.trim();
                    if (val && !categoryOptions.includes(val)) { setCategoryOptions(prev => [...prev, val]); input.value = ""; }
                  }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> 추가
                  </Button>
                </div>
              </div>

              {/* Video Management */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> 기술소개영상 관리 (홈 상위 3개 노출 / 전체는 온라인 기술 홍보관 · 9개 초과 시 세로 스크롤)</h3>

				{/* Video Category Management */}
				{(() => {
					let videoCats: string[] = [];
					try { videoCats = JSON.parse(siteSettings.video_categories || "[]"); } catch { videoCats = []; }
					if (!Array.isArray(videoCats)) videoCats = [];
					const updateCats = (next: string[]) => setSiteSettings(s => ({ ...s, video_categories: JSON.stringify(next) }));
					return (
						<div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-border/40">
							<p className="text-[12px] font-medium mb-2">영상 카테고리 (온라인 기술 홍보관 상단 탭)</p>
							<div className="flex flex-wrap gap-1.5 mb-2">
								{videoCats.map((cat, i) => (
									<div key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-background border border-border/50">
										<span>{cat}</span>
										<button onClick={() => updateCats(videoCats.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
											<X className="w-3 h-3" />
										</button>
									</div>
								))}
								{videoCats.length === 0 && <span className="text-[11px] text-muted-foreground">카테고리를 추가하면 홍보관 페이지 상단에 탭으로 표시됩니다.</span>}
							</div>
							<div className="flex gap-2">
								<Input placeholder="새 영상 카테고리 입력" id="new-video-category-input" onKeyDown={(e) => {
									if (e.key === "Enter") {
										const val = (e.target as HTMLInputElement).value.trim();
										if (val && !videoCats.includes(val)) { updateCats([...videoCats, val]); (e.target as HTMLInputElement).value = ""; }
									}
								}} />
								<Button variant="outline" size="sm" onClick={() => {
									const input = document.getElementById("new-video-category-input") as HTMLInputElement;
									const val = input?.value.trim();
									if (val && !videoCats.includes(val)) { updateCats([...videoCats, val]); input.value = ""; }
								}}>
									<Plus className="w-3.5 h-3.5 mr-1" /> 추가
								</Button>
							</div>
						</div>
					);
				})()}

                {/* Drag & drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2','ring-primary'); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2','ring-primary'); }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('ring-2','ring-primary');
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
                    if (files.length === 0) { toast.error('동영상 파일만 업로드 가능합니다.'); return; }
                    for (const file of files) {
                      const ext = file.name.split('.').pop() || 'mp4';
                      const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
                      toast.message(`업로드 중: ${file.name}`);
                      const { error } = await supabase.storage.from('tech-videos').upload(path, file, { contentType: file.type, upsert: false });
                      if (error) { toast.error(`업로드 실패: ${file.name} — ${error.message}`); continue; }
                      const titleGuess = file.name.replace(/\.[^.]+$/, '');
                      setTechVideos(prev => [...prev, { title: titleGuess, url: `storage://${path}` }]);
                      toast.success(`업로드 완료: ${file.name}`);
                    }
                  }}
                  className="rounded-xl border-2 border-dashed border-border bg-secondary/30 p-6 text-center mb-3 transition-all"
                >
                  <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                  <p className="text-sm font-medium text-foreground">동영상 파일을 여기로 드래그하세요</p>
                  <p className="text-[11px] text-muted-foreground mt-1">또는 아래에서 파일 선택 / YouTube URL 직접 입력</p>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    id="tech-video-file-input"
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) {
                        const ext = file.name.split('.').pop() || 'mp4';
                        const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
                        toast.message(`업로드 중: ${file.name}`);
                        const { error } = await supabase.storage.from('tech-videos').upload(path, file, { contentType: file.type, upsert: false });
                        if (error) { toast.error(`업로드 실패: ${file.name} — ${error.message}`); continue; }
                        const titleGuess = file.name.replace(/\.[^.]+$/, '');
                        setTechVideos(prev => [...prev, { title: titleGuess, url: `storage://${path}` }]);
                        toast.success(`업로드 완료: ${file.name}`);
                      }
                      e.target.value = '';
                    }}
                  />
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => document.getElementById('tech-video-file-input')?.click()}>
                    파일 선택
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground mb-2">왼쪽 ⋮⋮ 핸들을 드래그하여 순서를 변경할 수 있습니다.</p>
                <div className="space-y-3 mb-3 max-h-[520px] overflow-y-auto pr-1">
                  {techVideos.map((v, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={() => setDragVideoIdx(idx)}
                      onDragOver={(e) => { e.preventDefault(); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragVideoIdx === null || dragVideoIdx === idx) return;
                        setTechVideos(prev => {
                          const next = [...prev];
                          const [moved] = next.splice(dragVideoIdx, 1);
                          next.splice(idx, 0, moved);
                          return next;
                        });
                        setDragVideoIdx(null);
                      }}
                      onDragEnd={() => setDragVideoIdx(null)}
                      className={`rounded-lg border border-border/50 bg-card p-2.5 ${dragVideoIdx === idx ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="cursor-grab active:cursor-grabbing text-muted-foreground select-none px-1" title="드래그하여 순서 변경">⋮⋮</span>
                        <span className="text-[11px] text-muted-foreground w-6 text-center">{idx + 1}</span>
                        <Input placeholder="영상 제목" value={v.title} onChange={e => setTechVideos(prev => prev.map((item, i) => i === idx ? { ...item, title: e.target.value } : item))} className="flex-1" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-destructive" onClick={async () => {
                          if (!confirm(`'${v.title || '제목 없음'}' 영상을 삭제하시겠습니까?`)) return;
                          const item = techVideos[idx];
                          if (item?.url?.startsWith('storage://')) {
                            const path = item.url.replace('storage://', '');
                            await supabase.storage.from('tech-videos').remove([path]).catch(() => {});
                          }
                          setTechVideos(prev => prev.filter((_, i) => i !== idx));
                          toast.success('삭제되었습니다.');
                        }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                      <Input placeholder="YouTube URL 또는 storage://경로" value={v.url} onChange={e => setTechVideos(prev => prev.map((item, i) => i === idx ? { ...item, url: e.target.value } : item))} className="mb-2 text-[12px]" />
                      {(() => {
                        let videoCats: string[] = [];
                        try { videoCats = JSON.parse(siteSettings.video_categories || "[]"); } catch { videoCats = []; }
                        if (!Array.isArray(videoCats)) videoCats = [];
                        const cur = (v as any).category || "";
                        return (
                          <select
                            value={cur}
                            onChange={e => setTechVideos(prev => prev.map((item, i) => i === idx ? { ...item, category: e.target.value } as any : item))}
                            className="mb-2 w-full h-9 rounded-md border border-input bg-background px-2 text-[12px]"
                          >
                            <option value="">카테고리 선택 안 함 (미분류)</option>
                            {videoCats.map((cat, i) => (
                              <option key={i} value={cat}>{cat}</option>
                            ))}
                          </select>
                        );
                      })()}
                      <Textarea placeholder="영상 설명 (선택 · 홍보관 카드에 표시됩니다)" rows={2} value={v.description || ''} onChange={e => setTechVideos(prev => prev.map((item, i) => i === idx ? { ...item, description: e.target.value } : item))} className="text-[12px]" />
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setTechVideos(prev => [...prev, { title: "", url: "" }])}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> URL 직접 추가
                </Button>
              </div>


              <Button onClick={() => {
                setSiteSettings(s => ({ ...s, tech_categories: JSON.stringify(categoryOptions), tech_videos: JSON.stringify(techVideos) }));
                handleSaveSettings();
              }} disabled={isSavingSettings} className="w-full mt-4">
                {isSavingSettings ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                설정 저장
              </Button>
            </div>
          </TabsContent>
  );
}
