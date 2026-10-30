import { useState } from "react";
import { getPatentVideoUrls } from "@/lib/patentVideo";
import { SectionTitle } from "./SectionTitle";
import { SoftCard } from "./SoftCard";

/** R2에 해당 특허 영상이 있을 때만 보이는 기술소개영상 카드 */
export function VideoSection({ patentNumber }: { patentNumber?: string }) {
  const urls = patentNumber ? getPatentVideoUrls(patentNumber) : null;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!urls || failed) return null;

  return (
    <section className={ready ? "print:hidden" : "hidden"} aria-label="기술소개영상">
      <SectionTitle>기술소개영상</SectionTitle>
      <SoftCard className="p-0 sm:p-0 overflow-hidden">
        <video
          key={urls.video}
          src={urls.video}
          poster={urls.poster}
          controls
          playsInline
          preload="metadata"
          className="w-full aspect-video bg-muted"
          onLoadedMetadata={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      </SoftCard>
    </section>
  );
}
