import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, X, Heart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavoritePatents, FavoritePatent } from "@/hooks/useFavoritePatents";
import { PageLayout } from "@/components/layout/PageLayout";

function getScoreColor(value: number): string {
  if (value >= 80) return "text-chart-3";
  if (value >= 60) return "text-chart-1";
  if (value >= 40) return "text-chart-4";
  return "text-chart-5";
}

function getScoreBgColor(value: number): string {
  if (value >= 80) return "bg-chart-3";
  if (value >= 60) return "bg-chart-1";
  if (value >= 40) return "bg-chart-4";
  return "bg-chart-5";
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
  const bgColor = getScoreBgColor(score);
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
  const { favorites, removeFavorite } = useFavoritePatents();
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

  const headerRight = (
    <Link to="/">
      <Button variant="ghost" size="sm" className="gap-2 rounded-full">
        <ArrowLeft className="w-4 h-4" /> 홈으로
      </Button>
    </Link>
  );

  return (
    <PageLayout headerRight={headerRight}>
      <main className="container mx-auto px-4 md:px-6 py-8 relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <Heart className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg text-foreground">관심특허</h2>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">관심특허가 없습니다. 먼저 특허를 검색하고 관심특허에 담아주세요.</p>
            <Link to="/"><Button>홈으로 돌아가기</Button></Link>
          </div>
        ) : (
          <>
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">관심특허 목록</h3>
                <p className="text-xs text-muted-foreground">비교할 특허를 선택하세요 (최대 4개)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {favorites.map((f) => {
                  const isSelected = selected.includes(f.patentNumber);
                  return (
                    <div
                      key={f.patentNumber}
                      className={`relative text-left p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border/50 bg-card/50 hover:border-border"
                      } ${!isSelected && selected.length >= 4 ? "opacity-40" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => toggleSelect(f.patentNumber)}
                          disabled={!isSelected && selected.length >= 4}
                          className="flex-1 text-left"
                        >
                          <p className="text-xs text-muted-foreground mb-1">{f.patentNumber}</p>
                          <p className="text-sm font-medium line-clamp-2">{f.patentData.titleKo || f.patentData.title || "제목 없음"}</p>
                          {f.commercializationScore != null && (
                            <span className={`text-xs font-bold mt-1 inline-block ${getScoreColor(f.commercializationScore)}`}>
                              사업화 {f.commercializationScore}점
                            </span>
                          )}
                        </button>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Link to={`/?patent=${encodeURIComponent(f.patentNumber)}`} className="text-xs text-primary hover:underline">
                            요약서
                          </Link>
                          <button onClick={() => removeFavorite(f.patentNumber)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {selectedPatents.length >= 2 && (
              <section className="animate-fade-up">
                <h3 className="text-base font-semibold mb-4">비교 결과</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse table-fixed">
                    <colgroup>
                      <col className="w-28 md:w-32" />
                      {selectedPatents.map((p) => (
                        <col key={p.patentNumber} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="text-left text-xs text-muted-foreground font-medium p-3 border-b border-border/50">항목</th>
                        {selectedPatents.map((p) => (
                          <th key={p.patentNumber} className="text-left p-3 border-b border-border/50">
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
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">출원인</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 text-sm border-b border-border/30">{p.patentData.assignee || "-"}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">대표도면</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 border-b border-border/30">
                            {p.patentData.representativeImage ? (
                              <img src={p.patentData.representativeImage} alt="대표도면" className="w-full max-w-[180px] h-auto rounded-lg border border-border/30" />
                            ) : <span className="text-sm text-muted-foreground">-</span>}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 text-xs font-medium text-muted-foreground border-b border-border/30">출원일</td>
                        {selectedPatents.map((p) => (
                          <td key={p.patentNumber} className="p-3 text-sm border-b border-border/30">{p.patentData.filingDate || "-"}</td>
                        ))}
                      </tr>
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
    </PageLayout>
  );
}