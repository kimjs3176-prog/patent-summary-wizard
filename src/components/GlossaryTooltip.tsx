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
  // 기술 용어 (하이라이트 대신 용어 해설 제공)
  "AI": "인공지능(Artificial Intelligence). 인간의 학습·추론·인식 능력을 컴퓨터가 수행하도록 하는 기술",
  "인공지능": "Artificial Intelligence(AI). 인간의 학습·추론·인식 능력을 컴퓨터가 수행하도록 하는 기술",
  "ICT": "정보통신기술(Information and Communication Technology). 정보 처리와 통신을 결합한 기술 전반",
  "GPS": "위성위치확인시스템(Global Positioning System). 인공위성을 이용해 위치 정보를 제공하는 시스템",
  "RFID": "무선주파수 식별(Radio Frequency Identification). 전파를 이용해 사물·정보를 비접촉으로 인식하는 기술",
  "NFC": "근거리무선통신(Near Field Communication). 약 10cm 이내 단거리 무선 통신 기술",
  "5G": "5세대 이동통신. 초고속·초저지연·초연결을 특징으로 하는 차세대 무선 통신 기술",
  "API": "응용프로그램 인터페이스(Application Programming Interface). 소프트웨어 간 기능을 호출·연동하는 규격",
  "CNN": "합성곱신경망(Convolutional Neural Network). 이미지 인식에 특화된 딥러닝 모델",
  "RNN": "순환신경망(Recurrent Neural Network). 순차 데이터를 처리하는 딥러닝 모델",
  "LLM": "대형언어모델(Large Language Model). 방대한 텍스트로 학습한 자연어 처리 인공지능 모델",
  "NGS": "차세대염기서열분석(Next-Generation Sequencing). DNA 서열을 대량·고속으로 분석하는 기술",
  "PCR": "중합효소연쇄반응(Polymerase Chain Reaction). 특정 DNA 영역을 증폭하는 분자생물학 기법",
  "CRISPR": "유전자 가위 기술. 특정 DNA 서열을 정밀하게 자르고 편집하는 유전자 편집 도구",
  "블록체인": "거래 데이터를 분산 저장하여 위·변조를 방지하는 분산원장 기술",
  "빅데이터": "대용량·다양·고속의 데이터를 수집·저장·분석하여 가치를 도출하는 기술",
  "클라우드": "인터넷을 통해 컴퓨팅 자원을 빌려 쓰는 서비스 모델",
  "자율주행": "운전자의 조작 없이 차량 스스로 주행 환경을 인지·판단·제어하는 기술",
  "스마트팜": "ICT를 농업에 접목하여 작물·가축의 생육 환경을 자동 제어하는 지능형 농장",
  "스마트시티": "ICT를 활용해 도시 인프라와 서비스를 효율적으로 운영하는 도시 모델",
  "지능형": "센서·AI 등을 결합해 스스로 판단·제어가 가능한 시스템 특성",
  "자동화": "사람의 개입을 최소화하고 기계·소프트웨어가 작업을 수행하도록 만든 시스템",
};

// Build a regex that matches glossary terms (longest first to avoid partial matches).
// For ASCII-only terms (e.g. AI, IoT, LLM, GPS), enforce word boundaries so they
// don't match inside larger words like "MAIN", "RAID", "HELLO". Korean/mixed terms
// don't need this because Hangul characters never sit adjacent to ASCII identifiers.
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isAsciiTerm = (s: string) => /^[A-Za-z0-9]+$/.test(s);
function buildRegex(terms: string[]): RegExp | null {
  if (terms.length === 0) return null;
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const pattern = sorted
    .map((t) => {
      const esc = escapeRe(t);
      return isAsciiTerm(t) ? `(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9])` : esc;
    })
    .join('|');
  return new RegExp(`(${pattern})`, 'g');
}
const defaultRegex = buildRegex(Object.keys(glossary));

/**
 * Takes a plain text string and returns React nodes with glossary terms wrapped in tooltips.
 * Optionally accepts an `extra` glossary (e.g. AI-extracted terms for the current patent)
 * which is merged with the built-in dictionary. Extra entries override built-ins.
 */
export function annotateWithGlossary(
  text: string,
  extra?: Record<string, string>,
): React.ReactNode[] {
  if (!text) return [text];

  const hasExtra = extra && Object.keys(extra).length > 0;
  const merged: Record<string, string> = hasExtra ? { ...glossary, ...extra } : glossary;
  const regex = hasExtra ? buildRegex(Object.keys(merged)) : defaultRegex;
  if (!regex) return [text];

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const matched = new Set<string>(); // Only tooltip first occurrence per render

  let match: RegExpExecArray | null;
  regex.lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
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
        <GlossaryTerm key={`${term}-${idx}`} term={term} definition={merged[term]} />
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
  const isAi = !(term in glossary);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={
              "underline decoration-dotted underline-offset-2 cursor-help text-foreground hover:text-primary transition-colors " +
              (isAi ? "decoration-emerald-500/50" : "decoration-primary/40")
            }
          >
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
          {isAi && (
            <p className="mt-1 text-[10px] text-muted-foreground">AI 자동 인식 용어</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
