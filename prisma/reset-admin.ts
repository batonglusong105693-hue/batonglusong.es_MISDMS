import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { initializeDefaultSettings } from "../src/lib/settings";
import { ensureCurrentAcademicYear } from "../src/lib/academic-year";

const prisma = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_CLEAN_DATABASE !== "YES") {
    throw new Error("Set CONFIRM_CLEAN_DATABASE=YES to permanently delete all application data.");
  }

  const name = process.env.NEW_ADMIN_NAME?.trim();
  const email = process.env.NEW_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.NEW_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error("NEW_ADMIN_NAME, NEW_ADMIN_EMAIL, and NEW_ADMIN_PASSWORD are required.");
  }

  if (password.length < 12) {
    throw new Error("NEW_ADMIN_PASSWORD must be at least 12 characters long.");
  }

  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE
      table_record RECORD;
    BEGIN
      FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename <> '_prisma_migrations'
      LOOP
        EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', table_record.tablename);
      END LOOP;
    END
    $$;
  `);

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      department: "School Administration",
      position: "System Administrator",
    },
    select: { id: true, name: true, email: true, role: true },
  });

  await initializeDefaultSettings();
  await ensureCurrentAcademicYear();

  console.log(`Clean database created. New administrator: ${admin.name} <${admin.email}> (${admin.role})`);
  console.log("System defaults and active academic year were reinitialized.");
}

main()
  .catch((error) => {
    console.error("Database reset failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });