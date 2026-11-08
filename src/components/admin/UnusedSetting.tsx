import type { ReactNode } from "react";

/**
 * 지금 요약서(데이터시트형)·인쇄·점수 계산이 읽지 않는 설정 칸.
 * 바꿔도 반영되지 않는다는 것을 알리고 입력을 잠근다(저장된 값은 그대로 둔다). 칸과 설정값 정리는 대회 뒤에 한다.
 */
export function UnusedSetting({ note, children }: { note?: string; children: ReactNode }) {
  return (
    <div data-unused-setting>
      <p className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        <UnusedBadge />
        {note ?? "지금 요약서 화면과 인쇄에는 반영되지 않습니다."}
      </p>
      <fieldset disabled className="min-w-0 opacity-60 pointer-events-none">
        {children}
      </fieldset>
    </div>
  );
}

export function UnusedBadge() {
  return <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">현재 쓰지 않음</span>;
}
