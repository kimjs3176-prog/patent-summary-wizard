// KIPRIS 키 없이 개발·테스트할 때 쓰는 모의 응답 (KIPRIS_MOCK=1).
// 실제 KIPRIS 와 같은 XML 구조를 돌려주지만, 모든 문헌은 [모의] 표시가 붙은 가짜 데이터다.

const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

const DOCS = [
  ["미강 발효물을 유효성분으로 하는 액상 비료 조성물", "효모로 발효한 미강 발효물을 포함하는 액상 비료로 토양 개량과 작물 생육 촉진 효과가 있다."],
  ["바실러스 속 균주를 이용한 작물 생육 촉진제", "바실러스 균주 배양액을 유효성분으로 하여 작물의 생육을 촉진하고 병해를 억제한다."],
  ["농산 부산물 발효 퇴비의 제조방법", "쌀겨와 왕겨 등 농산 부산물을 미생물로 발효하여 퇴비를 제조하는 방법으로 토양 개량 효과가 있다."],
  ["키토산을 포함하는 식물 병해 방제용 조성물", "키토산과 미생물 발효액을 포함하여 식물 병해를 억제하는 조성물."],
  ["수경재배용 양액 첨가제", "수경재배 양액에 첨가하여 엽채류 생육을 촉진하는 첨가제와 그 제조방법."],
  ["유산균 발효 추출물을 이용한 생장 촉진 방법", "유산균으로 발효한 식물 추출물을 엽면 시비하여 생장을 촉진한다."],
  ["미강 추출물을 포함하는 사료 첨가제", "미강 추출물을 포함하여 가축의 생산성을 높이는 사료 첨가제."],
  ["바실러스 균주 및 이의 용도", "신규 바실러스 균주와 이를 포함하는 미생물 비료로 작물 생육 촉진과 병해 억제 효과가 있다."]
];

const xml = body => `<?xml version="1.0" encoding="UTF-8"?><response><header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>${body}</response>`;

// 건수: 같은 검색식은 늘 같은 값. 분야 전체처럼 동의어가 많은 검색식은 크게, 공백 맵 칸은 작게 나온다.
// 출원일 범위(applicationDate=YYYYMMDD~YYYYMMDD)가 있으면 해마다 늘어나는 분포로 나누고, 최근 2년은 공개 지연만큼 줄인다.
const LAST = new Date().getFullYear() - 1;
function mockCount(q, date, status) {
  const h = hash(q) % 100, ors = Math.max(0, ...q.split("*").map(g => g.split("+").length - 1));
  const base = (h < 18 ? h % 3 : h < 40 ? 3 + (h % 9) : 10 + (h % 45)) * (ors >= 3 ? 1 + ors * 6 : 1);
  const m = /^(\d{4})\d{4}~(\d{4})\d{4}$/.exec(date || "");
  let total = base;
  if (m) {
    const g = 1.04 + (hash(q + "g") % 9) / 100, first = LAST - 14, norm = Array.from({ length: 15 }, (_, i) => g ** i).reduce((a, b) => a + b, 0);
    const lag = y => (y === LAST ? 0.55 : y === LAST - 1 ? 0.9 : 1);
    total = 0; for (let y = Math.max(first, +m[1]); y <= Math.min(LAST, +m[2]); y++) total += base * g ** (y - first) / norm * lag(y);
    total = Math.round(total);
  }
  return status === "R" ? Math.round(total * 0.42) : total;
}
const OWNERS = ["[모의] 한국농업대학교 산학협력단", "[모의] 국립농업기술연구원", "[모의] 주식회사 그린팜", "[모의] 농업회사법인 새싹", "[모의] 식품연구센터", "[모의] (주)스마트그로우", "[모의] 개인 출원인 가", "[모의] 바이오농업 주식회사"];

