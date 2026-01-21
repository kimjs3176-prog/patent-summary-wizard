import { FileText, Sparkles, Shield, Zap } from "lucide-react";
import { PatentInput } from "@/components/PatentInput";
import { PatentSummary } from "@/components/PatentSummary";
import { usePatentSummary } from "@/hooks/usePatentSummary";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { isLoading, summary, currentPatent, generateSummary, reset } = usePatentSummary();

  const features = [
    {
      icon: Zap,
      title: "빠른 요약",
      description: "AI가 몇 초 만에 핵심 내용을 추출합니다",
    },
    {
      icon: FileText,
      title: "1페이지 포맷",
      description: "깔끔하게 정리된 요약서를 제공합니다",
    },
    {
      icon: Shield,
      title: "정확한 분석",
      description: "기술 분야별 전문 분석을 제공합니다",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="w-full border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground">특허요약</h1>
              <p className="text-xs text-muted-foreground">Patent Summary</p>
            </div>
          </div>
          {(summary || isLoading) && (
            <Button variant="outline" size="sm" onClick={reset}>
              새로운 특허 검색
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {!summary && !isLoading ? (
          <>
            {/* Hero Section */}
            <section className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent mb-6 animate-fade-up">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">AI 기반 특허 분석</span>
              </div>
              
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
                한국 특허
                <span className="gradient-text block">1페이지 요약 서비스</span>
              </h2>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: "0.2s" }}>
                특허 등록번호만 입력하면 AI가 핵심 내용을 분석하여
                <br className="hidden sm:block" />
                깔끔한 1페이지 요약서를 생성해 드립니다.
              </p>
            </section>

            {/* Input Section */}
            <section className="mb-20" style={{ animationDelay: "0.3s" }}>
              <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
            </section>

            {/* Features */}
            <section className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className="p-6 rounded-2xl bg-card border border-border/50 shadow-card hover:shadow-glow transition-all duration-300 animate-fade-up"
                  style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </section>
          </>
        ) : (
          <>
            {/* Summary Section */}
            <section className="mb-8">
              <PatentSummary
                content={summary}
                patentNumber={currentPatent}
                isStreaming={isLoading}
              />
            </section>

            {/* Loading Input for new search during streaming */}
            {isLoading && (
              <section className="mt-12">
                <PatentInput onSubmit={generateSummary} isLoading={isLoading} />
              </section>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>© 2025 특허요약 서비스. AI 기반 특허 분석 솔루션.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
