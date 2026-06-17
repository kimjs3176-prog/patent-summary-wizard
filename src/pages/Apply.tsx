import { useRef, useState } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download, FileText } from "lucide-react";

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
  receiptNo: string;
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
  mobile: string;
  postalCode: string;
  address: string;
  estimate: string;
  sharePct: string;
  companyName: string;
  established: string;
  ownerKind: OwnerKind;
  businessNo: string;
  corporateNo: string;
  representative: string;
  industry: string;
  businessItem: string;
  hqAddress: string;
  phone: string;
  fax: string;
  plan: string;
  postalCode2: string;
  homepage: string;
  products: string;
}

const initial: FormState = {
  category: "국유-농진청",
  categoryAction: "출원",
  caseType: "국내",
  rightType: "특허",
  receiptNo: "",
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
  mobile: "",
  postalCode: "",
  address: "",
  estimate: "0",
  sharePct: "0.0",
  companyName: "",
  established: "",
  ownerKind: "",
  businessNo: "",
  corporateNo: "",
  representative: "",
  industry: "",
  businessItem: "",
  hqAddress: "",
  phone: "",
  fax: "",
  plan: "",
  postalCode2: "",
  homepage: "",
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

export default function Apply() {
  const [f, setF] = useState<FormState>(initial);
  const [generating, setGenerating] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }));

  const handleGenerate = async () => {
    if (!sheetRef.current) return;
    if (!f.applicant.trim() || !f.companyName.trim()) {
      toast.error("신청자와 회사명은 필수입니다");
      return;
    }
    setGenerating(true);
    try {
      // Make sheet temporarily visible offscreen-friendly
      const node = sheetRef.current;
      node.style.display = "block";
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      node.style.display = "none";

      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 10;
      const imgH = (canvas.height * imgW) / canvas.width;
      const finalH = Math.min(imgH, pageH - 10);
      const finalW = (canvas.width * finalH) / canvas.height;
      const x = (pageW - Math.min(imgW, finalW)) / 2;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, 5, Math.min(imgW, finalW), Math.min(imgH, finalH));
      const fileName = `기술이전신청서_${f.companyName || "신청"}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);
      toast.success("신청서가 생성되었습니다");
    } catch (e) {
      console.error(e);
      toast.error("PDF 생성에 실패했습니다");
    } finally {
      setGenerating(false);
    }
  };

  const cellStyle: React.CSSProperties = {
    border: "1px solid #555",
    padding: "4px 6px",
    fontSize: 11,
    verticalAlign: "middle",
    color: "#000",
    background: "#fff",
  };
  const labelCell: React.CSSProperties = {
    ...cellStyle,
    background: "#e8e8e8",
    textAlign: "center",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
  const dot = (on: boolean) => (on ? "●" : "○");
  const chk = (on: boolean) => (on ? "■" : "□");

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
            입력 정보를 바탕으로 기술이전(실시) 신청서 PDF 파일을 생성합니다. 입력 데이터는 저장되지 않습니다.
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
              <Field label="접수번호"><Input value={f.receiptNo} onChange={(e) => upd("receiptNo", e.target.value)} placeholder="TTMS-2026-0042" /></Field>
              <Field label="출원번호"><Input value={f.applicationNo} onChange={(e) => upd("applicationNo", e.target.value)} /></Field>
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
              <Field label="견적금액 (원)"><Input type="number" value={f.estimate} onChange={(e) => upd("estimate", e.target.value)} /></Field>
              <Field label="점유율 (%)"><Input type="number" step="0.1" value={f.sharePct} onChange={(e) => upd("sharePct", e.target.value)} /></Field>
            </div>
          </section>

          {/* 계약 신청 정보 */}
          <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold mb-4 text-foreground/90">계약 신청 정보</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="신청자" required><Input value={f.applicant} onChange={(e) => upd("applicant", e.target.value)} /></Field>
              <Field label="이메일"><Input type="email" value={f.email} onChange={(e) => upd("email", e.target.value)} /></Field>
              <Field label="연락처"><Input value={f.contact} onChange={(e) => upd("contact", e.target.value)} /></Field>
              <Field label="휴대폰"><Input value={f.mobile} onChange={(e) => upd("mobile", e.target.value)} /></Field>
              <Field label="우편번호"><Input value={f.postalCode} onChange={(e) => upd("postalCode", e.target.value)} /></Field>
              <div className="sm:col-span-2 md:col-span-3">
                <Field label="주소"><Input value={f.address} onChange={(e) => upd("address", e.target.value)} /></Field>
              </div>
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
              <Field label="업태"><Input value={f.industry} onChange={(e) => upd("industry", e.target.value)} /></Field>
              <Field label="업종"><Input value={f.businessItem} onChange={(e) => upd("businessItem", e.target.value)} /></Field>
              <Field label="전화번호"><Input value={f.phone} onChange={(e) => upd("phone", e.target.value)} /></Field>
              <Field label="FAX"><Input value={f.fax} onChange={(e) => upd("fax", e.target.value)} /></Field>
              <div className="sm:col-span-2 md:col-span-3">
                <Field label="본사 주소"><Input value={f.hqAddress} onChange={(e) => upd("hqAddress", e.target.value)} /></Field>
              </div>
              <div className="sm:col-span-2 md:col-span-3">
                <Field label="사업화 추진 계획"><Input value={f.plan} onChange={(e) => upd("plan", e.target.value)} /></Field>
              </div>
              <Field label="홈페이지"><Input value={f.homepage} onChange={(e) => upd("homepage", e.target.value)} /></Field>
              <Field label="생산품목"><Input value={f.products} onChange={(e) => upd("products", e.target.value)} /></Field>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setF(initial)}>초기화</Button>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              <Download className="w-4 h-4" />
              {generating ? "생성 중..." : "신청서 PDF 다운로드"}
            </Button>
          </div>
        </div>

        {/* Hidden printable sheet — matches the reference form layout */}
        <div style={{ position: "fixed", left: -99999, top: 0, display: "none" }}>
          <div ref={sheetRef} style={{ width: 1400, padding: 24, background: "#fff", color: "#000", fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif" }}>
            <h2 style={{ textAlign: "center", fontSize: 22, fontWeight: 700, marginBottom: 16, letterSpacing: 4 }}>기술이전(실시) 신청서</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 90 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 120 }} />
              </colgroup>
              <tbody>
                <tr>
                  <td style={labelCell}>구분</td>
                  <td colSpan={8} style={cellStyle}>
                    {CATS.map((c) => (
                      <span key={c} style={{ marginRight: 14 }}>
                        {dot(f.category === c)} {c} {chk(f.category === c && f.categoryAction === "출원")} 출원 {chk(f.category === c && f.categoryAction === "등록")} 등록
                      </span>
                    ))}
                  </td>
                  <td style={labelCell}>회사명</td>
                  <td style={cellStyle}>{f.companyName}</td>
                </tr>
                <tr>
                  <td rowSpan={5} style={labelCell}>관련<br />특허<br />정보</td>
                  <td style={labelCell}>사건구분</td>
                  <td style={cellStyle}>{f.caseType}</td>
                  <td style={labelCell}>권리</td>
                  <td style={cellStyle}>{f.rightType}</td>
                  <td style={labelCell}>접수번호</td>
                  <td style={cellStyle}>{f.receiptNo}</td>
                  <td style={labelCell}>출원번호</td>
                  <td style={cellStyle}>{f.applicationNo}</td>
                  <td style={labelCell}>설립년월일</td>
                  <td style={cellStyle}>{f.established} <span style={{ marginLeft: 12 }}>소유: {f.ownerKind}</span></td>
                </tr>
                <tr>
                  <td style={labelCell}>등록번호</td>
                  <td style={cellStyle}>{f.registrationNo}</td>
                  <td style={labelCell}>발명기관</td>
                  <td colSpan={5} style={cellStyle}>{f.inventionOrg}</td>
                  <td style={labelCell}>사업자등록번호</td>
                  <td style={cellStyle}>{f.businessNo}</td>
                </tr>
                <tr>
                  <td style={labelCell}>발명의 명칭</td>
                  <td colSpan={6} style={cellStyle}>{f.inventionTitle}</td>
                  <td style={labelCell}>법인등록번호</td>
                  <td style={cellStyle}>{f.corporateNo}</td>
                  <td style={labelCell}>대표자</td>
                  <td style={cellStyle}>{f.representative}</td>
                </tr>
                <tr>
                  <td style={labelCell}>발명자</td>
                  <td colSpan={3} style={cellStyle}>{f.inventor}</td>
                  <td style={labelCell}>전화번호</td>
                  <td colSpan={3} style={cellStyle}>{f.inventorPhone}</td>
                  <td style={labelCell}>업태</td>
                  <td style={cellStyle}>{f.industry}</td>
                  <td style={labelCell}>업종</td>
                </tr>
                <tr>
                  <td style={labelCell}>출원인</td>
                  <td colSpan={3} style={cellStyle}>{f.applicantOrg}</td>
                  <td style={labelCell}>등록권리자</td>
                  <td colSpan={3} style={cellStyle}>{f.registrantHolder}</td>
                  <td colSpan={2} style={cellStyle}>{f.businessItem}</td>
                  <td style={cellStyle}></td>
                </tr>

                <tr>
                  <td rowSpan={6} style={labelCell}>실시<br />신청<br />내용</td>
                  <td style={labelCell}>계약의 종류</td>
                  <td colSpan={3} style={cellStyle}>
                    {dot(f.contractKind === "신규")} 신규 {dot(f.contractKind === "재계약")} 재계약 {dot(f.contractKind === "자동재계약")} 자동재계약
                  </td>
                  <td rowSpan={6} style={labelCell}>계약<br />신청<br />정보</td>
                  <td style={labelCell}>신청자</td>
                  <td style={cellStyle}>{f.applicant}</td>
                  <td style={labelCell}>이메일</td>
                  <td colSpan={2} style={cellStyle}>{f.email}</td>
                </tr>
                <tr>
                  <td style={labelCell}>처분의 종류</td>
                  <td colSpan={3} style={cellStyle}>
                    {dot(f.dispoKind === "통상실시")} 통상실시 {dot(f.dispoKind === "전용실시")} 전용실시 {dot(f.dispoKind === "양도")} 양도
                  </td>
                  <td style={labelCell}>연락처</td>
                  <td style={cellStyle}>{f.contact}</td>
                  <td style={labelCell}>휴대폰</td>
                  <td colSpan={2} style={cellStyle}>{f.mobile}</td>
                </tr>
                <tr>
                  <td style={labelCell}>유무상 여부</td>
                  <td colSpan={3} style={cellStyle}>
                    {dot(f.payKind.startsWith("유상"))} 유상 ({chk(f.payKind === "유상-선납(경상)")} 선납(경상) {chk(f.payKind === "유상-선납(정액)")} 선납(정액)) {dot(f.payKind === "무상")} 무상
                  </td>
                  <td style={labelCell}>우편번호</td>
                  <td colSpan={4} style={cellStyle}>{f.postalCode}</td>
                </tr>
                <tr>
                  <td style={labelCell}>실시 기간</td>
                  <td colSpan={3} style={cellStyle}>{f.periodStart} ~ {f.periodEnd}</td>
                  <td style={labelCell}>주소</td>
                  <td colSpan={4} style={cellStyle}>{f.address}</td>
                </tr>
                <tr>
                  <td style={labelCell}>실시 지역</td>
                  <td colSpan={3} style={cellStyle}>{f.region}</td>
                  <td style={labelCell}>본사 주소</td>
                  <td colSpan={4} style={cellStyle}>{f.hqAddress}</td>
                </tr>
                <tr>
                  <td style={labelCell}>실시 내용</td>
                  <td colSpan={3} style={cellStyle}>{f.scope}</td>
                  <td style={labelCell}>견적금액</td>
                  <td style={cellStyle}>{Number(f.estimate || 0).toLocaleString()}</td>
                  <td style={labelCell}>점유율</td>
                  <td colSpan={2} style={cellStyle}>{f.sharePct}</td>
                </tr>

                <tr>
                  <td colSpan={5} style={labelCell}>사업화 추진 계획</td>
                  <td colSpan={6} style={cellStyle}>{f.plan}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={labelCell}>전화번호</td>
                  <td colSpan={2} style={cellStyle}>{f.phone}</td>
                  <td style={labelCell}>FAX</td>
                  <td colSpan={2} style={cellStyle}>{f.fax}</td>
                  <td style={labelCell}>홈페이지</td>
                  <td colSpan={3} style={cellStyle}>{f.homepage}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={labelCell}>생산품목</td>
                  <td colSpan={9} style={cellStyle}>{f.products}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 28, fontSize: 12, lineHeight: 1.8 }}>
              <p>위와 같이 기술이전(실시)을 신청합니다.</p>
              <p style={{ textAlign: "center", marginTop: 16, fontSize: 14 }}>
                {new Date().getFullYear()}년 {new Date().getMonth() + 1}월 {new Date().getDate()}일
              </p>
              <p style={{ textAlign: "right", marginTop: 12 }}>신청자: {f.applicant} (인)</p>
            </div>
          </div>
        </div>
      </main>
    </PageLayout>
  );
}