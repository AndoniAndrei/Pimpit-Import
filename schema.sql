-- 1. Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Cleanup (Stergem tabelele vechi daca exista pentru a recrea structura corecta)
DROP FUNCTION IF EXISTS truncate_products();
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.sync_status CASCADE;

-- 3. Create Products Table
CREATE TABLE public.products (
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
    
    -- Filterable columns (indexed)
    size text,
    width text,
    pcd text,
    et text, -- AM REDENUMIT "offset" IN "et" PENTRU A EVITA EROAREA DE SINTAXA
    finish text,
    product_type text,
    
    -- Extra data stored as JSON
    metadata jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Indexes for Performance
CREATE INDEX idx_products_brand ON public.products(brand);
CREATE INDEX idx_products_size ON public.products(size);
CREATE INDEX idx_products_pcd ON public.products(pcd);
CREATE INDEX idx_products_width ON public.products(width);
CREATE INDEX idx_products_et ON public.products(et);
CREATE INDEX idx_products_part_number ON public.products(part_number);

-- 5. Create Sync Status Table
CREATE TABLE public.sync_status (
    id integer PRIMARY KEY,
    last_synced_at timestamp with time zone,
    is_syncing boolean DEFAULT false
);

-- Initialize status
INSERT INTO public.sync_status (id, last_synced_at, is_syncing)
VALUES (1, to_timestamp(0), false);

-- 6. Helper Function for Fast Truncation
CREATE OR REPLACE FUNCTION truncate_products()
RETURNS void AS $$
BEGIN
  TRUNCATE TABLE public.products;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS Policies (Row Level Security) - Public Access
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_status ENABLE ROW LEVEL SECURITY;

-- Products Policies
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public insert products" ON public.products FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update products" ON public.products FOR UPDATE USING (true);
CREATE POLICY "Public delete products" ON public.products FOR DELETE USING (true);

-- Sync Status Policies
CREATE POLICY "Public read sync" ON public.sync_status FOR SELECT USING (true);
CREATE POLICY "Public update sync" ON public.sync_status FOR UPDATE USING (true);
CREATE POLICY "Public insert sync" ON public.sync_status FOR INSERT WITH CHECK (true);
