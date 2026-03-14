"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { setBabyInfo } from "@/lib/babyStorage";

export default function ProfilisPage() {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();

  const [babyId, setBabyId] = useState<string | null>(null);
  const [babyName, setBabyName] = useState("");
  const [babyBirthInput, setBabyBirthInput] = useState("");
  const [isBabyLoading, setIsBabyLoading] = useState(true);
  const [babyError, setBabyError] = useState<string | null>(null);
  const [babySaved, setBabySaved] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/prisijungti");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    async function loadBaby() {
      setIsBabyLoading(true);
      setBabyError(null);
      // Rasti kūdikį, su kuriuo susietas vartotojas
      const { data: member, error: memberError } = await supabase
        .from("baby_members")
        .select("baby_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();

      if (memberError) {
        setBabyError(memberError.message);
        setIsBabyLoading(false);
        return;
      }

      if (!member?.baby_id) {
        setBabyId(null);
        setBabyName("");
        setBabyBirthInput("");
        setIsBabyLoading(false);
        return;
      }

      const { data: babyRow, error: babyRowError } = await supabase
        .from("babies")
        .select("*")
        .eq("id", member.baby_id)
        .maybeSingle();

      if (babyRowError) {
        setBabyError(babyRowError.message);
        setIsBabyLoading(false);
        return;
      }

      if (!babyRow) {
        setBabyId(null);
        setBabyName("");
        setBabyBirthInput("");
        setIsBabyLoading(false);
        return;
      }

      const id = babyRow.id as string;
      const name = (babyRow.name as string) ?? "";
      const birthIso = (babyRow.birth_iso as string) ?? null;

      setBabyId(id);
      setBabyName(name);
      setBabyBirthInput(
        birthIso ? new Date(birthIso).toISOString().slice(0, 16) : ""
      );
      setIsBabyLoading(false);

      if (birthIso) {
        setBabyInfo({
          name,
          birthIso,
        });
      }
    }

    loadBaby();
  }, [user]);

  async function handleSaveBaby(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const name = babyName.trim();
    if (!name) return;
    setBabyError(null);
    setBabySaved(false);

    const birthIso = (() => {
      if (!babyBirthInput) return null;
      const d = new Date(babyBirthInput);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    })();

    try {
      if (babyId) {
        const { data, error } = await supabase
          .from("babies")
          .update({
            name,
            birth_iso: birthIso,
          })
          .eq("id", babyId)
          .select("*")
          .maybeSingle();

        if (error) throw error;

        if (data && data.birth_iso) {
          setBabyInfo({
            name: (data.name as string) ?? name,
            birthIso: data.birth_iso as string,
          });
        }
      } else {
        const { data, error } = await supabase
          .from("babies")
          .insert({
            name,
            birth_iso: birthIso,
            created_by: user.id,
          })
          .select("*")
          .single();

        if (error) throw error;

        const newBabyId = data.id as string;
        setBabyId(newBabyId);

        await supabase.from("baby_members").insert({
          baby_id: newBabyId,
          user_id: user.id,
          role: "parent",
        });

        if (data.birth_iso) {
          setBabyInfo({
            name: (data.name as string) ?? name,
            birthIso: data.birth_iso as string,
          });
        }
      }

      setBabySaved(true);
      setTimeout(() => setBabySaved(false), 2000);
    } catch (err: any) {
      setBabyError(err.message ?? "Nepavyko išsaugoti kūdikio duomenų.");
    }
  }

  async function handleGenerateInvite() {
    if (!user || !babyId) return;
    setIsGeneratingInvite(true);
    setBabyError(null);
    try {
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const { data, error } = await supabase
        .from("baby_invites")
        .insert({
          baby_id: babyId,
          code,
          created_by: user.id,
        })
        .select("code")
        .single();

      if (error) throw error;

      setInviteCode((data.code as string) ?? code);
    } catch (err: any) {
      setBabyError(err.message ?? "Nepavyko sugeneruoti pakvietimo.");
    } finally {
      setIsGeneratingInvite(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Kraunama...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Nukreipiama į prisijungimą...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900">
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 ring-1 ring-sky-200">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold text-slate-800">
                Mano profilis
              </h1>
              <p className="truncate text-xs text-slate-600">{user.email}</p>
              {user.created_at && (
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Paskyra nuo{" "}
                  {new Date(user.created_at).toLocaleDateString("lt-LT")}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.push("/");
                router.refresh();
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Atsijungti
            </button>
          </div>
        </section>

        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Kūdikio registracija
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Užregistruok kūdikį: vardas, gimimo data ir laikas. Šie duomenys
            rodomi pagrindiniame puslapyje ir svorio skyriuje.
          </p>
          {isBabyLoading ? (
            <p className="mt-2 text-xs text-slate-500">Kraunama...</p>
          ) : (
            <form
              onSubmit={handleSaveBaby}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <label className="block text-[11px] font-medium text-slate-600">
                  Vardas
                </label>
                <input
                  type="text"
                  value={babyName}
                  onChange={(e) => setBabyName(e.target.value)}
                  placeholder="pvz. Adrijana"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <label className="block text-[11px] font-medium text-slate-600">
                  Gimimo data ir laikas
                </label>
                <input
                  type="datetime-local"
                  value={babyBirthInput}
                  onChange={(e) => setBabyBirthInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>
              <button
                type="submit"
                disabled={!babyName.trim()}
                className="shrink-0 rounded-xl bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {babyId ? "Išsaugoti kūdikį" : "Registruoti kūdikį"}
              </button>
            </form>
          )}
          {babySaved && (
            <p className="mt-2 text-[11px] text-emerald-600">Kūdikio duomenys išsaugoti.</p>
          )}
          {babyError && (
            <p className="mt-2 text-[11px] text-rose-600">{babyError}</p>
          )}
        </section>

        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Pakviesti kitą tėtį / mamą
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Sugeneruok pakvietimo kodą ir pasidalink juo su kitu tėčiu ar mama.
            Įvedę kodą, jie matys tą patį kūdikį ir įrašus (kai bus prijungtas
            bendras istorijos dalijimasis).
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!babyId || isGeneratingInvite}
              onClick={handleGenerateInvite}
              className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGeneratingInvite ? "Generuojama..." : "Sugeneruoti pakvietimo kodą"}
            </button>
            {!babyId && (
              <span className="text-[11px] text-slate-500">
                Pirma užregistruok kūdikį aukščiau.
              </span>
            )}
          </div>
          {inviteCode && (
            <div className="mt-3 rounded-2xl bg-sky-50 px-3 py-2 text-[11px] text-sky-800 ring-1 ring-sky-100">
              <p className="font-semibold">Pakvietimo kodas:</p>
              <p className="mt-1 font-mono text-sm tracking-wide">
                {inviteCode}
              </p>
              <p className="mt-1 text-[11px] text-sky-700">
                Nusiųsk šį kodą kitam tėčiui ar mamai. Jie gali jį įvesti
                puslapyje „Pakvietimas“.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Nustatymai
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Kūdikio duomenys, naujas įrašas, visi įrašai – administravimas.
          </p>
          <Link
            href="/admin"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Eiti į nustatymus
          </Link>
        </section>
      </main>
    </div>
  );
}

