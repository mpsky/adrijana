"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { setBabyInfo } from "@/lib/babyStorage";

type InviteWithBaby = {
  id: string;
  code: string;
  baby_id: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  baby_name: string;
  baby_birth_iso: string | null;
};

export default function PakvietimasPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [invite, setInvite] = useState<InviteWithBaby | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const code = params.code;

  useEffect(() => {
    if (!code) return;
    async function loadInvite() {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("baby_invites")
        .select(
          "id, code, baby_id, used_by, used_at, expires_at, babies(name, birth_iso)"
        )
        .eq("code", code)
        .maybeSingle();

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      if (!data) {
        setError("Pakvietimas nerastas.");
        setIsLoading(false);
        return;
      }

      const baby = (data as any).babies;
      const mapped: InviteWithBaby = {
        id: data.id as string,
        code: data.code as string,
        baby_id: data.baby_id as string,
        used_by: (data.used_by as string) ?? null,
        used_at: (data.used_at as string) ?? null,
        expires_at: (data.expires_at as string) ?? null,
        baby_name: baby?.name ?? "Kūdikis",
        baby_birth_iso: baby?.birth_iso ?? null,
      };

      if (mapped.used_by) {
        setError("Šis pakvietimo kodas jau panaudotas.");
        setIsLoading(false);
        return;
      }

      setInvite(mapped);
      setIsLoading(false);
    }

    loadInvite();
  }, [code]);

  async function handleAccept() {
    if (!user || !invite) return;
    setIsAccepting(true);
    setError(null);
    try {
      // Patikrinti, ar jau yra narystė
      const { data: existing } = await supabase
        .from("baby_members")
        .select("baby_id")
        .eq("baby_id", invite.baby_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("baby_members").insert({
          baby_id: invite.baby_id,
          user_id: user.id,
          role: "parent",
        });
      }

      await supabase
        .from("baby_invites")
        .update({
          used_by: user.id,
          used_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      if (invite.baby_birth_iso) {
        setBabyInfo({
          name: invite.baby_name,
          birthIso: invite.baby_birth_iso,
        });
      }

      router.push("/");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Nepavyko priimti pakvietimo.");
    } finally {
      setIsAccepting(false);
    }
  }

  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Pakvietimo kodas nerastas.</p>
      </div>
    );
  }

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Kraunama...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-rose-50 px-4 py-10">
        <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-lg ring-1 ring-slate-100 text-center">
          <h1 className="text-sm font-semibold text-slate-800">
            Pakvietimui priimti reikia prisijungti
          </h1>
          <p className="mt-2 text-xs text-slate-600">
            Prisijunk arba užsiregistruok, tada dar kartą atidaryk pakvietimo
            nuorodą su šiuo kodu:
          </p>
          <p className="mt-3 font-mono text-sm tracking-wide">{code}</p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/registracija"
              className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700"
            >
              Registruotis
            </Link>
            <Link
              href="/prisijungti"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Prisijungti
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-rose-50 px-4 py-10 text-slate-900">
      <main className="mx-auto w-full max-w-md rounded-3xl bg-white/95 p-6 shadow-lg ring-1 ring-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 ring-1 ring-sky-200">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Pakvietimas prisijungti prie kūdikio
            </p>
            <p className="text-sm font-medium text-slate-800">
              {invite?.baby_name ?? "Kūdikis"}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[11px] text-rose-600">
            {error}
          </p>
        )}

        {invite && !error && (
          <div className="mt-4 space-y-3 text-xs text-slate-700">
            <p>
              Priėmęs šį pakvietimą, matysi tą patį kūdikį ir įrašus kaip ir
              pakvietėjas.
            </p>
            <p className="font-semibold">
              Pakvietimo kodas:{" "}
              <span className="font-mono">{invite.code}</span>
            </p>
            {invite.baby_birth_iso && (
              <p className="text-slate-500">
                Gimimo data:{" "}
                {new Date(invite.baby_birth_iso).toLocaleString("lt-LT", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </p>
            )}
            <button
              type="button"
              disabled={isAccepting}
              onClick={handleAccept}
              className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAccepting ? "Jungiama..." : "Priimti pakvietimą"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

