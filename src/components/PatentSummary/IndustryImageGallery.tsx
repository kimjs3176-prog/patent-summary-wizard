import { useEffect, useState } from "react";
import { Loader2, ImageIcon, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PexelsImage {
  id: number;
  url: string;
  thumb: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  pexelsUrl: string;
}

interface ImageGroup {
  keyword: string;
  images: PexelsImage[];
}

interface Props {
  patentNumber: string;
  title?: string;
  abstract?: string;
}

export function IndustryImageGallery({ patentNumber, title, abstract }: Props) {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ImageGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    supabase.functions
      .invoke("search-product-images", {
        body: { patentNumber, title, abstract },
      })
      .then(({ data, error: invokeError }) => {
        if (cancelled) return;
        if (invokeError) {
          setError("이미지를 가져오지 못했습니다.");
        } else if (data?.success && Array.isArray(data.groups)) {
          setGroups(data.groups);
        } else {
          setError("이미지를 가져오지 못했습니다.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("이미지를 가져오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patentNumber, title, abstract]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#8B95A1] py-6 px-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[14px]">활용 산업·제품 이미지 검색 중...</span>
      </div>
    );
  }

  if (error || groups.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap gap-2 items-stretch">
        {groups.flatMap((g) =>
          g.images.map((img) => (
            <a
              key={img.id}
              href={img.pexelsUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={g.keyword}
              className="group relative flex-1 min-w-[180px] h-[180px] rounded-[14px] overflow-hidden bg-[#F4F6F8]"
            >
              <img
                src={img.thumb}
                alt={img.alt}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm">
                <span className="text-[10px] font-semibold text-white flex items-center gap-1">
                  <ImageIcon className="w-2.5 h-2.5" />
                  {g.keyword}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white flex items-center gap-1 truncate">
                  © {img.photographer}
                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                </p>
              </div>
            </a>
          ))
        )}
      </div>
      <p className="text-[11px] text-[#8B95A1] text-right px-1">
        Images via{" "}
        <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline">
          Pexels
        </a>
      </p>
    </div>
  );
}