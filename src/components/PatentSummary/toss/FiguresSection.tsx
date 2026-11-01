



import { SectionTitle } from "./SectionTitle";
import { SoftCard } from "./SoftCard";

interface Props {
  drawings: string[]; figureItems: {src: string; caption: string}[]; setLightboxIndex: (index: number | null) => void;
}

export function FiguresSection({ drawings, figureItems, setLightboxIndex }: Props) {
  return (
    <>
          {drawings.length > 0 && (
            <section id="sec-figures" data-summary-section data-summary-label="특허 도면" className="report-section mb-8 scroll-mt-24">
              <SectionTitle index="03" kicker="특허 도면">한눈에 보는 기술 구성</SectionTitle>
              <SoftCard className="!p-3">
                {/* 대표 도면 */}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(0)}
                  title="클릭하면 확대됩니다"
                  className="w-full bg-white rounded-[14px] p-3 flex flex-col items-center cursor-zoom-in transition-transform hover:scale-[1.01]"
                >
                  <img
                    src={figureItems[0].src}
                    alt={`${figureItems[0].caption.replace(/[【】]/g, "")} 이미지`}
                    className="w-full h-auto max-h-[340px] object-contain"
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                    }}
                  />
                  <p className="text-[12px] text-[#6B7684] mt-2 font-medium">{figureItems[0].caption}</p>
                </button>

                {/* 나머지 도면 썸네일 */}
                {figureItems.length > 1 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {figureItems.slice(1).map((item, i) => (
                      <button
                        type="button"
                        key={i}
                        onClick={() => setLightboxIndex(i + 1)}
                        title={`${item.caption} — 클릭하면 확대됩니다`}
                        className="shrink-0 w-[92px] bg-white rounded-[10px] border border-[#E5E8EB] p-2 flex flex-col items-center cursor-zoom-in hover:border-[#B0B8C1] transition-colors"
                      >
                        <img
                          src={item.src}
                          alt={`${item.caption.replace(/[【】]/g, "")} 이미지`}
                          className="w-full h-[64px] object-contain"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                          }}
                        />
                        <span className="text-[10px] text-[#6B7684] mt-1 font-medium truncate w-full text-center">
                          {item.caption}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </SoftCard>
            </section>
          )}
    </>
  );
}