function search(p) {
  const rows = Number(p.get("numOfRows") || 10);
  const q = p.get("astrtCont") || "";
  const rejected = p.get("lastvalue") === "J";
  if (rows === 1) {
    const total = mockCount(q, p.get("applicationDate"), p.get("lastvalue"));
    return xml(`<body><items>${total ? `<item><applicationNumber>1020000000000</applicationNumber><inventionTitle>[모의]</inventionTitle></item>` : ""}</items></body><count><numOfRows>1</numOfRows><pageNo>1</pageNo><totalCount>${total}</totalCount></count>`);
  }
  // 국내 출원 동향의 '최근 출원 100건': 출원인 분포를 보기 위한 목록
  if (rows >= 100) {
    const items = Array.from({ length: rows }, (_, i) => {
      const [t, a] = DOCS[i % DOCS.length], o = OWNERS[[0, 1, 2, 0, 3, 1, 4, 0, 5, 2, 6, 7][i % 12]];
      return `<item><indexNo>${i + 1}</indexNo><inventionTitle>[모의] ${t}</inventionTitle><applicationNumber>10${LAST}${String(hash(q + i) % 10000000).padStart(7, "0")}</applicationNumber><applicationDate>${LAST}0${(i % 9) + 1}01</applicationDate><applicantName>${o}</applicantName><astrtCont><![CDATA[${a}]]></astrtCont></item>`;
    }).join("");
    return xml(`<body><items>${items}</items></body><count><numOfRows>${rows}</numOfRows><pageNo>1</pageNo><totalCount>${mockCount(q)}</totalCount></count>`);
  }
  const list = (rejected ? DOCS.slice(0, 5) : DOCS).slice(0, rows);
  const items = list.map(([t, a], i) => {
    const no = `10${2015 + (i % 9)}${String(hash(t + rejected) % 10000000).padStart(7, "0")}`;
    return `<item><indexNo>${i + 1}</indexNo><registerStatus>${rejected ? "거절" : ["등록", "공개", "소멸"][i % 3]}</registerStatus><inventionTitle>[모의] ${t}</inventionTitle><ipcNumber>C05F 11/08|C12N 1/20</ipcNumber><applicationNumber>${no}</applicationNumber><applicationDate>${2015 + (i % 9)}0${(i % 9) + 1}15</applicationDate>${i % 3 === 0 ? `<registerNumber>10${String(2000000 + i * 1111).padStart(7, "0")}0000</registerNumber><registerDate>${2017 + (i % 7)}0301</registerDate>` : ""}<openNumber>10${2016 + (i % 9)}${String(hash(t) % 10000000).padStart(7, "0")}</openNumber><openDate>${2016 + (i % 9)}0720</openDate><applicantName>모의출원인${i + 1}</applicantName><astrtCont><![CDATA[${a}]]></astrtCont></item>`;
  }).join("");
  return xml(`<body><items>${items}</items></body><count><numOfRows>${rows}</numOfRows><pageNo>1</pageNo><totalCount>${rejected ? 37 : 412}</totalCount></count>`);
}

function detail(p) {
  const no = p.get("applicationNumber") || "";
  const h = hash(no) % 3;
  const legal = [["특허출원서", "20190115"], ["의견제출통지서", "20200310"], ...(h === 2 ? [["의견제출통지서", "20200901"]] : []), ["보정서", "20200505"], ["거절결정서", "20201120"]]
    .map(([n, d]) => `<legalStatusInfo><documentName>${n}</documentName><receiptDate>${d}</receiptDate></legalStatusInfo>`).join("");
  const prior = h === 1 ? "" : `<priorArtDocumentsInfo><documentsNumber>1020170000${h}11</documentsNumber><examinerQuotationFlag>Y</examinerQuotationFlag></priorArtDocumentsInfo><priorArtDocumentsInfo><documentsNumber>JP2016-00${h}22</documentsNumber><examinerQuotationFlag>Y</examinerQuotationFlag></priorArtDocumentsInfo>`;
  const AG = ["[모의] 가나 특허법인", "[모의] 다라 특허사무소", "[모의] 마바 국제특허법률사무소"], k = hash(no);
  const agents = `<agentInfoArray><agentInfo><name>${AG[k % 3]}</name><code>9${String(k % 3).padStart(11, "0")}</code></agentInfo></agentInfoArray>`;
  const applicants = `<applicantInfoArray><applicantInfo><name>${k % 4 === 0 ? "[모의] Global Agri Inc." : "[모의] 국내 출원인"}</name><country>${k % 4 === 0 ? "US" : "KR"}</country></applicantInfo></applicantInfoArray>`;
  return xml(`<body><item><biblioSummaryInfoArray><biblioSummaryInfo><applicationNumber>${no}</applicationNumber><inventionTitle>[모의] 상세</inventionTitle><registerStatus>거절</registerStatus><claimCount>8</claimCount></biblioSummaryInfo></biblioSummaryInfoArray>${applicants}${agents}<ipcInfoArray><ipcInfo><ipcNumber>C05F 11/08</ipcNumber></ipcInfo></ipcInfoArray><legalStatusInfoArray>${legal}</legalStatusInfoArray><priorArtDocumentsInfoArray>${prior}</priorArtDocumentsInfoArray></item></body>`);
}

export async function mockFetch(url) {
  const u = new URL(url);
  const op = u.pathname.split("/").pop();
  const text = op === "getAdvancedSearch" ? search(u.searchParams) : op === "getBibliographyDetailInfoSearch" ? detail(u.searchParams) : xml("");
  return { ok: true, status: 200, text: async () => text };
}
