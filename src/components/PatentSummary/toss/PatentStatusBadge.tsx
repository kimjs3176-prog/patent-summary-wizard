import type { PatentSummaryProps as BasePatentSummaryProps } from "../types";
import { getPatentStatus } from "./helpers";

export function PatentStatusBadge({ data }: { data?: BasePatentSummaryProps["patentData"] }) {
  const status = getPatentStatus(data);
  return (
    <span className={`report-status report-status-${status.tone}`} aria-label={`특허 상태 ${status.label}`}>
      <span aria-hidden="true" />
      {status.label}
    </span>
  );
}

