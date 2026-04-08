
CREATE TABLE public.notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active notices"
ON public.notices FOR SELECT
USING (true);

CREATE POLICY "No public insert on notices"
ON public.notices FOR INSERT
WITH CHECK (false);

CREATE POLICY "No public update on notices"
ON public.notices FOR UPDATE
USING (false);

CREATE POLICY "No public delete on notices"
ON public.notices FOR DELETE
USING (false);
