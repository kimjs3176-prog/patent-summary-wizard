/**
 * 요약서 중요 문구 볼드(**…**) 규칙.
 * 화면은 볼드를 형광 밑칠로 보여 준다(src/lib/summaryMarkup.ts). 바쁜 독자가 볼드만 이어 읽어도
 * 이 특허가 무엇을, 어떻게, 얼마나, 어디에, 지금 어디까지인지 알 수 있게 하는 것이 목적이다.
 * 규칙을 바꾸면 index.ts 의 promptVersion 을 올린다(캐시된 요약서가 다음 조회 때 새 규칙으로 다시 만들어진다).
 */

export const BOLD_RULES = `[중요 문구 볼드 규칙 — 반드시 준수]
- 목적: 독자가 볼드(**...**)만 이어 읽어도 이 특허가 무엇을, 어떻게, 얼마나, 어디에 쓰고, 지금 어디까지 왔는지 알 수 있게 한다.
- 고르는 방법(문맥 판단): 섹션을 다 쓴 뒤 "이 섹션을 한 줄로 줄이면 꼭 남겨야 할 구절"을 고른다. 같은 뜻이 반복되면 처음 나온 한 곳만 볼드한다. 문장 안에서 그 문장의 핵심 정보(대상·수단·수치·결론)를 담은 명사구만 고른다.
- 섹션별로 반드시 볼드할 대상(본문에 있을 때):
  · 기술분야: 이 발명이 무엇에 관한 것인지(청구 대상) 1곳, 쓰이는 산업·현장 1곳.
  · 발명요약 및 특징: 해결하려는 문제의 핵심 1곳, 핵심 해결수단(균주·성분·구조·공정 조건) 1~2곳, 원문에 있는 효과(수치가 있으면 수치와 단위를 함께) 1곳.
  · 관련시장 동향: 직접 시장·상위 시장의 시장명, 시장을 움직이는 정책·수요 요인 1곳. 이 섹션에서는 금액·성장률·연도 숫자에 볼드를 씌우지 않는다(시장 표가 숫자를 그대로 읽는다).
  · 농산업활용 가능성: 누가·어디서 쓰는지(수요처·작물·현장) 1곳, 쓰는 방법·조건 1곳, 현장에서 얻는 이득 1곳.
  · 상용화전망: 지금의 기술 단계 1곳, 상용화에 남은 핵심 과제 1곳, 사업화 경로(기술이전 대상·수익 방식) 1곳.
- 개수와 길이: 섹션마다 3~5곳(관련시장 동향은 2~4곳). 각 섹션의 첫 문장(요지)에는 그 섹션의 결론을 담은 구절 1곳을 반드시 볼드한다. 한 문장에 볼드는 2곳까지, 볼드 한 곳은 4~30자. 볼드한 글자가 섹션 글자의 25%를 넘지 않는다.
- 볼드 금지: 문장 전체, 섹션 이름 되풀이, 접속어·조사·술어(~한다, ~된다)만 남는 조각, "매우 중요한"·"다양한 산업" 같은 막연한 말, 이미 볼드한 구절의 재등장, 출처 괄호·(AI 추정치)·각주 표시.
- 의미가 하나로 묶이는 문구는 띄어쓰기·조사가 있어도 하나의 볼드 범위로 묶는다. 예) **국내 프로바이오틱스 시장**, **Lactobacillus plantarum 균주의 위산 내성**, **분말 제형 0.2~1.2 중량부 처리**(예시의 시장명·균주명·수치를 다른 특허에 옮겨 쓰지 않는다). 절대 "**국내** **프로바이오틱스** **시장**"처럼 조각내지 않는다.
- 각 볼드 범위는 떼어 읽어도 뜻이 통하는 명사구·수치구여야 한다.
- 학명의 이탤릭 *..* 표기와 볼드는 병행 가능하다: **\`*Lactobacillus plantarum*\` 균주**. 볼드 안에 이탤릭을 그대로 유지한다.
- 볼드 마커는 반드시 한 문장 안에서 열고 닫는다. 문단·문장 경계를 넘지 않는다.
- 학명(라틴어 속명·종명)은 이탤릭 *..* 사용. 속명 첫글자 대문자, 종소명 소문자. 조사·구두점·괄호는 이탤릭 바깥. 예: *Lactobacillus plantarum*은 / *Oryza sativa*(벼). 학명이 없는 특허에서는 이탤릭 별표를 사용하지 않는다(볼드 **...**는 사용 가능).
- 다 쓴 뒤 점검: 섹션마다 볼드 수를 세어 기준보다 적으면 위 '반드시 볼드할 대상'에서 더하고, 많으면 덜 중요한 것을 푼다. 볼드 마커(**)의 짝이 모두 맞는지 확인한다.`;

/** 볼드 한 곳의 최대 글자 수(학명 표기 별표·백틱 제외). 넘으면 문장 통째 강조로 보고 푼다. */
export const MAX_BOLD_CHARS = 45;

const BOLD_SPAN = /\*\*((?:[^*\n]|\*[^*\n]+?\*)+?)\*\*/g;
const visibleLength = (s: string) => s.replace(/[*`]/g, "").trim().length;

/**
 * 생성 직후 볼드를 규칙에 맞게 다듬는다(모델이 규칙을 어겼을 때의 안전장치).
 * - 관련시장 동향의 숫자 볼드는 푼다: 시장 수치 보정(marketConsistency)과 화면 시장 표가 숫자를 읽는다.
 * - 문장 통째 같은 너무 긴 볼드는 푼다.
 * - 짝 없는 '**'는 지운다(화면에 별표로 남지 않게).
 */
export function tidyBold(content: string): string {
  return content
    .split(/(?=^##\s)/m)
    .map((section) => {
      const isMarket = /^##\s*관련시장/.test(section);
      return section
        .split("\n")
        .map((line) => {
          if (/^##\s/.test(line)) return line;
          let out = line.replace(BOLD_SPAN, (whole, inner: string) => {
            if (visibleLength(inner) > MAX_BOLD_CHARS) return inner;
            if (isMarket && /\d/.test(inner) && !/시장/.test(inner)) return inner;
            return whole;
          });
          // 남은 짝 없는 '**' 제거 (짝 맞는 볼드는 위에서 이미 처리되어 그대로 남는다)
          const pairs = out.match(/\*\*/g)?.length ?? 0;
          if (pairs % 2 === 1) {
            const last = out.lastIndexOf("**");
            out = out.slice(0, last) + out.slice(last + 2);
          }
          return out;
        })
        .join("\n");
    })
    .join("");
}

/** 섹션별 볼드 개수 (점검·테스트용). */
export function countBoldBySection(content: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const section of content.split(/(?=^##\s)/m)) {
    const head = section.match(/^##\s*(.+)/)?.[1]?.trim();
    if (!head) continue;
    out[head] = section.match(BOLD_SPAN)?.length ?? 0;
  }
  return out;
}
