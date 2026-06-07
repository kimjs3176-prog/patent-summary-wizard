import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Video, ArrowLeft } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";

interface TechVideo {
  title: string;
  url: string;
  description?: string;
  category?: string;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function isStorageUrl(url: string) { return url.startsWith("storage://"); }

const TechVideos = () => {
  const { settings } = useSiteSettings();

  const videos = useMemo<TechVideo[]>(() => {
    try {
      const parsed = JSON.parse(settings.tech_videos || "[]");
      return Array.isArray(parsed) ? parsed.filter((v: TechVideo) => v?.url) : [];
    } catch {
      return [];
    }
  }, [settings.tech_videos]);

  const categories = useMemo<string[]>(() => {
    try {
      const parsed = JSON.parse(settings.video_categories || "[]");
      return Array.isArray(parsed) ? parsed.filter((c: unknown) => typeof c === "string" && c.trim().length > 0) : [];
    } catch {
      return [];
    }
  }, [settings.video_categories]);

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const hasUncategorized = useMemo(() => videos.some(v => !v.category || !categories.includes(v.category!)), [videos, categories]);

  const filteredVideos = useMemo(() => {
    if (activeCategory === "all") return videos;
    if (activeCategory === "__uncat__") return videos.filter(v => !v.category || !categories.includes(v.category!));
    return videos.filter(v => v.category === activeCategory);
  }, [videos, activeCategory, categories]);

  // Resolve storage:// URLs to signed URLs for playback
  const [resolved, setResolved] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      await Promise.all(videos.map(async (v) => {
        if (!isStorageUrl(v.url)) return;
        const path = v.url.replace("storage://", "");
        const { data } = await supabase.storage.from("tech-videos").createSignedUrl(path, 60 * 60 * 24);
        if (data?.signedUrl) map[v.url] = data.signedUrl;
      }));
      if (!cancelled) setResolved(map);
    })();
    return () => { cancelled = true; };
  }, [videos]);

  const headerRight = (
    <Link to="/">
      <Button variant="outline" size="sm" className="rounded-full text-[11px] md:text-xs h-7 md:h-8 px-2.5 md:px-4 glossy-card gap-1.5 btn-press font-medium">
        <ArrowLeft className="w-3 h-3 md:w-3.5 md:h-3.5" />
        <span className="hidden sm:inline">홈으로</span>
      </Button>
    </Link>
  );

  // Show all videos; pad to at least 9 slots for a complete 3x3 visual when fewer exist
  const slots = Array.from({ length: Math.max(9, filteredVideos.length) }, (_, i) => filteredVideos[i] || null);

  return (
    <PageLayout headerRight={headerRight}>
      <main className="container mx-auto px-3 sm:px-4 md:px-6 py-6 md:py-10 relative z-10">
        <section className="max-w-6xl mx-auto mb-6 md:mb-10 animate-fade-down">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'hsl(0 84% 60% / 0.1)' }}>
              <Video className="w-4 h-4" style={{ color: 'hsl(0 84% 60%)' }} />
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground tracking-tight">온라인 기술 홍보관</h1>
          </div>
          <p className="text-[13px] md:text-sm text-muted-foreground ml-[46px]">
            농식품 분야 우수 기술의 홍보 영상을 한 자리에서 확인하세요.
          </p>
        </section>

        <section className="max-w-6xl mx-auto animate-fade-up" style={{ animationDelay: "0.05s" }}>
          {categories.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveCategory("all")}
                className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all ${activeCategory === "all" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-foreground border-border/60 hover:border-primary/40 hover:text-primary"}`}
              >
                전체 ({videos.length})
              </button>
              {categories.map((cat) => {
                const count = videos.filter(v => v.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all ${activeCategory === cat ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-foreground border-border/60 hover:border-primary/40 hover:text-primary"}`}
                  >
                    {cat} ({count})
                  </button>
                );
              })}
              {hasUncategorized && (
                <button
                  onClick={() => setActiveCategory("__uncat__")}
                  className={`px-3.5 py-1.5 rounded-full text-[12px] font-medium border transition-all ${activeCategory === "__uncat__" ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-primary"}`}
                >
                  미분류
                </button>
              )}
            </div>
          )}
          {filteredVideos.length > 9 && (
            <p className="text-[11px] text-muted-foreground mb-3 text-right">총 {filteredVideos.length}개 · 아래로 스크롤하여 더 보기</p>
          )}
          {filteredVideos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card p-10 md:p-16 text-center">
              <Video className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{videos.length === 0 ? "등록된 홍보 영상이 아직 없습니다." : "이 카테고리에 등록된 영상이 없습니다."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {slots.map((video, idx) => {
                if (!video) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="aspect-video rounded-2xl border border-dashed border-border/40 bg-secondary/20 flex items-center justify-center"
                    >
                      <span className="text-[11px] text-muted-foreground/50">등록 예정</span>
                    </div>
                  );
                }
                const videoId = getYouTubeId(video.url);
                const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
                const storage = isStorageUrl(video.url);
                const playSrc = storage ? resolved[video.url] : video.url;
                return (
                  <div
                    key={idx}
                    className="group relative rounded-2xl overflow-hidden border border-border/40 bg-card hover:border-border/70 hover:shadow-lg transition-all duration-300 card-interactive"
                    style={{ boxShadow: 'var(--shadow-glossy)' }}
                  >
                    <div className="aspect-video bg-secondary/30 flex items-center justify-center overflow-hidden relative">
                      {storage ? (
                        playSrc ? (
                          <video
                            src={playSrc}
                            controls
                            preload="metadata"
                            controlsList="nodownload noremoteplayback"
                            disablePictureInPicture
                            onContextMenu={(e) => e.preventDefault()}
                            className="w-full h-full object-cover bg-black"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground/50 text-[11px]">불러오는 중…</div>
                        )
                      ) : thumbnail ? (
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="block w-full h-full relative">
                          <img
                          src={thumbnail}
                          alt={video.title || "기술 홍보 영상"}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 flex items-center justify-center">
                            <div
                              className="w-12 h-12 rounded-full flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 backdrop-blur-sm"
                              style={{ background: 'hsl(0 0% 100% / 0.95)', boxShadow: '0 4px 20px hsl(0 0% 0% / 0.15)' }}
                            >
                              <Play className="w-5 h-5 text-foreground ml-0.5" />
                            </div>
                          </div>
                        </a>
                      ) : (
                        <a href={video.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center">
                          <Play className="w-10 h-10 text-muted-foreground/30" />
                        </a>
                      )}
                    </div>
                    {(video.title || video.description) && (
                      <div className="px-4 py-3.5">
                        {video.title && (
                          <p className="text-[13px] font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-relaxed">
                            {video.title}
                          </p>
                        )}
                        {video.description && (
                          <p className="mt-1 text-[12px] text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-line">
                            {video.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </PageLayout>
  );
};

export default TechVideos;