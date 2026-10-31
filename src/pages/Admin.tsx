import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, ArrowLeft, Settings, Star, Database, FileText, Printer } from "lucide-react";
import { DEFAULT_PDF_CONFIG, type PdfLayoutConfig } from "@/components/admin/PdfLayoutSettings";
import { toast } from "sonner";
import { DEFAULT_SCORE_CONFIG, DEFAULT_TRL_CONFIG, type ScoreConfig, type TrlConfig } from "@/components/admin/ScoreTrlSettings";
import type { UsageStats, VisitorStats } from "@/components/admin/adminTypes";
import { supabase } from "@/integrations/supabase/client";
import { resolveTrlLevels } from "@/lib/trlPresentation";
import { type FeaturedPatent, DEFAULT_CATEGORY_OPTIONS, EMPTY_FORM, type SiteSettings, type CacheItem, type CacheCounts, DEFAULT_HOMEPAGE_SECTIONS, DEFAULT_SECTION_TITLES, DEFAULT_SECTION_LENGTHS, DEFAULT_VISIBLE_SECTIONS, DEFAULT_CARD_ICONS, DEFAULT_PRINT_SECTIONS, DEFAULT_INFO_LABELS } from '@/components/admin/adminPageConstants';
import { AdminContentPanel } from '@/components/admin/AdminContentPanel';
import { AdminHomepagePanel } from '@/components/admin/AdminHomepagePanel';
import { AdminSummaryPanel } from '@/components/admin/AdminSummaryPanel';
import { AdminOutputPanel } from '@/components/admin/AdminOutputPanel';
import { AdminSystemPanel } from '@/components/admin/AdminSystemPanel';
import { useDocumentTitle } from "@/hooks/useDocumentTitle";



