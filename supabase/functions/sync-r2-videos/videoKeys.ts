export const VIDEO_RE = /\.(mp4|webm|m4v|mov)$/i;

export function publicUrl(base: string, key: string) {
  return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** Object key behind a public URL, decoded so differently-encoded URLs of one file compare equal. */
export function keyFromUrl(base: string, url: string): string | null {
  if (!url?.startsWith(base + "/")) return null;
  try {
    return decodeURIComponent(url.slice(base.length + 1).split("?")[0]).normalize("NFC");
  } catch {
    return null;
  }
}

const DROP_SEGMENT = [
  /^(\d+\s*회차)?\s*(\d+\s*편)?$/, // 4회차, 1편, 4회차 1편
  /^\d{4}$/, // 0908 (date)
  /^\d{3,4}\s*[x×]\s*\d{3,4}$/i, // 2880 x 1152
  /^\d{3,4}p$/i,
  /^(편집|v\s*F|v\d+(\.\d+)*|final|최종)$/i,
  /^기술\s*소개\s*영상$/,
];

/** Title from a file name: "[분류] …" sets the category; numbering, dates, sizes and versions are dropped. */
export function titleFromKey(key: string): { title: string; category?: string } {
  let name = key.split("/").pop()!.replace(VIDEO_RE, "").normalize("NFC");
  let category: string | undefined;
  const m = name.match(/^\s*\[([^\]]+)\]\s*/);
  if (m) {
    category = m[1].trim();
    name = name.slice(m[0].length);
  }
  name = name.replace(/^\s*\d+\s*[.)]\s*/, "");
  const title = name
    .split("_")
    .map((s) => s.trim())
    .filter((s) => s && !DROP_SEGMENT.some((re) => re.test(s)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: title || name.trim() || key, category };
}
