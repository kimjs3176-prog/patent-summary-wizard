import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { canonicalFor } from "@/lib/canonical";

/** Keeps <link rel="canonical"> and og:url in step with the current route. Renders nothing. */
export function CanonicalUrl() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    const href = canonicalFor(pathname, search);
    let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = href;
    document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute("content", href);
  }, [pathname, search]);
  return null;
}
