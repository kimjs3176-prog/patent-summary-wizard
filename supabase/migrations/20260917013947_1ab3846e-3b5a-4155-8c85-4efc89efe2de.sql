CREATE TABLE public.potential_patents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number text NOT NULL,
  registration_number text,
  title text NOT NULL,
  right_type text,
  registration_date date,
  acquired_year integer,
  grade text,
  years_since numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_number)
);
GRANT SELECT ON public.potential_patents TO anon;
GRANT SELECT ON public.potential_patents TO authenticated;
GRANT ALL ON public.potential_patents TO service_role;
ALTER TABLE public.potential_patents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read potential patents" ON public.potential_patents FOR SELECT USING (true);
CREATE POLICY "No public insert on potential_patents" ON public.potential_patents FOR INSERT WITH CHECK (false);
CREATE POLICY "No public update on potential_patents" ON public.potential_patents FOR UPDATE USING (false) WITH CHECK (false);
CREATE POLICY "No public delete on potential_patents" ON public.potential_patents FOR DELETE USING (false);
CREATE INDEX idx_potential_patents_grade ON public.potential_patents (grade);