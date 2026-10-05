-- Enable Row Level Security for every table in the public schema.
-- Run this in Supabase Dashboard > SQL Editor.
-- This does not delete or change existing data.

DO $$
DECLARE
  table_record RECORD;
BEGIN
  FOR table_record IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_record.tablename
    );
  END LOOP;
END
$$;

-- Verify that every public table has RLS enabled.
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
