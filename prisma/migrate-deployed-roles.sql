-- Consolidate user roles for the deployed school setup.
-- Run this against the existing PostgreSQL database before prisma generate/deploy.
-- This version is idempotent and safe to rerun on an already-migrated database.
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Role_deployed'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "Role_deployed" AS ENUM (
      'SUPER_ADMIN',
      'PRINCIPAL',
      'ADMIN_OFFICER',
      'ADMIN_SUPPORT',
      'TEACHER',
      'ADVISER'
    );
  END IF;
END $$;

ALTER TABLE IF EXISTS "User" ALTER COLUMN "role" DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'role'
  ) THEN
    ALTER TABLE "User"
      ALTER COLUMN "role" TYPE "Role_deployed"
      USING (
        CASE "role"::text
          WHEN 'REGISTRAR' THEN 'ADMIN_OFFICER'
          WHEN 'ICT_COORDINATOR' THEN 'ADMIN_OFFICER'
          WHEN 'NON_TEACHING' THEN 'ADMIN_SUPPORT'
          WHEN 'ADVISER' THEN 'ADVISER'
          ELSE "role"::text
        END
      )::"Role_deployed";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Role'
      AND n.nspname = 'public'
  )
  AND EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Role_deployed'
      AND n.nspname = 'public'
  ) THEN
    DROP TYPE "Role";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'Role_deployed'
      AND n.nspname = 'public'
  ) THEN
    ALTER TYPE "Role_deployed" RENAME TO "Role";
  END IF;
END $$;

ALTER TABLE IF EXISTS "User"
  ALTER COLUMN "role" SET DEFAULT 'ADMIN_SUPPORT'::"Role";

COMMIT;
