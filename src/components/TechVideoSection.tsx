import { Play, Video, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TechVideo {
  title: string;
  url: string;
}

interface TechVideoSectionProps {
  videos: TechVideo[];
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

const isStorageUrl = (url: string) => url.startsWith("storage://");

export function TechVideoSection({ videos }: TechVideoSectionProps) {
  const preview = (videos || []).slice(0, 3);
  const [resolved, setResolved] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      await Promise.all(preview.map(async (v) => {
        if (!isStorageUrl(v.url)) return;
        const path = v.url.replace("storage://", "");
        const { data } = await supabase.storage.from("tech-videos").createSignedUrl(path, 60 * 60 * 24);
        if (data?.signedUrl) map[v.url] = data.signedUrl;
      }));
      setResolved(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(videos || []).map(v => v.url).join("|")]);
  if (!videos || videos.length === 0) return null;

  return (
    <section
      className="relative -mx-3 sm:-mx-4 md:-mx-6 px-5 sm:px-10 md:px-16 py-10 md:py-16 my-2 md:my-6 rounded-none md:rounded-3xl overflow-hidden animate-fade-up"
      style={{ animationDelay: "0.3s", background: "var(--gradient-dark)" }}
    >
      {/* Grid overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(hsl(158 64% 60%) 1px, transparent 1px), linear-gradient(90deg, hsl(158 64% 60%) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 80%)",
        }}
      />
      <div aria-hidden className="absolute -top-16 right-10 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: "hsl(158 64% 45% / 0.22)" }} />

      <div className="relative max-w-5xl mx-auto mb-6 md:mb-8">
        <div className="flex items-end justify-between gap-3 mb-1.5">
          <Link
            to="/tech-videos"
            className="group inline-flex items-center gap-2.5 hover:opacity-90 transition-opacity"
            aria-label="온라인 기술 홍보관으로 이동"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'hsl(158 64% 45% / 0.22)', border: '1px solid hsl(158 64% 45% / 0.35)' }}>
              <Video className="w-4 h-4" style={{ color: 'hsl(158 70% 70%)' }} />
            </div>
            <h3 className="text-lg md:text-xl font-bold tracking-tight transition-colors" style={{ color: '#f5f9ff' }}>
              주요 기술소개
            </h3>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-all" style={{ color: 'hsl(158 70% 70%)' }} />
          </Link>
          <Link
            to="/tech-videos"
            className="text-[12px] md:text-[13px] font-medium transition-colors inline-flex items-center gap-1"
            style={{ color: 'hsl(210 30% 75%)' }}
          >
            전체 보기
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <p className="text-[13px] ml-[42px]" style={{ color: 'hsl(210 25% 68%)' }}>농식품 분야 주요 기술 소개 — 클릭하여 온라인 기술 홍보관 전체보기</p>
      </div>
      <div className="relative max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {preview.map((video, idx) => {
          const videoId = getYouTubeId(video.url);
          const thumbnail = videoId
            ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            : null;
          const storage = isStorageUrl(video.url);
          const playSrc = storage ? resolved[video.url] : video.url;

          if (storage) {
            return (
              <div
                key={idx}
                className="group relative rounded-2xl overflow-hidden transition-all duration-300 card-interactive"
                style={{ background: 'hsl(218 40% 14%)', border: '1px solid hsl(158 64% 45% / 0.18)', boxShadow: '0 10px 30px -10px hsl(218 60% 5% / 0.6)' }}
              >
                <div className="aspect-video bg-black flex items-center justify-center overflow-hidden relative">
                  {playSrc ? (
                    <video
                      src={playSrc}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Play className="w-10 h-10 text-muted-foreground/30" />
                  )}
                </div>
                {video.title && (
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-medium line-clamp-2 leading-relaxed" style={{ color: '#f5f9ff' }}>{video.title}</p>
                  </div>
                )}
              </div>
            );
          }

          return (
            <a
              key={idx}
              href={playSrc}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-2xl overflow-hidden transition-all duration-300 card-interactive"
              style={{ background: 'hsl(218 40% 14%)', border: '1px solid hsl(158 64% 45% / 0.18)', boxShadow: '0 10px 30px -10px hsl(218 60% 5% / 0.6)' }}
            >
              <div className="aspect-video bg-black flex items-center justify-center overflow-hidden relative">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={video.title || "기술소개영상"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <Play className="w-10 h-10 text-muted-foreground/30" />
                )}
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center opacity-95 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300" style={{ background: 'linear-gradient(135deg, hsl(158 70% 55%), hsl(184 80% 60%))', boxShadow: '0 8px 28px hsl(158 70% 40% / 0.5)' }}>
                    <Play className="w-5 h-5 ml-0.5" style={{ color: '#0a1628' }} />
                  </div>
                </div>
              </div>
              {video.title && (
                <div className="px-4 py-3.5">
                  <p className="text-[13px] font-medium line-clamp-2 leading-relaxed transition-colors" style={{ color: '#f5f9ff' }}>
                    {video.title}
                  </p>
                </div>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
