import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, FileDown, RotateCcw, Eye } from "lucide-react";
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
  show_commercialization: boolean;
  // Footer
  footer_text: string;
  footer_show_date: boolean;
  footer_show_page: boolean;
  // Disclaimer
  disclaimer_text: string;
  show_disclaimer: boolean;
  // Watermark
  watermark_text: string;
  watermark_opacity: number;
  watermark_enabled: boolean;
  // Section text colors
  section_colors: {
    patentInfo: string;
    commercialization: string;
    trl: string;
    aiSummary: string;
    claims: string;
    relatedPatents: string;
  };
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
  show_commercialization: true,
  footer_text: "© 농식품 특허 요약 서비스 | AI 기반 특허 분석",
  footer_show_date: true,
  footer_show_page: true,
  disclaimer_text: "※ 본 분석은 특허명세서를 바탕으로 실시하여 실제 연구 및 개발 단계와는 상이할 수 있음",
  show_disclaimer: true,
  watermark_text: "",
  watermark_opacity: 0.08,
  watermark_enabled: false,
  section_colors: {
    patentInfo: "#1a65c8",
    commercialization: "#00785a",
    trl: "#059669",
    aiSummary: "#1a65c8",
    claims: "#7c3aed",
    relatedPatents: "#0891b2",
  },
};

interface PdfLayoutSettingsProps {
  apiCall: (action: string, data?: Record<string, unknown>) => Promise<any>;
  initialConfig?: PdfLayoutConfig;
}

