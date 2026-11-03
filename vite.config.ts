import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // 미리보기(개발 서버)는 public 폴더의 디렉터리 주소(/filing-app/)를 index.html 로 이어 주지 않아
    // 앱의 404 화면이 출원도우미 칸에 뜬다. 배포 사이트처럼 /filing-app/ → /filing-app/index.html 로 넘긴다.
    {
      name: "filing-app-dir-index",
      configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: unknown, next: () => void) => void) => void } }) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && /^\/filing-app\/?(\?|#|$)/.test(req.url)) {
            req.url = req.url.replace(/^\/filing-app\/?/, "/filing-app/index.html");
          }
          next();
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // 화면 코드만 바뀐 배포에서 기반 라이브러리 파일은 브라우저 캐시를 그대로 쓰도록 따로 묶는다
    // (예전에는 한 파일 788kB에 모두 들어 있어, 글자 하나만 고쳐도 사용자가 전부 다시 받았다)
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return "vendor-react";
          if (id.includes("node_modules/@supabase/")) return "vendor-supabase";
          if (id.includes("node_modules/@tanstack/")) return "vendor-query";
          return undefined;
        },
      },
    },
    // 머메이드(특허 도우미 그림)·엑셀 내보내기는 누를 때만 받는 큰 파일이라 경고 기준을 그보다 높게 둔다
    chunkSizeWarningLimit: 800,
  },
}));
