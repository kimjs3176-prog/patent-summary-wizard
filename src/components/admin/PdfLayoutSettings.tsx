import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, FileDown, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export interface PdfLayoutConfig {
  // Header
  header_title: string;
  header_subtitle: string;
  header_bg_color: string;
  // Fonts & Layout
  body_font_size: number;
  line_height: number;
  page_margin: number;
  section_title_size: number;
  section_accent_color: string;
  // Sections visibility
  show_patent_images: boolean;
  show_patent_meta: boolean;
  show_claims: boolean;
  show_trl: boolean;
  // Footer
  footer_text: string;
  footer_show_date: boolean;
  footer_show_page: boolean;
  // Disclaimer
  disclaimer_text: string;
  show_disclaimer: boolean;
}

export const DEFAULT_PDF_CONFIG: PdfLayoutConfig = {
  header_title: "농식품 특허 요약서",
  header_subtitle: "Agri-Food Patent Summary Report",
  header_bg_color: "#008c82",
  body_font_size: 9.5,
  line_height: 1.7,
  page_margin: 18,
  section_title_size: 10.5,
  section_accent_color: "#00785a",
  show_patent_images: true,
  show_patent_meta: true,
  show_claims: true,
  show_trl: false,
  footer_text: "© 농식품 특허 요약 서비스 | AI 기반 특허 분석",
  footer_show_date: true,
  footer_show_page: true,
  disclaimer_text: "※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음",
  show_disclaimer: true,
};

interface PdfLayoutSettingsProps {
  apiCall: (action: string, data?: Record<string, unknown>) => Promise<any>;
  initialConfig?: PdfLayoutConfig;
}

export function PdfLayoutSettings({ apiCall, initialConfig }: PdfLayoutSettingsProps) {
  const [config, setConfig] = useState<PdfLayoutConfig>(initialConfig || DEFAULT_PDF_CONFIG);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialConfig) setConfig(initialConfig);
  }, [initialConfig]);

  const update = <K extends keyof PdfLayoutConfig>(key: K, value: PdfLayoutConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await apiCall("update-settings", {
      pdf_layout_config: JSON.stringify(config),
    });
    if (result.success) {
      toast.success("PDF 레이아웃 설정이 저장되었습니다.");
    } else {
      toast.error("저장 실패");
    }
    setIsSaving(false);
  };

  const handleReset = () => {
    if (confirm("기본값으로 초기화하시겠습니까?")) {
      setConfig(DEFAULT_PDF_CONFIG);
      toast.info("기본값으로 초기화되었습니다. 저장 버튼을 눌러주세요.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <FileDown className="w-4 h-4" /> PDF 레이아웃 설정
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">PDF 다운로드 시 적용되는 레이아웃을 편집합니다</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> 초기화
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            저장
          </Button>
        </div>
      </div>

      {/* Header Settings */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">헤더</h3>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">헤더 제목</label>
            <Input value={config.header_title} onChange={e => update("header_title", e.target.value)} placeholder="농식품 특허 요약서" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">헤더 부제목</label>
            <Input value={config.header_subtitle} onChange={e => update("header_subtitle", e.target.value)} placeholder="Agri-Food Patent Summary Report" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">헤더 배경색</label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.header_bg_color} onChange={e => update("header_bg_color", e.target.value)} className="w-10 h-8 rounded border cursor-pointer" />
              <Input value={config.header_bg_color} onChange={e => update("header_bg_color", e.target.value)} className="flex-1" placeholder="#008c82" />
            </div>
          </div>
        </div>
      </Card>

      {/* Font & Layout Settings */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">폰트 · 레이아웃</h3>
        <div className="grid gap-4">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">본문 폰트 크기</span>
              <span className="font-medium">{config.body_font_size}pt</span>
            </div>
            <Slider value={[config.body_font_size]} min={7} max={14} step={0.5} onValueChange={v => update("body_font_size", v[0])} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">행간 (줄 간격)</span>
              <span className="font-medium">{config.line_height}</span>
            </div>
            <Slider value={[config.line_height]} min={1.2} max={2.5} step={0.1} onValueChange={v => update("line_height", v[0])} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">페이지 여백</span>
              <span className="font-medium">{config.page_margin}mm</span>
            </div>
            <Slider value={[config.page_margin]} min={10} max={30} step={1} onValueChange={v => update("page_margin", v[0])} />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">섹션 제목 크기</span>
              <span className="font-medium">{config.section_title_size}pt</span>
            </div>
            <Slider value={[config.section_title_size]} min={8} max={16} step={0.5} onValueChange={v => update("section_title_size", v[0])} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">섹션 강조색</label>
            <div className="flex items-center gap-2">
              <input type="color" value={config.section_accent_color} onChange={e => update("section_accent_color", e.target.value)} className="w-10 h-8 rounded border cursor-pointer" />
              <Input value={config.section_accent_color} onChange={e => update("section_accent_color", e.target.value)} className="flex-1" placeholder="#00785a" />
            </div>
          </div>
        </div>
      </Card>

      {/* Section Visibility */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">섹션 표시 여부</h3>
        <div className="grid gap-3">
          {[
            { key: "show_patent_images" as const, label: "특허 도면 이미지" },
            { key: "show_patent_meta" as const, label: "특허 기본 정보 (출원인, 일자 등)" },
            { key: "show_claims" as const, label: "청구항" },
            { key: "show_trl" as const, label: "기술성숙도(TRL) 섹션" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-1">
              <span className="text-sm">{item.label}</span>
              <Switch checked={config[item.key]} onCheckedChange={v => update(item.key, v)} />
            </div>
          ))}
        </div>
      </Card>

      {/* Footer Settings */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">푸터</h3>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">푸터 텍스트</label>
            <Input value={config.footer_text} onChange={e => update("footer_text", e.target.value)} placeholder="© 농식품 특허 요약 서비스" />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm">생성일 표시</span>
            <Switch checked={config.footer_show_date} onCheckedChange={v => update("footer_show_date", v)} />
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-sm">페이지 번호 표시</span>
            <Switch checked={config.footer_show_page} onCheckedChange={v => update("footer_show_page", v)} />
          </div>
        </div>
      </Card>

      {/* Disclaimer Settings */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">면책 문구</h3>
        <div className="grid gap-3">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm">면책 문구 표시</span>
            <Switch checked={config.show_disclaimer} onCheckedChange={v => update("show_disclaimer", v)} />
          </div>
          {config.show_disclaimer && (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">면책 문구 내용</label>
              <Textarea value={config.disclaimer_text} onChange={e => update("disclaimer_text", e.target.value)} rows={2} />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
