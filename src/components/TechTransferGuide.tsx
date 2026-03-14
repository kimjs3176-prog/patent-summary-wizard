import { Search, FileEdit, ClipboardCheck, Stamp, Handshake, Wallet } from "lucide-react";

const steps = [
  { num: 1, icon: Search, title: "이전 기술 탐색", desc: "KIPRIS, NATI 등에서 관심 기술을 검색하고 유망기술 자료집을 참고하세요." },
  { num: 2, icon: FileEdit, title: "기술이전 신청서 제출", desc: "NATI 사이트에서 신청서를 작성하고 필요 서류를 첨부하세요." },
  { num: 3, icon: ClipboardCheck, title: "신청서 검토 및 접수", desc: "서류 수정·보완 사항 발생 시 개별통보 후 재접수합니다." },
  { num: 4, icon: Stamp, title: "신청서 결재", desc: "발명자·발명기관·특허청의 기술이전 사항을 검토합니다." },
  { num: 5, icon: Handshake, title: "계약 체결", desc: "기술이전 승인 및 전자계약을 체결합니다." },
  { num: 6, icon: Wallet, title: "정산/실시료 납부", desc: "계약기간 종료 후 회계법인 통해 기술료를 정산 및 납부합니다." },
];

export function TechTransferGuide() {
  return (
    <section className="max-w-5xl mx-auto mt-12 md:mt-16 mb-8">
      <div className="mb-8 md:mb-10">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
          기술이전 절차 안내
        </p>
        <h3 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
          국가직무발명특허 <span className="gradient-text">기술이전</span>이란?
        </h3>
        <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-xl leading-relaxed">
          국가공무원의 직무발명에 따라 국가 명의로 출원하여 등록된 권리(특허)를{" "}
          <strong className="text-foreground font-medium">'실시권 허락(라이센싱 계약)'</strong>의 형태로 이전하는 것
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="group rounded-2xl p-5 md:p-6 bg-card/80 backdrop-blur-sm border border-border/30 hover:bg-card hover:border-border/50 hover:shadow-lg transition-all duration-300 animate-fade-up"
              style={{ animationDelay: `${0.06 * step.num}s`, boxShadow: 'var(--shadow-glossy)' }}
            >
              <div className="flex items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
                    <Icon className="w-4 h-4 text-background" />
                  </div>
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                    {step.num}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-foreground mb-1">{step.title}</h4>
                  <p className="text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-center mt-6 text-xs text-muted-foreground">
        자세한 내용은{" "}
        <a href="https://www.nati.or.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">NATI</a>
        {" "}또는{" "}
        <a href="https://www.kipris.or.kr" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">KIPRIS</a>
        를 참고하세요.
      </p>
    </section>
  );
}