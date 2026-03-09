-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Cleanup (Stergem tabelele vechi daca exista pentru a recrea structura corecta)
DROP FUNCTION IF EXISTS truncate_products();
DROP FUNCTION IF EXISTS truncate_published_products();
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.sync_status CASCADE;
DROP TABLE IF EXISTS public.published_catalog_products CASCADE;
DROP TABLE IF EXISTS public.product_import_issues CASCADE;
DROP TABLE IF EXISTS public.sync_run_sources CASCADE;
DROP TABLE IF EXISTS public.sync_runs CASCADE;
DROP TABLE IF EXISTS public.pricing_rule_versions CASCADE;
DROP TABLE IF EXISTS public.pricing_rules CASCADE;
DROP TABLE IF EXISTS public.source_settings CASCADE;

-- 3. Create Production Tables

CREATE TABLE public.source_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source_identifier text UNIQUE NOT NULL,
    is_active boolean DEFAULT true,
    currency text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.pricing_rules (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source_id uuid REFERENCES public.source_settings(id) ON DELETE CASCADE,
    base_multiplier numeric DEFAULT 1,
    base_discount_percent numeric DEFAULT 0,
    fixed_cost_addition numeric DEFAULT 0,
    vat_multiplier numeric DEFAULT 1,
    margin_multiplier numeric DEFAULT 1,
    exchange_rate numeric DEFAULT 1,
    final_divider numeric DEFAULT 1,
    status text DEFAULT 'active',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.pricing_rule_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_id uuid REFERENCES public.pricing_rules(id) ON DELETE CASCADE,
    base_multiplier numeric,
    base_discount_percent numeric,
    fixed_cost_addition numeric,
    vat_multiplier numeric,
    margin_multiplier numeric,
    exchange_rate numeric,
    final_divider numeric,
    status text,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.sync_runs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    started_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    finished_at timestamp with time zone,
    status text NOT NULL,
    trigger_type text,
    total_raw_products integer DEFAULT 0,
    total_valid_products integer DEFAULT 0,
    total_invalid_products integer DEFAULT 0,
    total_inserted_products integer DEFAULT 0,
    total_skipped_products integer DEFAULT 0,
    error_summary text
);

CREATE TABLE public.sync_run_sources (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE CASCADE,
    source_identifier text NOT NULL,
    raw_count integer DEFAULT 0,
    mapped_count integer DEFAULT 0,
    valid_count integer DEFAULT 0,
    invalid_price_count integer DEFAULT 0,
    invalid_stock_count integer DEFAULT 0,
    missing_image_count integer DEFAULT 0,
    inserted_count integer DEFAULT 0,
    duplicate_count integer DEFAULT 0,
    status text,
    message text
);

CREATE TABLE public.product_import_issues (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sync_run_id uuid REFERENCES public.sync_runs(id) ON DELETE CASCADE,
    source_identifier text,
    external_product_key text,
    issue_type text,
    issue_field text,
    raw_payload_excerpt jsonb,
    message text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.published_catalog_products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    part_number text,
    brand text,
    model text,
    part_description text,
    price numeric,
    old_price numeric,
    stock integer,
    image_url text,
    source_file text,
    
    size text,
    width text,
    pcd text,
    et text,
    finish text,
    product_type text,
    
    metadata jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Indexes for Performance
CREATE INDEX idx_published_brand ON public.published_catalog_products(brand);
CREATE INDEX idx_published_size ON public.published_catalog_products(size);
CREATE INDEX idx_published_pcd ON public.published_catalog_products(pcd);
CREATE INDEX idx_published_width ON public.published_catalog_products(width);
CREATE INDEX idx_published_et ON public.published_catalog_products(et);
CREATE INDEX idx_published_part_number ON public.published_catalog_products(part_number);

-- 5. Helper Function for Fast Truncation
CREATE OR REPLACE FUNCTION truncate_published_products()
RETURNS void AS $$
BEGIN
  TRUNCATE TABLE public.published_catalog_products;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS Policies (Row Level Security)
ALTER TABLE public.source_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_run_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_import_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.published_catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published_catalog_products" ON public.published_catalog_products FOR SELECT USING (true);
CREATE POLICY "Public all published_catalog_products" ON public.published_catalog_products FOR ALL USING (true);
CREATE POLICY "Public all sync_runs" ON public.sync_runs FOR ALL USING (true);
CREATE POLICY "Public all sync_run_sources" ON public.sync_run_sources FOR ALL USING (true);
CREATE POLICY "Public all product_import_issues" ON public.product_import_issues FOR ALL USING (true);
CREATE POLICY "Public all source_settings" ON public.source_settings FOR ALL USING (true);
CREATE POLICY "Public all pricing_rules" ON public.pricing_rules FOR ALL USING (true);
