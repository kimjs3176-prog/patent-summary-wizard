import { useState } from "react";
import { Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
interface PatentInputProps {
  onSubmit: (patentNumber: string) => void;
  isLoading: boolean;
}
export function PatentInput({
  onSubmit,
  isLoading
}: PatentInputProps) {
  const [patentNumber, setPatentNumber] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (patentNumber.trim()) {
      onSubmit(patentNumber.trim());
    }
  };
  const examplePatents = ["10-1234567", "10-2023-0012345", "10-0987654"];
  return <div className="w-full max-w-2xl mx-auto animate-fade-up">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <Input type="text" placeholder="특허 등록번호를 입력하세요 (예: 10-1234567)" value={patentNumber} onChange={e => setPatentNumber(e.target.value)} className="pl-12 pr-4 py-6 text-lg bg-card border-border/50 focus:border-accent shadow-card transition-all duration-300 placeholder:text-muted-foreground/60" disabled={isLoading} />
        </div>
        
        <Button type="submit" disabled={!patentNumber.trim() || isLoading} className="w-full py-6 text-lg font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300">
          {isLoading ? <span className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              요약서 생성 중...
            </span> : <span className="flex items-center gap-2">1페이지 요약서 생성<Search className="w-5 h-5" />
              1페이지 요약서 생성
            </span>}
        </Button>
      </form>

      <div className="mt-6 text-center">
        
        <div className="flex flex-wrap justify-center gap-2">
          {examplePatents.map(patent => {})}
        </div>
      </div>
    </div>;
}