-- 관리자 비밀번호를 안전하게 저장하기 위한 비공개 테이블
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  id INTEGER PRIMARY KEY DEFAULT 1,
  password_hash TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 단일 행만 사용 (id=1)
CREATE UNIQUE INDEX IF NOT EXISTS admin_credentials_singleton_idx ON public.admin_credentials ((id));

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

-- 공개 접근 차단 (서비스 롤 전용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_credentials' AND policyname = 'No public select on admin_credentials'
  ) THEN
    CREATE POLICY "No public select on admin_credentials"
    ON public.admin_credentials
    FOR SELECT
    USING (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_credentials' AND policyname = 'No public insert on admin_credentials'
  ) THEN
    CREATE POLICY "No public insert on admin_credentials"
    ON public.admin_credentials
    FOR INSERT
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_credentials' AND policyname = 'No public update on admin_credentials'
  ) THEN
    CREATE POLICY "No public update on admin_credentials"
    ON public.admin_credentials
    FOR UPDATE
    USING (false)
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_credentials' AND policyname = 'No public delete on admin_credentials'
  ) THEN
    CREATE POLICY "No public delete on admin_credentials"
    ON public.admin_credentials
    FOR DELETE
    USING (false);
  END IF;
END $$;