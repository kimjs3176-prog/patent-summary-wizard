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
}));
