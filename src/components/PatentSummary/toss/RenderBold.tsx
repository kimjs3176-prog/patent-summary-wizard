import { splitBold, splitItalic } from "@/lib/summaryMarkup";

// 중요도 볼드(**...**) + 학명 이탤릭(*..*) 렌더러
export function renderBold(text: string): React.ReactNode {
  if (!text) return text;
  const nodes: React.ReactNode[] = [];
  splitBold(text).forEach((seg, bi) => {
    if (seg.bold) {
      // 볼드 내부에서도 학명 이탤릭 처리
      nodes.push(
        <strong key={`b-${bi}`} className="font-bold text-[#191F28]">
          {splitItalic(seg.text).map((ip, ii) =>
            ip.italic ? <em key={ii} className="italic">{ip.text}</em> : <span key={ii}>{ip.text}</span>,
          )}
        </strong>,
      );
      return;
    }
    // 볼드가 아닌 조각에서 학명 이탤릭만 처리
    splitItalic(seg.text).forEach((p, i) => {
      if (p.italic) nodes.push(<em key={`i-${bi}-${i}`} className="italic">{p.text}</em>);
      else nodes.push(<span key={`t-${bi}-${i}`}>{p.text}</span>);
    });
  });
  return nodes;
}