const Admin = () => {
  useDocumentTitle("관리자");
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
  const [techVideos, setTechVideos] = useState<{ title: string; url: string; description?: string; category?: string }[]>([]);
  const [dragVideoIdx, setDragVideoIdx] = useState<number | null>(null);
  const [cacheCounts, setCacheCounts] = useState<CacheCounts>({ data: 0, ai: 0, score: 0 });
  const [cacheItems, setCacheItems] = useState<CacheItem[]>([]);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [cachePage, setCachePage] = useState(0);
  const [selectedCacheIds, setSelectedCacheIds] = useState<Set<string>>(new Set());

  // Stats dashboard state
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
  const [satisfaction, setSatisfaction] = useState<{ bucket: string; period: string; responses: number; avg_rating: number | null; r1: number; r2: number; r3: number; r4: number; r5: number }[]>([]);
  const [satComments, setSatComments] = useState<{ rating: number; comment: string; patent_number: string | null; created_at: string }[]>([]);

  const loadSatisfaction = async () => {
    const [{ data: stats }, commentsRes] = await Promise.all([
      supabase.rpc("get_satisfaction_stats"),
      apiCall("satisfaction-comments", { limit: 30 }),
    ]);
    setSatisfaction((stats as any) || []);
    setSatComments(commentsRes?.success ? (commentsRes.comments as any) || [] : []);
  };

  const loadUsageStats = async () => {
    setStatsLoading(true);
    try {
      const result = await apiCall("usage-stats");
      if (result.success) {
        setUsageStats(result.stats);
      }
      const vr = await apiCall("visitor-stats");
      if (vr.success) setVisitorStats(vr.visitors);
      await loadSatisfaction();
    } catch {
      toast.error("통계 로딩 실패");
    }
    setStatsLoading(false);
  };

  // Homepage section visibility

  const [homepageVisibleSections, setHomepageVisibleSections] = useState<Record<string, boolean>>(DEFAULT_HOMEPAGE_SECTIONS);

  // Summary customization state

  const [summaryTitles, setSummaryTitles] = useState<Record<string, string>>(DEFAULT_SECTION_TITLES);
  const [summarySectionLengths, setSummarySectionLengths] = useState<Record<string, number>>(DEFAULT_SECTION_LENGTHS);
  const [summaryDisclaimer, setSummaryDisclaimer] = useState("※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음");
  const [summaryVisibleSections, setSummaryVisibleSections] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_SECTIONS);
  const [summaryAiPromptExtra, setSummaryAiPromptExtra] = useState("");
  const [summaryCardIcons, setSummaryCardIcons] = useState<Record<string, string>>(DEFAULT_CARD_ICONS);
  const [summaryInfoLabels, setSummaryInfoLabels] = useState<Record<string, string>>(DEFAULT_INFO_LABELS);
  const [isSavingSummarySettings, setIsSavingSummarySettings] = useState(false);
  const [newSectionKey, setNewSectionKey] = useState("");
  const [summaryMaxTokens, setSummaryMaxTokens] = useState(3000);
  // AI 분석 모델은 고정값으로 사용한다.
  const [printSections, setPrintSections] = useState<Record<string, boolean>>(DEFAULT_PRINT_SECTIONS);
  const [isSavingPrintSettings, setIsSavingPrintSettings] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [scoreConfig, setScoreConfig] = useState<ScoreConfig>(DEFAULT_SCORE_CONFIG);
  const [trlConfig, setTrlConfig] = useState<TrlConfig>(DEFAULT_TRL_CONFIG);
  const [pdfLayoutConfig, setPdfLayoutConfig] = useState<PdfLayoutConfig>(DEFAULT_PDF_CONFIG);
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
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      if (next && next.startsWith("/")) {
        window.location.href = next;
        return;
      }
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
        if (settingsResult.settings?.summary_section_lengths) {
          try { setSummarySectionLengths({ ...DEFAULT_SECTION_LENGTHS, ...JSON.parse(settingsResult.settings.summary_section_lengths) }); } catch {}
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
        if (settingsResult.settings?.summary_max_tokens) {
          const v = parseInt(settingsResult.settings.summary_max_tokens, 10);
          if (!isNaN(v)) setSummaryMaxTokens(v);
        }
        if (settingsResult.settings?.score_settings) {
          try { setScoreConfig({ ...DEFAULT_SCORE_CONFIG, ...JSON.parse(settingsResult.settings.score_settings) }); } catch {}
        }
        if (settingsResult.settings?.trl_settings) {
          try {
            const saved = JSON.parse(settingsResult.settings.trl_settings);
            setTrlConfig({ ...DEFAULT_TRL_CONFIG, ...saved, levels: resolveTrlLevels(saved?.levels) });
          } catch {}
        }
        if (settingsResult.settings?.pdf_layout_config) {
          try { setPdfLayoutConfig({ ...DEFAULT_PDF_CONFIG, ...JSON.parse(settingsResult.settings.pdf_layout_config) }); } catch {}
        }
        if (settingsResult.settings?.print_sections) {
          try { setPrintSections({ ...DEFAULT_PRINT_SECTIONS, ...JSON.parse(settingsResult.settings.print_sections) }); } catch {}
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
      summary_section_lengths: JSON.stringify(summarySectionLengths),
      summary_visible_sections: JSON.stringify(summaryVisibleSections),
      summary_ai_prompt_extra: summaryAiPromptExtra,
      summary_card_icons: JSON.stringify(summaryCardIcons),
      summary_info_labels: JSON.stringify(summaryInfoLabels),
      summary_max_tokens: String(summaryMaxTokens),
      score_settings: JSON.stringify(scoreConfig),
      trl_settings: JSON.stringify(trlConfig),
    };
    const result = await apiCall("update-settings", settingsToSave);
    if (result.success) {
      toast.success("요약서 설정이 저장되었습니다.");
    } else {
      toast.error("설정 저장 실패");
    }
    setIsSavingSummarySettings(false);
  };

  const handleSavePrintSettings = async () => {
    setIsSavingPrintSettings(true);
    const result = await apiCall("update-settings", {
      print_sections: JSON.stringify(printSections),
    });
    if (result.success) toast.success("인쇄 설정이 저장되었습니다.");
    else toast.error("설정 저장 실패");
    setIsSavingPrintSettings(false);
  };

  const handleChangePassword = async () => {
    const next = newAdminPassword.trim();
    if (next.length < 4 || next.length > 100) {
      toast.error("비밀번호는 4~100자여야 합니다.");
      return;
    }
    if (next !== confirmAdminPassword.trim()) {
      toast.error("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setIsChangingPassword(true);
    const result = await apiCall("change-password", { new_password: next });
    if (result.success) {
      toast.success("관리자 비밀번호가 변경되었습니다.");
      setPassword(next);
      setNewAdminPassword("");
      setConfirmAdminPassword("");
    } else {
      toast.error(result.error || "변경 실패");
    }
    setIsChangingPassword(false);
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
        <Tabs defaultValue="content">
          <div className="overflow-x-auto -mx-4 px-4 mb-6">
            <TabsList className="w-max min-w-full sm:w-full">
              <TabsTrigger value="content" className="gap-1.5 text-xs sm:text-sm">
                <Star className="w-3.5 h-3.5" /> 콘텐츠
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
                <Settings className="w-3.5 h-3.5" /> 홈페이지
              </TabsTrigger>
              <TabsTrigger value="summary" className="gap-1.5 text-xs sm:text-sm">
                <FileText className="w-3.5 h-3.5" /> 요약서
              </TabsTrigger>
              <TabsTrigger value="output" className="gap-1.5 text-xs sm:text-sm">
                <Printer className="w-3.5 h-3.5" /> 출력
              </TabsTrigger>
              <TabsTrigger value="system" className="gap-1.5 text-xs sm:text-sm" onClick={() => { loadCache(0); loadUsageStats(); }}>
                <Database className="w-3.5 h-3.5" /> 시스템
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ===== Content Tab (Patents + Notices) ===== */}
          <AdminContentPanel patents={patents} isLoading={isLoading} editingId={editingId} setEditingId={setEditingId} showForm={showForm} setShowForm={setShowForm} form={form} setForm={setForm} isFetchingPatent={isFetchingPatent} categoryOptions={categoryOptions} apiCall={apiCall} handleFetchPatentInfo={handleFetchPatentInfo} handleSave={handleSave} handleEdit={handleEdit} handleDelete={handleDelete} handleToggleActive={handleToggleActive} />

          {/* ===== Settings Tab ===== */}
          <AdminHomepagePanel siteSettings={siteSettings} setSiteSettings={setSiteSettings} isSavingSettings={isSavingSettings} categoryOptions={categoryOptions} setCategoryOptions={setCategoryOptions} techVideos={techVideos} setTechVideos={setTechVideos} dragVideoIdx={dragVideoIdx} setDragVideoIdx={setDragVideoIdx} homepageVisibleSections={homepageVisibleSections} setHomepageVisibleSections={setHomepageVisibleSections} handleSaveSettings={handleSaveSettings} />

          {/* ===== Summary Customization Tab ===== */}
          <AdminSummaryPanel summaryTitles={summaryTitles} setSummaryTitles={setSummaryTitles} summarySectionLengths={summarySectionLengths} setSummarySectionLengths={setSummarySectionLengths} summaryDisclaimer={summaryDisclaimer} setSummaryDisclaimer={setSummaryDisclaimer} summaryVisibleSections={summaryVisibleSections} setSummaryVisibleSections={setSummaryVisibleSections} summaryAiPromptExtra={summaryAiPromptExtra} setSummaryAiPromptExtra={setSummaryAiPromptExtra} summaryCardIcons={summaryCardIcons} setSummaryCardIcons={setSummaryCardIcons} summaryInfoLabels={summaryInfoLabels} setSummaryInfoLabels={setSummaryInfoLabels} isSavingSummarySettings={isSavingSummarySettings} newSectionKey={newSectionKey} setNewSectionKey={setNewSectionKey} summaryMaxTokens={summaryMaxTokens} setSummaryMaxTokens={setSummaryMaxTokens} scoreConfig={scoreConfig} setScoreConfig={setScoreConfig} trlConfig={trlConfig} setTrlConfig={setTrlConfig} handleSaveSummarySettings={handleSaveSummarySettings} />

          {/* ===== Output Tab (Print + PDF) ===== */}
          <AdminOutputPanel printSections={printSections} setPrintSections={setPrintSections} isSavingPrintSettings={isSavingPrintSettings} pdfLayoutConfig={pdfLayoutConfig} apiCall={apiCall} handleSavePrintSettings={handleSavePrintSettings} />

          {/* ===== System Tab (Stats + Cache + Security) ===== */}
          <AdminSystemPanel cacheCounts={cacheCounts} cacheItems={cacheItems} cacheLoading={cacheLoading} cachePage={cachePage} selectedCacheIds={selectedCacheIds} setSelectedCacheIds={setSelectedCacheIds} usageStats={usageStats} statsLoading={statsLoading} visitorStats={visitorStats} satisfaction={satisfaction} satComments={satComments} loadUsageStats={loadUsageStats} newAdminPassword={newAdminPassword} setNewAdminPassword={setNewAdminPassword} confirmAdminPassword={confirmAdminPassword} setConfirmAdminPassword={setConfirmAdminPassword} isChangingPassword={isChangingPassword} loadCache={loadCache} handleDeleteCache={handleDeleteCache} handleDeleteAllCache={handleDeleteAllCache} handleChangePassword={handleChangePassword} />
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
