"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/authContext";

const PUBLIC_PATHS = ["/registracija", "/prisijungti"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Kraunama...</p>
      </div>
    );
  }

  if (!user && !isPublicPath) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-rose-50 px-4 py-10">
        <div className="w-full max-w-md rounded-3xl bg-white/95 p-6 shadow-lg ring-1 ring-slate-100">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-800">
                Norint naudotis programa – reikia užsiregistruoti
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Sukurk paskyrą arba prisijunk, jei jau esi užsiregistravęs.
              </p>
            </div>
            <div className="mt-2 flex w-full flex-col gap-3">
              <Link
                href="/registracija"
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
              >
                Registruotis
              </Link>
              <Link
                href="/prisijungti"
                className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Prisijungti
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
