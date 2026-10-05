"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { rolePermissions } from "@/lib/permissions";
import { LayoutDashboard, Users, GraduationCap, BookOpen, FileText, ClipboardList, FolderArchive, LogOut, ShieldCheck, Package } from "lucide-react";

const navGroups = [
  { label: "Main", items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Management", items: [
    { href: "/students", label: "Students", icon: Users },
    { href: "/my-students", label: "My Students", icon: Users },
    { href: "/faculty", label: "Faculty & Staff", icon: GraduationCap },
    { href: "/sections", label: "Sections", icon: BookOpen },
    { href: "/enrollment", label: "Enrollment", icon: ClipboardList },
  ]},
  { label: "Documents", items: [
    { href: "/documents", label: "Document Archive", icon: FolderArchive },
    { href: "/documents/released", label: "Released Logs", icon: FileText },
  ]},
  { label: "System", items: [
    { href: "/inventory", label: "Inventory", icon: Package },
    { href: "/alerts", label: "Alerts & Notifications", icon: ShieldCheck },
    { href: "/audit-logs", label: "Audit Logs", icon: ShieldCheck },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user?.role ?? "ADMIN_SUPPORT") as string;
  const roleConfig = rolePermissions[role];
  if (!roleConfig) return null;

  const canAccess = (href: string) =>
    role === "SUPER_ADMIN" || roleConfig.routes.some((r) => href === r || href.startsWith(r + "/"));

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    window.location.assign(`${window.location.origin}/login`);
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-blue-700 p-1 text-white">
          <Image src="/bles-logo.png" alt="School Logo" width={36} height={36} className="h-full w-full object-contain" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">BLES DMS-MIS</p>
          <p className="text-xs text-slate-500">Batong Lusong ES</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const items = group.items.filter((i) => canAccess(i.href));
          if (!items.length) return null;
          return (
            <div key={group.label} className="mb-6">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
              <ul className="space-y-1">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <li key={item.href}>
                      <Link href={item.href} className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}>
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
            {session?.user?.name?.charAt(0) ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-slate-900">{session?.user?.name}</p>
            <p className="truncate text-xs text-slate-500">{roleConfig.label}</p>
          </div>
          <button onClick={handleSignOut} className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}