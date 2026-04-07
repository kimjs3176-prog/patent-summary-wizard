import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Technical/academic glossary for patent summaries
// 일반인이 바로 이해하기 어려운 전문·학술 용어만 선별
const glossary: Record<string, string> = {
  "TRL": "기술준비수준(Technology Readiness Level). 기술의 성숙도를 1~9단계로 평가하는 지표",
  "IoT": "사물인터넷(Internet of Things). 센서와 네트워크로 사물을 연결하는 기술",
  "PCT": "특허협력조약(Patent Cooperation Treaty). 하나의 출원으로 여러 나라에 특허를 출원하는 제도",
  "IPC": "국제특허분류(International Patent Classification). 기술 분야별 특허 분류 체계",
  "CPC": "협력특허분류(Cooperative Patent Classification). 유럽·미국 공동 특허 분류 체계",
  "선행기술": "출원 전에 이미 공개된 동일·유사 기술. 특허 등록 가능성을 판단하는 기준",
  "청구항": "특허권의 보호 범위를 구체적으로 기술한 항목",
  "명세서": "발명의 내용을 상세히 기술한 문서. 특허 출원 시 필수 제출 서류",
  "실시예": "발명을 실제로 실시하는 구체적 방법이나 사례",
  "기술이전": "특허 등 기술을 보유자로부터 다른 주체에게 이전하는 것",
  "라이선스": "특허 기술의 사용 권한을 허여하는 계약",
  "균주": "미생물의 순수 배양된 단일 계통",
  "형질전환": "외래 유전자를 생물체에 도입하여 새로운 특성을 부여하는 기술",
  "유전자 편집": "CRISPR 등을 이용해 특정 유전자를 정밀하게 수정하는 기술",
  "바이오매스": "에너지원이나 화학 원료로 활용 가능한 생물 유래 자원",
  "저항전분": "소화효소에 의해 분해되지 않아 식이섬유처럼 작용하는 전분",
  "양액재배": "토양 대신 영양분이 포함된 용액으로 작물을 재배하는 수경재배 방식",
  "생물전환": "미생물이나 효소를 이용해 물질을 다른 유용한 물질로 변환하는 기술",
  "생분해성": "미생물에 의해 자연적으로 분해되는 성질",
  "나노기술": "나노미터(10⁻⁹m) 수준에서 물질을 제어하는 기술",
  "딥러닝": "인공신경망의 층을 깊게 쌓아 복잡한 패턴을 학습하는 기계학습 기법",
  "머신러닝": "데이터를 기반으로 패턴을 학습하고 예측하는 인공지능 기법",
  "GAP": "농산물우수관리(Good Agricultural Practices). 안전한 농산물 생산을 위한 관리 기준",
  "HACCP": "식품안전관리인증기준. 위해요소를 분석·관리하는 식품 안전 시스템",
  "GMP": "우수제조관리기준(Good Manufacturing Practice). 의약품·식품 등의 제조 품질 관리 기준",
  "특허권": "발명에 대해 일정 기간 독점적으로 실시할 수 있는 권리",
  // 추가 전문용어
  "고아밀로스": "아밀로스 함량이 높은 전분 또는 곡물. 일반 전분 대비 소화가 느려 혈당 조절에 유리",
  "난소화성": "체내 소화효소에 의해 잘 분해되지 않는 성질. 식이섬유와 유사한 기능을 함",
  "아밀로스": "전분을 구성하는 직쇄형 다당류. 아밀로펙틴과 함께 전분의 주성분",
  "아밀로펙틴": "전분을 구성하는 분지형 다당류. 찰기(점성)와 관련이 큰 성분",
  "프로바이오틱스": "장내 유익균의 증식을 돕는 살아있는 미생물",
  "프리바이오틱스": "장내 유익균의 먹이가 되는 난소화성 성분",
  "폴리페놀": "식물에 함유된 항산화 물질의 총칭. 노화 방지와 질병 예방에 기여",
  "플라보노이드": "폴리페놀의 하위 그룹으로, 강력한 항산화·항염 작용을 하는 식물 색소 성분",
  "안토시아닌": "보라색·빨간색 식물 색소로, 강력한 항산화 활성을 가진 플라보노이드 계열 물질",
  "카로티노이드": "주황·노란색 식물 색소로, 비타민A의 전구체 역할을 하는 항산화 물질",
  "펩타이드": "아미노산이 2~50개 결합한 짧은 단백질 조각. 생리활성 기능을 가질 수 있음",
  "게놈": "한 생물체가 가진 유전 정보의 전체 집합",
  "유전체": "게놈과 동의어. 생물의 모든 유전자 정보를 포함하는 DNA 전체",
  "SNP": "단일염기다형성(Single Nucleotide Polymorphism). DNA 서열에서 하나의 염기가 다른 변이",
  "QTL": "양적형질유전자좌(Quantitative Trait Loci). 수확량 등 양적 형질에 관여하는 유전자 위치",
  "분자마커": "DNA 수준에서 유전적 차이를 식별하는 표지. 품종 판별·육종에 활용",
  "엘리시터": "식물의 방어 반응을 유도하는 물질. 병해충 저항성 강화에 활용",
  "키토산": "갑각류 껍질에서 추출한 천연 다당류. 항균·보존 효과가 있어 농업·식품에 활용",
  "셀룰로스": "식물 세포벽의 주성분인 다당류. 바이오 소재 및 에너지 원료로 활용",
  "리그닌": "목질부를 구성하는 고분자 물질. 바이오 연료 및 화학 소재 원료",
  "미세조류": "현미경으로만 볼 수 있는 단세포 조류. 바이오 연료·건강식품 원료로 주목",
  "바이오차": "바이오매스를 열분해하여 만든 탄소 물질. 토양 개량제로 활용",
  "관능평가": "사람의 오감(시각·후각·미각 등)으로 식품의 품질을 평가하는 방법",
  "유변학": "물질의 흐름과 변형을 연구하는 학문. 식품 점도·질감 분석에 활용",
  "in vitro": "시험관 내(체외) 실험. 살아있는 생물체 밖에서 수행하는 실험",
  "in vivo": "생체 내 실험. 살아있는 동물이나 인체에서 수행하는 실험",
  "동결건조": "식품이나 시료를 얼린 뒤 진공에서 수분을 제거하는 건조 방법",
  "초임계추출": "초임계 상태(고온·고압)의 유체를 이용해 특정 성분을 선택적으로 추출하는 기술",
  "마이크로캡슐화": "미세한 캡슐로 유효 성분을 감싸 보호·서방출하는 기술",
  "병해충": "작물에 피해를 주는 질병(병해)과 해충을 통칭하는 용어",
  "내병성": "식물이 질병에 감염되어도 견디거나 저항하는 유전적 능력",
  "내재해성": "가뭄·홍수·고온 등 환경 스트레스에 견디는 작물의 특성",
  "계통": "특정 유전적 특성을 공유하는 생물 집단 또는 세대를 거쳐 유지되는 혈통",
  "교배육종": "서로 다른 품종을 인위적으로 교배하여 우수한 형질의 새 품종을 만드는 방법",
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
        <TooltipContent 
          side="top" 
          align="center"
          collisionPadding={16}
          className="max-w-[280px] text-xs leading-relaxed z-[9999]"
        >
          <p><strong className="text-primary">{term}</strong></p>
          <p className="mt-0.5 text-popover-foreground/80">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
