import { useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { safeFetch } from "@/lib/safeFetch";
import { Download, FileText, Search, Loader2, MapPin } from "lucide-react";

type Category = "국유-농진청" | "국유-검역본부" | "국유-품관원" | "국유-종자원" | "비국유";
type CategoryAction = "출원" | "등록";
type ContractKind = "신규" | "재계약" | "자동재계약";
type DispoKind = "통상실시" | "전용실시" | "양도";
type PayKind = "유상-선납(경상)" | "유상-선납(정액)" | "무상";
type OwnerKind = "" | "법인" | "개인" | "기타";

interface FormState {
  category: Category;
  categoryAction: CategoryAction;
  caseType: string;
  rightType: string;
  applicationNo: string;
  registrationNo: string;
  inventionOrg: string;
  inventionTitle: string;
  inventor: string;
  inventorPhone: string;
  applicantOrg: string;
  registrantHolder: string;
  contractKind: ContractKind;
  dispoKind: DispoKind;
  payKind: PayKind;
  periodStart: string;
  periodEnd: string;
  region: string;
  scope: string;
  applicant: string;
  email: string;
  contact: string;
  quantity: string;
  unitPrice: string;
  sharePct: string;
  ownershipPct: string;
  companyName: string;
  established: string;
  ownerKind: OwnerKind;
  businessNo: string;
  corporateNo: string;
  representative: string;
  hqAddress: string;
  hqPostalCode: string;
  phone: string;
  fax: string;
  plannedProducts: string;
  products: string;
}

const initial: FormState = {
  category: "국유-농진청",
  categoryAction: "출원",
  caseType: "국내",
  rightType: "특허",
  applicationNo: "",
  registrationNo: "",
  inventionOrg: "",
  inventionTitle: "",
  inventor: "",
  inventorPhone: "",
  applicantOrg: "",
  registrantHolder: "",
  contractKind: "신규",
  dispoKind: "통상실시",
  payKind: "유상-선납(경상)",
  periodStart: "",
  periodEnd: "",
  region: "대한민국 전역",
  scope: "특허법 제2조 제3호에 규정된 실시행위",
  applicant: "",
  email: "",
  contact: "",
  quantity: "0",
  unitPrice: "0",
  sharePct: "100",
  ownershipPct: "100",
  companyName: "",
  established: "",
  ownerKind: "",
  businessNo: "",
  corporateNo: "",
  representative: "",
  hqAddress: "",
  hqPostalCode: "",
  phone: "",
  fax: "",
  plannedProducts: "",
  products: "",
};

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-[12px] font-medium text-foreground/80">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

const CATS: Category[] = ["국유-농진청", "국유-검역본부", "국유-품관원", "국유-종자원", "비국유"];

const BASE_RATE = 0.03; // 기본율 3% 고정

// 농촌진흥청 지분율을 출원인 문자열에서 계산
function calcRdaShare(applicantStr: string): number {
  if (!applicantStr) return 100;
  const parts = applicantStr.split(/[,;\/·및\n]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return 100;
  const rdaCount = parts.filter((p) => /농촌진흥청|농진청|Rural Development Administration|RDA/i.test(p)).length;
  if (rdaCount === 0) return 0;
  if (parts.length === 1) return 100;
  // 균등 지분으로 가정
  return Math.round((rdaCount / parts.length) * 1000) / 10;
}

// Daum 우편번호 스크립트 동적 로드
function loadDaumPostcode(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.daum?.Postcode) return resolve(w.daum);
    const existing = document.getElementById("daum-postcode-script") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve((window as any).daum));
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.id = "daum-postcode-script";
    s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    s.async = true;
    s.onload = () => resolve((window as any).daum);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function Apply() {
  const [f, setF] = useState<FormState>(initial);
  const [generating, setGenerating] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  // 견적금액 = 예정수량 × 단가 × 점유율(%) × 지분율(%) × 기본율(3%)
  const estimate = Math.round(
    (Number(f.quantity) || 0) *
      (Number(f.unitPrice) || 0) *
      ((Number(f.sharePct) || 0) / 100) *
      ((Number(f.ownershipPct) || 0) / 100) *
      BASE_RATE
  );

  const openPostcode = async (target: "company") => {
    try {
      const daum: any = await loadDaumPostcode();
      new daum.Postcode({
        oncomplete: (data: any) => {
          const addr = data.roadAddress || data.jibunAddress || data.address || "";
          if (target === "company") {
            setF((p) => ({ ...p, hqAddress: addr, hqPostalCode: data.zonecode || "" }));
          }
        },
      }).open();
    } catch (e) {
      console.error(e);
      toast.error("우편번호 검색을 불러오지 못했습니다");
    }
  };

  const handleKiprisLookup = async () => {
    const query = (f.applicationNo || f.registrationNo).trim();
    if (!query) {
      toast.error("출원번호 또는 등록번호를 입력하세요");
      return;
    }
    setLookingUp(true);
    try {
      const res = await safeFetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-patent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ patentNumber: query }),
          timeoutMs: 30000,
          retries: 1,
        }
      );
      const result = await res.json().catch(() => ({ success: false }));
      if (!result.success || !result.data) {
        toast.error(result.error || "특허 정보를 찾을 수 없습니다");
        return;
      }
      const d = result.data;
      const applicantStr = d.applicant || d.assignee || "";
      const ownership = calcRdaShare(applicantStr);
      setF((p) => ({
        ...p,
        inventionTitle: d.titleKo || d.title || p.inventionTitle,
        inventor: Array.isArray(d.inventors) ? d.inventors.join(", ") : p.inventor,
        applicantOrg: applicantStr || p.applicantOrg,
        registrantHolder: d.assignee || d.applicant || p.registrantHolder,
        inventionOrg: d.applicant || d.assignee || p.inventionOrg,
        applicationNo: d.applicationNumber || d.displayNumber || p.applicationNo,
        registrationNo: d.registrationNumber || p.registrationNo,
        categoryAction: d.registrationNumber ? "등록" : "출원",
        ownershipPct: String(ownership),
      }));
      toast.success(`KIPRIS 자동입력 완료 (농진청 지분율 ${ownership}%)`);
    } catch (e) {
      console.error(e);
      toast.error("KIPRIS 조회에 실패했습니다");
    } finally {
      setLookingUp(false);
    }
  };

  const handleGenerate = async () => {
    if (!agreed) {
      toast.error("개인정보 수집·이용에 동의해 주세요");
      return;
    }
    if (!f.applicant.trim() || !f.companyName.trim()) {
      toast.error("신청자와 회사명은 필수입니다");
      return;
    }
    setGenerating(true);
    try {
      const categoryLabel = `${f.category} / ${f.categoryAction}`;
      const period = [f.periodStart, f.periodEnd].filter(Boolean).join(" ~ ");
      const rows: (string | number)[][] = [
        ["기술이전(실시) 신청서"],
        [],
        ["[관련 특허 정보]"],
        ["구분", categoryLabel, "회사명", f.companyName],
        ["사건구분", f.caseType, "권리", f.rightType],
        ["출원번호", f.applicationNo, "등록번호", f.registrationNo],
        ["발명기관", f.inventionOrg, "발명의 명칭", f.inventionTitle],
        ["발명자", f.inventor, "전화번호", f.inventorPhone],
        ["출원인", f.applicantOrg, "등록권리자", f.registrantHolder],
        [],
        ["[실시 신청 내용]"],
        ["계약의 종류", f.contractKind, "처분의 종류", f.dispoKind],
        ["유무상 여부", f.payKind, "실시 기간", period],
        ["실시 지역", f.region, "실시 내용", f.scope],
        ["예정수량", Number(f.quantity || 0), "단가(원)", Number(f.unitPrice || 0)],
        ["점유율(%)", Number(f.sharePct || 0), "지분율(%)", Number(f.ownershipPct || 0)],
        ["기본율(%)", BASE_RATE * 100, "견적금액(원)", estimate],
        [],
        ["[계약 신청 정보]"],
        ["신청자", f.applicant, "이메일", f.email],
        ["연락처", f.contact, "", ""],
        [],
        ["[신청 업체 정보]"],
        ["회사명", f.companyName, "설립년월일", f.established],
        ["소유여부", f.ownerKind, "대표자", f.representative],
        ["사업자등록번호", f.businessNo, "법인등록번호", f.corporateNo],
        ["전화번호", f.phone, "FAX", f.fax],
        ["본사 주소", `${f.hqPostalCode ? `(${f.hqPostalCode}) ` : ""}${f.hqAddress}`, "생산품목", f.products],
        ["사업화예정제품", f.plannedProducts, "", ""],
        [],
        ["[개인정보 수집·이용 동의]"],
        ["동의 여부", agreed ? "동의함" : "미동의", "동의 일시", new Date().toLocaleString("ko-KR")],
      ];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [{ wch: 18 }, { wch: 38 }, { wch: 18 }, { wch: 38 }];
      // 섹션 헤더 전체 병합 (제목/각 [..] 라인)
      const mergeRows = rows
        .map((r, idx) => (typeof r[0] === "string" && (idx === 0 || (r[0] as string).startsWith("[")) ? idx : -1))
        .filter((i) => i >= 0);
      ws["!merges"] = mergeRows.map((r) => ({ s: { r, c: 0 }, e: { r, c: 3 } }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "기술이전신청서");

      // ===== [서식 1] 수의계약신청서 =====
      const today = new Date();
      const ymd = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;
      const rightLabel = f.registrationNo
        ? `등록 ${f.registrationNo}`
        : f.applicationNo
        ? `출원 ${f.applicationNo}`
        : "";
      const periodYears =
        f.periodStart && f.periodEnd
          ? Math.max(
              1,
              Math.round(
                (new Date(f.periodEnd).getTime() - new Date(f.periodStart).getTime()) /
                  (365.25 * 24 * 3600 * 1000)
              )
            )
          : "";
      const periodLine = `기간: ${f.periodStart || "20  .  .  ."} ~ ${f.periodEnd || "20  .  .  ."}${
        periodYears ? ` (${periodYears}년간)` : ""
      } / 지역: ${f.region} / 내용: ${f.scope}`;
      const dispoCheck = (k: DispoKind) => (f.dispoKind === k ? "■" : "□");
      const form1: (string | number)[][] = [
        ["[서식 1] 수의계약신청서"],
        ["수의계약신청서"],
        [],
        ["신청인", "", "", ""],
        ["① 업체명", f.companyName, "② 사업자등록번호", f.businessNo],
        ["①-1 대표자", f.representative, "②-1 법인등록번호", f.corporateNo],
        [
          "③ 사업장소재지 (사업자등록증 기준)",
          `${f.hqPostalCode ? `(${f.hqPostalCode}) ` : ""}${f.hqAddress}`,
          "③-1 대표전화",
          f.phone,
        ],
        ["④ 권리의 표시", rightLabel, "⑤ 발명의 명칭", f.inventionTitle],
        [
          "⑥ 처분의 종류",
          `${dispoCheck("양도")} 매수    ${dispoCheck("전용실시")} 전용실시(권)    ${dispoCheck(
            "통상실시"
          )} 통상실시(권)`,
          "",
          "",
        ],
        ["⑦ 실시범위", periodLine, "", ""],
        ["⑧ 총 견적금액", `${estimate.toLocaleString()} 원`, "", ""],
        [
          "⑨ 수의계약의 근거",
          "「국가공무원 등 직무발명의 처분ㆍ관리 및 보상 등에 관한 규정」 제11조 및 같은 규정 시행규칙 제8조 / 「농촌진흥법」 제13조 제2항 및 같은 법 시행규칙 제8조 제1항",
          "",
          "",
        ],
        ["※ 국가직무발명특허권등이 적용될 제품명", f.plannedProducts || f.products, "", ""],
        [],
        [ymd, "", "", ""],
        [`신청인: ${f.companyName}  (대표 ${f.representative})  (인)`, "", "", ""],
        ["한국농업기술진흥원장 귀하", "", "", ""],
        [],
        ["※ 첨부서류", "1. 실시료에 대한 견적서 1부   2. 해당 국가직무발명특허권등의 실시에 관한 사업계획서 1부", "", ""],
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(form1);
      ws1["!cols"] = [{ wch: 22 }, { wch: 36 }, { wch: 22 }, { wch: 36 }];
      ws1["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
        { s: { r: 8, c: 1 }, e: { r: 8, c: 3 } },
        { s: { r: 9, c: 1 }, e: { r: 9, c: 3 } },
        { s: { r: 10, c: 1 }, e: { r: 10, c: 3 } },
        { s: { r: 11, c: 1 }, e: { r: 11, c: 3 } },
        { s: { r: 12, c: 1 }, e: { r: 12, c: 3 } },
        { s: { r: 14, c: 0 }, e: { r: 14, c: 3 } },
        { s: { r: 15, c: 0 }, e: { r: 15, c: 3 } },
        { s: { r: 16, c: 0 }, e: { r: 16, c: 3 } },
        { s: { r: 18, c: 1 }, e: { r: 18, c: 3 } },
      ];
      XLSX.utils.book_append_sheet(wb, ws1, "서식1_수의계약신청서");

      // ===== [서식 2] 실시료 견적서 =====
      const qty = Number(f.quantity || 0);
      const price = Number(f.unitPrice || 0);
      const share = Number(f.sharePct || 0);
      const own = Number(f.ownershipPct || 0);
      const form2: (string | number)[][] = [
        ["[서식 2] 실시료 견적서"],
        ["실시료견적서"],
        [],
        ["권리의 표시", rightLabel, "발명의 명칭", f.inventionTitle],
        ["예정실시료 견적금액", `${estimate.toLocaleString()} 원`, "", ""],
        [],
        ["○ 예정실시료의 견적금액 산정근거", "", "", ""],
        ["- 제품명", f.plannedProducts || f.products, "", ""],
        ["- 총판매예정수량", qty, "- 예정단가(원)", price],
        ["- 점유율(%)", share, "- 기본율(%)", BASE_RATE * 100],
        ["- 지분율(%)", own, "- 실시료 산출금액(원)", estimate],
        [
          "산식",
          `(총판매예정수량 ${qty}) × (예정단가 ${price}) × (점유율 ${share}%) × (기본율 3%) × (지분율 ${own}%) = ${estimate.toLocaleString()} 원`,
          "",
          "",
        ],
        [],
        [ymd, "", "", ""],
        [`신청인: ${f.companyName}  (대표 ${f.representative})  (인)`, "", "", ""],
        ["한국농업기술진흥원장 귀하", "", "", ""],
      ];
      const ws2 = XLSX.utils.aoa_to_sheet(form2);
      ws2["!cols"] = [{ wch: 22 }, { wch: 36 }, { wch: 22 }, { wch: 36 }];
      ws2["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        { s: { r: 4, c: 1 }, e: { r: 4, c: 3 } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: 3 } },
        { s: { r: 7, c: 1 }, e: { r: 7, c: 3 } },
        { s: { r: 11, c: 1 }, e: { r: 11, c: 3 } },
        { s: { r: 13, c: 0 }, e: { r: 13, c: 3 } },
        { s: { r: 14, c: 0 }, e: { r: 14, c: 3 } },
        { s: { r: 15, c: 0 }, e: { r: 15, c: 3 } },
      ];
      XLSX.utils.book_append_sheet(wb, ws2, "서식2_실시료견적서");

      // ===== 통상실시권 실시계약서 (요약 양식) =====
      const contract: (string | number)[][] = [
        ["국가직무발명특허권의 통상실시권 실시계약서"],
        [],
        [
          "한국농업기술진흥원(이하 '농진원')과 " +
            `${f.companyName}(대표자: ${f.representative}, 이하 '실시권자')는 아래와 같은 조건으로 ` +
            "국가직무발명특허권의 통상실시권 허락(이하 '실시')에 관한 계약을 체결한다.",
        ],
        [],
        ["제1조 (실시권의 허락)"],
        [`○ 특허번호(출원번호): ${f.registrationNo || "-"} (${f.applicationNo || "-"})`],
        [`○ 발명의 명칭: ${f.inventionTitle}`],
        [],
        ["제2조 (실시권의 범위 등)"],
        [
          `1. 실시기간: ${f.periodStart || "20  .  .  ."} ~ ${f.periodEnd || "20  .  .  ."}${
            periodYears ? ` (${periodYears}년간)` : ""
          }`,
        ],
        [`2. 실시료: 금 ${estimate.toLocaleString()} 원`],
        [`   ○ 총판매예정수량: ${qty.toLocaleString()} 개`],
        [`   ○ 제품판매단가: ${price.toLocaleString()} 원/개`],
        [`   ○ 점유율 ${share}%, 기본율 3%, 국가지분율 ${own}%`],
        [`3. 실시범위 - 지리적 범위: ${f.region} / 실시내용: ${f.scope}`],
        [`4. 실시제품명: ${f.plannedProducts || f.products}`],
        [],
        ["제3조 (제3자에 대한 허락) — 원 계약서 본문 준용"],
        ["제4조 (실시권의 등록) — 원 계약서 본문 준용"],
        ["제5조 (실시료의 납부) — 원 계약서 본문 준용"],
        ["제6조 (실시료의 정산 등) — 원 계약서 본문 준용"],
        ["제7조 (비밀보장) — 원 계약서 본문 준용"],
        ["제8조 (면책) — 원 계약서 본문 준용"],
        ["제9조 (재계약) — 원 계약서 본문 준용"],
        ["제10조 이하 — 원 계약서 본문 준용"],
        [],
        ["※ 본 시트는 입력값을 자동 반영한 계약서 초안입니다. 정식 계약 체결 시 한국농업기술진흥원이 제공하는 원본 계약서 양식을 사용해 주십시오."],
        [],
        [ymd],
        [],
        [`[농진원]  한국농업기술진흥원장 (인)`],
        [
          `[실시권자]  ${f.companyName}  대표자: ${f.representative} (인)`,
        ],
        [
          `주소: ${f.hqPostalCode ? `(${f.hqPostalCode}) ` : ""}${f.hqAddress}  /  전화: ${f.phone}  /  담당: ${f.applicant} (${f.email}, ${f.contact})`,
        ],
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(contract);
      ws3["!cols"] = [{ wch: 110 }];
      XLSX.utils.book_append_sheet(wb, ws3, "통상실시권_실시계약서");

      const fileName = `기술이전신청서_${f.companyName || "신청"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("신청서·견적서·계약서 양식이 포함된 엑셀 파일이 생성되었습니다");
    } catch (e) {
      console.error(e);
      toast.error("엑셀 생성에 실패했습니다");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PageLayout>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-10 max-w-6xl">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--gradient-accent)" }}>
              <FileText className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">기술이전 신청</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            입력 정보를 바탕으로 기술이전(실시) 신청서 엑셀 파일을 생성합니다. 입력 데이터는 어디에도 저장되지 않습니다.
          </p>
        </div>

        <div className="space-y-6">
          {/* 구분 */}
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-4 text-foreground/90">구분</h2>
            <div className="flex flex-wrap gap-2">
              {CATS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => upd("category", c)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    f.category === c ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/60 hover:bg-accent/30"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {(["출원", "등록"] as CategoryAction[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => upd("categoryAction", a)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${
                    f.categoryAction === a ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/60"
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </section>

          {/* 관련 특허 정보 */}
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-4 text-foreground/90">관련 특허 정보</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="사건구분"><Input value={f.caseType} onChange={(e) => upd("caseType", e.target.value)} placeholder="국내" /></Field>
              <Field label="권리"><Input value={f.rightType} onChange={(e) => upd("rightType", e.target.value)} placeholder="특허" /></Field>
              <Field label="출원번호">
                <div className="flex gap-2">
                  <Input value={f.applicationNo} onChange={(e) => upd("applicationNo", e.target.value)} placeholder="10-2023-0000000" />
                  <Button type="button" variant="outline" size="sm" onClick={handleKiprisLookup} disabled={lookingUp} className="shrink-0 h-9 px-2.5">
                    {lookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </Field>
              <Field label="등록번호"><Input value={f.registrationNo} onChange={(e) => upd("registrationNo", e.target.value)} /></Field>
              <Field label="발명기관"><Input value={f.inventionOrg} onChange={(e) => upd("inventionOrg", e.target.value)} /></Field>
              <div className="sm:col-span-2 md:col-span-3">
                <Field label="발명의 명칭"><Input value={f.inventionTitle} onChange={(e) => upd("inventionTitle", e.target.value)} /></Field>
              </div>
              <Field label="발명자"><Input value={f.inventor} onChange={(e) => upd("inventor", e.target.value)} /></Field>
              <Field label="전화번호"><Input value={f.inventorPhone} onChange={(e) => upd("inventorPhone", e.target.value)} /></Field>
              <Field label="출원인"><Input value={f.applicantOrg} onChange={(e) => upd("applicantOrg", e.target.value)} /></Field>
              <Field label="등록권리자"><Input value={f.registrantHolder} onChange={(e) => upd("registrantHolder", e.target.value)} /></Field>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">출원번호를 입력 후 돋보기 버튼을 누르면 KIPRIS에서 특허 정보를 자동으로 불러옵니다.</p>
          </section>

          {/* 실시 신청 내용 */}
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-4 text-foreground/90">실시 신청 내용</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="계약의 종류">
                <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={f.contractKind} onChange={(e) => upd("contractKind", e.target.value as ContractKind)}>
                  <option>신규</option><option>재계약</option><option>자동재계약</option>
                </select>
              </Field>
              <Field label="처분의 종류">
                <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={f.dispoKind} onChange={(e) => upd("dispoKind", e.target.value as DispoKind)}>
                  <option>통상실시</option><option>전용실시</option><option>양도</option>
                </select>
              </Field>
              <Field label="유무상 여부">
                <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={f.payKind} onChange={(e) => upd("payKind", e.target.value as PayKind)}>
                  <option>유상-선납(경상)</option><option>유상-선납(정액)</option><option>무상</option>
                </select>
              </Field>
              <Field label="실시 기간 시작"><Input type="date" value={f.periodStart} onChange={(e) => upd("periodStart", e.target.value)} /></Field>
              <Field label="실시 기간 종료"><Input type="date" value={f.periodEnd} onChange={(e) => upd("periodEnd", e.target.value)} /></Field>
              <Field label="실시 지역"><Input value={f.region} onChange={(e) => upd("region", e.target.value)} /></Field>
              <div className="sm:col-span-2 md:col-span-3">
                <Field label="실시 내용"><Input value={f.scope} onChange={(e) => upd("scope", e.target.value)} /></Field>
              </div>
              <Field label="예정수량">
                <Input type="number" min="0" value={f.quantity} onChange={(e) => upd("quantity", e.target.value)} />
              </Field>
              <Field label="단가 (원)">
                <Input type="number" min="0" value={f.unitPrice} onChange={(e) => upd("unitPrice", e.target.value)} />
              </Field>
              <Field label="점유율 (%)">
                <Input type="number" step="0.1" min="0" max="100" value={f.sharePct} onChange={(e) => upd("sharePct", e.target.value)} />
              </Field>
              <Field label="지분율 (%) · 농진청">
                <Input type="number" step="0.1" min="0" max="100" value={f.ownershipPct} onChange={(e) => upd("ownershipPct", e.target.value)} />
              </Field>
              <Field label="기본율 (%)">
                <Input type="number" value={(BASE_RATE * 100).toFixed(1)} readOnly className="bg-muted/40" />
              </Field>
              <div className="sm:col-span-2 md:col-span-3">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[12px] text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">견적금액 산식</span> ={" "}
                    예정수량 × 단가 × 점유율 × 지분율 × 기본율(3%)
                    <div className="mt-1 text-foreground/70">
                      {Number(f.quantity || 0).toLocaleString()} × {Number(f.unitPrice || 0).toLocaleString()} ×{" "}
                      {f.sharePct}% × {f.ownershipPct}% × 3%
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">견적금액</div>
                    <div className="text-xl font-bold text-primary">{estimate.toLocaleString()} 원</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 계약 신청 정보 */}
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-1 text-foreground/90">계약 신청자 정보</h2>
            <p className="text-[11px] text-muted-foreground mb-4">이름 · 이메일 · 연락처만 입력합니다.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="신청자" required><Input value={f.applicant} onChange={(e) => upd("applicant", e.target.value)} /></Field>
              <Field label="이메일"><Input type="email" value={f.email} onChange={(e) => upd("email", e.target.value)} /></Field>
              <Field label="연락처"><Input value={f.contact} onChange={(e) => upd("contact", e.target.value)} placeholder="010-0000-0000" /></Field>
            </div>
          </section>

          {/* 신청 업체 정보 */}
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-4 text-foreground/90">신청 업체 정보</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="회사명" required><Input value={f.companyName} onChange={(e) => upd("companyName", e.target.value)} /></Field>
              <Field label="설립년월일"><Input type="date" value={f.established} onChange={(e) => upd("established", e.target.value)} /></Field>
              <Field label="소유여부">
                <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={f.ownerKind} onChange={(e) => upd("ownerKind", e.target.value as OwnerKind)}>
                  <option value="">선택</option><option>법인</option><option>개인</option><option>기타</option>
                </select>
              </Field>
              <Field label="사업자등록번호"><Input value={f.businessNo} onChange={(e) => upd("businessNo", e.target.value)} /></Field>
              <Field label="법인등록번호"><Input value={f.corporateNo} onChange={(e) => upd("corporateNo", e.target.value)} /></Field>
              <Field label="대표자"><Input value={f.representative} onChange={(e) => upd("representative", e.target.value)} /></Field>
              <Field label="전화번호"><Input value={f.phone} onChange={(e) => upd("phone", e.target.value)} /></Field>
              <Field label="FAX"><Input value={f.fax} onChange={(e) => upd("fax", e.target.value)} /></Field>
              <Field label="우편번호">
                <div className="flex gap-2">
                  <Input value={f.hqPostalCode} readOnly placeholder="검색" className="bg-muted/40" />
                  <Button type="button" variant="outline" size="sm" onClick={() => openPostcode("company")} className="shrink-0 h-9 px-2.5 gap-1">
                    <MapPin className="w-3.5 h-3.5" /> 검색
                  </Button>
                </div>
              </Field>
              <div className="sm:col-span-2 md:col-span-2">
                <Field label="본사 주소 (도로명)">
                  <Input value={f.hqAddress} onChange={(e) => upd("hqAddress", e.target.value)} placeholder="우편번호 검색을 사용해 주세요" />
                </Field>
              </div>
              <div className="sm:col-span-2 md:col-span-3">
                <Field label="사업화예정제품"><Input value={f.plannedProducts} onChange={(e) => upd("plannedProducts", e.target.value)} placeholder="예: 기능성 가공식품, 농업용 자재 등" /></Field>
              </div>
              <Field label="생산품목"><Input value={f.products} onChange={(e) => upd("products", e.target.value)} /></Field>
            </div>
          </section>

          {/* 개인정보 수집·이용 동의 */}
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-3 text-foreground/90">개인정보 수집·이용 동의</h2>
            <div className="text-[12px] leading-relaxed text-muted-foreground bg-muted/30 rounded-lg p-3 mb-3 max-h-40 overflow-y-auto">
              <p className="font-medium text-foreground mb-1">1. 수집 항목</p>
              <p>신청자 성명, 회사명, 이메일, 연락처(전화/휴대폰), 주소, 사업자등록번호, 법인등록번호, 대표자, 본사 주소 등 신청서 작성에 필요한 정보</p>
              <p className="font-medium text-foreground mt-2 mb-1">2. 수집·이용 목적</p>
              <p>기술이전(실시) 신청서 작성·생성 및 제출, 신청 접수·심사·계약 체결 및 관련 안내</p>
              <p className="font-medium text-foreground mt-2 mb-1">3. 보유·이용 기간</p>
              <p>본 서비스는 입력 데이터를 서버에 저장하지 않으며, 생성된 엑셀 파일은 사용자의 단말기에만 저장됩니다. 신청서를 제출한 기관의 보유·이용 기간은 해당 기관의 개인정보 처리방침을 따릅니다.</p>
              <p className="font-medium text-foreground mt-2 mb-1">4. 동의 거부 권리 및 불이익</p>
              <p>위 개인정보 수집·이용에 동의하지 않으실 수 있으며, 다만 동의하지 않으실 경우 신청서 생성이 제한됩니다.</p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <span className="text-sm text-foreground">위 개인정보 수집·이용 내용을 확인하였으며 이에 <strong>동의합니다.</strong> (필수)</span>
            </label>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setF(initial)}>초기화</Button>
            <Button onClick={handleGenerate} disabled={generating || !agreed} className="gap-2">
              <Download className="w-4 h-4" />
              {generating ? "생성 중..." : "신청서 엑셀 다운로드"}
            </Button>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}