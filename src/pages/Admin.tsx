import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Lock, Plus, Pencil, Trash2, Eye, EyeOff, ArrowLeft, Save, X, Loader2, Search, Settings, Star, Video, ToggleLeft, ToggleRight, Database, RefreshCw, FileText, FileDown, Printer, KeyRound, MessageCircle, BarChart3, TrendingUp, Zap, Calendar, Megaphone, Highlighter } from "lucide-react";
import { NoticeManager } from "@/components/admin/NoticeManager";
import { PdfLayoutSettings, DEFAULT_PDF_CONFIG, type PdfLayoutConfig } from "@/components/admin/PdfLayoutSettings";
import { toast } from "sonner";
import { ScoreTrlSettings, DEFAULT_SCORE_CONFIG, DEFAULT_TRL_CONFIG, type ScoreConfig, type TrlConfig } from "@/components/admin/ScoreTrlSettings";
import { supabase } from "@/integrations/supabase/client";

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

interface UsageStats {
  totalSummaries: number;
  totalScores: number;
  totalSearches: number;
  totalDataCache: number;
  recentSummaries: { date: string; count: number }[];
  recentSearches: { date: string; count: number }[];
  topSearched: { patent_number: string; patent_title: string | null; search_count: number }[];
  currentModel: string;
}

interface VisitorStats {
  total: number;
  today: number;
  thisMonth: number;
  thisQuarter: number;
  thisYear: number;
  last30: { date: string; count: number }[];
  daily: { date: string; count: number }[];
  monthly: { month: string; count: number }[];
  quarterly: { quarter: string; count: number }[];
  yearly: { year: string; count: number }[];
}

