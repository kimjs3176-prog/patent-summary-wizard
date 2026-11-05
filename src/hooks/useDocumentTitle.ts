import { useEffect } from "react";

/** index.html의 기본 제목 — 페이지가 이름을 주지 않을 때와 화면을 떠날 때 되돌린다. */
export const DEFAULT_DOCUMENT_TITLE = "Agri IP Summary (AIS) | 농식품분야 특허 AI 기술분석";
export const DOCUMENT_TITLE_SUFFIX = "AIS";

/** "페이지명 | AIS" 형태의 문서 제목. 이름이 비어 있으면 기본 제목. */
export function formatDocumentTitle(page?: string | null): string {
  const name = (page ?? "").replace(/\s+/g, " ").trim();
  return name ? `${name} | ${DOCUMENT_TITLE_SUFFIX}` : DEFAULT_DOCUMENT_TITLE;
}

/**
 * 화면마다 브라우저 탭과 스크린리더가 읽는 문서 제목을 구분한다.
 * 화면을 떠나면 기본 제목으로 되돌려 다음 화면이 이전 제목을 물려받지 않게 한다.
 */
export function useDocumentTitle(page?: string | null) {
  const title = formatDocumentTitle(page);
  useEffect(() => {
    document.title = title;
  }, [title]);
  useEffect(() => () => {
    document.title = DEFAULT_DOCUMENT_TITLE;
  }, []);
}
