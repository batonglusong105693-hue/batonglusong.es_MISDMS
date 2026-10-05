"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, Users } from "lucide-react";

interface Section {
  id: string;
  name: string;
  gradeLevel: string;
  academicYear: { year: string; isCurrent: boolean };
}

interface RosterStudent {
  id: string;
  lrn: string;
  firstName: string;
  lastName: string;
  sectionId: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { totalPages: number };
}

export default function MyStudentsPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [selectedSection, setSelectedSection] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadRoster = async () => {
      setLoading(true);
      setError("");

      try {
        const firstPageResponse = await fetch("/api/sections?page=1&pageSize=100");
        if (!firstPageResponse.ok) throw new Error("Could not load your assigned sections.");
        const firstPage: PaginatedResponse<Section> = await firstPageResponse.json();
        const remainingPages = await Promise.all(
          Array.from({ length: Math.max(0, firstPage.pagination.totalPages - 1) }, (_, index) =>
            fetch(`/api/sections?page=${index + 2}&pageSize=100`).then(async (response) => {
              if (!response.ok) throw new Error("Could not load your assigned sections.");
              return response.json() as Promise<PaginatedResponse<Section>>;
            })
          )
        );
        const assignedSections = [firstPage, ...remainingPages].flatMap((page) => page.data);

        const rosterGroups = await Promise.all(
          assignedSections.map(async (section) => {
            const query = new URLSearchParams({ sectionId: section.id });
            const response = await fetch(`/api/enrollment?${query.toString()}`);
            if (!response.ok) throw new Error("Could not load a section roster.");
            const enrollments: { student: Omit<RosterStudent, "sectionId"> }[] = await response.json();
            return enrollments.map(({ student }) => ({ ...student, sectionId: section.id }));
          })
        );

        if (!cancelled) {
          setSections(assignedSections);
          setStudents(rosterGroups.flat());
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load your student roster.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadRoster();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredStudents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesSection = selectedSection === "all" || student.sectionId === selectedSection;
      const matchesSearch = !normalizedSearch ||
        `${student.firstName} ${student.lastName} ${student.lrn}`.toLowerCase().includes(normalizedSearch);
      return matchesSection && matchesSearch;
    });
  }, [students, selectedSection, search]);

  const sectionById = new Map(sections.map((section) => [section.id, section]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Students</h1>
        <p className="mt-1 text-sm text-slate-500">Enrolled learners in your assigned sections</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-700" />
            <div>
              <p className="text-sm text-slate-500">Enrolled learners</p>
              <p className="text-xl font-semibold text-slate-900">{loading ? "-" : students.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm text-slate-500">Assigned sections</p>
              <p className="text-xl font-semibold text-slate-900">{loading ? "-" : sections.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or LRN"
            aria-label="Search students by name or LRN"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <select
          value={selectedSection}
          onChange={(event) => setSelectedSection(event.target.value)}
          aria-label="Filter by section"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:min-w-64"
        >
          <option value="all">All assigned sections</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name} · {section.gradeLevel.replace("GRADE_", "Grade ").replace("KINDERGARTEN", "Kindergarten")}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading your students...</div>
        ) : error ? (
          <div role="alert" className="p-6 text-sm text-red-700">{error}</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-800">
              {students.length === 0 ? "No enrolled students in your assigned sections." : "No students match your search."}
            </p>
            {sections.length === 0 && <p className="mt-1 text-sm text-slate-500">No sections are currently assigned to your account.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Learner</th>
                  <th className="px-4 py-3 font-medium">LRN</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Academic year</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const section = sectionById.get(student.sectionId);
                  return (
                    <tr key={`${student.sectionId}:${student.id}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{student.lastName}, {student.firstName}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{student.lrn}</td>
                      <td className="px-4 py-3 text-slate-600">{section?.name ?? "-"} · {section?.gradeLevel.replace("GRADE_", "Grade ").replace("KINDERGARTEN", "Kindergarten") ?? ""}</td>
                      <td className="px-4 py-3 text-slate-600">{section?.academicYear.year ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}