import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { FileText, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ background: 'linear-gradient(135deg, hsl(239 84% 67%), hsl(262 83% 58%))' }}>
          <FileText className="w-7 h-7 text-white" />
        </div>
        <h1 className="mb-2 text-5xl font-extrabold text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">요청하신 페이지를 찾을 수 없습니다</p>
        <Link to="/">
          <Button className="rounded-full gap-2">
            <Home className="w-4 h-4" />
            홈으로 돌아가기
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;