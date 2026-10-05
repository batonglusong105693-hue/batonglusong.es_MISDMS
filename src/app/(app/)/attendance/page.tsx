"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Calendar, Users, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { hasPermission, type Role } from "@/lib/permissions";

interface Student {
  id: string;
  lrn: string;
  firstName: string;
  lastName: string;
}

interface Section {
  id: string;
  name: string;
  gradeLevel: string;
}

interface AttendanceEntry {
  enrollmentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  remarks?: string;
}

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-800 hover:bg-green-200",
  ABSENT: "bg-red-100 text-red-800 hover:bg-red-200",
  LATE: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
  EXCUSED: "bg-blue-100 text-blue-800 hover:bg-blue-200",
};

export default function AttendancePage() {
  const { data: session } = useSession();
  const canManageAttendance = session?.user?.role
    ? hasPermission(session.user.role as Role, "attendance:manage")
    : false;
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollmentByStudent, setEnrollmentByStudent] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [error, setError] = useState("");

  // Fetch sections (for teacher: their assigned sections)
  useEffect(() => {
    const fetchSections = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/sections");
        if (!res.ok) throw new Error("Failed to fetch sections");
        const data = await res.json();
        const sectionList = Array.isArray(data) ? data : (data?.data ?? []);
        setSections(sectionList);
        if (sectionList.length > 0) {
          setSelectedSection(sectionList[0].id);
        }
      } catch (err) {
        setError("Failed to load sections");
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, []);

  // Fetch students in section and today's attendance
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedSection) return;

      try {
        setLoading(true);
        const res = await fetch(`/api/attendance?sectionId=${selectedSection}&date=${selectedDate}`);
        if (!res.ok) throw new Error("Failed to fetch attendance");

        const records = await res.json();

        // Get enrollments for section
        const enrollRes = await fetch(`/api/enrollment?sectionId=${selectedSection}`);
        if (!enrollRes.ok) throw new Error("Failed to fetch enrollments");

        const enrollments = await enrollRes.json();
        setStudents(enrollments.map((e: any) => e.student));
        setEnrollmentByStudent(
          Object.fromEntries(enrollments.map((e: any) => [e.student.id, e.id]))
        );

        // Initialize attendance from existing records
        const attendanceMap: Record<string, AttendanceStatus> = {};
        records.forEach((record: any) => {
          attendanceMap[record.enrollmentId] = record.status;
        });
        setAttendance(attendanceMap);
      } catch (err) {
        setError("Failed to load students");
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [selectedSection, selectedDate]);

  const handleStatusChange = (enrollmentId: string, status: AttendanceStatus) => {
    if (!canManageAttendance) return;
    setAttendance((prev) => {
      const next = { ...prev };
      if (status === prev[enrollmentId]) delete next[enrollmentId];
      else next[enrollmentId] = status;
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedSection || !canManageAttendance) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const records = students.map((student) => ({
        enrollmentId: enrollmentByStudent[student.id],
        status: attendance[enrollmentByStudent[student.id]] || "PRESENT",
      }));

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: selectedSection,
          date: selectedDate,
          records,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save attendance");
      }

      setSuccessMessage(`✓ Attendance saved for ${students.length} students`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const section = sections.find((s) => s.id === selectedSection);
  const presentCount = Object.values(attendance).filter((s) => s === "PRESENT").length;
  const absentCount = Object.values(attendance).filter((s) => s === "ABSENT").length;
  const lateCount = Object.values(attendance).filter((s) => s === "LATE").length;
  const excusedCount = Object.values(attendance).filter((s) => s === "EXCUSED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Attendance Management</h1>
          <p className="mt-1 text-sm text-slate-500">Mark student attendance for the day</p>
        </div>
        <Calendar className="h-8 w-8 text-blue-600" />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Section & Date Selection */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Section</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select a section...</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} - Grade {s.gradeLevel}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Summary Stats */}
      {section && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-blue-50 p-3">
            <div className="text-xs text-blue-600 font-medium">Present</div>
            <div className="mt-1 text-2xl font-bold text-blue-900">{presentCount}</div>
          </div>
          <div className="rounded-lg bg-red-50 p-3">
            <div className="text-xs text-red-600 font-medium">Absent</div>
            <div className="mt-1 text-2xl font-bold text-red-900">{absentCount}</div>
          </div>
          <div className="rounded-lg bg-yellow-50 p-3">
            <div className="text-xs text-yellow-600 font-medium">Late</div>
            <div className="mt-1 text-2xl font-bold text-yellow-900">{lateCount}</div>
          </div>
          <div className="rounded-lg bg-purple-50 p-3">
            <div className="text-xs text-purple-600 font-medium">Excused</div>
            <div className="mt-1 text-2xl font-bold text-purple-900">{excusedCount}</div>
          </div>
        </div>
      )}

      {/* Student Attendance Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">Select a section to view students</p>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Student</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">LRN</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900">Attendance</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const enrollmentId = enrollmentByStudent[student.id];
                  const currentStatus = attendance[enrollmentId];

                  return (
                    <tr key={student.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{student.lrn}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-1">
                          {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((status) => (
                            <button
                              key={status}
                              type="button"
                              disabled={!canManageAttendance}
                              onClick={() => handleStatusChange(enrollmentId, status)}
                              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                currentStatus === status
                                  ? STATUS_COLORS[status]
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {status[0]}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save Button */}
      {students.length > 0 && canManageAttendance && (
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving || Object.keys(attendance).length === 0}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      )}

      {/* Quick Reference */}
      <div className="rounded-lg bg-blue-50 p-4">
        <h3 className="text-sm font-semibold text-blue-900">Quick Reference</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-blue-800 sm:grid-cols-4">
          <div>
            <span className="font-medium">P</span> = Present
          </div>
          <div>
            <span className="font-medium">A</span> = Absent
          </div>
          <div>
            <span className="font-medium">L</span> = Late
          </div>
          <div>
            <span className="font-medium">E</span> = Excused
          </div>
        </div>
      </div>
    </div>
  );
}
