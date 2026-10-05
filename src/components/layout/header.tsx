"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Search, Bell, Settings } from "lucide-react";
import { SuperadminSettingsModal } from "@/components/settings/superadmin-settings";

export function Header() {
  const { data: session } = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-slate-900">
            {session?.user?.name ? `Welcome, ${session.user.name.split(" ")[0]}` : "Welcome"}
          </h1>
        </div>
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search students, documents..."
            className="w-64 rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {session?.user?.role === "SUPER_ADMIN" && (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        )}
        <button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100" title="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
        </button>
      </header>

      {session?.user?.role === "SUPER_ADMIN" && (
        <SuperadminSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}