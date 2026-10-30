/**
 * 기술소개영상(Cloudflare R2) 주소 규칙.
 * 영상은 R2 버킷의 `patents/{숫자만 남긴 특허번호}.mp4`(썸네일 .jpg)로 올린다.
 * R2_VIDEO_BASE_URL에 버킷 공개 주소(예: https://media.example.com)를 넣으면 요약서에 자동 표시된다.
 * 비어 있으면 영상 영역은 아예 나타나지 않는다.
 */
export const R2_VIDEO_BASE_URL = "";

export function normalizePatentKey(patentNumber: string): string {
  return (patentNumber || "").replace(/\D/g, "");
}

export function getPatentVideoUrls(patentNumber: string, base = R2_VIDEO_BASE_URL) {
  const key = normalizePatentKey(patentNumber);
  const root = base.replace(/\/+$/, "");
  if (!root || key.length < 10) return null;
  return {
    video: `${root}/patents/${key}.mp4`,
    poster: `${root}/patents/${key}.jpg`,
  };
}
