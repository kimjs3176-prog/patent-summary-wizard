import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, X, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavoritePatents, FavoritePatent } from "@/hooks/useFavoritePatents";

function getScoreColor(value: number): string {
  if (value >= 80) return "text-emerald-500";
  if (value >= 60) return "text-blue-500";
  if (value >= 40) return "text-amber-500";
  return "text-red-500";
}

function getGradeLabel(value: number): string {
  if (value >= 90) return "S";
  if (value >= 80) return "A";
  if (value >= 70) return "B";
  if (value >= 60) return "C";
  if (value >= 50) return "D";
  return "F";
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const bgColor = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-blue-500" : score >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}점</span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${bgColor} transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export default function Compare() {
  const { favorites } = useFavoritePatents();
  const [selected, setSelected] = useState<string[]>([]);

  const selectedPatents = useMemo(
    () => selected.map((n) => favorites.find((f) => f.patentNumber === n)).filter(Boolean) as FavoritePatent[],
    [selected, favorites]
  );

  const toggleSelect = (patentNumber: string) => {
    setSelected((prev) => {
      if (prev.includes(patentNumber)) return prev.filter((n) => n !== patentNumber);
      if (prev.length >= 4) return prev;
      return [...prev, patentNumber];
    });
  };

  const removeFromCompare = (patentNumber: string) => {
    setSelected((prev) => prev.filter((n) => n !== patentNumber));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[hsl(174_60%_90%/0.2)] blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[hsl(210_80%_92%/0.15)] blur-[100px]" />
      </div>

      <header className="w-full bg-background/60 backdrop-blur-xl sticky top-0 z-50 border-b border-border/30">
        <div className="container mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> 홈으로
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <GitCompareArrows className="w-5 h-5 text-primary" />
            <h1 className="font-semibold text-base text-foreground">특허 비교</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 relative z-10">
        {favorites.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">관심특허가 없습니다. 먼저 특허를 검색하고 관심특허에 담아주세요.</p>
            <Link to="/"><Button>홈으로 돌아가기</Button></Link>
          </div>
        ) : (
          <>
            {/* Selection */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-3">비교할 특허 선택 (최대 4개)</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {favorites.map((f) => {
                  const isSelected = selected.includes(f.patentNumber);
                  return (
                    <button
                      key={f.patentNumber}
                      onClick={() => toggleSelect(f.patentNumber)}
                      className={`text-left p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/50 bg-card/50 hover:border-border"
                      } ${!isSelected && selected.length >= 4 ? "opacity-40 cursor-not-allowed" : ""}`}
                      disabled={!isSelected && selected.length >= 4}
                    >
                      <p className="text-xs text-muted-foreground mb-1">{f.patentNumber}</p>
                      <p className="text-sm font-medium line-clamp-2">{f.patentData.titleKo || f.patentData.title || "제목 없음"}</p>
                      {f.commercializationScore != null && (
                        <span className={`text-xs font-bold mt-1 inline-block ${getScoreColor(f.commercializationScore)}`}>
                          사업화 {f.commercializationScore}점
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Comparison Table */}
            {selectedPatents.length >= 2 && (
              <section className="animate-fade-up">
                <h2 className="text-lg font-semibold mb-4">비교 결과</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-muted-foreground font-medium p-3 border-b border-border/50 w-32">항목</th>
                        {selectedPatents.map((p) => (
                          <th key={p.patentNumber} className="text-left p-3 border-b border-border/50 min-w-[200px]">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs text-muted-foreground">{p.patentNumber}</p>
                                <p className="text-sm font-semibold line-clamp-2 mt-0.5">{p.patentData.titleKo || p.patentData.title}</p>
                              </div>
                              <button onClick={() => removeFromCompare(p.patentNumber)} className="text-muted-foreground hover:text-foreground shrink-0">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* 출원인 */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">출원인</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 text-sm border-b border-border/30">{p.patentData.assignee || "-"}</td>
                        ))}
                      </tr>
                      {/* 발명자 */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">발명자</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 text-sm border-b border-border/30">{p.patentData.inventors?.join(", ") || "-"}</td>
                        ))}
                      </tr>
                      {/* 출원일 */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">출원일</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 text-sm border-b border-border/30">{p.patentData.filingDate || "-"}</td>
                        ))}
                      </tr>
                      {/* IPC */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">IPC 분류</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 border-b border-border/30">
                            <div className="flex flex-wrap gap-1">
                              {p.patentData.classifications?.length ? (
                                p.patentData.classifications.map((c, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground">{c}</span>
                                ))
                              ) : <span className="text-sm text-muted-foreground">-</span>}
                            </div>
                          </td>
                        ))}
                      </tr>
                      {/* TRL */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">TRL (기술성숙도)</td>
                        {selectedPatents.map((p) => {
                          const trl = p.commercializationDetails?.trl;
                          return (
                            <td key={p.patentNumber} className="p-3 border-b border-border/30">
                              {trl != null ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{trl}</div>
                                  <div className="flex-1">
                                    <div className="flex gap-0.5">
                                      {[1,2,3,4,5,6,7,8,9].map((l) => (
                                        <div key={l} className={`flex-1 h-1.5 rounded-full ${l <= trl ? "bg-primary" : "bg-muted"}`} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              ) : <span className="text-sm text-muted-foreground">-</span>}
                            </td>
                          );
                        })}
                      </tr>
                      {/* 사업화 총점 */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">사업화 총점</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 border-b border-border/30">
                            {p.commercializationScore != null ? (
                              <div className="flex items-center gap-2">
                                <span className={`text-2xl font-black ${getScoreColor(p.commercializationScore)}`}>{p.commercializationScore}</span>
                                <span className={`text-lg font-bold ${getScoreColor(p.commercializationScore)}`}>{getGradeLabel(p.commercializationScore)}</span>
                              </div>
                            ) : <span className="text-sm text-muted-foreground">-</span>}
                          </td>
                        ))}
                      </tr>
                      {/* 기술성 */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">기술성</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 border-b border-border/30">
                            {p.commercializationDetails?.technologyScore != null ? (
                              <ScoreBar score={p.commercializationDetails.technologyScore} label="" />
                            ) : <span className="text-sm text-muted-foreground">-</span>}
                          </td>
                        ))}
                      </tr>
                      {/* 시장성 */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">시장성</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 border-b border-border/30">
                            {p.commercializationDetails?.marketScore != null ? (
                              <ScoreBar score={p.commercializationDetails.marketScore} label="" />
                            ) : <span className="text-sm text-muted-foreground">-</span>}
                          </td>
                        ))}
                      </tr>
                      {/* 사업성 */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">사업성</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 border-b border-border/30">
                            {p.commercializationDetails?.businessScore != null ? (
                              <ScoreBar score={p.commercializationDetails.businessScore} label="" />
                            ) : <span className="text-sm text-muted-foreground">-</span>}
                          </td>
                        ))}
                      </tr>
                      {/* 주요 특징 (AI 분석) */}
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground">AI 분석 의견</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3">
                            <p className="text-sm text-foreground/80 leading-relaxed">
                              {p.commercializationDetails?.analysis || "-"}
                            </p>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {selected.length > 0 && selected.length < 2 && (
              <p className="text-center text-sm text-muted-foreground mt-8">비교하려면 최소 2개 이상의 특허를 선택하세요.</p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
