import { useMemo, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TrendSnapshot } from "@/hooks/useFilingTrends";
import { buildInsightsTables, combinedCsvRows, exportFileName, snapshotNote, tableToAoa, toCsv, type Cell, type ExportTable } from "./insightsExport";

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const saveCsv = (rows: Cell[][], name: string) => saveBlob(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }), name);

async function saveXlsx(data: TrendSnapshot, tables: ExportTable[], note: string[]) {
  // Loaded on demand so the spreadsheet writer stays out of the page's initial chunk.
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  for (const t of tables) {
    const ws = XLSX.utils.aoa_to_sheet(tableToAoa(t, note));
    ws["!cols"] = t.widths.map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, t.name);
  }
  XLSX.writeFile(wb, exportFileName(data, "", "xlsx"));
}

/** "데이터 내려받기": one XLSX with a sheet per table, or one CSV per table. */
export function InsightsDownload({ data }: { data: TrendSnapshot }) {
  const [busy, setBusy] = useState(false);
  const tables = useMemo(() => buildInsightsTables(data), [data]);
  const note = useMemo(() => snapshotNote(data), [data]);

  const downloadXlsx = async () => {
    setBusy(true);
    try {
      await saveXlsx(data, tables, note);
    } catch {
      saveCsv(combinedCsvRows(tables, note), exportFileName(data, "전체", "csv"));
      toast.info("엑셀 파일을 만들 수 없어 CSV 파일 하나로 내려받았어요.");
    } finally {
      setBusy(false);
    }
  };

  const downloadCsv = (t: ExportTable) => saveCsv(tableToAoa(t, note), exportFileName(data, t.name, "csv"));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full gap-1.5 h-8" disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          데이터 내려받기
          <ChevronDown className="w-3.5 h-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">{data.completeYear}년 기준 · 집계 기간 전체</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void downloadXlsx()} className="gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          <span>엑셀 파일 <span className="text-muted-foreground">(표 {tables.length}개, 시트별)</span></span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-medium text-muted-foreground">CSV (표별 파일)</DropdownMenuLabel>
        {tables.map((t) => (
          <DropdownMenuItem key={t.name} onSelect={() => downloadCsv(t)} className="gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />{t.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
