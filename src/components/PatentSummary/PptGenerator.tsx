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

function getGradeLabel(v: number) { return v >= 90 ? "S" : v >= 80 ? "A" : v >= 70 ? "B" : v >= 60 ? "C" : v >= 50 ? "D" : "F"; }
function getScoreLabel(v: number) { return v >= 90 ? "매우 우수" : v >= 80 ? "우수" : v >= 70 ? "양호" : v >= 60 ? "보통" : v >= 50 ? "미흡" : "개선 필요"; }
function getScoreColorHex(v: number) { return v >= 80 ? "2E7D32" : v >= 60 ? "1565C0" : v >= 40 ? "F57F17" : "C62828"; }
function getTrlStageLabel(t: number) { return t <= 3 ? "기초연구" : t <= 6 ? "실험/시험" : "실용화/상용화"; }

const C = {
  darkGreen: "0D3B26",
  headerGreen: "145A3C",
  midGreen: "1B7A50",
  lightGreen: "E8F5EC",
  cardBg: "F2F9F5",
  accent: "D4A843",
  text: "1A2E22",
  textMuted: "5E7A6C",
  textLight: "8AA698",
  border: "C5DDD0",
  white: "FFFFFF",
  gradientEnd: "0A5E38",
};

// Helper: load image as data URL
async function loadImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

