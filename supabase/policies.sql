-- Run in Supabase SQL Editor after the table schema exists.
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_master_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_incidents" ON public.incidents;
CREATE POLICY "public_read_incidents"
ON public.incidents FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "public_read_master_data" ON public.system_master_data;
CREATE POLICY "public_read_master_data"
ON public.system_master_data FOR SELECT
TO anon
USING (true);
