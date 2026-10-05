import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { getCurrentAcademicYear } from "@/lib/utils";

export async function getAcademicYearMode(): Promise<"automatic" | "manual"> {
  const mode = await getSetting("academic_year_mode");
  return mode === "manual" ? "manual" : "automatic";
}

export async function getManualAcademicYearOverride(): Promise<string | null> {
  const override = await getSetting("manual_academic_year");
  if (!override || !/^\d{4}-\d{4}$/.test(override)) {
    return null;
  }
  return override;
}

async function syncAcademicYearSetting(year: string) {
  const systemUser = await prisma.user.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  if (!systemUser) return;

  await prisma.systemSetting.upsert({
    where: { key: "academic_year" },
    update: { value: year, updatedById: systemUser.id, updatedAt: new Date() },
    create: {
      key: "academic_year",
      value: year,
      description: "Current academic year",
      category: "academic",
      dataType: "string",
      updatedById: systemUser.id,
    },
  });
}

export async function ensureCurrentAcademicYear() {
  const mode = await getAcademicYearMode();
  const manualYear = mode === "manual" ? await getManualAcademicYearOverride() : null;
  const currentYear = manualYear || getCurrentAcademicYear();

  const activeYear = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  if (activeYear && activeYear.year === currentYear) {
    await syncAcademicYearSetting(currentYear);
    return activeYear;
  }

  const matchingYear = await prisma.academicYear.findUnique({ where: { year: currentYear } });
  if (matchingYear) {
    await prisma.academicYear.updateMany({
      where: { isCurrent: true, id: { not: matchingYear.id } },
      data: { isCurrent: false },
    });

    const updated = await prisma.academicYear.update({
      where: { id: matchingYear.id },
      data: { isCurrent: true },
    });

    await syncAcademicYearSetting(currentYear);
    return updated;
  }

  await prisma.academicYear.updateMany({
    where: { isCurrent: true },
    data: { isCurrent: false },
  });

  const created = await prisma.academicYear.create({
    data: {
      year: currentYear,
      isCurrent: true,
    },
  });

  await syncAcademicYearSetting(currentYear);
  return created;
}

export async function getActiveAcademicYear() {
  return ensureCurrentAcademicYear();
}