// Mini PDF Preview Component
function PdfPreview({ config }: { config: PdfLayoutConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const scale = w / 210; // A4 width in mm
    const m = config.page_margin * scale;

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // Watermark
    if (config.watermark_enabled && config.watermark_text) {
      ctx.save();
      ctx.globalAlpha = config.watermark_opacity;
      ctx.fillStyle = "#888888";
      ctx.font = `bold ${24 * scale / 5}px sans-serif`;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 6);
      ctx.textAlign = "center";
      ctx.fillText(config.watermark_text, 0, 0);
      ctx.restore();
    }

    // Header bar
    const hexToRgb = (hex: string) => {
      const c = hex.replace("#", "");
      return `rgb(${parseInt(c.substring(0, 2), 16)},${parseInt(c.substring(2, 4), 16)},${parseInt(c.substring(4, 6), 16)})`;
    };
    const headerH = 18 * scale;
    ctx.fillStyle = hexToRgb(config.header_bg_color);
    roundRect(ctx, m, m, w - m * 2, headerH, 3 * scale);

    // Header text
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${12 * scale / 3}px sans-serif`;
    ctx.fillText(config.header_title, m + 6 * scale, m + headerH * 0.45);
    ctx.font = `${7 * scale / 3}px sans-serif`;
    ctx.fillStyle = "#c8e1d2";
    ctx.fillText(config.header_subtitle, m + 6 * scale, m + headerH * 0.75);

    let y = m + headerH + 6 * scale;

    // Patent meta placeholder
    if (config.show_patent_meta) {
      ctx.fillStyle = "#1a1a1a";
      ctx.font = `bold ${11 * scale / 3}px sans-serif`;
      ctx.fillText("특허 제목 예시", m + 2 * scale, y);
      y += 5 * scale;
      ctx.fillStyle = "#666666";
      ctx.font = `${7 * scale / 3}px sans-serif`;
      ctx.fillText("출원인: OOO  |  출원일: 2024-01-01  |  등록일: 2024-06-01", m + 2 * scale, y);
      y += 4 * scale;
      // separator
      ctx.strokeStyle = "#c3d7cd";
      ctx.lineWidth = 0.3 * scale;
      ctx.beginPath();
      ctx.moveTo(m, y);
      ctx.lineTo(w - m, y);
      ctx.stroke();
      y += 5 * scale;
    }

    // Commercialization score placeholder
    if (config.show_commercialization) {
      drawSectionBlock(ctx, m, y, w - m * 2, 18 * scale, config.section_accent_color, "AI 기술사업화 점수", scale);
      y += 22 * scale;
    }

    // TRL placeholder
    if (config.show_trl) {
      drawSectionBlock(ctx, m, y, w - m * 2, 14 * scale, config.section_accent_color, "기술성숙도(TRL)", scale);
      y += 18 * scale;
    }

    // AI Summary sections
    const sections = ["기술 분야", "발명의 요약", "기술적 특징"];
    const accentHex = config.section_accent_color;
    for (const sec of sections) {
      if (y + 14 * scale > h - m - 10 * scale) break;
      // Accent bar
      ctx.fillStyle = hexToRgb(accentHex);
      roundRect(ctx, m, y - 1 * scale, 2.5 * scale, 5 * scale, 0.8 * scale);
      ctx.fillStyle = hexToRgb(accentHex);
      ctx.font = `bold ${config.section_title_size * scale / 3}px sans-serif`;
      ctx.fillText(sec, m + 5 * scale, y + 2 * scale);
      y += 6 * scale;

      // Body text lines
      ctx.fillStyle = "#333333";
      ctx.font = `${config.body_font_size * scale / 3}px sans-serif`;
      for (let i = 0; i < 3; i++) {
        if (y + 4 * scale > h - m - 10 * scale) break;
        const lineW = (w - m * 2 - 8 * scale) * (i === 2 ? 0.6 : 1);
        ctx.fillStyle = "#e0e0e0";
        ctx.fillRect(m + 4 * scale, y - 1 * scale, lineW, 2.5 * scale);
        y += config.line_height * config.body_font_size * 0.352778 * scale / 2.5;
      }
      y += 3 * scale;
    }

    // Images placeholder
    if (config.show_patent_images && y + 20 * scale < h - m - 10 * scale) {
      const imgW = 30 * scale;
      const imgH = 18 * scale;
      const imgX = (w - imgW) / 2;
      ctx.strokeStyle = "#c3d7cd";
      ctx.lineWidth = 0.5 * scale;
      ctx.strokeRect(imgX, y, imgW, imgH);
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(imgX + 0.5, y + 0.5, imgW - 1, imgH - 1);
      ctx.fillStyle = "#999";
      ctx.font = `${6 * scale / 3}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("【도면】", w / 2, y + imgH + 3 * scale);
      ctx.textAlign = "start";
      y += imgH + 6 * scale;
    }

    // Disclaimer
    if (config.show_disclaimer && y + 6 * scale < h - m - 8 * scale) {
      ctx.fillStyle = "#fef9e7";
      roundRect(ctx, m + 4 * scale, y, w - m * 2 - 8 * scale, 6 * scale, 1 * scale);
      ctx.fillStyle = "#8b6914";
      ctx.font = `${6 * scale / 3}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("⚠️ " + config.disclaimer_text.substring(0, 30) + "...", w / 2, y + 4 * scale);
      ctx.textAlign = "start";
    }

    // Footer
    const fy = h - 7 * scale;
    ctx.strokeStyle = "#c3d7cd";
    ctx.lineWidth = 0.2 * scale;
    ctx.beginPath();
    ctx.moveTo(m, fy - 2 * scale);
    ctx.lineTo(w - m, fy - 2 * scale);
    ctx.stroke();
    ctx.fillStyle = "#666666";
    ctx.font = `${6 * scale / 3}px sans-serif`;
    ctx.fillText(config.footer_text.substring(0, 25), m, fy);
    if (config.footer_show_page) {
      ctx.textAlign = "center";
      ctx.fillText("1 / 1", w / 2, fy);
      ctx.textAlign = "start";
    }
    if (config.footer_show_date) {
      const dt = new Date().toLocaleDateString("ko-KR");
      ctx.textAlign = "end";
      ctx.fillText(`생성일: ${dt}`, w - m, fy);
      ctx.textAlign = "start";
    }
  }, [config]);

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        width={420}
        height={594}
        className="border border-border rounded-lg shadow-md bg-white"
        style={{ width: 280, height: 396 }}
      />
    </div>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawSectionBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, title: string, scale: number) {
  const hexToRgba = (hex: string, a: number) => {
    const c = hex.replace("#", "");
    return `rgba(${parseInt(c.substring(0, 2), 16)},${parseInt(c.substring(2, 4), 16)},${parseInt(c.substring(4, 6), 16)},${a})`;
  };
  ctx.fillStyle = hexToRgba(color, 0.08);
  roundRect(ctx, x, y, w, h, 2 * scale);
  ctx.fillStyle = hexToRgba(color, 1);
  ctx.font = `bold ${9 * scale / 3}px sans-serif`;
  ctx.fillText(title, x + 5 * scale, y + 5 * scale);
  // score placeholder
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(x + 5 * scale, y + 8 * scale, w * 0.3, 3 * scale);
  ctx.fillRect(x + 5 * scale, y + 12 * scale, w * 0.5, 2 * scale);
}

export function PdfLayoutSettings({ apiCall, initialConfig }: PdfLayoutSettingsProps) {
  const [config, setConfig] = useState<PdfLayoutConfig>({ ...DEFAULT_PDF_CONFIG, ...initialConfig });
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (initialConfig) setConfig(prev => ({ ...prev, ...initialConfig }));
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
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="w-3.5 h-3.5 mr-1" /> {showPreview ? "미리보기 닫기" : "미리보기"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> 초기화
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            저장
          </Button>
        </div>
      </div>

      {/* Live Preview */}
      {showPreview && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">PDF 미리보기</h3>
          <PdfPreview config={config} />
          <p className="text-[10px] text-muted-foreground text-center mt-2">실제 PDF와 유사한 레이아웃 미리보기입니다</p>
        </Card>
      )}

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
            { key: "show_commercialization" as const, label: "AI 기술사업화 점수" },
            { key: "show_trl" as const, label: "기술성숙도(TRL) 섹션" },
            { key: "show_claims" as const, label: "청구항" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-1">
              <span className="text-sm">{item.label}</span>
              <Switch checked={config[item.key]} onCheckedChange={v => update(item.key, v)} />
            </div>
          ))}
        </div>
      </Card>

      {/* Watermark Settings */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">워터마크</h3>
        <div className="grid gap-3">
          <div className="flex items-center justify-between py-1">
            <span className="text-sm">워터마크 표시</span>
            <Switch checked={config.watermark_enabled} onCheckedChange={v => update("watermark_enabled", v)} />
          </div>
          {config.watermark_enabled && (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">워터마크 텍스트</label>
                <Input value={config.watermark_text} onChange={e => update("watermark_text", e.target.value)} placeholder="예: CONFIDENTIAL, DRAFT" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">워터마크 투명도</span>
                  <span className="font-medium">{Math.round(config.watermark_opacity * 100)}%</span>
                </div>
                <Slider value={[config.watermark_opacity]} min={0.02} max={0.3} step={0.01} onValueChange={v => update("watermark_opacity", v[0])} />
              </div>
            </>
          )}
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

      {/* Section Text Colors */}
      <Card className="p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">섹션별 텍스트 색상</h3>
        <p className="text-[10px] text-muted-foreground">각 섹션 제목 및 강조색을 개별적으로 설정합니다</p>
        <div className="grid gap-3">
          {[
            { key: "patentInfo" as const, label: "특허 정보" },
            { key: "commercialization" as const, label: "AI 기술사업화 점수" },
            { key: "trl" as const, label: "기술성숙도(TRL)" },
            { key: "aiSummary" as const, label: "AI 종합 요약" },
            { key: "claims" as const, label: "청구항" },
            { key: "relatedPatents" as const, label: "유사특허" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-1">
              <span className="text-sm">{item.label}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={config.section_colors[item.key]}
                  onChange={e => update("section_colors", { ...config.section_colors, [item.key]: e.target.value })}
                  className="w-8 h-6 rounded border cursor-pointer"
                />
                <Input
                  value={config.section_colors[item.key]}
                  onChange={e => update("section_colors", { ...config.section_colors, [item.key]: e.target.value })}
                  className="w-24 text-xs h-7"
                  placeholder="#000000"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
