import { Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PatentData } from "./types";
import { CommercializationDetails } from "./TechnologyCommercializationScore";

interface PptGeneratorProps {
  content: string;
  patentNumber: string;
  patentData?: PatentData | null;
  commercializationDetails?: CommercializationDetails | null;
  commercializationScore?: number | null;
}

function getGradeLabel(value: number): string {
  if (value >= 90) return "S";
  if (value >= 80) return "A";
  if (value >= 70) return "B";
  if (value >= 60) return "C";
  if (value >= 50) return "D";
  return "F";
}

function getScoreLabel(value: number): string {
  if (value >= 90) return "매우 우수";
  if (value >= 80) return "우수";
  if (value >= 70) return "양호";
  if (value >= 60) return "보통";
  if (value >= 50) return "미흡";
  return "개선 필요";
}

function getScoreColorHex(value: number): string {
  if (value >= 80) return "4CAF50";
  if (value >= 60) return "2196F3";
  if (value >= 40) return "FFC107";
  return "F44336";
}

function getTrlStageLabel(trl: number): string {
  if (trl <= 3) return "기초연구";
  if (trl <= 6) return "실험/시험";
  return "실용화/상용화";
}

const COLORS = {
  primary: "267850",
  accent: "C88728",
  headerGreen: "1C6446",
  bg: "FFFFFF",
  cardBg: "F0F8F3",
  text: "141E14",
  textMuted: "5A6E64",
  border: "C3D7CD",
  white: "FFFFFF",
};

