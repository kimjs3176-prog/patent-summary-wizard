import { useState, useCallback } from "react";
import { toast } from "sonner";

export function usePatentSummary() {
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [currentPatent, setCurrentPatent] = useState("");

  const generateSummary = useCallback(async (patentNumber: string) => {
    setIsLoading(true);
    setSummary("");
    setCurrentPatent(patentNumber);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/summarize-patent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ patentNumber }),
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
  }, []);

  return {
    isLoading,
    summary,
    currentPatent,
    generateSummary,
    reset,
  };
}