const SETTINGS_FIELDS = [
  { key: "header_title", label: "헤더 타이틀", placeholder: "Agri IP Summary (AIS)" },
  { key: "header_subtitle", label: "헤더 서브타이틀", placeholder: "농식품분야 특허 AI 기술분석 서비스" },
  { key: "hero_title", label: "히어로 타이틀 1줄", placeholder: "Agri IP" },
  { key: "hero_title_accent", label: "히어로 강조 텍스트", placeholder: "AI 기술요약" },
  { key: "hero_title_suffix", label: "히어로 타이틀 끝", placeholder: "서비스" },
  { key: "hero_description", label: "히어로 설명", placeholder: "농식품 분야 특허를 AI가 자동으로 분석하고 요약합니다" },
  { key: "featured_section_title", label: "이달의 특허 섹션 제목", placeholder: "이달의 특허 · 기술이전 추천" },
  { key: "featured_section_subtitle", label: "이달의 특허 섹션 부제목", placeholder: "농식품 분야 기술이전 추천 특허" },
  { key: "footer_line1", label: "푸터 1줄", placeholder: "본 서비스는..." },
  { key: "footer_line2", label: "푸터 2줄", placeholder: "KIPRIS 데이터 연동..." },
  { key: "search_placeholder", label: "검색창 예시 텍스트", placeholder: "관심 키워드 또는 특허 등록번호, 출원번호를 입력하세요" },
  { key: "search_helper_text", label: "검색창 안내 텍스트", placeholder: "관심있는 키워드나 특허 등록번호(예: 10-2920574)/출원번호(예:10-2022-1213421)를 입력하세요" },
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
    const [{ data: stats }, { data: comments }] = await Promise.all([
      supabase.rpc("get_satisfaction_stats"),
      supabase.rpc("get_satisfaction_comments", { p_limit: 30 }),
    ]);
    setSatisfaction((stats as any) || []);
    setSatComments((comments as any) || []);
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
  const DEFAULT_HOMEPAGE_SECTIONS: Record<string, boolean> = {
    featuredPatents: true,
    techVideos: true,
    techTransferGuide: true,
    popularSearches: true,
  };
  const [homepageVisibleSections, setHomepageVisibleSections] = useState<Record<string, boolean>>(DEFAULT_HOMEPAGE_SECTIONS);

  // Summary customization state
  const DEFAULT_SECTION_TITLES: Record<string, string> = {
    "기술분야": "기술분야",
    "발명요약 및 특징": "발명요약 및 특징",
    "관련시장 동향": "관련시장 동향",
    "농산업활용 가능성": "농산업활용 가능성",
    "상용화전망": "상용화전망",
  };
  const DEFAULT_SECTION_LENGTHS: Record<string, number> = {
    "기술분야": 3,
    "발명요약 및 특징": 6,
    "관련시장 동향": 5,
    "농산업활용 가능성": 4,
    "상용화전망": 4,
  };
  const DEFAULT_VISIBLE_SECTIONS: Record<string, boolean> = {
    commercialization: true,
    claims: true,
    competitorComparison: true,
    familyTree: true,
  };
  const DEFAULT_CARD_ICONS: Record<string, string> = {
    patentInfo: "📄",
    aiSummary: "🤖",
    claims: "📑",
  };
  const DEFAULT_PRINT_SECTIONS: Record<string, boolean> = {
    patentInfo: true,
    commercialization: true,
    aiSummary: true,
    trl: true,
    claims: false,
    relatedPatents: false,
    disclaimer: true,
    header: true,
    footer: true,
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
          try { setTrlConfig({ ...DEFAULT_TRL_CONFIG, ...JSON.parse(settingsResult.settings.trl_settings) }); } catch {}
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

              {/* Chatbot Settings */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> 챗봇 설정</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
                    <div>
                      <p className="text-sm font-medium">챗봇 아이콘 표시</p>
                      <p className="text-[11px] text-muted-foreground">플로팅 챗봇 버튼을 홈페이지에 표시합니다</p>
                    </div>
                    <button onClick={() => setSiteSettings(s => ({ ...s, chatbot_visible: s.chatbot_visible === "false" ? "true" : "false" }))} className="flex-shrink-0">
                      {siteSettings.chatbot_visible !== "false" ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">챗봇 창 이름</label>
                    <Input
                      value={siteSettings.chatbot_title || "Patent Chat Aid"}
                      onChange={e => setSiteSettings(s => ({ ...s, chatbot_title: e.target.value }))}
                      placeholder="Patent Chat Aid"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">창 가로 크기 (px)</label>
                      <Input
                        type="number"
                        value={siteSettings.chatbot_width || "440"}
                        onChange={e => setSiteSettings(s => ({ ...s, chatbot_width: e.target.value }))}
                        placeholder="440"
                        min={300}
                        max={600}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">창 세로 크기 (vh)</label>
                      <Input
                        type="number"
                        value={siteSettings.chatbot_height || "92"}
                        onChange={e => setSiteSettings(s => ({ ...s, chatbot_height: e.target.value }))}
                        placeholder="92"
                        min={50}
                        max={95}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">가로: 300~600px, 세로: 50~95vh (화면 대비 비율)</p>
                </div>
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
                          setSummarySectionLengths(prev => {
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
                        setSummarySectionLengths(prev => ({ ...prev, [newSectionKey.trim()]: 3 }));
                        setNewSectionKey("");
                      }
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => {
                    if (newSectionKey.trim()) {
                      setSummaryTitles(prev => ({ ...prev, [newSectionKey.trim()]: newSectionKey.trim() }));
                      setSummarySectionLengths(prev => ({ ...prev, [newSectionKey.trim()]: 3 }));
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
                    { key: "commercialization", label: "기술분석 점수", desc: "종합 점수 + TRL 통합 카드 (기술성·시장성·사업성)" },
                    { key: "claims", label: "청구항", desc: "특허 청구항 접기/펼치기 섹션" },
                    { key: "competitorComparison", label: "경쟁 특허 비교", desc: "유사 특허와의 비교 분석 표" },
                    { key: "familyTree", label: "패밀리 트리", desc: "동일 출원인의 관련 특허 네트워크" },
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

              {/* Summary Length */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">요약 결과 분량 조절</h3>
                <p className="text-[10px] text-muted-foreground mb-3">AI 요약서의 결과 텍스트 분량을 조절합니다. 값이 클수록 더 상세한 요약이 생성됩니다.</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    {[
                      { label: "간략", value: 1500, desc: "핵심만 간략히" },
                      { label: "보통", value: 3000, desc: "기본 분량" },
                      { label: "상세", value: 5000, desc: "풍부한 분석" },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setSummaryMaxTokens(opt.value)}
                        className={`flex-1 p-3 rounded-lg border text-center transition-colors ${
                          summaryMaxTokens === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                        }`}
                      >
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-[10px] mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <Slider
                      value={[summaryMaxTokens]}
                      onValueChange={([v]) => setSummaryMaxTokens(v)}
                      min={500}
                      max={8000}
                      step={100}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={summaryMaxTokens}
                      onChange={e => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 500 && v <= 8000) setSummaryMaxTokens(v);
                      }}
                      className="w-24 text-center"
                      min={500}
                      max={8000}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">현재 설정: {summaryMaxTokens} tokens (500~8000) · ⚠️ 분량 변경 후 기존 AI 캐시를 삭제해야 새 설정이 적용됩니다</p>
                </div>
              </div>

              {/* Section Lengths */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">항목별 분량 조절</h3>
                <p className="text-[10px] text-muted-foreground mb-3">각 요약 항목의 권장 문장 수를 조절합니다. 전체 토큰 한도 안에서 우선 반영됩니다.</p>
                <div className="space-y-3">
                  {Object.entries(summaryTitles).map(([key, label]) => {
                    const value = summarySectionLengths[key] ?? 3;
                    return (
                      <div key={key} className="p-3 rounded-lg bg-secondary/20 border border-border/40">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{label || key}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{key}</p>
                          </div>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={value}
                            onChange={e => {
                              const next = parseInt(e.target.value, 10);
                              if (!isNaN(next)) setSummarySectionLengths(prev => ({ ...prev, [key]: Math.max(1, Math.min(10, next)) }));
                            }}
                            className="w-20 text-center shrink-0"
                          />
                        </div>
                        <Slider
                          value={[value]}
                          onValueChange={([next]) => setSummarySectionLengths(prev => ({ ...prev, [key]: next }))}
                          min={1}
                          max={10}
                          step={1}
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">⚠️ 항목별 분량 변경 후 기존 AI 캐시를 삭제해야 새 설정이 적용됩니다</p>
              </div>

              {/* AI 분석 모델은 가격/성능 균형이 가장 우수한 Gemini 3 Flash Preview로 고정 */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-2">AI 분석 모델</h3>
                <div className="p-3 rounded-lg border border-border/50 bg-secondary/20">
                  <p className="text-sm font-medium">Gemini 3 Flash Preview</p>
                  <p className="text-[10px] text-muted-foreground mt-1">현재 시점에서 분석 성능 대비 비용이 가장 우수한 모델로 고정 적용됩니다.</p>
                </div>
              </div>

              {/* Score & TRL Settings */}
              <div className="pt-4 border-t border-border/50">
                <h3 className="font-semibold text-sm mb-3">기술사업화점수 · TRL 관리</h3>
                <ScoreTrlSettings
                  scoreConfig={scoreConfig}
                  trlConfig={trlConfig}
                  onScoreConfigChange={setScoreConfig}
                  onTrlConfigChange={setTrlConfig}
                />
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

          {/* ===== Output Tab (Print + PDF) ===== */}
          <TabsContent value="output">
            <Accordion type="multiple" defaultValue={["print"]} className="space-y-3">
              <AccordionItem value="print" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><Printer className="w-4 h-4 text-primary" /> 인쇄 설정</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <p className="text-[11px] text-muted-foreground">저장 후 인쇄 시 선택한 항목만 포함됩니다.</p>
                    <div className="space-y-3">
                      {[
                        { key: "header", label: "인쇄 헤더", desc: "출력 상단 제목/번호 영역" },
                        { key: "patentInfo", label: "특허 정보 카드", desc: "등록번호/출원인/날짜 정보" },
                        { key: "commercialization", label: "사업화 점수", desc: "종합 점수 및 상세 분석" },
                        { key: "aiSummary", label: "AI 종합 요약", desc: "본문 요약 텍스트 영역" },
                        { key: "trl", label: "TRL 섹션", desc: "기술 성숙도 차트 영역" },
                        { key: "claims", label: "청구항", desc: "청구항 카드(화면에는 항상 표시)" },
                        { key: "relatedPatents", label: "관련 특허", desc: "추천 특허 리스트" },
                        { key: "disclaimer", label: "면책 문구", desc: "요약 하단 주의 문구" },
                        { key: "footer", label: "인쇄 푸터", desc: "생성일 및 하단 문구" },
                      ].map((item) => {
                        const isOn = printSections[item.key] !== false;
                        return (
                          <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
                            <div>
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                            </div>
                            <button onClick={() => setPrintSections((prev) => ({ ...prev, [item.key]: !isOn }))} className="flex-shrink-0">
                              {isOn ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <Button onClick={handleSavePrintSettings} disabled={isSavingPrintSettings} className="w-full">
                      {isSavingPrintSettings ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      인쇄 설정 저장
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pdf" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><FileDown className="w-4 h-4 text-primary" /> PDF 레이아웃</span>
                </AccordionTrigger>
                <AccordionContent>
                  <PdfLayoutSettings apiCall={apiCall} initialConfig={pdfLayoutConfig} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* ===== System Tab (Stats + Cache + Security) ===== */}
          <TabsContent value="system">
            <Accordion type="multiple" defaultValue={["stats"]} className="space-y-3">
              <AccordionItem value="stats" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> 통계 대시보드</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-6">
                    <div className="flex items-center justify-end">
                      <Button variant="outline" size="sm" onClick={loadUsageStats} disabled={statsLoading}>
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${statsLoading ? "animate-spin" : ""}`} /> 새로고침
                      </Button>
                    </div>

                    {visitorStats && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          {[
                            { label: "누적 접속자", value: visitorStats.total },
                            { label: "올해 접속자", value: visitorStats.thisYear },
                            { label: "이번 분기", value: visitorStats.thisQuarter ?? 0 },
                            { label: "이번 달 접속자", value: visitorStats.thisMonth },
                            { label: "오늘 접속자", value: visitorStats.today },
                          ].map((s, i) => (
                            <Card key={i} className="p-4 bg-primary/5 border-primary/20">
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

                            {([
                              { key: "daily", label: "최근 30일", data: (visitorStats.last30 ?? []).map(d => ({ label: d.date, count: d.count })), color: "bg-primary/70", w: "w-20" },
                              { key: "monthly", label: "최근 12개월", data: (visitorStats.monthly ?? []).slice(-12).map(m => ({ label: m.month, count: m.count })), color: "bg-accent/70", w: "w-16" },
                              { key: "quarterly", label: "분기별", data: (visitorStats.quarterly ?? []).map(q => ({ label: q.quarter, count: q.count })), color: "bg-primary/60", w: "w-16" },
                              { key: "yearly", label: "연도별", data: (visitorStats.yearly ?? []).map(y => ({ label: `${y.year}년`, count: y.count })), color: "bg-primary/80", w: "w-14" },
                            ] as const).map(tab => (
                              <TabsContent key={tab.key} value={tab.key} className="mt-0">
                                {tab.data.length > 0 ? (
                                  <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                                    {tab.data.map((row, i, arr) => {
                                      const max = Math.max(...arr.map(x => x.count), 1);
                                      return (
                                        <div key={i} className="flex items-center gap-2">
                                          <span className={`text-[11px] text-muted-foreground ${tab.w} flex-shrink-0 font-mono`}>{row.label}</span>
                                          <div className="flex-1 h-5 bg-secondary/30 rounded overflow-hidden">
                                            <div className={`h-full ${tab.color} rounded`} style={{ width: `${(row.count / max) * 100}%` }} />
                                          </div>
                                          <span className="text-[11px] font-medium w-14 text-right">{row.count.toLocaleString()}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground text-center py-4">데이터 없음</p>
                                )}
                              </TabsContent>
                            ))}
                          </Tabs>
                        </Card>
                      </div>
                    )}

                    {/* 만족도 조사 통계 */}
                    {(() => {
                      const total = satisfaction.find((s) => s.bucket === "total");
                      const monthly = satisfaction.filter((s) => s.bucket === "monthly").slice(0, 12);
                      const yearly = satisfaction.filter((s) => s.bucket === "yearly");
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
                                const c = (total as any)[`r${n}`] as number;
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
                                          <div className="h-full bg-primary/70 rounded" style={{ width: `${((Number(r.avg_rating) || 0) / 5) * 100}%` }} />
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
                                      {c.patent_number && <span className="text-[10px] font-mono text-muted-foreground">{c.patent_number}</span>}
                                      <span className="text-[10px] text-muted-foreground ml-auto">{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
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
                    })()}

                    {statsLoading && !usageStats ? (
                      <div className="text-center py-16 text-muted-foreground text-sm">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        통계 로딩 중...
                      </div>
                    ) : usageStats ? (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {[
                            { label: "AI 요약 생성", value: usageStats.totalSummaries, icon: <FileText className="w-4 h-4" />, color: "text-primary" },
                            { label: "사업화 점수 분석", value: usageStats.totalScores, icon: <TrendingUp className="w-4 h-4" />, color: "text-primary" },
                            { label: "총 검색 횟수", value: usageStats.totalSearches, icon: <Search className="w-4 h-4" />, color: "text-primary" },
                            { label: "KIPRIS 데이터 캐시", value: usageStats.totalDataCache, icon: <Database className="w-4 h-4" />, color: "text-primary" },
                          ].map((stat, i) => (
                            <Card key={i} className="p-4">
                              <div className={`flex items-center gap-2 mb-2 ${stat.color}`}>
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
                            {usageStats.recentSummaries.length > 0 ? (
                              <div className="space-y-1.5">
                                {usageStats.recentSummaries.map((d, i) => {
                                  const maxCount = Math.max(...usageStats.recentSummaries.map(s => s.count), 1);
                                  return (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="text-[10px] text-muted-foreground w-12 flex-shrink-0">{d.date}</span>
                                      <div className="flex-1 h-5 bg-secondary/30 rounded overflow-hidden">
                                        <div className="h-full bg-primary/60 rounded transition-all" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                                      </div>
                                      <span className="text-[10px] font-medium w-6 text-right">{d.count}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-4">데이터 없음</p>
                            )}
                          </Card>

                          <Card className="p-4">
                            <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" /> 최근 7일 검색 활동
                            </h3>
                            {usageStats.recentSearches.length > 0 ? (
                              <div className="space-y-1.5">
                                {usageStats.recentSearches.map((d, i) => {
                                  const maxCount = Math.max(...usageStats.recentSearches.map(s => s.count), 1);
                                  return (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="text-[10px] text-muted-foreground w-12 flex-shrink-0">{d.date}</span>
                                      <div className="flex-1 h-5 bg-secondary/30 rounded overflow-hidden">
                                        <div className="h-full bg-accent/60 rounded transition-all" style={{ width: `${(d.count / maxCount) * 100}%` }} />
                                      </div>
                                      <span className="text-[10px] font-medium w-6 text-right">{d.count}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground text-center py-4">데이터 없음</p>
                            )}
                          </Card>
                        </div>

                        <Card className="p-4">
                          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5" /> 인기 검색 특허 TOP 10
                          </h3>
                          {usageStats.topSearched.length > 0 ? (
                            <div className="space-y-2">
                              {usageStats.topSearched.map((item, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/20">
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
                    ) : (
                      <div className="text-center py-16 text-muted-foreground text-sm">
                        통계 탭을 클릭하면 데이터를 불러옵니다.
                      </div>
                    )}
                  </div>
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
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
