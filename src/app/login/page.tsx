"use client";

import Image from "next/image";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Mail, AlertCircle, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedCallbackUrl = searchParams.get("callbackUrl");
  const callbackUrl = requestedCallbackUrl?.startsWith("/") && !requestedCallbackUrl.startsWith("//")
    ? requestedCallbackUrl
    : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password. Please try again.");
      setLoading(false);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/10 p-2 backdrop-blur">
            <Image src="/bles-logo.png" alt="School Logo" width={72} height={72} className="h-full w-full object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white">Batong Lusong Elementary School</h1>
          <p className="mt-1 text-sm text-blue-100">
            Management Information System & Document Management System
          </p>
          <p className="mt-1 text-xs text-amber-300">
            School ID: 105693 | Schools Division of San Jose City
          </p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-2xl">
          <h2 className="mb-6 text-lg font-semibold text-slate-900">Sign In</h2>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="teacher@bles.edu.ph"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-700 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <Image
        src="/bg.jpg"
        alt="School Background"
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-blue-950/65" />
      <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-xl bg-white/10" />}>
        <div className="relative z-10">
          <LoginForm />
        </div>
      </Suspense>
    </div>
  );
}
