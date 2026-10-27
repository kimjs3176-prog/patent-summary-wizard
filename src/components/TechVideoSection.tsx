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
      className="tech-video-band relative -mx-3 sm:-mx-4 md:-mx-6 px-5 sm:px-10 md:px-16 py-10 md:py-14 my-2 md:my-6 rounded-none md:rounded-3xl overflow-hidden animate-fade-up motion-reduce:animate-none"
      style={{ animationDelay: "0.3s" }}
    >
      <div className="relative max-w-5xl mx-auto mb-6 md:mb-8">
        <div className="flex items-end justify-between gap-3 mb-1.5">
          <Link
            to="/tech-videos"
            className="group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--home-hero-accent))]"
            aria-label="온라인 기술 홍보관으로 이동"
          >
            <span className="tech-video-icon w-8 h-8 rounded-xl flex items-center justify-center">
              <Video className="w-4 h-4" />
            </span>
            <h3 className="text-lg md:text-xl font-bold">주요 기술소개</h3>
          </Link>
          <Link
            to="/tech-videos"
            className="home-hero-muted text-[13px] font-medium rounded underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--home-hero-accent))]"
          >
            전체 보기
          </Link>
        </div>
        <p className="home-hero-muted text-[13px] ml-[42px]">농식품 분야 주요 기술을 영상으로 소개합니다. 전체 영상은 온라인 기술 홍보관에서 볼 수 있어요.</p>
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
              <div key={idx} className="tech-video-card group relative rounded-2xl overflow-hidden">
                <div className="aspect-video bg-foreground flex items-center justify-center overflow-hidden relative">
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
                    <p className="text-[13px] font-medium line-clamp-2 leading-relaxed">{video.title}</p>
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
              className="tech-video-card group relative rounded-2xl overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--home-hero-accent))]"
            >
              <div className="aspect-video bg-foreground flex items-center justify-center overflow-hidden relative">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={video.title || "기술소개영상"}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                ) : (
                  <Play className="w-10 h-10 text-muted-foreground/30" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="tech-video-play w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                    <Play className="w-5 h-5 ml-0.5" />
                  </span>
                </div>
              </div>
              {video.title && (
                <div className="px-4 py-3.5">
                  <p className="text-[13px] font-medium line-clamp-2 leading-relaxed">{video.title}</p>
                </div>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
