import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">404</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-sm text-slate-600">
          The page you requested does not exist or is no longer available.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
        >
          Return to dashboard
        </Link>
      </div>
    </div>
  );
}
