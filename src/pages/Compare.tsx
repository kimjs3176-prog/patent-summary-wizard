import { useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, X, Heart, Trash2, FolderPlus, Folder, Tag, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFavoritePatents, FavoritePatent, FavoriteFolder } from "@/hooks/useFavoritePatents";
import { PageLayout } from "@/components/layout/PageLayout";
import { PatentTrendChart } from "@/components/PatentTrendChart";
import { toast } from "sonner";

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

// Tag input component
function TagInput({ patentNumber, existingTags, allTags, onAdd, onRemove }: {
  patentNumber: string;
  existingTags: string[];
  allTags: string[];
  onAdd: (pn: string, tag: string) => void;
  onRemove: (pn: string, tag: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = allTags.filter((t) => !existingTags.includes(t) && t.includes(value));

  const handleAdd = (tag: string) => {
    onAdd(patentNumber, tag);
    setValue("");
    setIsAdding(false);
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {existingTags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-[10px] font-medium">
          #{tag}
          <button onClick={() => onRemove(patentNumber, tag)} className="hover:text-destructive ml-0.5">
            <X className="w-2.5 h-2.5" />
          </button>
        </span>
      ))}
      {isAdding ? (
        <div className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) handleAdd(value.trim());
              if (e.key === "Escape") setIsAdding(false);
            }}
            onBlur={() => setTimeout(() => setIsAdding(false), 150)}
            autoFocus
            placeholder="태그 입력"
            className="h-5 w-20 text-[10px] px-1.5 rounded-md"
          />
          {suggestions.length > 0 && value && (
            <div className="absolute top-6 left-0 z-50 bg-card border border-border/50 rounded-lg shadow-lg py-1 min-w-[80px]">
              {suggestions.slice(0, 5).map((s) => (
                <button key={s} onMouseDown={() => handleAdd(s)} className="block w-full text-left px-2 py-1 text-[10px] hover:bg-muted/50">
                  #{s}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setIsAdding(true)} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
          <Plus className="w-2.5 h-2.5" />
          태그
        </button>
      )}
    </div>
  );
}

export default function Compare() {
  const {
    favorites, removeFavorite,
    folders, addFolder, removeFolder, renameFolder, assignFolder,
    allTags, addTagToPatent, removeTagFromPatent,
  } = useFavoritePatents();

  const [selected, setSelected] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState("");

  const filteredFavorites = useMemo(() => {
    let list = favorites;
    if (activeFolder !== "all") {
      list = list.filter((f) => f.folder === activeFolder);
    }
    if (activeTag) {
      list = list.filter((f) => (f.tags || []).includes(activeTag));
    }
    return list;
  }, [favorites, activeFolder, activeTag]);

  const selectedPatents = useMemo(
    () => selected.map((n) => favorites.find((f) => f.patentNumber === n)).filter(Boolean) as FavoritePatent[],
    [selected, favorites]
  );

  // Find best (highest) value indices for highlighting
  const bestIndices = useMemo(() => {
    const findMaxIdx = (getter: (p: FavoritePatent) => number | undefined | null): number => {
      let maxIdx = -1;
      let maxVal = -Infinity;
      selectedPatents.forEach((p, i) => {
        const v = getter(p);
        if (v != null && v > maxVal) { maxVal = v; maxIdx = i; }
      });
      return maxIdx;
    };
    return {
      total: findMaxIdx((p) => p.commercializationScore),
      tech: findMaxIdx((p) => p.commercializationDetails?.technologyScore),
      market: findMaxIdx((p) => p.commercializationDetails?.marketScore),
      business: findMaxIdx((p) => p.commercializationDetails?.businessScore),
      trl: findMaxIdx((p) => p.commercializationDetails?.trl),
    };
  }, [selectedPatents]);

  const usedTags = useMemo(() => {
    const set = new Set<string>();
    favorites.forEach((f) => (f.tags || []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [favorites]);

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

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    addFolder(newFolderName.trim());
    setNewFolderName("");
    setShowAddFolder(false);
    toast.success("폴더가 생성되었습니다");
  };

  const handleRenameFolder = (folderId: string) => {
    if (!editFolderName.trim()) return;
    renameFolder(folderId, editFolderName.trim());
    setEditingFolder(null);
    toast.success("폴더 이름이 변경되었습니다");
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
          <span className="text-xs text-muted-foreground ml-1">({favorites.length})</span>
        </div>

        {favorites.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">관심특허가 없습니다. 먼저 특허를 검색하고 관심특허에 담아주세요.</p>
            <Link to="/"><Button>홈으로 돌아가기</Button></Link>
          </div>
        ) : (
          <>
            {/* Folders & Tags Bar */}
            <div className="mb-6 space-y-3">
              {/* Folders */}
              <div className="flex items-center gap-2 flex-wrap">
                <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <button
                  onClick={() => { setActiveFolder("all"); setActiveTag(null); }}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${
                    activeFolder === "all" && !activeTag
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  전체 ({favorites.length})
                </button>
                {folders.map((f) => {
                  const count = favorites.filter((p) => p.folder === f.id).length;
                  return editingFolder === f.id ? (
                    <div key={f.id} className="flex items-center gap-1">
                      <Input
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameFolder(f.id); if (e.key === "Escape") setEditingFolder(null); }}
                        autoFocus
                        className="h-7 w-24 text-[11px] rounded-lg"
                      />
                      <button onClick={() => handleRenameFolder(f.id)}><Check className="w-3 h-3 text-primary" /></button>
                      <button onClick={() => setEditingFolder(null)}><X className="w-3 h-3 text-muted-foreground" /></button>
                    </div>
                  ) : (
                    <button
                      key={f.id}
                      onClick={() => { setActiveFolder(f.id); setActiveTag(null); }}
                      onDoubleClick={() => { setEditingFolder(f.id); setEditFolderName(f.name); }}
                      className={`group px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                        activeFolder === f.id
                          ? "text-primary-foreground"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                      style={activeFolder === f.id ? { background: f.color } : {}}
                      title="더블클릭으로 이름 변경"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: f.color }} />
                      {f.name} ({count})
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFolder(f.id); toast.success("폴더가 삭제되었습니다"); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </button>
                  );
                })}
                {showAddFolder ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddFolder(); if (e.key === "Escape") setShowAddFolder(false); }}
                      autoFocus
                      placeholder="폴더 이름"
                      className="h-7 w-24 text-[11px] rounded-lg"
                    />
                    <button onClick={handleAddFolder}><Check className="w-3 h-3 text-primary" /></button>
                    <button onClick={() => setShowAddFolder(false)}><X className="w-3 h-3 text-muted-foreground" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddFolder(true)}
                    className="px-2 py-1.5 rounded-xl text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center gap-1"
                  >
                    <FolderPlus className="w-3 h-3" />
                    폴더 추가
                  </button>
                )}
              </div>

              {/* Tags */}
              {usedTags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {usedTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                        activeTag === tag
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                  {activeTag && (
                    <button onClick={() => setActiveTag(null)} className="text-[10px] text-muted-foreground hover:text-foreground">
                      필터 해제
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Patent List */}
            <section className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold">
                  {activeFolder !== "all" ? folders.find((f) => f.id === activeFolder)?.name || "" : "전체"} 목록
                  {activeTag && <span className="text-primary ml-1.5 text-sm">#{activeTag}</span>}
                </h3>
                <p className="text-xs text-muted-foreground">비교할 특허를 선택하세요 (최대 4개)</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredFavorites.map((f) => {
                  const isSelected = selected.includes(f.patentNumber);
                  const patentFolder = folders.find((fo) => fo.id === f.folder);
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
                          <div className="flex items-center gap-1.5 mb-1">
                            <p className="text-xs text-muted-foreground">{f.patentNumber}</p>
                            {patentFolder && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-medium text-white" style={{ background: patentFolder.color }}>
                                {patentFolder.name}
                              </span>
                            )}
                          </div>
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
                          {/* Folder assign dropdown */}
                          {folders.length > 0 && (
                            <select
                              value={f.folder || ""}
                              onChange={(e) => assignFolder(f.patentNumber, e.target.value || undefined)}
                              className="text-[9px] w-14 bg-transparent border border-border/30 rounded px-0.5 py-0.5 text-muted-foreground"
                              title="폴더 지정"
                            >
                              <option value="">폴더</option>
                              {folders.map((fo) => (
                                <option key={fo.id} value={fo.id}>{fo.name}</option>
                              ))}
                            </select>
                          )}
                          <button onClick={() => removeFavorite(f.patentNumber)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {/* Tags */}
                      <TagInput
                        patentNumber={f.patentNumber}
                        existingTags={f.tags || []}
                        allTags={allTags}
                        onAdd={addTagToPatent}
                        onRemove={removeTagFromPatent}
                      />
                    </div>
                  );
                })}
              </div>
              {filteredFavorites.length === 0 && (
                <p className="text-center py-8 text-sm text-muted-foreground">해당 폴더/태그에 특허가 없습니다.</p>
              )}
            </section>

            {/* Trend Chart */}
            <PatentTrendChart patents={favorites} />

            {/* Comparison Table */}
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
