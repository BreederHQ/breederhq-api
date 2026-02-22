-- Fix: Reset DB state so baseline migration can run cleanly
-- The baseline was marked as applied but DDL never executed.
-- This clears the record and drops the empty marketplace schema.

DELETE FROM public.schema_migrations WHERE version = '20260216185145';
DROP SCHEMA IF EXISTS marketplace CASCADE;
