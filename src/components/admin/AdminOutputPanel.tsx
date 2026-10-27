import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Save, Loader2, ToggleLeft, ToggleRight, FileDown, Printer } from "lucide-react";
import { PdfLayoutSettings, type PdfLayoutConfig } from "@/components/admin/PdfLayoutSettings";
import type { Dispatch, SetStateAction } from "react";

interface AdminOutputPanelProps {
  printSections: Record<string, boolean>;
  setPrintSections: Dispatch<SetStateAction<Record<string, boolean>>>;
  isSavingPrintSettings: boolean;
  pdfLayoutConfig: PdfLayoutConfig;
  apiCall: (action: string, data?: Record<string, unknown>) => Promise<any>;
  handleSavePrintSettings: () => Promise<void>;
}

export function AdminOutputPanel({ printSections, setPrintSections, isSavingPrintSettings, pdfLayoutConfig, apiCall, handleSavePrintSettings }: AdminOutputPanelProps) {
  return (
          <TabsContent value="output">
            <Accordion type="multiple" defaultValue={["print"]} className="space-y-3">
              <AccordionItem value="print" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><Printer className="w-4 h-4 text-primary" /> 인쇄 설정</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    <p className="text-[11px] text-muted-foreground">저장 후 인쇄 시 선택한 항목만 포함됩니다.</p>
                    <div className="space-y-3">
                      {[
                        { key: "header", label: "인쇄 헤더", desc: "출력 상단 제목/번호 영역" },
                        { key: "patentInfo", label: "특허 정보 카드", desc: "등록번호/출원인/날짜 정보" },
                        { key: "commercialization", label: "사업화 점수", desc: "종합 점수 및 상세 분석" },
                        { key: "aiSummary", label: "AI 종합 요약", desc: "본문 요약 텍스트 영역" },
                        { key: "trl", label: "TRL 섹션", desc: "기술 성숙도 차트 영역" },
                        { key: "claims", label: "청구항", desc: "청구항 카드(화면에는 항상 표시)" },
                        { key: "relatedPatents", label: "관련 특허", desc: "추천 특허 리스트" },
                        { key: "disclaimer", label: "면책 문구", desc: "요약 하단 주의 문구" },
                        { key: "footer", label: "인쇄 푸터", desc: "생성일 및 하단 문구" },
                      ].map((item) => {
                        const isOn = printSections[item.key] !== false;
                        return (
                          <div key={item.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/30">
                            <div>
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                            </div>
                            <button onClick={() => setPrintSections((prev) => ({ ...prev, [item.key]: !isOn }))} className="flex-shrink-0">
                              {isOn ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <Button onClick={handleSavePrintSettings} disabled={isSavingPrintSettings} className="w-full">
                      {isSavingPrintSettings ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                      인쇄 설정 저장
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="pdf" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-semibold gap-2">
                  <span className="flex items-center gap-2"><FileDown className="w-4 h-4 text-primary" /> PDF 레이아웃</span>
                </AccordionTrigger>
                <AccordionContent>
                  <PdfLayoutSettings apiCall={apiCall} initialConfig={pdfLayoutConfig} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
  );
}
