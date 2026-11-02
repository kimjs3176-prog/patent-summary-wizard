import { BookOpen } from "lucide-react";

const steps = [
  { num: 1, title: "이전 기술 탐색", desc: "KIPRIS·NATI에서 관심 기술을 검색합니다." },
  { num: 2, title: "신청서 제출", desc: "NATI에서 신청서 작성 후 서류를 첨부합니다." },
  { num: 3, title: "검토 및 접수", desc: "보완 사항 발생 시 개별 통보 후 재접수합니다." },
  { num: 4, title: "신청서 결재", desc: "발명자·기관·지식재산처의 이전 사항을 검토합니다." },
  { num: 5, title: "계약 체결", desc: "기술이전 승인 및 전자계약을 체결합니다." },
  { num: 6, title: "정산 · 납부", desc: "계약 종료 후 기술료를 정산·납부합니다." },
];

export function TechTransferGuide() {
  return (
    <section className="w-full">
      <div className="mb-6 md:mb-8">
        <h3 className="flex items-center gap-2 text-lg sm:text-xl md:text-2xl font-bold text-foreground">
          <BookOpen className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
          국가직무발명특허 기술이전 6단계
        </h3>
        <p className="mt-2 text-[13px] sm:text-sm text-muted-foreground leading-relaxed max-w-xl">
          국가 명의로 등록된 특허를 실시권 허락(라이센싱) 형태로 이전하는 절차입니다.
        </p>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0 sm:gap-y-1">
        {steps.map((step) => (
          <li
            key={step.num}
            className="flex items-start gap-3 py-3.5 border-t border-border/50"
          >
            <span className="mt-px w-4 shrink-0 text-[14px] font-bold tabular-nums text-primary">
              {step.num}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-foreground leading-snug">{step.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{step.desc}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-[12px] text-muted-foreground">
        자세한 내용은{" "}
        <a href="https://www.nati.or.kr" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline font-medium">NATI</a>
        {"와 "}
        <a href="https://www.kipris.or.kr" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline font-medium">KIPRIS</a>
        를 참고하세요.
      </p>
    </section>
  );
}
