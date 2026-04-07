import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Technical/academic glossary for patent summaries
const glossary: Record<string, string> = {
  "TRL": "기술준비수준(Technology Readiness Level). 기술의 성숙도를 1~9단계로 평가하는 지표",
  "IoT": "사물인터넷(Internet of Things). 센서와 네트워크로 사물을 연결하는 기술",
  "AI": "인공지능(Artificial Intelligence). 컴퓨터가 인간의 학습·추론 능력을 모방하는 기술",
  "PCT": "특허협력조약(Patent Cooperation Treaty). 하나의 출원으로 여러 나라에 특허를 출원하는 제도",
  "IPC": "국제특허분류(International Patent Classification). 기술 분야별 특허 분류 체계",
  "CPC": "협력특허분류(Cooperative Patent Classification). 유럽·미국 공동 특허 분류 체계",
  "선행기술": "출원 전에 이미 공개된 동일·유사 기술. 특허 등록 가능성을 판단하는 기준",
  "청구항": "특허권의 보호 범위를 구체적으로 기술한 항목",
  "명세서": "발명의 내용을 상세히 기술한 문서. 특허 출원 시 필수 제출 서류",
  "실시예": "발명을 실제로 실시하는 구체적 방법이나 사례",
  "발명의 효과": "발명으로 인해 얻어지는 기술적·경제적 이점",
  "기술이전": "특허 등 기술을 보유자로부터 다른 주체에게 이전하는 것",
  "라이선스": "특허 기술의 사용 권한을 허여하는 계약",
  "균주": "미생물의 순수 배양된 단일 계통",
  "형질전환": "외래 유전자를 생물체에 도입하여 새로운 특성을 부여하는 기술",
  "유전자 편집": "CRISPR 등을 이용해 특정 유전자를 정밀하게 수정하는 기술",
  "바이오매스": "에너지원이나 화학 원료로 활용 가능한 생물 유래 자원",
  "저항전분": "소화효소에 의해 분해되지 않아 식이섬유처럼 작용하는 전분",
  "기능성 식품": "건강 유지·개선에 도움을 주는 성분이 함유된 식품",
  "스마트팜": "ICT 기술을 활용해 작물 재배 환경을 자동으로 관리하는 농업 시스템",
  "양액재배": "토양 대신 영양분이 포함된 용액으로 작물을 재배하는 수경재배 방식",
  "생물전환": "미생물이나 효소를 이용해 물질을 다른 유용한 물질로 변환하는 기술",
  "발효": "미생물의 대사작용을 이용해 유기물을 분해·변환하는 과정",
  "추출물": "원료에서 특정 성분을 분리해낸 물질",
  "항산화": "활성산소에 의한 세포 손상을 방지하는 작용",
  "항균": "세균의 성장이나 번식을 억제하는 성질",
  "생분해성": "미생물에 의해 자연적으로 분해되는 성질",
  "나노기술": "나노미터(10⁻⁹m) 수준에서 물질을 제어하는 기술",
  "센서": "물리적·화학적 변화를 감지하여 전기 신호로 변환하는 장치",
  "딥러닝": "인공신경망의 층을 깊게 쌓아 복잡한 패턴을 학습하는 기계학습 기법",
  "머신러닝": "데이터를 기반으로 패턴을 학습하고 예측하는 인공지능 기법",
  "GAP": "농산물우수관리(Good Agricultural Practices). 안전한 농산물 생산을 위한 관리 기준",
  "HACCP": "식품안전관리인증기준. 위해요소를 분석·관리하는 식품 안전 시스템",
  "GMP": "우수제조관리기준(Good Manufacturing Practice). 의약품·식품 등의 제조 품질 관리 기준",
  "특허권": "발명에 대해 일정 기간 독점적으로 실시할 수 있는 권리",
  "출원인": "특허를 출원한 개인 또는 기관",
  "등록번호": "특허가 등록된 후 부여되는 고유 번호",
  "출원번호": "특허 출원 시 부여되는 고유 번호",
  "공개번호": "특허 출원 내용이 공개될 때 부여되는 번호",
};

// Build a regex that matches glossary terms (longest first to avoid partial matches)
const sortedTerms = Object.keys(glossary).sort((a, b) => b.length - a.length);
const glossaryRegex = new RegExp(`(${sortedTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

/**
 * Takes a plain text string and returns React nodes with glossary terms wrapped in tooltips.
 */
export function annotateWithGlossary(text: string): React.ReactNode[] {
  if (!text) return [text];
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const matched = new Set<string>(); // Only tooltip first occurrence per render

  let match: RegExpExecArray | null;
  glossaryRegex.lastIndex = 0;
  
  while ((match = glossaryRegex.exec(text)) !== null) {
    const term = match[0];
    const idx = match.index;
    
    // Add text before match
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    
    if (matched.has(term)) {
      // Already tooltipped this term, just render plain
      parts.push(term);
    } else {
      matched.add(term);
      parts.push(
        <GlossaryTerm key={`${term}-${idx}`} term={term} definition={glossary[term]} />
      );
    }
    
    lastIndex = idx + term.length;
  }
  
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : [text];
}

function GlossaryTerm({ term, definition }: { term: string; definition: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="underline decoration-dotted decoration-primary/40 underline-offset-2 cursor-help text-foreground hover:text-primary transition-colors">
            {term}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
          <p><strong className="text-primary">{term}</strong></p>
          <p className="mt-0.5 text-popover-foreground/80">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
