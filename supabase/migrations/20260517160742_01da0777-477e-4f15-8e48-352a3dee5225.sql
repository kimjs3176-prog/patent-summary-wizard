CREATE TABLE IF NOT EXISTS public.product_image_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patent_number text NOT NULL UNIQUE,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_product_image_cache_patent ON public.product_image_cache(patent_number);
CREATE INDEX IF NOT EXISTS idx_product_image_cache_expires ON public.product_image_cache(expires_at);

ALTER TABLE public.product_image_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read product image cache"
  ON public.product_image_cache FOR SELECT
  USING (true);