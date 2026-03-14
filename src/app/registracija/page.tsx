"use client";

import Link from "next/link";
import { Button } from "@/components/Button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/authContext";

export default function RegistracijaPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Įvesk el. paštą ir slaptažodį.");
      return;
    }
    if (password.length < 6) {
      setError("Slaptažodis turi būti bent 6 simbolių.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Slaptažodžiai nesutampa.");
      return;
    }
    setIsSubmitting(true);
    const { error: err } = await signUp(email.trim(), password);
    setIsSubmitting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSuccess(true);
    router.refresh();
  }

  if (success) {
    return (
      <div className="min-h-screen text-slate-900">
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-rose-50 px-4 py-10">
          <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-lg ring-1 ring-slate-100 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mt-4 text-sm font-semibold text-slate-800">Paskyra sukurta</h2>
            <p className="mt-2 text-xs text-slate-600">
              Patikrink el. paštą – galime išsiuntę patvirtinimo nuorodą. Kai patvirtinsi, galėsi{" "}
              <Link href="/prisijungti" className="font-medium text-sky-600 underline">prisijungti</Link>.
            </p>
            <p className="mt-4 text-[11px] text-slate-500">
              Jei Supabase nustatymuose el. patvirtinimas išjungtas, gali iš karto{" "}
              <Link href="/prisijungti" className="font-medium text-sky-600 underline">prisijungti</Link>.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block text-[11px] text-slate-500 hover:underline"
            >
              ← Atgal į pradžią
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900">
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-rose-50 px-4 py-10">
        <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-lg ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-800">Registracija</h1>
              <p className="text-xs text-slate-500">Sukurk naują paskyrą</p>
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
                Slaptažodis (min. 6 simboliai)
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-[11px] font-medium text-slate-600">
                Pakartok slaptažodį
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-[11px] text-rose-600">{error}</p>}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-sky-600 text-white hover:bg-sky-700"
            >
              {isSubmitting ? "Kuriama..." : "Registruotis"}
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Jau turi paskyrą?{" "}
            <Link href="/prisijungti" className="font-medium text-sky-600 underline-offset-2 hover:underline">
              Prisijunk
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
