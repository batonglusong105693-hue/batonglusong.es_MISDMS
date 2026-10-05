import { PrismaClient, type GradeLevel, type DocumentCategory, type DocumentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_DATABASE !== "true") {
    throw new Error("Refusing to run the seed script in production without SEED_DATABASE=true.");
  }

  console.log("🌱 Seeding Batong Lusong Elementary School database...");

  const existingUserCount = await prisma.user.count();
  if (existingUserCount > 0 && process.env.SEED_DATABASE_FORCE !== "true") {
    console.log("ℹ️ Database already contains users; skipping demo seed data.");
    return;
  }

  // ========== USERS ==========
  const admin = await prisma.user.upsert({
    where: { email: "admin@bles.edu.ph" },
    update: {},
    create: {
      name: "Juan Dela Cruz",
      email: "admin@bles.edu.ph",
      password: await bcrypt.hash("admin123", 10),
      role: "SUPER_ADMIN",
      department: "School Administration",
      position: "Super Admin / System Administrator",
      employeeNumber: "BLE-001",
      status: "ACTIVE",
    },
  });

  const principal = await prisma.user.upsert({
    where: { email: "principal@bles.edu.ph" },
    update: {},
    create: {
      name: "Maria Santos",
      email: "principal@bles.edu.ph",
      password: await bcrypt.hash("principal123", 10),
      role: "PRINCIPAL",
      department: "School Administration",
      position: "School Principal I",
      employeeNumber: "BLE-002",
      status: "ACTIVE",
    },
  });

  const adminOfficer = await prisma.user.upsert({
    where: { email: "admin.officer@bles.edu.ph" },
    update: {},
    create: {
      name: "Ana Reyes",
      email: "admin.officer@bles.edu.ph",
      password: await bcrypt.hash("adminofficer123", 10),
      role: "ADMIN_OFFICER",
      department: "School Administration",
      position: "Administrative Officer",
      employeeNumber: "BLE-003",
      status: "ACTIVE",
    },
  });

  const teacherData = [
    { name: "Liza Mendoza", email: "liza.mendoza@bles.edu.ph", position: "Teacher III - Kinder", employeeNumber: "BLE-005" },
    { name: "Carlos Villanueva", email: "carlos.villanueva@bles.edu.ph", position: "Teacher II - Grade 1", employeeNumber: "BLE-006" },
    { name: "Grace Aquino", email: "grace.aquino@bles.edu.ph", position: "Teacher II - Grade 2", employeeNumber: "BLE-007" },
    { name: "Dennis Ramos", email: "dennis.ramos@bles.edu.ph", position: "Teacher III - Grade 3", employeeNumber: "BLE-008" },
    { name: "Susan Bautista", email: "susan.bautista@bles.edu.ph", position: "Master Teacher I - Grade 4", employeeNumber: "BLE-009" },
    { name: "Mark Del Rosario", email: "mark.delrosario@bles.edu.ph", position: "Teacher III - Grade 5", employeeNumber: "BLE-010" },
    { name: "Elena Navarro", email: "elena.navarro@bles.edu.ph", position: "Master Teacher II - Grade 6", employeeNumber: "BLE-011" },
  ];

  const teacherPassword = await bcrypt.hash("teacher123", 10);
  const teachers = [];
  for (const t of teacherData) {
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { ...t, password: teacherPassword, role: "ADVISER", department: "Teaching", status: "ACTIVE" },
    });
    teachers.push(user);
  }

  console.log(`✅ Created ${teachers.length + 3} users`);

  // ========== ACADEMIC YEAR ==========
  const sy2025 = await prisma.academicYear.upsert({
    where: { year: "2025-2026" },
    update: { isCurrent: true },
    create: { year: "2025-2026", isCurrent: true, startDate: new Date("2025-06-02"), endDate: new Date("2026-04-30") },
  });

  await prisma.academicYear.updateMany({
    where: { year: { not: "2025-2026" } },
    data: { isCurrent: false },
  });

  // ========== SECTIONS ==========
  const sectionData: Array<{ name: string; gradeLevel: GradeLevel; adviser: (typeof teachers)[number] }> = [
    { name: "Sampaguita", gradeLevel: "KINDERGARTEN", adviser: teachers[0] },
    { name: "Mabini", gradeLevel: "GRADE_1", adviser: teachers[1] },
    { name: "Bonifacio", gradeLevel: "GRADE_2", adviser: teachers[2] },
    { name: "Rizal", gradeLevel: "GRADE_3", adviser: teachers[3] },
    { name: "Luna", gradeLevel: "GRADE_4", adviser: teachers[4] },
    { name: "Del Pilar", gradeLevel: "GRADE_5", adviser: teachers[5] },
    { name: "Jacinto", gradeLevel: "GRADE_6", adviser: teachers[6] },
  ];

  const sections = [];
  for (const s of sectionData) {
    const section = await prisma.section.upsert({
      where: { name_gradeLevel_academicYearId: { name: s.name, gradeLevel: s.gradeLevel, academicYearId: sy2025.id } },
      update: { adviserId: s.adviser.id },
      create: {
        name: s.name,
        gradeLevel: s.gradeLevel,
        type: "REGULAR",
        capacity: 40,
        adviserId: s.adviser.id,
        academicYearId: sy2025.id,
      },
    });
    sections.push(section);
  }
  console.log(`✅ Created ${sections.length} sections`);

  // ========== SUBJECTS ==========
  const subjects: Array<[string, string, GradeLevel]> = [
    ["Filipino", "FIL", "GRADE_1"], ["English", "ENG", "GRADE_1"], ["Mathematics", "MATH", "GRADE_1"],
    ["Science", "SCI", "GRADE_3"], ["Araling Panlipunan", "AP", "GRADE_1"], ["MAPEH", "MAPEH", "GRADE_1"],
    ["Edukasyon sa Pagpapakatao", "ESP", "GRADE_1"], ["Mother Tongue", "MTB", "GRADE_1"],
    ["Filipino", "FIL", "GRADE_2"], ["English", "ENG", "GRADE_2"], ["Mathematics", "MATH", "GRADE_2"],
    ["Araling Panlipunan", "AP", "GRADE_2"], ["MAPEH", "MAPEH", "GRADE_2"], ["Edukasyon sa Pagpapakatao", "ESP", "GRADE_2"],
    ["Mother Tongue", "MTB", "GRADE_2"], ["Filipino", "FIL", "GRADE_3"], ["English", "ENG", "GRADE_3"],
    ["Mathematics", "MATH", "GRADE_3"], ["Science", "SCI", "GRADE_3"], ["Araling Panlipunan", "AP", "GRADE_3"],
    ["MAPEH", "MAPEH", "GRADE_3"], ["Edukasyon sa Pagpapakatao", "ESP", "GRADE_3"],
    ["Filipino", "FIL", "GRADE_4"], ["English", "ENG", "GRADE_4"], ["Mathematics", "MATH", "GRADE_4"],
    ["Science", "SCI", "GRADE_4"], ["Araling Panlipunan", "AP", "GRADE_4"], ["MAPEH", "MAPEH", "GRADE_4"],
    ["Edukasyon sa Pagpapakatao", "ESP", "GRADE_4"], ["Edukasyong Pantahanan at Pangkabuhayan", "EPP", "GRADE_4"],
    ["Filipino", "FIL", "GRADE_5"], ["English", "ENG", "GRADE_5"], ["Mathematics", "MATH", "GRADE_5"],
    ["Science", "SCI", "GRADE_5"], ["Araling Panlipunan", "AP", "GRADE_5"], ["MAPEH", "MAPEH", "GRADE_5"],
    ["Edukasyon sa Pagpapakatao", "ESP", "GRADE_5"], ["Edukasyong Pantahanan at Pangkabuhayan", "EPP", "GRADE_5"],
    ["Filipino", "FIL", "GRADE_6"], ["English", "ENG", "GRADE_6"], ["Mathematics", "MATH", "GRADE_6"],
    ["Science", "SCI", "GRADE_6"], ["Araling Panlipunan", "AP", "GRADE_6"], ["MAPEH", "MAPEH", "GRADE_6"],
    ["Edukasyon sa Pagpapakatao", "ESP", "GRADE_6"], ["Edukasyong Pantahanan at Pangkabuhayan", "EPP", "GRADE_6"],
  ];

  for (const [name, shortName, gradeLevel] of subjects) {
    await prisma.subject.upsert({
      where: { name_gradeLevel: { name, gradeLevel } },
      update: {},
      create: { name, shortName, gradeLevel, isCore: true, order: 0 },
    });
  }
  console.log(`✅ Created ${subjects.length} subjects`);

  // ========== STUDENTS ==========
  const firstNames = ["Juan", "Maria", "Jose", "Ana", "Pedro", "Rosa", "Miguel", "Liza", "Andres", "Carmen", "Paolo", "Angela", "Rafael", "Kristine", "Dante", "Maricel", "Erwin", "Gina", "Noel", "Divina"];
  const lastNames = ["Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Villanueva", "Mendoza", "Torres", "Flores", "Ramos", "Aquino", "Navarro", "Dela Cruz", "Garcia", "Rivera", "Domingo", "Castillo", "Gonzales", "Lopez", "Martinez"];
  const middleNames = ["P.", "R.", "D.", "M.", "S.", "L.", "T.", "B.", "C.", "N."];
  const barangays = ["Batong Lusong", "San Isidro", "Cuta", "Kumintang Ibaba", "Balagtas", "Dumamay", "Sico", "Sta. Clara", "Gulod Itaas", "Talahib Pandayan"];
  const bloodTypes = ["O+", "A+", "B+", "AB+", "O-", "A-"];

  await prisma.enrollment.deleteMany({});
  await prisma.student.deleteMany({});

  let lrnCounter = 136050120001;

  for (let i = 0; i < 100; i++) {
    const gradeIdx = Math.floor(i / 14) % 7;
    const fn = firstNames[i % 20];
    const ln = lastNames[i % 20];
    const mn = middleNames[i % 10];
    const gender = i % 2 === 0 ? "FEMALE" : "MALE";
    const birthYear = 2014 + (6 - gradeIdx);
    const month = (i % 12) + 1;
    const day = (i % 28) + 1;
    const is4ps = i % 3 === 0;
    const isIP = i % 7 === 0;
    const section = sections[gradeIdx];

    const student = await prisma.student.create({
      data: {
        lrn: (lrnCounter++).toString(),
        firstName: fn,
        middleName: mn,
        lastName: ln,
        extensionName: i % 50 === 0 ? "Jr." : null,
        gender,
        birthDate: new Date(birthYear, month - 1, day),
        birthPlace: `Brgy. ${barangays[i % 10]}, Batangas City`,
        nationality: "Filipino",
        religion: i % 4 === 0 ? "Roman Catholic" : i % 4 === 1 ? "Iglesia Ni Cristo" : i % 4 === 2 ? "Born Again" : null,
        address: `${(i % 99) + 1} Purok ${(i % 5) + 1}, Brgy. ${barangays[i % 10]}`,
        barangay: barangays[i % 10],
        city: "Batangas City",
        province: "Batangas",
        zipCode: "4200",
        motherTongue: "Tagalog",
        indigenousGroup: isIP ? "Mangyan" : null,
        is4PsBeneficiary: is4ps,
        isLWD: i % 20 === 0,
        isCCT: is4ps,
        bloodType: bloodTypes[i % 6],
        fatherName: `${firstNames[(i + 3) % 20]} ${mn} ${ln}`,
        fatherOccupation: ["Farmer", "Fisherman", "Construction Worker", "Driver", "Carpenter"][i % 5],
        motherName: `${firstNames[(i + 11) % 20]} ${middleNames[(i + 1) % 10]} ${lastNames[(i + 7) % 20]}`,
        motherOccupation: ["Housewife", "Sari-sari Store Owner", "Factory Worker", "Laundry Woman", "Vendor"][i % 5],
        guardianName: i % 4 === 0 ? null : `${firstNames[(i + 17) % 20]} ${ln}`,
        guardianRelationship: i % 4 === 0 ? null : ["Aunt", "Uncle", "Grandmother", "Older Sibling"][i % 4],
        guardianContact: `0917${String(1000000 + i * 123).slice(0, 7)}`,
        guardianAddress: `Brgy. ${barangays[i % 10]}, Batangas City`,
        emergencyContactName: `${firstNames[(i + 5) % 20]} ${lastNames[(i + 3) % 20]}`,
        emergencyContactNumber: `0928${String(2000000 + i * 456).slice(0, 7)}`,
        emergencyContactRelation: ["Mother", "Father", "Guardian", "Relative"][i % 4],
        status: "ENROLLED",
        createdById: adminOfficer.id,
      },
    });

    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        sectionId: section.id,
        academicYearId: sy2025.id,
        status: "ENROLLED",
        dateEnrolled: new Date("2025-06-02"),
        createdById: adminOfficer.id,
      },
    });
  }
  console.log("✅ Created 100 students with enrollments");

  // ========== DOCUMENTS ==========
  const docs: Array<{ title: string; category: DocumentCategory; status: DocumentStatus; ref: string; confidential: boolean }> = [
    { title: "DepEd Order No. 21, s. 2025 - Implementing Guidelines on School Calendar", category: "DEPED_ORDER", status: "ARCHIVED", ref: "DO-2025-021", confidential: false },
    { title: "Division Memorandum - Mid-Year INSET Schedule", category: "DEPED_MEMORANDUM", status: "APPROVED", ref: "DM-2025-118", confidential: false },
    { title: "School MOOE Plan for SY 2025-2026", category: "FINANCIAL_MOOE", status: "PENDING_REVIEW", ref: "BLES-MOOE-2025", confidential: true },
    { title: "First Quarter Test Results - Grade 6", category: "STUDENT_RECORD", status: "APPROVED", ref: "BLES-SR-Q1-2025", confidential: true },
    { title: "Inventory of School Furniture and Equipment", category: "INVENTORY", status: "RELEASED", ref: "BLES-INV-2025", confidential: false },
    { title: "Lesson Plan - Science 4: States of Matter", category: "LESSON_PLAN", status: "ARCHIVED", ref: "BLES-LP-SCI4-025", confidential: false },
    { title: "SF1 School Register - Grade 3 - Rizal", category: "SCHOOL_FORM", status: "APPROVED", ref: "BLES-SF1-G3-RIZAL", confidential: true },
    { title: "Request for Quotation - Laptop Units", category: "PROCUREMENT", status: "PENDING_REVIEW", ref: "BLES-RFQ-2025-014", confidential: false },
    { title: "Letter to Parents - School Field Trip", category: "CORRESPONDENCE", status: "RELEASED", ref: "BLES-LTR-2025-089", confidential: false },
    { title: "Students' 201 Files (Batch 2019-2025)", category: "STUDENT_RECORD", status: "ARCHIVED", ref: "BLES-201F-ARCHIVE", confidential: true },
  ];

  for (const d of docs) {
    await prisma.document.create({
      data: {
        title: d.title,
        description: `${d.title} - Batong Lusong Elementary School`,
        fileUrl: `/uploads/documents/${Date.now()}-sample.pdf`,
        fileType: "PDF",
        fileSize: Math.floor(Math.random() * 900000) + 100000,
        category: d.category,
        status: d.status,
        tags: ["official", "bles", "2025"],
        metadata: { dateReceived: new Date("2025-06-15"), sender: "SDO Batangas City", actionTaken: "Received and filed" },
        version: 1,
        isConfidential: d.confidential,
        referenceNumber: d.ref,
        dateReceived: new Date("2025-06-15"),
        sender: "SDO Batangas City",
        recipient: "Batong Lusong ES",
        uploadedById: admin.id,
        createdById: admin.id,
        auditLogs: {
          create: {
            action: "CREATED",
            performedById: admin.id,
            details: "Document uploaded during seeding",
          },
        },
      },
    });
  }
  console.log(`✅ Created ${docs.length} sample documents`);

  await prisma.announcement.create({
    data: {
      title: "Welcome to School Year 2025-2026!",
      content: "Welcome back! Classes start on June 2, 2025. Please be guided by the approved school calendar. Regular attendance is expected for all learners.",
      authorId: principal.id,
    },
  });
  await prisma.announcement.create({
    data: {
      title: "First Quarterly Test Schedule",
      content: "The first quarterly examinations will be held on the last week of July. Teachers are requested to submit test questions at least 3 days before.",
      authorId: principal.id,
    },
  });

  console.log("✅ Seed complete!");
  console.log("🎉 Batong Lusong Elementary School database is ready!");
  console.log("Demo logins:");
  console.log("  admin@bles.edu.ph / admin123");
  console.log("  principal@bles.edu.ph / principal123");
  console.log("  admin officer: admin.officer@bles.edu.ph / adminofficer123");
  console.log("  liza.mendoza@bles.edu.ph / teacher123");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });