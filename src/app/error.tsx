"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-red-100 p-3 text-red-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">System temporarily unavailable</h1>
        <p className="mt-3 text-sm text-slate-600">
          This page could not load because the application or its database connection is temporarily unavailable.
        </p>

        {/* <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700">
          <p className="font-medium text-slate-900">What to check:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Supabase database is running and reachable.</li>
            <li>Environment variables are set in Vercel.</li>
            <li>NextAuth secrets and database URLs are valid.</li>
          </ul>
        </div> */}

        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>

        {process.env.NODE_ENV === "development" && (
          <pre className="mt-5 overflow-auto rounded-md bg-slate-900 p-3 text-left text-xs text-red-200">
            {error.message}
          </pre>
        )}
      </div>
    </div>
  );
}
