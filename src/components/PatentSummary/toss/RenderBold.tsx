// 중요도 볼드(**...**) + 학명 이탤릭(*..*) 렌더러
export function renderBold(text: string): React.ReactNode {
  if (!text) return text;
  // 1) 먼저 **...**를 분리
  const boldParts = text.split(/(\*\*[^*\n]+?\*\*)/g);
  const nodes: React.ReactNode[] = [];
  boldParts.forEach((bp, bi) => {
    const bm = bp.match(/^\*\*([^*\n]+?)\*\*$/);
    if (bm) {
      // 볼드 내부에서도 학명 이탤릭 처리
      const inner = bm[1];
      const italicInside = inner.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
      nodes.push(
        <strong key={`b-${bi}`} className="font-bold text-[#191F28]">
          {italicInside.map((ip, ii) => {
            const im = ip.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
            if (im) return <em key={ii} className="italic">{im[1]}</em>;
            return <span key={ii}>{ip}</span>;
          })}
        </strong>,
      );
      return;
    }
    // 2) 볼드가 아닌 조각에서 학명 이탤릭만 처리
    const italicParts = bp.split(/(\*[A-Za-z][A-Za-z0-9 .\-]{1,60}\*)/g);
    italicParts.forEach((p, i) => {
      const m = p.match(/^\*([A-Za-z][A-Za-z0-9 .\-]{1,60})\*$/);
      if (m) nodes.push(<em key={`i-${bi}-${i}`} className="italic">{m[1]}</em>);
      else if (p) nodes.push(<span key={`t-${bi}-${i}`}>{p}</span>);
    });
  });
  return nodes;
}