export function PptGenerator({
  content,
  patentNumber,
  patentData,
  commercializationDetails,
  commercializationScore,
}: PptGeneratorProps) {
  const handlePptDownload = async () => {
    if (!content) { toast.error("PPT 생성에 실패했습니다."); return; }
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
      const dateStr = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

      // ============================
      // Slide 1: Title (gradient bg)
      // ============================
      const s1 = pptx.addSlide();
      // Gradient background via two overlapping shapes
      s1.background = { fill: C.darkGreen };
      // Decorative accent bar
      s1.addShape(pptx.ShapeType.rect, {
        x: 0, y: 4.0, w: 10, h: 0.06, fill: { color: C.accent },
      });
      // Decorative circle
      s1.addShape(pptx.ShapeType.ellipse, {
        x: 7.8, y: 0.6, w: 2.5, h: 2.5,
        fill: { color: C.headerGreen, transparency: 60 },
      });
      s1.addShape(pptx.ShapeType.ellipse, {
        x: 8.3, y: 1.0, w: 1.5, h: 1.5,
        fill: { color: C.midGreen, transparency: 50 },
      });

      s1.addText("농식품 특허 요약서", {
        x: 0.8, y: 1.0, w: 7, h: 0.8,
        fontSize: 34, fontFace: "맑은 고딕", color: C.white, bold: true,
      });
      s1.addText("Agri-Food Patent Summary Report", {
        x: 0.8, y: 1.85, w: 7, h: 0.4,
        fontSize: 13, fontFace: "맑은 고딕", color: C.textLight, italic: true,
      });

      // Accent line under subtitle
      s1.addShape(pptx.ShapeType.rect, {
        x: 0.8, y: 2.35, w: 2.5, h: 0.04, fill: { color: C.accent },
      });

      if (patentData?.titleKo) {
        s1.addText(patentData.titleKo, {
          x: 0.8, y: 2.65, w: 7, h: 0.7,
          fontSize: 17, fontFace: "맑은 고딕", color: C.white, bold: true,
        });
      }

      s1.addText(`${numberLabel}: ${displayNumber}`, {
        x: 0.8, y: 4.3, w: 5, h: 0.35,
        fontSize: 12, fontFace: "맑은 고딕", color: C.textLight,
      });
      s1.addText(dateStr, {
        x: 0.8, y: 4.65, w: 5, h: 0.3,
        fontSize: 10, fontFace: "맑은 고딕", color: C.textLight,
      });

      // =====================================================
      // Slide 2: Patent Info + Score (MERGED into one slide)
      // =====================================================
      if (patentData) {
        const s2 = pptx.addSlide();
        addSlideHeader(s2, pptx, "📄 특허 정보 & 기술사업화점수");

        // Patent title
        if (patentData.titleKo) {
          s2.addText(patentData.titleKo, {
            x: 0.5, y: 1.05, w: 9, h: 0.45,
            fontSize: 14, fontFace: "맑은 고딕", color: C.text, bold: true,
          });
        }

        // Info grid cards
        const infoItems: { label: string; value: string }[] = [];
        if (patentData.assignee) infoItems.push({ label: "출원인", value: patentData.assignee });
        if (patentData.inventors?.length) infoItems.push({ label: "발명자", value: patentData.inventors.join(", ") });
        if (patentData.filingDate) infoItems.push({ label: "출원일", value: patentData.filingDate });
        if (patentData.publicationDate) infoItems.push({ label: "공개일", value: patentData.publicationDate });

        const cols = Math.min(infoItems.length, 4);
        const cardW = (9 - (cols - 1) * 0.12) / cols;
        infoItems.forEach((item, idx) => {
          const xPos = 0.5 + idx * (cardW + 0.12);
          s2.addShape(pptx.ShapeType.roundRect, {
            x: xPos, y: 1.6, w: cardW, h: 0.75,
            fill: { color: C.cardBg }, line: { color: C.border, width: 0.4 }, rectRadius: 0.06,
          });
          s2.addText(item.label, {
            x: xPos + 0.12, y: 1.62, w: cardW - 0.24, h: 0.25,
            fontSize: 8, fontFace: "맑은 고딕", color: C.textMuted,
          });
          s2.addText(item.value, {
            x: xPos + 0.12, y: 1.88, w: cardW - 0.24, h: 0.4,
            fontSize: 10, fontFace: "맑은 고딕", color: C.text, bold: true,
          });
        });

        // Divider
        s2.addShape(pptx.ShapeType.rect, {
          x: 0.5, y: 2.55, w: 9, h: 0.015, fill: { color: C.border },
        });

        // Commercialization Score section on same slide
        if (commercializationScore != null && commercializationDetails) {
          const sc = getScoreColorHex(commercializationScore);
          const grade = getGradeLabel(commercializationScore);
          const label = getScoreLabel(commercializationScore);

          // Score display - left side
          s2.addText("AI 기술사업화점수", {
            x: 0.5, y: 2.7, w: 4, h: 0.3,
            fontSize: 10, fontFace: "맑은 고딕", color: C.textMuted,
          });

          s2.addShape(pptx.ShapeType.roundRect, {
            x: 0.5, y: 3.05, w: 4.3, h: 1.5,
            fill: { color: C.cardBg }, line: { color: C.border, width: 0.4 }, rectRadius: 0.08,
          });

          s2.addText(String(commercializationScore), {
            x: 0.7, y: 3.05, w: 1.5, h: 1.0,
            fontSize: 42, fontFace: "맑은 고딕", color: sc, bold: true,
          });
          s2.addText(`/ 100`, {
            x: 2.1, y: 3.4, w: 0.8, h: 0.3,
            fontSize: 12, fontFace: "맑은 고딕", color: C.textMuted,
          });
          s2.addText(`${grade}등급 · ${label}`, {
            x: 2.9, y: 3.15, w: 1.8, h: 0.35,
            fontSize: 13, fontFace: "맑은 고딕", color: sc, bold: true,
          });

          // Progress bar
          s2.addShape(pptx.ShapeType.roundRect, {
            x: 0.7, y: 4.1, w: 3.9, h: 0.18,
            fill: { color: "E0E8E3" }, rectRadius: 0.09,
          });
          s2.addShape(pptx.ShapeType.roundRect, {
            x: 0.7, y: 4.1, w: Math.max(0.18, 3.9 * commercializationScore / 100), h: 0.18,
            fill: { color: sc }, rectRadius: 0.09,
          });

          // Sub-scores - right side
          const subScores = [
            { label: "기술성", score: commercializationDetails.technologyScore },
            { label: "시장성", score: commercializationDetails.marketScore },
            { label: "사업성", score: commercializationDetails.businessScore },
          ];
          subScores.forEach((item, idx) => {
            const xPos = 5.1 + idx * 1.55;
            const itemColor = getScoreColorHex(item.score);
            s2.addShape(pptx.ShapeType.roundRect, {
              x: xPos, y: 3.05, w: 1.4, h: 1.5,
              fill: { color: C.cardBg }, line: { color: C.border, width: 0.4 }, rectRadius: 0.06,
            });
            s2.addText(item.label, {
              x: xPos, y: 3.1, w: 1.4, h: 0.3,
              fontSize: 9, fontFace: "맑은 고딕", color: C.textMuted, align: "center",
            });
            s2.addText(String(item.score), {
              x: xPos, y: 3.4, w: 1.4, h: 0.6,
              fontSize: 26, fontFace: "맑은 고딕", color: itemColor, bold: true, align: "center",
            });
            s2.addText("점", {
              x: xPos, y: 4.0, w: 1.4, h: 0.25,
              fontSize: 9, fontFace: "맑은 고딕", color: C.textMuted, align: "center",
            });
            // Mini progress bar
            s2.addShape(pptx.ShapeType.roundRect, {
              x: xPos + 0.2, y: 4.3, w: 1.0, h: 0.1,
              fill: { color: "E0E8E3" }, rectRadius: 0.05,
            });
            s2.addShape(pptx.ShapeType.roundRect, {
              x: xPos + 0.2, y: 4.3, w: Math.max(0.1, 1.0 * item.score / 100), h: 0.1,
              fill: { color: itemColor }, rectRadius: 0.05,
            });
          });

          // Analysis text below
          if (commercializationDetails.analysis) {
            s2.addText(commercializationDetails.analysis, {
              x: 0.5, y: 4.65, w: 9, h: 0.5,
              fontSize: 8.5, fontFace: "맑은 고딕", color: C.textMuted,
              wrap: true, valign: "top",
            });
          }
        }
      }

      // =====================================================
      // Slide 3: TRL (Technology Readiness Level)
      // =====================================================
      if (commercializationDetails?.trl) {
        const s3 = pptx.addSlide();
        addSlideHeader(s3, pptx, "📊 기술성숙도 (TRL)");

        const trl = commercializationDetails.trl;
        const trlColors = ["9C27B0", "8E24AA", "7B1FA2", "F9A825", "F57F17", "EF6C00", "43A047", "2E7D32", "1B5E20"];

        // TRL badge - large circle
        const activeTrlColor = trl <= 3 ? "7B1FA2" : trl <= 6 ? "EF6C00" : "2E7D32";
        s3.addShape(pptx.ShapeType.ellipse, {
          x: 0.7, y: 1.15, w: 1.1, h: 1.1,
          fill: { color: activeTrlColor },
        });
        s3.addText(String(trl), {
          x: 0.7, y: 1.15, w: 1.1, h: 1.1,
          fontSize: 36, fontFace: "맑은 고딕", color: C.white, bold: true,
          align: "center", valign: "middle",
        });

        s3.addText(`TRL ${trl} — ${getTrlStageLabel(trl)}`, {
          x: 2.0, y: 1.2, w: 5, h: 0.4,
          fontSize: 18, fontFace: "맑은 고딕", color: C.text, bold: true,
        });
        s3.addText(`상용화까지 ${9 - trl} 단계 남음`, {
          x: 2.0, y: 1.65, w: 5, h: 0.3,
          fontSize: 11, fontFace: "맑은 고딕", color: C.textMuted,
        });

        // TRL progress segments - visual bar chart style
        const barStartX = 0.7;
        const totalBarW = 8.6;
        const segW = totalBarW / 9;
        const segH = 0.55;
        for (let i = 1; i <= 9; i++) {
          const active = i <= trl;
          const fillColor = active ? trlColors[i - 1] : "E8EBE8";
          s3.addShape(pptx.ShapeType.roundRect, {
            x: barStartX + (i - 1) * segW, y: 2.25, w: segW - 0.06, h: segH,
            fill: { color: fillColor }, rectRadius: 0.06,
          });
          s3.addText(String(i), {
            x: barStartX + (i - 1) * segW, y: 2.25, w: segW - 0.06, h: segH,
            fontSize: 12, fontFace: "맑은 고딕",
            color: active ? C.white : "B0B0B0",
            align: "center", valign: "middle", bold: active,
          });
        }

        // Stage labels with colored tags
        const stages = [
          { label: "기초연구", sub: "TRL 1-3", color: "7B1FA2", range: [1, 3] },
          { label: "개발/실증", sub: "TRL 4-6", color: "EF6C00", range: [4, 6] },
          { label: "상용화", sub: "TRL 7-9", color: "2E7D32", range: [7, 9] },
        ];
        stages.forEach((s, idx) => {
          const active = trl >= s.range[0] && trl <= s.range[1];
          const stgW = totalBarW / 3;
          const sx = barStartX + idx * stgW;
          s3.addShape(pptx.ShapeType.roundRect, {
            x: sx, y: 2.95, w: stgW - 0.1, h: 0.45,
            fill: { color: active ? s.color : "F0F2F0" }, rectRadius: 0.06,
          });
          s3.addText(`${s.label}  ${s.sub}`, {
            x: sx, y: 2.95, w: stgW - 0.1, h: 0.45,
            fontSize: 10, fontFace: "맑은 고딕",
            color: active ? C.white : C.textMuted,
            align: "center", valign: "middle", bold: active,
          });
        });

        // TRL reason box
        if (commercializationDetails.trlReason) {
          s3.addShape(pptx.ShapeType.roundRect, {
            x: 0.7, y: 3.65, w: 8.6, h: 1.2,
            fill: { color: C.cardBg }, line: { color: C.border, width: 0.4 }, rectRadius: 0.08,
          });
          // Green accent bar on left
          s3.addShape(pptx.ShapeType.rect, {
            x: 0.7, y: 3.65, w: 0.06, h: 1.2, fill: { color: C.midGreen },
          });
          s3.addText("TRL 추정 근거", {
            x: 0.95, y: 3.7, w: 8, h: 0.25,
            fontSize: 9, fontFace: "맑은 고딕", color: C.textMuted, bold: true,
          });
          s3.addText(commercializationDetails.trlReason, {
            x: 0.95, y: 3.98, w: 8.1, h: 0.8,
            fontSize: 11, fontFace: "맑은 고딕", color: C.text,
            wrap: true, valign: "top", lineSpacingMultiple: 1.3,
          });
        }
      }

      // =====================================================
      // Summary Slides - smart text flow with overflow handling
      // =====================================================
      const lines = content.split("\n");
      let currentSlide: any = null;
      let currentY = 1.15;
      let skipSection = false;
      let currentSectionTitle = "";
      let hasImageOnSlide = false;

      // Collect sections first for smarter layout
      const sections: { title: string; lines: string[] }[] = [];
      let currentSection: { title: string; lines: string[] } | null = null;
      for (const line of lines) {
        if (line.startsWith("## 특허 기본 정보")) { skipSection = true; continue; }
        if (skipSection && line.startsWith("## ")) skipSection = false;
        if (skipSection) continue;
        if (line.startsWith("## ")) {
          const title = line.replace("## ", "").replace(/\*\*/g, "");
          if (title === "특허 기본 정보") { skipSection = true; continue; }
          if (title.includes("AI 종합") || title.includes("종합 요약") || title.includes("종합요약")) continue;
          if (currentSection) sections.push(currentSection);
          currentSection = { title, lines: [] };
        } else {
          const clean = line.replace(/^\s*[-•]\s+/, "").replace(/^\s*\d+\.\s+/, "").trim();
          if (clean && currentSection) currentSection.lines.push(clean);
        }
      }
      if (currentSection) sections.push(currentSection);

      // Estimate text height: ~0.32 inches per line, lines wrap at ~80 chars
      const estimateHeight = (text: string) => Math.ceil(text.length / 80) * 0.32;

      // Check if two short sections can be merged
      const canMergeSections = (a: { lines: string[] }, b: { lines: string[] }) => {
        const hA = a.lines.reduce((sum, l) => sum + estimateHeight(l), 0);
        const hB = b.lines.reduce((sum, l) => sum + estimateHeight(l), 0);
        return hA + hB < 3.2; // fits in one slide with both headers
      };

      let i = 0;
      while (i < sections.length) {
        const sec = sections[i];
        const nextSec = i + 1 < sections.length ? sections[i + 1] : null;

        // Try merging two small sections
        if (nextSec && canMergeSections(sec, nextSec)) {
          currentSlide = pptx.addSlide();
          addSlideHeader(currentSlide, pptx, sec.title);
          addDecoStripe(currentSlide, pptx);
          currentY = 1.15;
          hasImageOnSlide = false;

          // First section content
          if (sec.title === "발명의 요약" && patentData?.representativeImage) {
            hasImageOnSlide = true;
            const imgDataUrl = await loadImage(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(patentData.representativeImage)}`
            );
            if (imgDataUrl) {
              currentSlide.addImage({
                data: imgDataUrl, x: 6.8, y: 1.15, w: 2.4, h: 1.9,
                rounding: true,
              });
            }
          }

          const textW1 = hasImageOnSlide ? 6.0 : 9.0;
          for (const line of sec.lines) {
            if (currentY > 4.5) break;
            const runs = parseBoldText(line);
            const lineH = Math.max(0.32, estimateHeight(line));
            currentSlide.addText(runs, {
              x: 0.5, y: currentY, w: textW1, h: lineH,
              fontSize: 11, fontFace: "맑은 고딕", color: C.text,
              valign: "top", wrap: true, lineSpacingMultiple: 1.3,
            });
            currentY += lineH + 0.04;
          }

          // Divider + second section title
          currentY += 0.15;
          currentSlide.addShape(pptx.ShapeType.rect, {
            x: 0.5, y: currentY, w: 9, h: 0.015, fill: { color: C.border },
          });
          currentY += 0.25;

          // Section title accent
          currentSlide.addShape(pptx.ShapeType.rect, {
            x: 0.5, y: currentY, w: 0.06, h: 0.35, fill: { color: C.midGreen },
          });
          currentSlide.addText(nextSec.title, {
            x: 0.7, y: currentY, w: 8, h: 0.35,
            fontSize: 13, fontFace: "맑은 고딕", color: C.headerGreen, bold: true,
          });
          currentY += 0.45;

          for (const line of nextSec.lines) {
            if (currentY > 4.8) break;
            const runs = parseBoldText(line);
            const lineH = Math.max(0.32, estimateHeight(line));
            currentSlide.addText(runs, {
              x: 0.5, y: currentY, w: 9, h: lineH,
              fontSize: 11, fontFace: "맑은 고딕", color: C.text,
              valign: "top", wrap: true, lineSpacingMultiple: 1.3,
            });
            currentY += lineH + 0.04;
          }

          i += 2;
          continue;
        }

        // Single section per slide
        currentSlide = pptx.addSlide();
        addSlideHeader(currentSlide, pptx, sec.title);
        addDecoStripe(currentSlide, pptx);
        currentY = 1.15;
        hasImageOnSlide = false;

        // Representative image on 발명의 요약
        if (sec.title === "발명의 요약" && patentData?.representativeImage) {
          hasImageOnSlide = true;
          const imgDataUrl = await loadImage(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-image?url=${encodeURIComponent(patentData.representativeImage)}`
          );
          if (imgDataUrl) {
            currentSlide.addImage({
              data: imgDataUrl, x: 6.8, y: 1.15, w: 2.5, h: 2.0,
              rounding: true,
            });
            // Image caption
            currentSlide.addText("【대표 도면】", {
              x: 6.8, y: 3.2, w: 2.5, h: 0.25,
              fontSize: 7, fontFace: "맑은 고딕", color: C.textMuted, align: "center",
            });
          }
        }

        const textW = hasImageOnSlide ? 6.0 : 9.0;

        for (const line of sec.lines) {
          // Overflow check → new continuation slide
          if (currentY > 4.5) {
            currentSlide = pptx.addSlide();
            addSlideHeader(currentSlide, pptx, `${sec.title} (계속)`);
            addDecoStripe(currentSlide, pptx);
            currentY = 1.15;
          }

          const runs = parseBoldText(line);
          const lineH = Math.max(0.32, estimateHeight(line));
          currentSlide.addText(runs, {
            x: 0.5, y: currentY, w: textW, h: lineH,
            fontSize: 11, fontFace: "맑은 고딕", color: C.text,
            valign: "top", wrap: true, lineSpacingMultiple: 1.3,
          });
          currentY += lineH + 0.04;
        }

        i++;
      }

      // =====================================================
      // Claims Slide
      // =====================================================
      if (patentData?.claims && patentData.claims.length > 0) {
        const cs = pptx.addSlide();
        addSlideHeader(cs, pptx, `📑 청구항 (${patentData.claims.length}개)`);
        addDecoStripe(cs, pptx);

        let cy = 1.15;
        const maxClaims = Math.min(patentData.claims.length, 5);
        for (let j = 0; j < maxClaims; j++) {
          if (cy > 4.4) break;
          const claimText = patentData.claims[j].length > 180
            ? patentData.claims[j].substring(0, 180) + "..."
            : patentData.claims[j];

          // Claim number badge
          cs.addShape(pptx.ShapeType.roundRect, {
            x: 0.5, y: cy, w: 0.6, h: 0.25,
            fill: { color: C.midGreen }, rectRadius: 0.04,
          });
          cs.addText(`${j + 1}`, {
            x: 0.5, y: cy, w: 0.6, h: 0.25,
            fontSize: 8, fontFace: "맑은 고딕", color: C.white,
            align: "center", valign: "middle", bold: true,
          });

          const claimH = Math.max(0.4, estimateHeight(claimText));
          cs.addText(claimText, {
            x: 1.2, y: cy, w: 8.3, h: claimH,
            fontSize: 9, fontFace: "맑은 고딕", color: C.text,
            wrap: true, valign: "top", lineSpacingMultiple: 1.2,
          });
          cy += claimH + 0.12;
        }
      }

      // =====================================================
      // Footer on all slides
      // =====================================================
      const allSlides = (pptx as any).slides || [];
      const slideCount = allSlides.length;
      allSlides.forEach((slide: any, idx: number) => {
        // Footer line
        slide.addShape("rect" as any, {
          x: 0.3, y: 5.05, w: 9.4, h: 0.01, fill: { color: C.border },
        });
        slide.addText("© 농식품 특허 요약 서비스 · AI 기반 특허 분석", {
          x: 0.3, y: 5.1, w: 7, h: 0.22,
          fontSize: 6.5, fontFace: "맑은 고딕", color: C.textLight,
        });
        slide.addText(`${idx + 1} / ${slideCount}`, {
          x: 8.5, y: 5.1, w: 1.2, h: 0.22,
          fontSize: 6.5, fontFace: "맑은 고딕", color: C.textLight, align: "right",
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
      PPT
    </Button>
  );
}

function addSlideHeader(slide: any, pptx: any, title: string) {
  // Gradient-like header with two layers
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.9,
    fill: { color: C.headerGreen },
  });
  // Accent bar at bottom of header
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0.87, w: 10, h: 0.03,
    fill: { color: C.accent },
  });
  slide.addText(title, {
    x: 0.5, y: 0.18, w: 9, h: 0.55,
    fontSize: 17, fontFace: "맑은 고딕", color: C.white, bold: true,
  });
}

function addDecoStripe(slide: any, pptx: any) {
  // Subtle vertical accent stripe on left
  slide.addShape(pptx.ShapeType.rect, {
    x: 0.35, y: 1.1, w: 0.04, h: 3.8,
    fill: { color: C.lightGreen },
  });
}

function parseBoldText(text: string): Array<{ text: string; options?: { bold?: boolean; color?: string; fontSize?: number } }> {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);
  return segments
    .filter(s => s.length > 0)
    .map(seg => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        return { text: seg.slice(2, -2), options: { bold: true, color: C.text } };
      }
      return { text: seg, options: { color: C.text } };
    });
}
