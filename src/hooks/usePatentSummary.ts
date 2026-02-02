import { useState, useCallback } from "react";
import { toast } from "sonner";
import { PatentData, RelatedPatent } from "@/components/PatentSummary/types";

export function usePatentSummary() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [summary, setSummary] = useState("");
  const [currentPatent, setCurrentPatent] = useState("");
  const [patentData, setPatentData] = useState<PatentData | null>(null);
  const [relatedPatents, setRelatedPatents] = useState<RelatedPatent[]>([]);

  const generateSummary = useCallback(async (patentNumber: string) => {
    setIsLoading(true);
    setIsFetching(true);
    setSummary("");
    setPatentData(null);
    setRelatedPatents([]);
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
        
        // Set related patents if available
        if (fetchResult.relatedPatents && fetchResult.relatedPatents.length > 0) {
          setRelatedPatents(fetchResult.relatedPatents);
        }
        
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
      
      // Return the generated data for history saving
      return {
        summary: fullContent,
        patentData: fetchedPatentData,
        relatedPatents: relatedPatents,
      };
    } catch (error) {
      console.error("Patent summary error:", error);
      toast.error(error instanceof Error ? error.message : "오류가 발생했습니다.");
      setSummary("");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [relatedPatents]);

  const loadFromHistory = useCallback((historyItem: {
    summary: string;
    patentData: PatentData;
    relatedPatents: RelatedPatent[];
    patentNumber: string;
  }) => {
    setSummary(historyItem.summary);
    setPatentData(historyItem.patentData);
    setRelatedPatents(historyItem.relatedPatents);
    setCurrentPatent(historyItem.patentNumber);
  }, []);

  const reset = useCallback(() => {
    setSummary("");
    setCurrentPatent("");
    setPatentData(null);
    setRelatedPatents([]);
  }, []);

  return {
    isLoading,
    isFetching,
    summary,
    currentPatent,
    patentData,
    relatedPatents,
    generateSummary,
    loadFromHistory,
    reset,
  };
}
