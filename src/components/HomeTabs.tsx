import { useState } from "react";
import { Star, Video, BookOpen, Bell } from "lucide-react";
import { FeaturedPatents } from "@/components/FeaturedPatents";
import { TechVideoSection } from "@/components/TechVideoSection";
import { TechTransferGuide } from "@/components/TechTransferGuide";
import { NoticeSection } from "@/components/NoticeSection";
import { PopularSearches } from "@/components/PopularSearches";
import { SearchHistory } from "@/components/SearchHistory";
import { SearchHistoryItem } from "@/hooks/useSearchHistory";

interface Props {
  showFeatured: boolean;
  showVideos: boolean;
  showGuide: boolean;
  showNotices: boolean;
  onPatentSelect: (n: string) => void;
  onHistorySelect: (item: SearchHistoryItem) => void;
  onHistoryRemove: (n: string) => void;
  onHistoryClear: () => void;
  history: SearchHistoryItem[];
  settings: Record<string, string>;
}

type TabKey = "featured" | "videos" | "guide" | "info";

export function HomeTabs({
  showFeatured, showVideos, showGuide, showNotices,
  onPatentSelect, onHistorySelect, onHistoryRemove, onHistoryClear, history, settings,
}: Props) {
  const tabs = ([
    { key: "featured" as const, label: "추천 특허", icon: Star, show: showFeatured },
    { key: "videos" as const, label: "기술 영상", icon: Video, show: showVideos },
    { key: "guide" as const, label: "기술이전 안내", icon: BookOpen, show: showGuide },
    { key: "info" as const, label: "공지·기록", icon: Bell, show: showNotices || history.length > 0 },
  ]).filter((t) => t.show);

  const [active, setActive] = useState<TabKey>(tabs[0]?.key || "featured");

  if (tabs.length === 0) return null;

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 sm:gap-1.5 mb-5 md:mb-6 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
        {tabs.map((t) => {
          const isActive = active === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border transition-all btn-press ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card text-muted-foreground border-border/50 hover:text-foreground hover:border-border"
              }`}
              style={isActive ? { boxShadow: "0 4px 14px hsl(var(--primary) / 0.25)" } : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="animate-fade-up" key={active}>
        {active === "featured" && showFeatured && (
          <FeaturedPatents
            onPatentSelect={onPatentSelect}
            sectionTitle={settings.featured_section_title}
            sectionSubtitle={settings.featured_section_subtitle}
          />
        )}
        {active === "videos" && showVideos && (
          <TechVideoSection videos={(() => {
            try {
              const parsed = JSON.parse(settings.tech_videos || "[]");
              return Array.isArray(parsed) ? parsed : [];
            } catch { return []; }
          })()} />
        )}
        {active === "guide" && showGuide && (
          <div id="tech-transfer">
            <TechTransferGuide />
          </div>
        )}
        {active === "info" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {showNotices && (
              <div className="rounded-2xl border border-border/40 bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                <NoticeSection compact />
              </div>
            )}
            <div className="rounded-2xl border border-border/40 bg-card p-4" style={{ boxShadow: "var(--shadow-card)" }}>
              <PopularSearches onPatentSelect={onPatentSelect} />
            </div>
            {history.length > 0 && (
              <div className="rounded-2xl border border-border/40 bg-card p-4 md:col-span-2" style={{ boxShadow: "var(--shadow-card)" }}>
                <SearchHistory history={history} onSelect={onHistorySelect} onRemove={onHistoryRemove} onClear={onHistoryClear} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
