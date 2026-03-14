import { Play } from "lucide-react";

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

export function TechVideoSection({ videos }: TechVideoSectionProps) {
  if (!videos || videos.length === 0) return null;

  return (
    <section className="max-w-5xl mx-auto mt-12 md:mt-16 mb-12 md:mb-16 animate-fade-up" style={{ animationDelay: "0.3s" }}>
      <div className="mb-5">
        <h3 className="text-lg md:text-xl font-semibold text-foreground">기술소개영상</h3>
        <p className="text-xs text-muted-foreground mt-0.5">농식품 분야 기술 소개 영상</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {videos.slice(0, 3).map((video, idx) => {
          const videoId = getYouTubeId(video.url);
          const thumbnail = videoId
            ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            : null;

          return (
            <a
              key={idx}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-2xl overflow-hidden border border-border/30 bg-card/80 backdrop-blur-sm hover:border-foreground/15 hover:shadow-lg transition-all duration-300"
              style={{ boxShadow: 'var(--shadow-glossy)' }}
            >
              <div className="aspect-video bg-muted/30 flex items-center justify-center overflow-hidden relative">
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={video.title || "기술소개영상"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <Play className="w-10 h-10 text-muted-foreground/40" />
                )}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-foreground/80 flex items-center justify-center opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-200">
                    <Play className="w-5 h-5 text-background ml-0.5" />
                  </div>
                </div>
              </div>
              {video.title && (
                <div className="px-3 py-2.5">
                  <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
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