import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, LogIn, RefreshCw, Shield, TimerOff, TriangleAlert } from "lucide-react";

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

type FriendlyError = {
  kind: "expired" | "session" | "unavailable" | "invalid" | "unknown";
  title: string;
  message: string;
  hint?: string;
  detail?: string;
};

/** 원본 오류 메시지를 사용자 친화적인 안내로 변환합니다. */
function toFriendlyError(raw: unknown): FriendlyError {
  const detail = typeof raw === "string" ? raw : (raw as { message?: string })?.message ?? "";
  const text = detail.toLowerCase();

  if (/expire|expired|timeout|timed out|만료/.test(text)) {
    return {
      kind: "expired",
      title: "연결 요청이 만료되었습니다",
      message: "보안을 위해 연결 요청은 일정 시간이 지나면 자동으로 만료됩니다.",
      hint: "연결하려던 AI 클라이언트(ChatGPT, Claude 등)로 돌아가 연결을 다시 시작해 주세요.",
      detail,
    };
  }
  if (/jwt|token|unauthorized|401|not authenticated|invalid session|refresh/.test(text)) {
    return {
      kind: "session",
      title: "로그인 세션이 만료되었습니다",
      message: "장시간 사용하지 않아 로그인 정보가 만료되었습니다.",
      hint: "다시 로그인하면 이 연결 화면으로 자동으로 돌아옵니다.",
      detail,
    };
  }
  if (/not found|invalid|malformed|bad request|400|404/.test(text)) {
    return {
      kind: "invalid",
      title: "유효하지 않은 연결 요청입니다",
      message: "이미 처리되었거나 잘못된 연결 요청입니다.",
      hint: "AI 클라이언트에서 연결을 처음부터 다시 시도해 주세요.",
      detail,
    };
  }
  return {
    kind: "unknown",
    title: "연결 중 문제가 발생했습니다",
    message: "일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.",
    hint: "문제가 계속되면 AI 클라이언트에서 연결을 다시 시작해 주세요.",
    detail,
  };
}

/** 같은 출처의 상대 경로만 허용합니다. */
function safeNextPath() {
  const next = window.location.pathname + window.location.search;
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const goSignIn = useCallback(() => {
    window.location.href = "/admin?next=" + encodeURIComponent(safeNextPath());
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      setError(null);
      if (!authorizationId) {
        return setError({
          kind: "invalid",
          title: "연결 요청 정보가 없습니다",
          message: "이 페이지는 AI 클라이언트의 연결 요청을 통해서만 열 수 있습니다.",
          hint: "ChatGPT, Claude 등에서 이 앱 연결을 다시 시작해 주세요.",
        });
      }

      // 만료된 세션은 우선 자동 갱신을 시도하고, 실패할 때만 재로그인으로 보냅니다.
      let { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const refreshed = await supabase.auth.refreshSession();
        sess = refreshed.data.session ? { session: refreshed.data.session } : sess;
      }
      if (!active) return;
      if (!sess.session) {
        goSignIn();
        return;
      }

      setUserEmail(sess.session.user.email ?? null);

      const oauthApi = (supabase.auth as any).oauth;
      if (!oauthApi?.getAuthorizationDetails) {
        return setError({
          kind: "unavailable",
          title: "연결 기능을 일시적으로 사용할 수 없습니다",
          message: "인증 서비스를 준비하는 중입니다.",
          hint: "잠시 후 다시 시도해 주세요.",
        });
      }

      try {
        const { data, error: detailsError } = await oauthApi.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (detailsError) return setError(toFriendlyError(detailsError));

        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e) {
        if (active) setError(toFriendlyError(e));
      }
    })();

    return () => {
      active = false;
    };
  }, [authorizationId, reloadKey, goSignIn]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const oauthApi = (supabase.auth as any).oauth;
    if (!oauthApi?.approveAuthorization || !oauthApi?.denyAuthorization) {
      setBusy(false);
      return setError({
        kind: "unavailable",
        title: "연결 기능을 일시적으로 사용할 수 없습니다",
        message: "인증 서비스를 준비하는 중입니다.",
        hint: "잠시 후 다시 시도해 주세요.",
      });
    }

    // 승인 직전에 세션이 만료됐을 수 있으므로 한 번 갱신을 시도합니다.
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.data.session) {
        setBusy(false);
        return setError({
          kind: "session",
          title: "로그인 세션이 만료되었습니다",
          message: "승인을 처리하는 동안 로그인 정보가 만료되었습니다.",
          hint: "다시 로그인하면 이 연결 화면으로 자동으로 돌아옵니다.",
        });
      }
    }

    let data: AuthorizationDetails | undefined;
    try {
      const res = approve
        ? await oauthApi.approveAuthorization(authorizationId)
        : await oauthApi.denyAuthorization(authorizationId);
      if (res?.error) {
        setBusy(false);
        return setError(toFriendlyError(res.error));
      }
      data = res?.data;
    } catch (e) {
      setBusy(false);
      return setError(toFriendlyError(e));
    }

    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError({
        kind: "unknown",
        title: "돌아갈 주소를 확인하지 못했습니다",
        message: "연결 처리는 되었지만 원래 화면으로 이동할 주소를 받지 못했습니다.",
        hint: "AI 클라이언트로 돌아가 연결 상태를 확인해 주세요.",
      });
    }
    window.location.href = target;
  }

  function retry() {
    setRetrying(true);
    setDetails(null);
    setError(null);
    setReloadKey((k) => k + 1);
    window.setTimeout(() => setRetrying(false), 400);
  }

  if (error) {
    const Icon = error.kind === "expired" ? TimerOff : error.kind === "session" ? LogIn : TriangleAlert;
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Icon className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">{error.title}</CardTitle>
            <CardDescription>{error.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error.hint && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                {error.hint}
              </div>
            )}
            {error.detail && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer select-none">기술 상세 정보 보기</summary>
                <p className="mt-2 break-words font-mono">{error.detail}</p>
              </details>
            )}
          </CardContent>
          <CardFooter className="flex gap-3">
            {error.kind === "session" ? (
              <Button className="flex-1" onClick={goSignIn}>
                <LogIn className="mr-2 h-4 w-4" />
                다시 로그인
              </Button>
            ) : (
              <Button className="flex-1" onClick={retry} disabled={retrying}>
                <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                다시 시도
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={() => (window.location.href = "/")}>
              홈으로
            </Button>
          </CardFooter>
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
            승인하면 {clientName}은 이 앱의 특허 분석 도구를 회원님 대신 호출할 수 있습니다.
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
