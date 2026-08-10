import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield } from "lucide-react";

interface OAuthClient {
  name?: string;
  redirect_uri?: string;
}

interface AuthorizationDetails {
  client?: OAuthClient;
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!authorizationId) {
        return setError("잘못된 연결 요청입니다. (authorization_id 없음)");
      }

      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/admin?next=" + encodeURIComponent(next);
        return;
      }

      setUserEmail(sess.session.user.email ?? null);

      const oauthApi = (supabase.auth as any).oauth;
      if (!oauthApi?.getAuthorizationDetails) {
        return setError("OAuth 동의 기능을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      }

      const { data, error: detailsError } = await oauthApi.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) return setError(detailsError.message);

      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();

    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const oauthApi = (supabase.auth as any).oauth;
    if (!oauthApi?.approveAuthorization || !oauthApi?.denyAuthorization) {
      setBusy(false);
      return setError("OAuth 동의 기능을 사용할 수 없습니다.");
    }

    const { data, error: decideError } = approve
      ? await oauthApi.approveAuthorization(authorizationId)
      : await oauthApi.denyAuthorization(authorizationId);

    if (decideError) {
      setBusy(false);
      return setError(decideError.message);
    }

    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("연결 완료 후 이동할 주소를 받지 못했습니다.");
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>연결 오류</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            연결 정보를 불러오는 중입니다…
          </CardContent>
        </Card>
      </main>
    );
  }

  const clientName = details.client?.name ?? "외부 애플리케이션";
  const redirectUri = details.client?.redirect_uri ?? "";
  const redirectHost = redirectUri ? new URL(redirectUri).host : "";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">
            {clientName}에 연결
          </CardTitle>
          <CardDescription>
            AI 기술분석 서비스 계정을 외부 AI 클라이언트와 연결합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">연결 대상</span>
              <span className="font-medium">{clientName}</span>
            </div>
            {redirectHost && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">리디렉션 주소</span>
                <span className="font-medium">{redirectHost}</span>
              </div>
            )}
            {userEmail && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">로그인 계정</span>
                <span className="font-medium">{userEmail}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            승인하면 {clientName}은 이 앱의 특헀 분석 도구를 회원님 대신 호출할 수 있습니다.
            앱의 권한과 백엔드 정책은 그대로 유지됩니다.
          </p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            취소
          </Button>
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            연결 승인
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
