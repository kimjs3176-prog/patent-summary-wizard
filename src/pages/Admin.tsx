import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft, Save, X, Loader2, Search, Settings, Star, Video, ToggleLeft, ToggleRight, Database, RefreshCw, FileText } from "lucide-react";
import { toast } from "sonner";

interface FeaturedPatent {
  id: string;
  patent_number: string;
  title: string;
  description: string | null;
  recommendation_reason: string | null;
  category: string | null;
  transfer_status: string | null;
  contact_info: string | null;
  thumbnail_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_CATEGORY_OPTIONS = ["기계설비용품", "기능성소재", "식품", "재배생육", "환경·에너지", "기타", "잠재기술"];

const EMPTY_FORM = {
  patent_number: "",
  title: "",
  description: "",
  recommendation_reason: "",
  category: "",
  transfer_status: "기술이전 가능",
  contact_info: "",
  thumbnail_url: "",
  display_order: 0,
  is_active: true,
};

type SiteSettings = Record<string, string>;

interface CacheItem {
  id: string;
  patent_number: string;
  created_at: string;
}

interface CacheCounts {
  data: number;
  ai: number;
  score: number;
}

const SETTINGS_FIELDS = [
  { key: "header_title", label: "헤더 타이틀", placeholder: "농식품분야 특허 AI 기술요약" },
  { key: "header_subtitle", label: "헤더 서브타이틀", placeholder: "Agri-Food Patent AI Summary" },
  { key: "hero_title", label: "히어로 타이틀 1줄", placeholder: "농식품분야 특허" },
  { key: "hero_title_accent", label: "히어로 강조 텍스트", placeholder: "AI 기술요약" },
  { key: "hero_title_suffix", label: "히어로 타이틀 끝", placeholder: "서비스" },
  { key: "hero_description", label: "히어로 설명", placeholder: "농식품 분야 특허를 AI가 자동으로 분석하고 요약합니다" },
  { key: "featured_section_title", label: "이달의 특허 섹션 제목", placeholder: "이달의 특허 · 기술이전 추천" },
  { key: "featured_section_subtitle", label: "이달의 특허 섹션 부제목", placeholder: "농식품 분야 기술이전 추천 특허" },
  { key: "footer_line1", label: "푸터 1줄", placeholder: "본 서비스는..." },
  { key: "footer_line2", label: "푸터 2줄", placeholder: "KIPRIS 데이터 연동..." },
  { key: "kipris_api_key", label: "KIPRIS API 키", placeholder: "API 키를 입력하세요", isSecret: true },
];

const Admin = () => {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [patents, setPatents] = useState<FeaturedPatent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isFetchingPatent, setIsFetchingPatent] = useState(false);
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS);
  const [techVideos, setTechVideos] = useState<{ title: string; url: string }[]>([]);
  const [cacheCounts, setCacheCounts] = useState<CacheCounts>({ data: 0, ai: 0, score: 0 });
  const [cacheItems, setCacheItems] = useState<CacheItem[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cachePage, setCachePage] = useState(0);
  const [selectedCacheIds, setSelectedCacheIds] = useState<Set<string>>(new Set());

  // Homepage section visibility
  const DEFAULT_HOMEPAGE_SECTIONS: Record<string, boolean> = {
    featuredPatents: true,
    techVideos: true,
    techTransferGuide: true,
    popularSearches: true,
  };
  const [homepageVisibleSections, setHomepageVisibleSections] = useState<Record<string, boolean>>(DEFAULT_HOMEPAGE_SECTIONS);

  // Summary customization state
  const DEFAULT_SECTION_TITLES: Record<string, string> = {
    "기술 분야": "기술 분야",
    "발명의 요약": "발명의 요약",
    "기술적 특징": "기술적 특징",
    "시장동향": "시장동향",
    "농산업 활용 특장점": "농산업 활용 특장점",
    "기술 성숙도 및 상용화 전망": "기술 성숙도 및 상용화 전망",
  };
  const DEFAULT_VISIBLE_SECTIONS: Record<string, boolean> = {
    commercialization: true,
    trl: true,
    claims: true,
    relatedPatents: true,
  };
  const DEFAULT_CARD_ICONS: Record<string, string> = {
    patentInfo: "📄",
    aiSummary: "🤖",
    claims: "📑",
  };
  const DEFAULT_INFO_LABELS: Record<string, string> = {
    registrationNumber: "등록번호",
    applicationNumber: "출원번호",
    assignee: "출원인",
    filingDate: "출원일",
    publicationDate: "등록일",
    ipc: "IPC",
  };
  const [summaryTitles, setSummaryTitles] = useState<Record<string, string>>(DEFAULT_SECTION_TITLES);
  const [summaryDisclaimer, setSummaryDisclaimer] = useState("※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음");
  const [summaryVisibleSections, setSummaryVisibleSections] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_SECTIONS);
  const [summaryAiPromptExtra, setSummaryAiPromptExtra] = useState("");
  const [summaryCardIcons, setSummaryCardIcons] = useState<Record<string, string>>(DEFAULT_CARD_ICONS);
  const [summaryInfoLabels, setSummaryInfoLabels] = useState<Record<string, string>>(DEFAULT_INFO_LABELS);
  const [isSavingSummarySettings, setIsSavingSummarySettings] = useState(false);
  const [newSectionKey, setNewSectionKey] = useState("");
  const apiCall = async (action: string, data?: Record<string, unknown>) => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-featured-patents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ action, password, data }),
      }
    );
    return res.json();
  };

  const handleLogin = async () => {
    if (!password.trim()) return;
    setIsLoading(true);
    const result = await apiCall("list");
    if (result.success) {
      setIsAuthenticated(true);
      setPatents(result.patents || []);
      const settingsResult = await apiCall("list-settings");
      if (settingsResult.success) {
        setSiteSettings(settingsResult.settings || {});
        if (settingsResult.settings?.tech_categories) {
          try {
            const cats = JSON.parse(settingsResult.settings.tech_categories);
            if (Array.isArray(cats) && cats.length > 0) setCategoryOptions(cats);
          } catch {}
        }
        if (settingsResult.settings?.tech_videos) {
          try {
            const vids = JSON.parse(settingsResult.settings.tech_videos);
            if (Array.isArray(vids)) setTechVideos(vids);
          } catch {}
        }
        // Load summary customization settings
        if (settingsResult.settings?.summary_section_titles) {
          try { setSummaryTitles(JSON.parse(settingsResult.settings.summary_section_titles)); } catch {}
        }
        if (settingsResult.settings?.summary_disclaimer) {
          setSummaryDisclaimer(settingsResult.settings.summary_disclaimer);
        }
        if (settingsResult.settings?.summary_visible_sections) {
          try { setSummaryVisibleSections(JSON.parse(settingsResult.settings.summary_visible_sections)); } catch {}
        }
        if (settingsResult.settings?.summary_ai_prompt_extra) {
          setSummaryAiPromptExtra(settingsResult.settings.summary_ai_prompt_extra);
        }
        if (settingsResult.settings?.summary_card_icons) {
          try { setSummaryCardIcons(JSON.parse(settingsResult.settings.summary_card_icons)); } catch {}
        }
        if (settingsResult.settings?.summary_info_labels) {
          try { setSummaryInfoLabels(JSON.parse(settingsResult.settings.summary_info_labels)); } catch {}
        }
        if (settingsResult.settings?.homepage_visible_sections) {
          try { setHomepageVisibleSections(JSON.parse(settingsResult.settings.homepage_visible_sections)); } catch {}
        }
      }
    } else {
      toast.error("비밀번호가 올바르지 않습니다.");
    }
    setIsLoading(false);
  };

  const loadPatents = async () => {
    const result = await apiCall("list");
    if (result.success) setPatents(result.patents || []);
  };

  // Auto-fetch patent info from KIPRIS
  const handleFetchPatentInfo = async () => {
    if (!form.patent_number.trim()) {
      toast.error("특허번호를 먼저 입력하세요.");
      return;
    }
    setIsFetchingPatent(true);
    try {
      const result = await apiCall("fetch-patent-info", { patent_number: form.patent_number.trim() });
      if (result.success && result.patentInfo) {
        const info = result.patentInfo;
        setForm(f => ({
          ...f,
          title: info.title || f.title,
          thumbnail_url: info.thumbnail_url || f.thumbnail_url,
        }));
        toast.success("특허 정보를 자동으로 가져왔습니다.");
      } else {
        toast.error(result.error || "특허 정보를 찾을 수 없습니다.");
      }
    } catch {
      toast.error("네트워크 오류");
    } finally {
      setIsFetchingPatent(false);
    }
  };

  const handleSave = async () => {
    if (!form.patent_number.trim() || !form.title.trim()) {
      toast.error("특허번호와 제목은 필수입니다.");
      return;
    }
    setIsLoading(true);
    const action = editingId ? "update" : "create";
    const data = editingId ? { ...form, id: editingId } : form;
    const result = await apiCall(action, data);
    if (result.success) {
      toast.success(editingId ? "수정되었습니다." : "등록되었습니다.");
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadPatents();
    } else {
      toast.error(result.error || "오류가 발생했습니다.");
    }
    setIsLoading(false);
  };

  const handleEdit = (patent: FeaturedPatent) => {
    setEditingId(patent.id);
    setForm({
      patent_number: patent.patent_number,
      title: patent.title,
      description: patent.description || "",
      recommendation_reason: patent.recommendation_reason || "",
      category: patent.category || "",
      transfer_status: patent.transfer_status || "기술이전 가능",
      contact_info: patent.contact_info || "",
      thumbnail_url: patent.thumbnail_url || "",
      display_order: patent.display_order,
      is_active: patent.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setIsLoading(true);
    const result = await apiCall("delete", { id });
    if (result.success) {
      toast.success("삭제되었습니다.");
      await loadPatents();
    } else {
      toast.error(result.error || "삭제 실패");
    }
    setIsLoading(false);
  };

  const handleToggleActive = async (patent: FeaturedPatent) => {
    const result = await apiCall("update", { id: patent.id, is_active: !patent.is_active });
    if (result.success) {
      toast.success(patent.is_active ? "비활성화되었습니다." : "활성화되었습니다.");
      await loadPatents();
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    const settingsToSave = {
      ...siteSettings,
      tech_categories: JSON.stringify(categoryOptions),
      tech_videos: JSON.stringify(techVideos),
      homepage_visible_sections: JSON.stringify(homepageVisibleSections),
    };
    const result = await apiCall("update-settings", settingsToSave);
    if (result.success) {
      toast.success("홈페이지 설정이 저장되었습니다.");
    } else {
      toast.error("설정 저장 실패");
    }
    setIsSavingSettings(false);
  };

  const loadCache = async (page = 0) => {
    setCacheLoading(true);
    const result = await apiCall("list-cache", { page });
    if (result.success) {
      setCacheCounts(result.counts);
      setCacheItems(result.items || []);
      setCachePage(page);
      setSelectedCacheIds(new Set());
    }
    setCacheLoading(false);
  };

  const handleDeleteCache = async () => {
    if (selectedCacheIds.size === 0) return;
    if (!confirm(`선택한 ${selectedCacheIds.size}건의 캐시를 삭제하시겠습니까? (관련 AI요약/점수 캐시도 함께 삭제됩니다)`)) return;
    setCacheLoading(true);
    const result = await apiCall("delete-cache", { ids: Array.from(selectedCacheIds) });
    if (result.success) {
      toast.success(`${result.deleted}건 삭제 완료`);
      await loadCache(cachePage);
    } else {
      toast.error("삭제 실패");
    }
    setCacheLoading(false);
  };

  const handleDeleteAllCache = async () => {
    if (!confirm("전체 캐시를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    setCacheLoading(true);
    const result = await apiCall("delete-all-cache");
    if (result.success) {
      toast.success("전체 캐시 삭제 완료");
      await loadCache(0);
    } else {
      toast.error("삭제 실패");
    }
    setCacheLoading(false);
  };

  const handleSaveSummarySettings = async () => {
    setIsSavingSummarySettings(true);
    const settingsToSave: Record<string, string> = {
      summary_section_titles: JSON.stringify(summaryTitles),
      summary_disclaimer: summaryDisclaimer,
      summary_visible_sections: JSON.stringify(summaryVisibleSections),
      summary_ai_prompt_extra: summaryAiPromptExtra,
      summary_card_icons: JSON.stringify(summaryCardIcons),
      summary_info_labels: JSON.stringify(summaryInfoLabels),
    };
    const result = await apiCall("update-settings", settingsToSave);
    if (result.success) {
      toast.success("요약서 설정이 저장되었습니다.");
    } else {
      toast.error("설정 저장 실패");
    }
    setIsSavingSummarySettings(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
              <Lock className="w-5 h-5 text-muted-foreground" />
            </div>
            <h1 className="text-lg font-semibold">관리자 인증</h1>
            <Input
              type="password"
              placeholder="관리자 비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button onClick={handleLogin} disabled={isLoading} className="w-full">
              {isLoading ? "확인 중..." : "로그인"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => window.location.href = "/"}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-semibold text-sm">관리자</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <Tabs defaultValue="patents">
          <TabsList className="mb-6 w-full">
            <TabsTrigger value="patents" className="flex-1 gap-1.5">
              <Star className="w-3.5 h-3.5" /> 이달의 특허
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1 gap-1.5">
              <Settings className="w-3.5 h-3.5" /> 홈페이지 관리
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex-1 gap-1.5">
              <FileText className="w-3.5 h-3.5" /> 요약서 관리
            </TabsTrigger>
            <TabsTrigger value="cache" className="flex-1 gap-1.5" onClick={() => loadCache(0)}>
              <Database className="w-3.5 h-3.5" /> 캐시 관리
            </TabsTrigger>
          </TabsList>

          {/* ===== Patents Tab ===== */}
          <TabsContent value="patents">
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
          </TabsContent>

          {/* ===== Settings Tab ===== */}
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
                    { key: "feature_ppt", label: "PPT 내보내기", desc: "특허 요약서를 PPT로 다운로드하는 기능" },
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
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> 기술소개영상 관리 (최대 3개)</h3>
                <div className="space-y-2 mb-3">
                  {techVideos.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input placeholder="영상 제목" value={v.title} onChange={e => setTechVideos(prev => prev.map((item, i) => i === idx ? { ...item, title: e.target.value } : item))} className="flex-1" />
                      <Input placeholder="YouTube URL" value={v.url} onChange={e => setTechVideos(prev => prev.map((item, i) => i === idx ? { ...item, url: e.target.value } : item))} className="flex-1" />
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-destructive" onClick={() => setTechVideos(prev => prev.filter((_, i) => i !== idx))}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                </div>
                {techVideos.length < 3 && (
                  <Button variant="outline" size="sm" onClick={() => setTechVideos(prev => [...prev, { title: "", url: "" }])}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> 영상 추가
                  </Button>
                )}
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

          {/* ===== Summary Customization Tab ===== */}
          <TabsContent value="summary">
            <div className="space-y-6">
              <h2 className="font-semibold text-sm">요약서 레이아웃 · 텍스트 관리</h2>

              {/* Section Titles with Add/Delete */}
              <div>
                <h3 className="font-semibold text-sm mb-3">섹션 제목 수정 · 추가/삭제</h3>
                <p className="text-[10px] text-muted-foreground mb-3">AI 요약서의 각 섹션 제목을 변경하거나 새 섹션을 추가할 수 있습니다</p>
                <div className="space-y-2">
                  {Object.entries(summaryTitles).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-40 flex-shrink-0 truncate" title={key}>{key}</span>
                      <Input
                        value={val}
                        onChange={e => setSummaryTitles(prev => ({ ...prev, [key]: e.target.value }))}
                        placeholder={key}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 text-destructive" onClick={() => {
                        setSummaryTitles(prev => {
                          const next = { ...prev };
                          delete next[key];
                          return next;
                        });
                      }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <Input
                    placeholder="새 섹션 원본 제목 (예: 지식재산 전략)"
                    value={newSectionKey}
                    onChange={e => setNewSectionKey(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && newSectionKey.trim()) {
                        setSummaryTitles(prev => ({ ...prev, [newSectionKey.trim()]: newSectionKey.trim() }));
                        setNewSectionKey("");
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => {
                    if (newSectionKey.trim()) {
                      setSummaryTitles(prev => ({ ...prev, [newSectionKey.trim()]: newSectionKey.trim() }));
                      setNewSectionKey("");
                    }
                  }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> 추가
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">왼쪽은 AI가 생성하는 원래 제목, 오른쪽은 표시할 제목입니다</p>
              </div>

              {/* Card Icons */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">카드 아이콘 (이모지)</h3>
                <div className="space-y-2">
                  {[
                    { key: "patentInfo", label: "특허 정보 카드" },
                    { key: "aiSummary", label: "AI 요약 카드" },
                    { key: "claims", label: "청구항 카드" },
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-40 flex-shrink-0">{item.label}</span>
                      <Input
                        value={summaryCardIcons[item.key] || ""}
                        onChange={e => setSummaryCardIcons(prev => ({ ...prev, [item.key]: e.target.value }))}
                        placeholder="이모지 입력"
                        className="w-20"
                      />
                      <span className="text-2xl">{summaryCardIcons[item.key] || ""}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Patent Info Labels */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">특허 정보 라벨 수정</h3>
                <p className="text-[10px] text-muted-foreground mb-3">특허 정보 카드에 표시되는 라벨 텍스트를 변경합니다</p>
                <div className="space-y-2">
                  {[
                    { key: "registrationNumber", label: "등록번호" },
                    { key: "applicationNumber", label: "출원번호" },
                    { key: "assignee", label: "출원인" },
                    { key: "filingDate", label: "출원일" },
                    { key: "publicationDate", label: "등록일/공개일" },
                    { key: "ipc", label: "IPC" },
                  ].map(item => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-40 flex-shrink-0">{item.label}</span>
                      <Input
                        value={summaryInfoLabels[item.key] || ""}
                        onChange={e => setSummaryInfoLabels(prev => ({ ...prev, [item.key]: e.target.value }))}
                        placeholder={item.label}
                        className="flex-1"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">면책 조항 문구</h3>
                <Input
                  value={summaryDisclaimer}
                  onChange={e => setSummaryDisclaimer(e.target.value)}
                  placeholder="※ 본 분석은..."
                />
              </div>

              {/* Section Visibility */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">섹션 표시/숨김</h3>
                <div className="space-y-3">
                  {[
                    { key: "commercialization", label: "기술사업화 점수", desc: "종합 점수, 기술성·시장성·사업성 카드" },
                    { key: "trl", label: "TRL 차트", desc: "기술 성숙도(TRL) 차트 섹션" },
                    { key: "claims", label: "청구항", desc: "특허 청구항 접기/펼치기 섹션" },
                    { key: "relatedPatents", label: "관련 특허", desc: "유사 특허 추천 섹션" },
                  ].map(item => {
                    const isOn = summaryVisibleSections[item.key] !== false;
                    return (
                      <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                        </div>
                        <button onClick={() => setSummaryVisibleSections(prev => ({ ...prev, [item.key]: !isOn }))} className="flex-shrink-0">
                          {isOn ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* AI Prompt Extra */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">AI 요약 프롬프트 커스터마이징</h3>
                <p className="text-[10px] text-muted-foreground mb-2">기본 프롬프트에 추가할 지시사항을 입력하세요.</p>
                <Textarea
                  value={summaryAiPromptExtra}
                  onChange={e => setSummaryAiPromptExtra(e.target.value)}
                  placeholder="예: 바이오 분야 특허는 임상 단계를 포함하여 분석해 주세요."
                  rows={5}
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">⚠️ 프롬프트 변경 후 기존 AI 캐시를 삭제해야 새 프롬프트가 적용됩니다</p>
              </div>

              <Button onClick={handleSaveSummarySettings} disabled={isSavingSummarySettings} className="w-full mt-4">
                {isSavingSummarySettings ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                요약서 설정 저장
              </Button>
            </div>
          </TabsContent>

          {/* ===== Cache Tab ===== */}
          <TabsContent value="cache">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">KIPRIS 데이터 캐시 현황</h2>
                <Button variant="outline" size="sm" onClick={() => loadCache(cachePage)} disabled={cacheLoading}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${cacheLoading ? "animate-spin" : ""}`} /> 새로고침
                </Button>
              </div>

              {/* Summary cards */}
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

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteCache}
                  disabled={selectedCacheIds.size === 0 || cacheLoading}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> 선택 삭제 ({selectedCacheIds.size})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteAllCache}
                  disabled={cacheLoading || cacheCounts.data === 0}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> 전체 삭제
                </Button>
              </div>

              {/* Cache list */}
              {cacheItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {cacheLoading ? "로딩 중..." : "캐시된 데이터가 없습니다."}
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground border-b border-border/50">
                    <input
                      type="checkbox"
                      checked={selectedCacheIds.size === cacheItems.length && cacheItems.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCacheIds(new Set(cacheItems.map(i => i.id)));
                        } else {
                          setSelectedCacheIds(new Set());
                        }
                      }}
                    />
                    <span className="flex-1">특허번호</span>
                    <span>캐시 일시</span>
                  </div>
                  {cacheItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-secondary/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedCacheIds.has(item.id)}
                        onChange={(e) => {
                          const next = new Set(selectedCacheIds);
                          if (e.target.checked) next.add(item.id);
                          else next.delete(item.id);
                          setSelectedCacheIds(next);
                        }}
                      />
                      <span className="flex-1 text-sm font-mono">{item.patent_number}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {cacheCounts.data > 20 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Button variant="outline" size="sm" disabled={cachePage === 0 || cacheLoading} onClick={() => loadCache(cachePage - 1)}>
                    이전
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {cachePage + 1} / {Math.ceil(cacheCounts.data / 20)}
                  </span>
                  <Button variant="outline" size="sm" disabled={(cachePage + 1) * 20 >= cacheCounts.data || cacheLoading} onClick={() => loadCache(cachePage + 1)}>
                    다음
                  </Button>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground">
                캐시 삭제 시 해당 특허의 AI 요약과 사업화 점수 캐시도 함께 삭제됩니다. 다음 검색 시 KIPRIS API에서 새로 가져옵니다.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
