import { useState, useCallback } from "react";
import { toast } from "sonner";

interface PatentData {
  title?: string;
  abstract?: string;
  inventors?: string[];
  assignee?: string;
  filingDate?: string;
  publicationDate?: string;
  claims?: string[];
  patentNumber?: string;
  applicationNumber?: string;
  classifications?: string[];
  description?: string;
}

export function usePatentSummary() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [summary, setSummary] = useState("");
  const [currentPatent, setCurrentPatent] = useState("");
  const [patentData, setPatentData] = useState<PatentData | null>(null);

  const generateSummary = useCallback(async (patentNumber: string) => {
    setIsLoading(true);
    setIsFetching(true);
    setSummary("");
    setPatentData(null);
    setCurrentPatent(patentNumber);

    let fetchedPatentData: PatentData | null = null;

    // Step 1: Fetch patent data from Google Patents via SerpApi
    try {
      toast.info("Google Patents에서 특허 정보를 조회 중...");
      
      const fetchResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-patent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ patentNumber }),
        }
      );

      const fetchResult = await fetchResponse.json();

      if (fetchResult.success && fetchResult.data) {
        fetchedPatentData = fetchResult.data;
        setPatentData(fetchedPatentData);
        toast.success("특허 정보를 성공적으로 가져왔습니다!");
      } else {
        toast.warning(fetchResult.error || "특허 정보를 가져올 수 없어 일반 요약을 생성합니다.");
      }
    } catch (fetchError) {
      console.error("Patent fetch error:", fetchError);
      toast.warning("특허 정보 조회 실패. 일반 요약을 생성합니다.");
    }

    setIsFetching(false);

    // Step 2: Generate AI summary with patent data
    try {
      toast.info("AI 요약서를 생성 중...");
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-patent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            patentNumber,
            patentData: fetchedPatentData 
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "요약서 생성에 실패했습니다.");
      }

      if (!response.body) {
        throw new Error("스트리밍 응답을 받을 수 없습니다.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setSummary(fullContent);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      toast.success("요약서가 생성되었습니다!");
    } catch (error) {
      console.error("Patent summary error:", error);
      toast.error(error instanceof Error ? error.message : "오류가 발생했습니다.");
      setSummary("");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSummary("");
    setCurrentPatent("");
    setPatentData(null);
  }, []);

  return {
    isLoading,
    isFetching,
    summary,
    currentPatent,
    patentData,
    generateSummary,
    reset,
  };
}
