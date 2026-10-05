import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
          Access restricted
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">You do not have permission to view this page.</h1>
        <p className="mt-4 text-slate-600">
          Your account role does not allow access to this section of the system. Please contact your administrator if you believe this is a mistake.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Back to dashboard
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Sign in again
          </Link>
        </div>
      </div>
    </div>
  );
}
