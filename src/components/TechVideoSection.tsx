import { Play, Video } from "lucide-react";

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
    <section className="max-w-5xl mx-auto mt-8 md:mt-16 mb-8 md:mb-16 animate-fade-up" style={{ animationDelay: "0.3s" }}>
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-2.5 mb-1.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'hsl(0 84% 60% / 0.1)' }}>
            <Video className="w-4 h-4" style={{ color: 'hsl(0 84% 60%)' }} />
          </div>
          <h3 className="text-lg md:text-xl font-bold text-foreground tracking-tight">주요 기술소개</h3>
        </div>
        <p className="text-[13px] text-muted-foreground ml-[42px]">농식품 분야 주요 기술 소개</p>
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
              className="group relative rounded-2xl overflow-hidden border border-border/40 bg-card hover:border-border/70 hover:shadow-lg transition-all duration-300 card-interactive"
              style={{ boxShadow: 'var(--shadow-glossy)' }}
            >
              <div className="aspect-video bg-secondary/30 flex items-center justify-center overflow-hidden relative">
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
                  <div className="w-12 h-12 rounded-full flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 backdrop-blur-sm" style={{ background: 'hsl(0 0% 100% / 0.95)', boxShadow: '0 4px 20px hsl(0 0% 0% / 0.15)' }}>
                    <Play className="w-5 h-5 text-foreground ml-0.5" />
                  </div>
                </div>
              </div>
              {video.title && (
                <div className="px-4 py-3.5">
                  <p className="text-[13px] font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-relaxed">
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