export function PptGenerator({
  content,
  patentNumber,
  patentData,
  commercializationDetails,
  commercializationScore,
}: PptGeneratorProps) {
  const handlePptDownload = async () => {
    if (!content) {
      toast.error("PPT 생성에 실패했습니다.");
      return;
    }

    toast.info("PPT 생성 중...");

    try {
      const PptxGenJS = (await import("pptxgenjs")).default;
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_16x9";
      pptx.author = "농식품 특허 요약 서비스";
      pptx.title = `특허요약_${patentNumber}`;

      const isApp = patentData?.searchType === "application";
      const displayNumber = isApp
        ? patentData?.applicationNumber || patentData?.displayNumber || patentNumber
        : patentData?.displayNumber || patentNumber;
      const numberLabel = isApp ? "출원번호" : "등록번호";

      // ===== Slide 1: Title =====
      const slide1 = pptx.addSlide();
      slide1.background = { fill: COLORS.headerGreen };

      slide1.addText("농식품 특허 요약서", {
        x: 0.8, y: 1.5, w: 8.4, h: 1,
        fontSize: 32, fontFace: "맑은 고딕",
        color: COLORS.white, bold: true,
      });
      slide1.addText("Agri-Food Patent Summary Report", {
        x: 0.8, y: 2.5, w: 8.4, h: 0.5,
        fontSize: 14, fontFace: "맑은 고딕",
        color: "C8E1D2",
      });

      if (patentData?.titleKo) {
        slide1.addText(patentData.titleKo, {
          x: 0.8, y: 3.4, w: 8.4, h: 0.8,
          fontSize: 18, fontFace: "맑은 고딕",
          color: COLORS.white, bold: true,
        });
      }

      slide1.addText(`${numberLabel}: ${displayNumber}`, {
        x: 0.8, y: 4.5, w: 8.4, h: 0.4,
        fontSize: 13, fontFace: "맑은 고딕",
        color: "C8E1D2",
      });

      const dateStr = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
      slide1.addText(dateStr, {
        x: 0.8, y: 4.9, w: 8.4, h: 0.4,
        fontSize: 11, fontFace: "맑은 고딕",
        color: "A0C4B0",
      });

      // ===== Slide 2: Patent Info =====
      if (patentData) {
        const slide2 = pptx.addSlide();
        addSlideHeader(slide2, "📄 특허 정보");

        if (patentData.titleKo) {
          slide2.addText(patentData.titleKo, {
            x: 0.5, y: 1.2, w: 9, h: 0.6,
            fontSize: 16, fontFace: "맑은 고딕",
            color: COLORS.text, bold: true,
          });
        }

        const infoItems: { label: string; value: string }[] = [];
        if (patentData.assignee) infoItems.push({ label: "출원인", value: patentData.assignee });
        if (patentData.inventors?.length) infoItems.push({ label: "발명자", value: patentData.inventors.join(", ") });
        if (patentData.filingDate) infoItems.push({ label: "출원일", value: patentData.filingDate });
        if (patentData.publicationDate) infoItems.push({ label: "공개일", value: patentData.publicationDate });

        const cols = Math.min(infoItems.length, 4);
        const cardW = 9 / cols - 0.15;
        infoItems.forEach((item, idx) => {
          const xPos = 0.5 + idx * (cardW + 0.15);
          slide2.addShape(pptx.ShapeType.roundRect, {
            x: xPos, y: 2.0, w: cardW, h: 1.0,
            fill: { color: COLORS.cardBg },
            line: { color: COLORS.border, width: 0.5 },
            rectRadius: 0.08,
          });
          slide2.addText(item.label, {
            x: xPos + 0.15, y: 2.05, w: cardW - 0.3, h: 0.35,
            fontSize: 9, fontFace: "맑은 고딕", color: COLORS.textMuted,
          });
          slide2.addText(item.value, {
            x: xPos + 0.15, y: 2.4, w: cardW - 0.3, h: 0.5,
            fontSize: 11, fontFace: "맑은 고딕", color: COLORS.text, bold: true,
          });
        });
      }

      // ===== Slide 3: Commercialization Score =====
      if (commercializationScore != null && commercializationDetails) {
        const slide3 = pptx.addSlide();
        addSlideHeader(slide3, "✨ AI 기술사업화점수");

        const scoreColor = getScoreColorHex(commercializationScore);
        const grade = getGradeLabel(commercializationScore);
        const label = getScoreLabel(commercializationScore);

        // Main score
        slide3.addText(String(commercializationScore), {
          x: 0.8, y: 1.3, w: 2, h: 1,
          fontSize: 48, fontFace: "맑은 고딕",
          color: scoreColor, bold: true,
        });
        slide3.addText("/ 100", {
          x: 2.6, y: 1.65, w: 1, h: 0.5,
          fontSize: 16, fontFace: "맑은 고딕", color: COLORS.textMuted,
        });
        slide3.addText(`${grade} - ${label}`, {
          x: 3.8, y: 1.5, w: 3, h: 0.6,
          fontSize: 20, fontFace: "맑은 고딕", color: scoreColor, bold: true,
        });

        // Sub-scores
        const subScores = [
          { label: "기술성", score: commercializationDetails.technologyScore },
          { label: "시장성", score: commercializationDetails.marketScore },
          { label: "사업성", score: commercializationDetails.businessScore },
        ];

        subScores.forEach((item, idx) => {
          const xPos = 0.8 + idx * 2.8;
          const sc = getScoreColorHex(item.score);
          slide3.addShape(pptx.ShapeType.roundRect, {
            x: xPos, y: 2.6, w: 2.5, h: 1.0,
            fill: { color: COLORS.cardBg },
            line: { color: COLORS.border, width: 0.5 },
            rectRadius: 0.08,
          });
          slide3.addText(item.label, {
            x: xPos + 0.2, y: 2.65, w: 2, h: 0.35,
            fontSize: 10, fontFace: "맑은 고딕", color: COLORS.textMuted,
          });
          slide3.addText(`${item.score}점`, {
            x: xPos + 0.2, y: 3.0, w: 2, h: 0.5,
            fontSize: 18, fontFace: "맑은 고딕", color: sc, bold: true,
          });
        });

        // Analysis
        if (commercializationDetails.analysis) {
          slide3.addText(commercializationDetails.analysis, {
            x: 0.8, y: 3.9, w: 8.4, h: 1.3,
            fontSize: 10, fontFace: "맑은 고딕",
            color: COLORS.text, valign: "top",
            wrap: true,
          });
        }
      }

      // ===== Slide 4: TRL =====
      if (commercializationDetails?.trl) {
        const slide4 = pptx.addSlide();
        addSlideHeader(slide4, "📊 기술성숙도 (TRL)");

        const trl = commercializationDetails.trl;
        const trlColor = trl <= 3 ? "9C27B0" : trl <= 6 ? "FBBF24" : "4ADE80";

        // TRL badge
        slide4.addShape(pptx.ShapeType.roundRect, {
          x: 0.8, y: 1.3, w: 0.7, h: 0.7,
          fill: { color: trlColor }, rectRadius: 0.1,
        });
        slide4.addText(String(trl), {
          x: 0.8, y: 1.3, w: 0.7, h: 0.7,
          fontSize: 24, fontFace: "맑은 고딕",
          color: COLORS.white, bold: true, align: "center", valign: "middle",
        });
        slide4.addText(`TRL ${trl} - ${getTrlStageLabel(trl)}`, {
          x: 1.7, y: 1.3, w: 5, h: 0.4,
          fontSize: 16, fontFace: "맑은 고딕", color: COLORS.text, bold: true,
        });
        slide4.addText(`상용화까지 ${9 - trl} 단계`, {
          x: 1.7, y: 1.7, w: 5, h: 0.3,
          fontSize: 11, fontFace: "맑은 고딕", color: COLORS.textMuted,
        });

        // TRL progress bar segments
        const barStartX = 0.8;
        const barW = 8.4;
        const segW = barW / 9;
        for (let i = 1; i <= 9; i++) {
          const active = i <= trl;
          let fillColor: string;
          if (i <= 3) fillColor = active ? "9C27B0" : "E6E8E6";
          else if (i <= 6) fillColor = active ? "FBBF24" : "E6E8E6";
          else fillColor = active ? "4ADE80" : "E6E8E6";

          slide4.addShape(pptx.ShapeType.roundRect, {
            x: barStartX + (i - 1) * segW, y: 2.3, w: segW - 0.05, h: 0.35,
            fill: { color: fillColor }, rectRadius: 0.05,
          });
          slide4.addText(String(i), {
            x: barStartX + (i - 1) * segW, y: 2.3, w: segW - 0.05, h: 0.35,
            fontSize: 8, fontFace: "맑은 고딕",
            color: active ? COLORS.white : "A0A0A0",
            align: "center", valign: "middle",
          });
        }

        // Stage labels
        const stages = ["기초연구 (TRL 1-3)", "개발/실증 (TRL 4-6)", "상용화 (TRL 7-9)"];
        const stageColors = ["9C27B0", "FBBF24", "4ADE80"];
        stages.forEach((s, idx) => {
          const active = (idx === 0 && trl <= 3) || (idx === 1 && trl >= 4 && trl <= 6) || (idx === 2 && trl >= 7);
          slide4.addShape(pptx.ShapeType.roundRect, {
            x: 0.8 + idx * 2.9, y: 2.85, w: 2.7, h: 0.4,
            fill: { color: active ? stageColors[idx] : "F0F2F0" },
            rectRadius: 0.06,
          });
          slide4.addText(s, {
            x: 0.8 + idx * 2.9, y: 2.85, w: 2.7, h: 0.4,
            fontSize: 9, fontFace: "맑은 고딕",
            color: active ? COLORS.white : COLORS.textMuted,
            align: "center", valign: "middle",
          });
        });

        // TRL reason
        if (commercializationDetails.trlReason) {
          slide4.addShape(pptx.ShapeType.roundRect, {
            x: 0.8, y: 3.5, w: 8.4, h: 1.2,
            fill: { color: COLORS.cardBg },
            line: { color: COLORS.border, width: 0.5 },
            rectRadius: 0.08,
          });
          slide4.addText("TRL 추정 근거", {
            x: 1.0, y: 3.55, w: 8, h: 0.3,
            fontSize: 9, fontFace: "맑은 고딕", color: COLORS.textMuted,
          });
          slide4.addText(commercializationDetails.trlReason, {
            x: 1.0, y: 3.85, w: 8, h: 0.8,
            fontSize: 11, fontFace: "맑은 고딕", color: COLORS.text,
            wrap: true, valign: "top",
          });
        }
      }

      // ===== Summary Slides =====
      const lines = content.split("\n");
      let currentSlide: ReturnType<typeof pptx.addSlide> | null = null;
      let currentY = 1.2;
      let skipSection = false;

      for (const line of lines) {
        if (line.startsWith("## 특허 기본 정보")) { skipSection = true; continue; }
        if (skipSection && line.startsWith("## ")) skipSection = false;
        if (skipSection) continue;

        if (line.startsWith("## ")) {
          const sectionTitle = line.replace("## ", "").replace(/\*\*/g, "");
          if (sectionTitle === "특허 기본 정보") { skipSection = true; continue; }
          if (sectionTitle.includes("AI 종합") || sectionTitle.includes("종합 요약") || sectionTitle.includes("종합요약")) continue;

          // New slide per section
          currentSlide = pptx.addSlide();
          addSlideHeader(currentSlide, sectionTitle);
          currentY = 1.2;

          // Add representative image on 발명의 요약 slide
          if (sectionTitle === "발명의 요약" && patentData?.representativeImage) {
            try {
              const proxied = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(patentData.representativeImage)}`;
              const res = await fetch(proxied);
              if (res.ok) {
                const blob = await res.blob();
                const dataUrl = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(String(reader.result));
                  reader.onerror = () => reject(new Error("fail"));
                  reader.readAsDataURL(blob);
                });
                currentSlide.addImage({
                  data: dataUrl,
                  x: 6.5, y: 1.2, w: 2.8, h: 2.2,
                  rounding: true,
                });
                // Narrow text to leave room for image
              }
            } catch { /* ignore image errors */ }
          }
        } else if (line.trim() && currentSlide) {
          const cleanLine = line.replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "");
          if (!cleanLine.trim()) continue;

          // Check if we need a new slide (text overflow)
          if (currentY > 4.8) {
            const prevTitle = "（계속）";
            currentSlide = pptx.addSlide();
            addSlideHeader(currentSlide, prevTitle);
            currentY = 1.2;
          }

          // Parse bold segments into pptxgenjs text runs
          const textRuns = parseBoldText(cleanLine);
          currentSlide.addText(textRuns, {
            x: 0.5, y: currentY, w: 9, h: 0.45,
            fontSize: 11, fontFace: "맑은 고딕",
            color: COLORS.text, valign: "top",
            wrap: true, lineSpacingMultiple: 1.3,
          });
          currentY += 0.45;
        }
      }

      // ===== Claims Slide =====
      if (patentData?.claims && patentData.claims.length > 0) {
        const claimsSlide = pptx.addSlide();
        addSlideHeader(claimsSlide, `📑 청구항 (${patentData.claims.length}개)`);

        let cy = 1.2;
        const maxClaims = Math.min(patentData.claims.length, 5);
        for (let i = 0; i < maxClaims; i++) {
          if (cy > 4.6) break;
          const claimText = patentData.claims[i].length > 200
            ? patentData.claims[i].substring(0, 200) + "..."
            : patentData.claims[i];

          claimsSlide.addText(`청구항 ${i + 1}`, {
            x: 0.5, y: cy, w: 9, h: 0.25,
            fontSize: 8, fontFace: "맑은 고딕", color: COLORS.textMuted,
          });
          claimsSlide.addText(claimText, {
            x: 0.5, y: cy + 0.25, w: 9, h: 0.6,
            fontSize: 9, fontFace: "맑은 고딕", color: COLORS.text,
            wrap: true, valign: "top",
          });
          cy += 0.95;
        }
      }

      // ===== Footer on all slides =====
      const allSlides = (pptx as any).slides || [];
      const slideCount = allSlides.length;
      allSlides.forEach((slide: any, idx: number) => {
        slide.addText("© 농식품 특허 요약 서비스 | AI 기반 특허 분석", {
          x: 0.3, y: 5.15, w: 6, h: 0.25,
          fontSize: 7, fontFace: "맑은 고딕", color: COLORS.textMuted,
        });
        slide.addText(`${idx + 1} / ${slideCount}`, {
          x: 8.5, y: 5.15, w: 1.2, h: 0.25,
          fontSize: 7, fontFace: "맑은 고딕", color: COLORS.textMuted, align: "right",
        });
      });

      await pptx.writeFile({ fileName: `특허요약_${patentNumber}.pptx` });
      toast.success("PPT가 다운로드되었습니다!");
    } catch (error) {
      console.error("PPT generation error:", error);
      toast.error("PPT 생성 중 오류가 발생했습니다.");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePptDownload} className="gap-2" disabled={!content}>
      <Presentation className="w-4 h-4" />
      PPT 다운로드
    </Button>
  );
}

function addSlideHeader(slide: any, title: string) {
  slide.addShape("roundRect" as any, {
    x: 0, y: 0, w: 10, h: 0.85,
    fill: { color: COLORS.headerGreen },
    rectRadius: 0,
  });
  slide.addText(title, {
    x: 0.5, y: 0.15, w: 9, h: 0.55,
    fontSize: 18, fontFace: "맑은 고딕",
    color: COLORS.white, bold: true,
  });
}

function parseBoldText(text: string): Array<{ text: string; options?: { bold?: boolean; color?: string } }> {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments
    .filter(s => s.length > 0)
    .map(seg => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        return { text: seg.slice(2, -2), options: { bold: true, color: COLORS.text } };
      }
      return { text: seg, options: { color: COLORS.text } };
    });
}
