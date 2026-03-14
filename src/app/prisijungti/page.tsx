"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/authContext";

export default function PrisijungtiPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Įvesk el. paštą ir slaptažodį.");
      return;
    }
    setIsSubmitting(true);
    const { error: err } = await signIn(email.trim(), password);
    setIsSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen text-slate-900">
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-rose-50 px-4 py-10">
        <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-lg ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-800">Prisijungti</h1>
              <p className="text-xs text-slate-500">Įvesk savo duomenis</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[11px] font-medium text-slate-600">
                El. paštas
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                placeholder="pvz. vardas@pastas.lt"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[11px] font-medium text-slate-600">
                Slaptažodis
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-[11px] text-rose-600">{error}</p>}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Prisijungiama..." : "Prisijungti"}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Neturi paskyros?{" "}
            <Link href="/registracija" className="font-medium text-sky-600 underline-offset-2 hover:underline">
              Registruokis
            </Link>
          </p>
          <p className="mt-2 text-center">
            <Link href="/" className="text-[11px] text-slate-500 hover:underline">
              ← Atgal į pradžią
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
