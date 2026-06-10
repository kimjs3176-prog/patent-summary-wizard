import React from "react";

export type KeywordCategory = "function" | "industry" | "material" | "product" | "tech" | "general";

export const CATEGORY_STYLE: Record<KeywordCategory, { bg: string; text: string; border: string; label: string }> = {
  function: { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", label: "주요기능" },
  industry: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", label: "활용산업" },
  material: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA", label: "소재" },
  product:  { bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA", label: "최종제품" },
  tech:     { bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF", label: "기술" },
  general:  { bg: "#FFFFFF", text: "#4E5968", border: "#E5E8EB", label: "기타" },
};

export function classifyKeyword(word: string): KeywordCategory {
  const w = word.toLowerCase();
  if (/(농업|축산|수산|임업|원예|화훼|식품|제약|의약|의료|바이오|헬스|에너지|환경|건설|건축|자동차|항공|조선|반도체|전자|화학|섬유|패션|물류|유통|교육|관광|금융|미용|화장품|가공|제조|산업|시장|소비자|유아|아동|노인|가정|외식|급식|병원|학교|공장|농장|농가|축사|온실|비닐하우스|스마트팜|밭|논|하우스)/.test(word)) return "industry";
  if (/(소재|원료|재료|성분|물질|추출물|분말|입자|섬유|금속|합금|폴리머|수지|세라믹|실리콘|탄소|나노|효소|미생물|균주|배지|용액|용매|용제|첨가제|보조제|식물|곡물|과일|채소|허브|꽃|뿌리|잎|줄기|씨앗|종자|종균|콩|쌀|밀|보리|옥수수|고구마|감자|토마토|딸기|버섯|약초|한약|생약|단백질|지방|당류|비타민|미네랄)/.test(word)) return "material";
  if (/(ai|인공지능|머신러닝|딥러닝|iot|블록체인|빅데이터|클라우드|로봇|자동화|자율주행|센서|카메라|드론|gps|rfid|nfc|5g|알고리즘|네트워크|플랫폼|소프트웨어|하드웨어|모듈|디바이스|controller|제어기|구동부|모터|배터리|회로|기판|디스플레이)/.test(w)) return "tech";
  if (/(분석|측정|감지|판별|판정|진단|검출|예측|인식|식별|추적|모니터링|제어|조절|관리|운영|운용|처리|가공|살포|분사|분무|건조|냉각|가열|살균|멸균|발효|숙성|혼합|배합|성형|코팅|포장|저장|보관|운반|이송|선별|수확|파종|이식|관수|급수|시비|방제|제초|예찰|예방|보호|개선|향상|증대|증가|감소|절감|절약|최적화|효율|품질|안전|편리|간편|신속|정확)/.test(word)) return "function";
  return "general";
}

export function KeywordChip({
  children, onClick, category = "general",
}: { children: React.ReactNode; onClick?: () => void; category?: KeywordCategory }) {
  const s = CATEGORY_STYLE[category];
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center px-3 py-1.5 rounded-full text-[13px] font-semibold border transition-all hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0"
      style={{ background: s.bg, color: s.text, borderColor: s.border }}
    >
      {children}
    </button>
  );
}

export type KwItem = { word: string; cat: KeywordCategory };

export function extractKeywordsFromPatent(
  patentData: { titleKo?: string; title?: string; abstract?: string; classifications?: string[] } | null | undefined,
  max = 8,
): KwItem[] {
  if (!patentData) return [];
  const title = patentData.titleKo || patentData.title || "";
  const text = `${title} ${patentData.abstract || ""}`;

  const industryKws: string[] = [];
  const funcKws: string[] = [];
  const featKws: string[] = [];
  const subjectKws: string[] = [];
  const productKws: string[] = [];

  if (patentData.classifications?.length) {
    const ipcIndustryMap: Record<string, string> = {
      A23L: "식품산업", A23B: "식품저장", A23C: "유제품", A23D: "유지식품",
      A23F: "음료", A23G: "제과", A23J: "단백질식품", A23K: "사료",
      A23P: "식품가공", A22C: "축산식품", A22B: "도축",
      A01G: "스마트팜", A01H: "품종개량", A01K: "스마트축산",
      A01N: "농약·방제", A01C: "정밀농업", A01D: "수확기계", A01J: "유가공",
      A01F: "수확후관리",
      A61K: "의약품", A61P: "치료제", A61B: "의료기기", A61F: "의료용품",
      A61L: "의료위생", A61Q: "화장품",
      B01D: "화학공정", B01J: "촉매산업", B01F: "혼합공정",
      B02C: "분쇄산업", B29C: "성형산업", B65B: "포장산업", B09B: "환경산업",
      B02B: "곡물가공", B07B: "선별산업",
      C12N: "바이오산업", C12P: "발효산업", C12G: "주류산업", C12Q: "진단산업",
      C07K: "바이오의약", C07D: "정밀화학", C08L: "소재산업",
      C05G: "비료산업", C02F: "수처리산업",
      G06F: "AI·SW", G06N: "AI산업", G06Q: "유통·물류", G01N: "분석·검사",
      G16B: "바이오IT", G05B: "자동화산업",
      H04L: "IoT", H04W: "무선통신",
      F26B: "건조산업", F25D: "냉장냉동산업",
      A23: "식품산업", A01: "농업", A22: "축산업", A61: "헬스케어",
      C12: "바이오산업", C07: "의약화학", C08: "소재산업",
      G06: "ICT", B01: "화학공정", H04: "IoT", G01: "계측산업",
      B65: "물류산업", B02: "곡물가공", F26: "건조산업",
    };
    patentData.classifications.forEach((cls) => {
      const c = cls.replace(/\s/g, "");
      let k: string | undefined;
      if (/^A23L\s*33/.test(cls)) k = "건강기능식품";
      else if (/^A23L\s*2/.test(cls)) k = "음료";
      else k = ipcIndustryMap[c.slice(0, 4)] || ipcIndustryMap[c.slice(0, 3)];
      if (k && !industryKws.includes(k)) industryKws.push(k);
    });
  }

  const industryPatterns: [RegExp, string][] = [
    [/식품|음식료|식음료/, "식품산업"], [/화장품|뷰티산업|미용제품/, "화장품산업"],
    [/의약품|제약|의약조성물/, "제약산업"], [/사료|가축|축산/, "축산업"],
    [/비료|퇴비|토양개량/, "비료산업"], [/건강기능식품|건기식|기능성\s*식품/, "건강기능식품"],
    [/수산물|어류양식|양식장/, "수산업"], [/섬유산업|직물|의류/, "섬유산업"],
    [/태양광|바이오매스|신재생에너지/, "에너지산업"], [/폐수처리|폐기물처리|환경정화/, "환경산업"],
    [/반도체|전자제품|전자부품|전자기기산업/, "전자산업"], [/건설현장|건축자재|건축물/, "건설산업"],
  ];
  industryPatterns.forEach(([p, l]) => { if (p.test(text) && !industryKws.includes(l)) industryKws.push(l); });

  const funcPatterns: [RegExp, string][] = [
    [/항균|살균|멸균|항미생물/, "항균"], [/항산화|산화방지|자유라디칼/, "항산화"],
    [/항염|소염|염증억제/, "항염"], [/항암|종양억제|암세포\s*억제/, "항암"],
    [/항바이러스|바이러스\s*억제/, "항바이러스"],
    [/면역\s*강화|면역력|면역\s*조절/, "면역강화"], [/혈당|당뇨|인슐린/, "혈당조절"],
    [/혈압|고혈압|저혈압/, "혈압조절"], [/비만|체중\s*감소|지방\s*분해/, "체중조절"],
    [/치매|인지\s*기능|기억력/, "인지개선"], [/피부\s*개선|피부\s*보습|보습력|주름\s*개선/, "피부개선"],
    [/발효|숙성|유산균/, "발효기능"], [/프로바이오|장\s*건강|장내\s*세균|장내\s*환경/, "장건강"],
    [/콜라겐|피부\s*탄력|탄력\s*개선/, "피부탄력"], [/노화\s*방지|안티에이징|항노화/, "항노화"],
    [/수분\s*보유|보수력/, "보수성"], [/유화\s*안정|유화\s*분산/, "유화안정"],
    [/점도\s*조절|겔화|겔형/, "점도조절"], [/방부|보존성|저장성|장기\s*보관/, "보존성향상"],
    [/장기\s*유통|상온\s*유통|상온\s*보관|유통\s*기한\s*연장/, "유통기한 연장"],
    [/후살균|살균\s*공정|레토르트|초고온\s*살균|UHT/, "살균공정"],
    [/흡착\s*제거|흡착\s*능|흡수\s*촉진/, "흡착기능"], [/소취|탈취|악취\s*제거/, "소취기능"],
    [/진통|통증\s*완화/, "진통효과"], [/이뇨|배뇨/, "이뇨작용"],
    [/간\s*보호|간\s*기능\s*개선/, "간기능개선"], [/골밀도|골다공|뼈\s*건강|골\s*건강/, "골건강"],
    [/도계|도축|도살/, "도축공정"],
    [/탈모(?:기|봉|공정)?|탈피|깃털\s*제거|모(?:털)?\s*제거/, "깃털제거"],
    [/내장\s*제거|박피|발골|해체\s*가공/, "해체가공"],
    [/선별|정선|등급\s*판정/, "선별처리"],
    [/자동\s*포장|포장\s*공정|패킹\s*공정/, "포장공정"],
    [/세척|세정|클리닝/, "세척처리"],
    [/이송\s*장치|컨베이어|운반\s*장치/, "이송처리"],
    [/혼합\s*공정|배합\s*공정|믹싱/, "혼합공정"],
  ];
  funcPatterns.forEach(([p, l]) => { if (p.test(text) && !funcKws.includes(l)) funcKws.push(l); });

  const featPatterns: [RegExp, string][] = [
    [/나노입자|나노캡슐|나노기술|나노소재/, "나노기술"], [/마이크로캡슐|마이크로\s*입자/, "마이크로캡슐"],
    [/코팅\s*층|코팅\s*막|피복|코팅\s*기술|코팅\s*처리/, "코팅기술"], [/추출\s*공정|용매\s*추출|분리\s*정제/, "추출정제"],
    [/건조\s*공정|동결\s*건조|열풍\s*건조|진공\s*건조/, "건조공정"], [/분쇄|미분|초미분/, "미분화"],
    [/캡슐화|캡슐형|포접|마이크로\s*캡슐화/, "캡슐화"], [/수경\s*재배|양액\s*재배/, "수경재배"],
    [/드론|무인\s*비행/, "드론활용"], [/IoT|사물인터넷|센서\s*네트워크|센서\s*기반/, "IoT기반"],
    [/인공지능|딥러닝|머신러닝|기계학습|\bAI\b/, "AI활용"], [/로봇|자동화\s*시스템|자동화\s*공정/, "자동화"],
    [/친환경|유기농|무농약/, "친환경"], [/저온\s*처리|저온\s*공정|저온\s*보관/, "저온공정"],
    [/고압\s*처리|초고압|고온\s*고압/, "고압처리"], [/효소\s*처리|효소\s*분해|효소적\s*반응/, "효소처리"],
    [/미생물|균주|접종/, "미생물활용"], [/세포\s*배양|미생물\s*배양|배양\s*공정/, "배양기술"],
    [/유전자|형질전환|게놈|유전체/, "유전공학"], [/3D\s*프린팅|삼차원\s*인쇄|적층\s*제조/, "3D기술"],
    [/블록체인|이력\s*추적/, "이력추적"], [/빅데이터|데이터\s*분석/, "빅데이터"],
    [/복합\s*기술|융합\s*기술|하이브리드/, "복합기술"], [/실시간\s*모니터링|상시\s*모니터링/, "실시간모니터링"],
    [/영상\s*분석|이미지\s*분석|머신\s*비전/, "영상분석"], [/스펙트럼\s*분석|분광\s*분석/, "분광분석"],
    [/회전\s*플레이트|회전체|회전\s*가능|회전\s*구동|회전[가-힣\s]{0,8}구동/, "회전구동"],
    [/구동\s*모터|구동\s*유닛|구동력|전동\s*모터/, "모터구동"],
    [/브러쉬|브러시/, "브러시처리"],
    [/하우징|챔버\s*구조|반응\s*챔버/, "하우징구조"],
    [/회전\s*플레이트|디스크\s*형|드럼\s*형/, "회전체구조"],
    [/안내홀|배출구|배출\s*공간|배출\s*구조/, "배출구조"],
  ];
  featPatterns.forEach(([p, l]) => { if (p.test(text) && !featKws.includes(l)) featKws.push(l); });

  const subjectPatterns: [RegExp, string][] = [
    [/오가피|오갈피|가시오갈피|자오가/, "오가피"],
    [/황기/, "황기"], [/당귀/, "당귀"], [/천궁/, "천궁"], [/작약/, "작약"],
    [/감초/, "감초"], [/구기자/, "구기자"], [/오미자/, "오미자"], [/복분자/, "복분자"],
    [/산수유/, "산수유"], [/하수오/, "하수오"], [/지황|숙지황|생지황/, "지황"],
    [/맥문동/, "맥문동"], [/길경|도라지/, "도라지"], [/더덕/, "더덕"],
    [/마(?:가목|치현|황)/, "마"], [/율무|의이인/, "율무"], [/연자육|연근|연잎/, "연"],
    [/생강/, "생강"], [/강황|울금|커큐민/, "강황"], [/계피|육계/, "계피"],
    [/녹용|녹각/, "녹용"], [/영지|상황|차가|동충하초/, "약용버섯"],
    [/쑥|애엽/, "쑥"], [/민들레|포공영/, "민들레"], [/익모초/, "익모초"],
    [/헛개나무|헛개/, "헛개"], [/엉겅퀴|밀크\s*씨슬/, "엉겅퀴"],
    [/아로니아/, "아로니아"], [/마카/, "마카"], [/노니/, "노니"],
    [/쌀|미곡|현미|백미/, "쌀"], [/밀가루|소맥분|밀\s*기울|밀\s*짚|소맥/, "밀"], [/보리|맥주\s*보리/, "보리"], [/옥수수/, "옥수수"],
    [/떡(?:볶이|국|류|살)?|쌀가루|쌀\s*반죽|가래떡/, "쌀"],
    [/대두|콩(?:나물|기름|가루|류|즙|단백)?|검정콩|서리태/, "콩"], [/인삼|홍삼|수삼|산양삼/, "인삼"], [/녹차|차(?:잎|나무|류)/, "차"],
    [/고추(?!장)|고춧가루/, "고추"], [/마늘/, "마늘"], [/양파/, "양파"], [/배추/, "배추"],
    [/토마토/, "토마토"], [/감자(?!튀김)/, "감자"], [/고구마/, "고구마"],
    [/딸기/, "딸기"], [/사과(?!나무|드림)?/, "사과"], [/포도/, "포도"], [/감귤|귤(?!피)?/, "감귤"],
    [/블루베리/, "블루베리"], [/버섯/, "버섯"], [/김치/, "김치"],
    [/한우|소고기|한우육/, "한우"], [/돼지|돈육|양돈/, "돼지"], [/육계|산란계|가금류?|오리(?!엔트)|메추리|닭(?:고기|육|계)?/, "가금"],
    [/우유|원유|유청/, "우유"], [/계란|달걀/, "계란"],
    [/새우/, "새우"], [/김\s*양식|마른\s*김|조미\s*김|해조류/, "해조류"], [/미역/, "미역"],
    [/꿀|벌꿀|봉밀/, "꿀"], [/유산균|젖산균/, "유산균"], [/효모|이스트/, "효모"],
    [/키토산/, "키토산"], [/펙틴/, "펙틴"], [/폴리페놀/, "폴리페놀"],
    [/(?:주성분|유효\s*성분|핵심\s*성분|고함량|함유한|풍부한)[가-힣\s]{0,6}단백질|단백질\s*(?:추출|분리|정제|소재|원료)/, "단백질"],
    [/전분|녹말/, "전분"], [/셀룰로오스|섬유소/, "셀룰로오스"],
  ];
  subjectPatterns.forEach(([p, l]) => { if (p.test(title) && !subjectKws.includes(l)) subjectKws.push(l); });
  if (subjectKws.length === 0) {
    subjectPatterns.forEach(([p, l]) => { if (p.test(text) && !subjectKws.includes(l)) subjectKws.push(l); });
  }

  const productPatterns: [RegExp, string][] = [
    [/유전자\s*마커|바이오\s*마커|분자\s*마커|진단\s*마커|SNP\s*마커|단일염기다형성\s*마커|마커\s*세트|마커\s*조성물|마커\s*키트/, "마커"],
    [/건강기능식품|건기식|기능성\s*식품/, "건강기능식품"],
    [/음료(?!수)|드링크|차\s*제품|주스|스무디/, "음료"],
    [/약학(?:적|용)?\s*조성물|식이\s*조성물|경구\s*투여\s*조성물|제형\s*화|환제|환약|시럽\s*제|연고\s*제|약학\s*제제|정제\s*제형/, "제형 제품"],
    [/화장품|스킨\s*케어|스킨\s*크림|로션|에센스|마스크팩|미용\s*세럼/, "화장품"],
    [/사료|배합\s*사료|반려동물\s*사료|펫푸드/, "사료"],
    [/비료|퇴비|토양\s*개량제/, "비료"],
    [/떡(?:볶이|국|류|살)?|즉석\s*밥|즉석\s*죽|HMR|가정\s*간편식|스낵|과자|간식|빵|면류|국수|라면|만두|부침|소스|장류|발효식품|김치|반찬|밀키트|냉동\s*식품/, "가공식품"],
    [/유제품|치즈|요거트|버터|분유/, "유제품"],
    [/의약품|치료제|진단\s*키트|의료기기|의료용품/, "의료제품"],
    [/포장\s*필름|포장\s*시트|패키징|포장재|보관\s*용기|식품\s*용기/, "포장·소재 제품"],
    [/장치|시스템|설비|기계|로봇|드론|센서\s*모듈|모니터링\s*시스템/, "장치·시스템"],
    [/플랫폼|서비스\s*제공|모바일\s*앱|애플리케이션|소프트웨어\s*솔루션/, "플랫폼·서비스"],
    [/종자|종균|품종|모종/, "종자·종균"],
    [/추출물|분말|원료\s*소재|기능성\s*성분/, "원료 소재"],
  ];
  productPatterns.forEach(([p, l]) => { if (p.test(text) && !productKws.includes(l)) productKws.push(l); });

  const extractTitleNouns = (): string[] => {
    if (!title) return [];
    const STOP = new Set([
      "발명", "본", "방법", "장치", "시스템", "이를", "포함", "포함하는", "제공", "관한",
      "그", "및", "또는", "위한", "사용", "이용", "구비", "구성", "기술", "특징", "수단",
      "구비하는", "구성된", "이루어진", "사용하는", "이용하는",
      "제조방법", "제조법", "제조", "조성물", "키트", "용도", "제형", "제제", "모듈",
    ]);
    const cleaned = title
      .replace(/[\[\](){}<>"'`·,.\-—–:;?!]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const tokens = cleaned.split(/\s+/).filter(t => /[가-힣A-Za-z]/.test(t));
    const nouns: string[] = [];
    const SUFFIX_LIKE = /(제조방법|제조법|조성물|키트|용도|방법|시스템|장치|모듈|제형|제제|마커)$/;
    for (const t of tokens) {
      const stem = t.replace(/(?:으로|에서|로서|로써|에게|에서|에|의|를|을|이|가|와|과|로|은|는)$/u, "");
      if (stem.length < 2 || stem.length > 8) continue;
      if (STOP.has(stem)) continue;
      if (/^\d+$/.test(stem)) continue;
      if (SUFFIX_LIKE.test(stem) && stem.length <= 4) continue;
      if (!nouns.includes(stem)) nouns.push(stem);
      if (nouns.length >= 3) break;
    }
    return nouns;
  };

  if (subjectKws.length === 0) {
    if (/식품|음료|건기식|발효|가공/.test(text)) subjectKws.push("식품 원료");
    else if (/작물|재배|농산물|곡물|채소|과일/.test(text)) subjectKws.push("농산 원료");
    else if (/축산|가축|사료|도계|도축|가금/.test(text)) subjectKws.push("축산 원료");
    else if (/소재|재료|성분|물질|추출물|분말/.test(text)) subjectKws.push("기능성 소재");
    else {
      const titleNouns = extractTitleNouns();
      if (titleNouns.length > 0) subjectKws.push(titleNouns[0]);
      else subjectKws.push("처리 대상");
    }
  }
  if (funcKws.length === 0) {
    if (/측정|분석|감지|판별|진단|검출|모니터링/.test(text)) funcKws.push("측정·분석");
    else if (/제어|관리|운영|자동/.test(text)) funcKws.push("제어·관리");
    else if (/처리|가공|공정|제조/.test(text)) funcKws.push("가공·처리");
    else if (/개선|향상|증대|효율|최적화|품질/.test(text)) funcKws.push("성능 개선");
    else {
      const titleNouns = extractTitleNouns();
      const fnNoun = titleNouns.find(n => /기$|장치$|시스템$|모듈$|유닛$/.test(n)) || titleNouns[0];
      if (fnNoun) funcKws.push(fnNoun);
      else funcKws.push("핵심 기능");
    }
  }
  if (industryKws.length === 0) {
    if (/식품|음료|건기식|발효/.test(text)) industryKws.push("식품산업");
    else if (/작물|재배|농산|곡물|채소|과일|스마트팜/.test(text)) industryKws.push("농업");
    else if (/축산|가축|사료|도계|도축|가금|육계|닭|오리/.test(text)) industryKws.push("축산업");
    else if (/의약|제약|치료|진단/.test(text)) industryKws.push("제약·의료");
    else if (/화장품|미용|뷰티/.test(text)) industryKws.push("화장품산업");
    else if (/환경|폐수|폐기물/.test(text)) industryKws.push("환경산업");
    else industryKws.push("농식품산업");
  }
  if (productKws.length === 0) {
    if (/유전자\s*마커|바이오\s*마커|분자\s*마커|진단\s*마커|마커/.test(title)) productKws.push("마커");
    else if (/진단\s*키트|판별\s*키트|검출\s*키트|프라이머\s*세트|판별\s*용\s*조성물/.test(text)) productKws.push("진단·검사 키트");
    else if (/장치|시스템|설비|기계|모듈|하우징|챔버/.test(text)) productKws.push("장치·시스템");
    else if (/사료/.test(text)) productKws.push("사료");
    else if (/비료|퇴비/.test(text)) productKws.push("비료");
    else if (/식품|음료|가공\s*식품/.test(text)) productKws.push("가공식품");
    else if (/약학(?:적|용)?\s*조성물|환제|환약|시럽\s*제|연고\s*제/.test(text)) productKws.push("제형 제품");
    else if (/추출물|분말|원료\s*소재|기능성\s*성분/.test(text)) productKws.push("원료 소재");
    else {
      const productNoun = (() => {
        if (!title) return "";
        const STOP_LOCAL = new Set(["및","또는","이의","그","위한","사용","이용","포함","관한","본","발명","제공","구비","구성"]);
        const tokens = title
          .replace(/[\[\](){}<>"'`·,.\-—–:;?!]/g, " ")
          .split(/\s+/)
          .filter(Boolean);
        const SUFFIX = /(제조방법|제조법|조성물|키트|용도|방법|시스템|장치|모듈|제형|제제|마커)$/;
        for (let i = tokens.length - 1; i >= 0; i--) {
          if (SUFFIX.test(tokens[i])) {
            const m = tokens[i].match(/^([가-힣A-Za-z]{1,6})(마커|키트|장치|시스템)$/);
            if (m) return m[2] === "마커" ? "마커" : m[1] + m[2];
            for (let j = i - 1; j >= 0; j--) {
              const stem = tokens[j].replace(/(?:으로|에서|로서|로써|에게|에|의|를|을|이|가|와|과|로|은|는|용)$/u, "");
              if (stem.length < 2 || stem.length > 8) continue;
              if (STOP_LOCAL.has(stem)) continue;
              if (/^\d+$/.test(stem)) continue;
              return stem;
            }
          }
        }
        const nouns = extractTitleNouns();
        const FORBIDDEN = /(제조방법|제조법|제조|조성물|키트|용도|방법|시스템|장치|모듈|제형|제제)/;
        for (let k = nouns.length - 1; k >= 0; k--) {
          if (!FORBIDDEN.test(nouns[k])) return nouns[k];
        }
        return "";
      })();
      productKws.push(productNoun || "최종 산출물");
    }
  }

  const seen = new Set<string>();
  const unique: KwItem[] = [];
  const push = (word: string, cat: KeywordCategory) => {
    if (!word || seen.has(word) || unique.length >= max) return;
    seen.add(word);
    unique.push({ word, cat });
  };

  push(subjectKws[0], "material");
  push(funcKws[0], "function");
  push(industryKws[0], "industry");
  push(productKws[0], "product");

  subjectKws.slice(1, 2).forEach((w) => push(w, "material"));
  funcKws.slice(1, 3).forEach((w) => push(w, "function"));
  industryKws.slice(1, 3).forEach((w) => push(w, "industry"));
  productKws.slice(1, 2).forEach((w) => push(w, "product"));
  featKws.slice(0, 3).forEach((w) => push(w, "tech"));

  return unique;
}