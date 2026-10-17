CREATE TABLE public.patent_analysis_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patent_key text NOT NULL UNIQUE,
 identity_keys text[] NOT NULL DEFAULT '{}',
 field_id text NOT NULL,
 ipc_prefix text NOT NULL,
 source_hash text NOT NULL,
 policy_version text NOT NULL,
 evidence jsonb NOT NULL DEFAULT '[]',
 validation jsonb NOT NULL DEFAULT '{}',
 status text NOT NULL DEFAULT 'validated' CHECK (status IN ('validated','excluded')),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.patent_analysis_cases TO service_role;
ALTER TABLE public.patent_analysis_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages evidence cases" ON public.patent_analysis_cases FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX patent_analysis_cases_field_idx ON public.patent_analysis_cases(field_id, policy_version, status);
CREATE TABLE public.patent_analysis_case_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 patent_key text NOT NULL,
 analysis_kind text NOT NULL,
 policy_version text NOT NULL,
 source_hash text,
 reference_case_ids uuid[] NOT NULL DEFAULT '{}',
 validation jsonb NOT NULL DEFAULT '{}',
 result_hash text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.patent_analysis_case_runs TO service_role;
ALTER TABLE public.patent_analysis_case_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service manages case audit" ON public.patent_analysis_case_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX patent_analysis_case_runs_patent_idx ON public.patent_analysis_case_runs(patent_key, created_at DESC);