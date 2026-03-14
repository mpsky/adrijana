"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import {
  setBabyInfo,
  toLocalDateTimeInputValue,
  fromLocalDateTimeInputValue,
} from "@/lib/babyStorage";

type EventType = "feeding" | "diaper" | "sleep";
type FeedingMethod = "breast" | "formula" | "pumped";
type DiaperKind = "wet" | "dirty" | "both";

type FeedingEvent = {
  id: string;
  type: "feeding";
  time: string;
  feedingMethod: FeedingMethod;
  amountMl?: number;
  durationMinutes?: number;
};

type DiaperEvent = {
  id: string;
  type: "diaper";
  time: string;
  diaperKind: DiaperKind;
};

type SleepEvent = {
  id: string;
  type: "sleep";
  time: string;
  sleepEnd?: string;
};

type BabyEvent = FeedingEvent | DiaperEvent | SleepEvent;

function formatTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<EventType>("feeding");
  const [feedingMethod, setFeedingMethod] =
    useState<FeedingMethod>("formula");
  const [diaperKind, setDiaperKind] = useState<DiaperKind>("wet");
  const [timeInput, setTimeInput] = useState<string>("");
  const [sleepEndInput, setSleepEndInput] = useState<string>("");
  const [amountMl, setAmountMl] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [babyId, setBabyId] = useState<string | null>(null);
  const [babyName, setBabyName] = useState("");
  const [babyBirthInput, setBabyBirthInput] = useState("");
  const [babySaved, setBabySaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    async function loadBaby() {
      // Rasti kūdikį, su kuriuo susietas šis vartotojas
      const { data: member } = await supabase
        .from("baby_members")
        .select("baby_id")
        .eq("user_id", uid)
        .limit(1)
        .maybeSingle();

      if (!member?.baby_id) {
        // Nėra kūdikio – paliekame tuščią formą
        setBabyId(null);
        setBabyName("");
        setBabyBirthInput("");
        return;
      }

      const { data: baby } = await supabase
        .from("babies")
        .select("*")
        .eq("id", member.baby_id)
        .maybeSingle();

      if (!baby) return;

      setBabyId(baby.id as string);
      setBabyName((baby.name as string) ?? "");
      setBabyBirthInput(
        baby.birth_iso
          ? toLocalDateTimeInputValue(baby.birth_iso as string)
          : ""
      );

      // Sinchronizuojame su localStorage, kad pagrindinis ir svoris matytų tuos pačius duomenis
      if (baby.birth_iso) {
        setBabyInfo({
          name: (baby.name as string) ?? "",
          birthIso: baby.birth_iso as string,
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

    const birthIso = fromLocalDateTimeInputValue(babyBirthInput);

    try {
      if (babyId) {
        // Atnaujinti esamą kūdikį
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

        if (data) {
          setBabyInfo({
            name: (data.name as string) ?? name,
            birthIso: (data.birth_iso as string) ?? birthIso,
          });
        }
      } else {
        // Sukurti naują kūdikį ir narystę
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

        setBabyInfo({
          name: (data.name as string) ?? name,
          birthIso: (data.birth_iso as string) ?? birthIso,
        });
      }

      setBabySaved(true);
      setTimeout(() => setBabySaved(false), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (!authLoading && !user) router.replace("/prisijungti");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("time", { ascending: false });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      const mapped: BabyEvent[] = (data as any[]).map((row) => {
        if (row.type === "feeding") {
          const feeding: FeedingEvent = {
            id: row.id,
            type: "feeding",
            time: row.time,
            feedingMethod: row.feeding_method,
            amountMl: row.amount_ml ?? undefined,
            durationMinutes: row.duration_minutes ?? undefined,
          };
          return feeding;
        }

        if (row.type === "diaper") {
          const diaper: DiaperEvent = {
            id: row.id,
            type: "diaper",
            time: row.time,
            diaperKind: row.diaper_kind,
          };
          return diaper;
        }

        const sleep: SleepEvent = {
          id: row.id,
          type: "sleep",
          time: row.time,
          sleepEnd: row.sleep_end ?? undefined,
        };
        return sleep;
      });

      setEvents(mapped);
      setIsLoading(false);
    }

    load();
  }, [user]);

  const isEditing = !!editingId;

  const sortedByDay = useMemo(() => {
    const groups: Record<string, BabyEvent[]> = {};
    for (const e of events) {
      const d = new Date(e.time);
      const key = d.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [events]);

  function resetForm() {
    setEditingId(null);
    setType("feeding");
    setFeedingMethod("formula");
    setDiaperKind("wet");
    setAmountMl("");
    setDurationMinutes("");
    setSleepEndInput("");
    setError(null);
    setTimeInput("");
  }

  function startEdit(e: BabyEvent) {
    setEditingId(e.id);
    setType(e.type);
    setTimeInput(toLocalDateTimeInputValue(e.time));

    if (e.type === "feeding") {
      setFeedingMethod(e.feedingMethod);
      setAmountMl(e.amountMl ? String(e.amountMl) : "");
      setDurationMinutes(
        e.durationMinutes ? String(e.durationMinutes) : ""
      );
      setSleepEndInput("");
    } else if (e.type === "diaper") {
      setDiaperKind(e.diaperKind);
      setAmountMl("");
      setDurationMinutes("");
      setSleepEndInput("");
    } else if (e.type === "sleep") {
      setAmountMl("");
      setDurationMinutes("");
      setSleepEndInput(
        e.sleepEnd ? toLocalDateTimeInputValue(e.sleepEnd) : ""
      );
    }
  }

  async function handleSave() {
    try {
      setIsSaving(true);
      setError(null);

      if (!timeInput) {
        setError("Pasirink laiką.");
        setIsSaving(false);
        return;
      }

      const timeIso = fromLocalDateTimeInputValue(timeInput);

      if (!editingId) {
        // CREATE
        if (type === "feeding") {
          const isAmountBased =
            feedingMethod === "formula" || feedingMethod === "pumped";
          const payload = {
            user_id: user?.id,
            baby_id: babyId ?? undefined,
            type: "feeding",
            time: timeIso,
            feeding_method: feedingMethod,
            amount_ml:
              isAmountBased && amountMl ? Number(amountMl) || null : null,
            duration_minutes:
              !isAmountBased && durationMinutes
                ? Number(durationMinutes) || null
                : null,
            diaper_kind: null,
            sleep_end: null,
          };

          const { data, error } = await supabase
            .from("events")
            .insert(payload)
            .select("*")
            .single();

          if (error) throw error;

          const newEvent: FeedingEvent = {
            id: data.id,
            type: "feeding",
            time: data.time,
            feedingMethod: data.feeding_method,
            amountMl: data.amount_ml ?? undefined,
            durationMinutes: data.duration_minutes ?? undefined,
          };
          setEvents((prev) => [newEvent, ...prev]);
        } else if (type === "diaper") {
          const payload = {
            user_id: user?.id,
            baby_id: babyId ?? undefined,
            type: "diaper",
            time: timeIso,
            diaper_kind: diaperKind,
            feeding_method: null,
            amount_ml: null,
            duration_minutes: null,
            sleep_end: null,
          };

          const { data, error } = await supabase
            .from("events")
            .insert(payload)
            .select("*")
            .single();

          if (error) throw error;

          const newEvent: DiaperEvent = {
            id: data.id,
            type: "diaper",
            time: data.time,
            diaperKind: data.diaper_kind,
          };
          setEvents((prev) => [newEvent, ...prev]);
        } else {
          const payload = {
            user_id: user?.id,
            baby_id: babyId ?? undefined,
            type: "sleep",
            time: timeIso,
            sleep_end: sleepEndInput
              ? fromLocalDateTimeInputValue(sleepEndInput)
              : null,
            feeding_method: null,
            amount_ml: null,
            duration_minutes: null,
            diaper_kind: null,
          };

          const { data, error } = await supabase
            .from("events")
            .insert(payload)
            .select("*")
            .single();

          if (error) throw error;

          const newEvent: SleepEvent = {
            id: data.id,
            type: "sleep",
            time: data.time,
            sleepEnd: data.sleep_end ?? undefined,
          };
          setEvents((prev) => [newEvent, ...prev]);
        }
      } else {
        // UPDATE
        if (type === "feeding") {
          const isAmountBased =
            feedingMethod === "formula" || feedingMethod === "pumped";
          const payload = {
            type: "feeding",
            time: timeIso,
            feeding_method: feedingMethod,
            amount_ml:
              isAmountBased && amountMl ? Number(amountMl) || null : null,
            duration_minutes:
              !isAmountBased && durationMinutes
                ? Number(durationMinutes) || null
                : null,
            diaper_kind: null,
            sleep_end: null,
          };

          const { data, error } = await supabase
            .from("events")
            .update(payload)
            .eq("id", editingId)
            .select("*")
            .single();

          if (error) throw error;

          const updated: FeedingEvent = {
            id: data.id,
            type: "feeding",
            time: data.time,
            feedingMethod: data.feeding_method,
            amountMl: data.amount_ml ?? undefined,
            durationMinutes: data.duration_minutes ?? undefined,
          };
          setEvents((prev) =>
            prev.map((e) => (e.id === updated.id ? updated : e))
          );
        } else if (type === "diaper") {
          const payload = {
            type: "diaper",
            time: timeIso,
            diaper_kind: diaperKind,
            feeding_method: null,
            amount_ml: null,
            duration_minutes: null,
            sleep_end: null,
          };

          const { data, error } = await supabase
            .from("events")
            .update(payload)
            .eq("id", editingId)
            .select("*")
            .single();

          if (error) throw error;

          const updated: DiaperEvent = {
            id: data.id,
            type: "diaper",
            time: data.time,
            diaperKind: data.diaper_kind,
          };
          setEvents((prev) =>
            prev.map((e) => (e.id === updated.id ? updated : e))
          );
        } else {
          const payload = {
            type: "sleep",
            time: timeIso,
            sleep_end: sleepEndInput
              ? fromLocalDateTimeInputValue(sleepEndInput)
              : null,
            feeding_method: null,
            amount_ml: null,
            duration_minutes: null,
            diaper_kind: null,
          };

          const { data, error } = await supabase
            .from("events")
            .update(payload)
            .eq("id", editingId)
            .select("*")
            .single();

          if (error) throw error;

          const updated: SleepEvent = {
            id: data.id,
            type: "sleep",
            time: data.time,
            sleepEnd: data.sleep_end ?? undefined,
          };
          setEvents((prev) =>
            prev.map((e) => (e.id === updated.id ? updated : e))
          );
        }
      }

      resetForm();
    } catch (err: any) {
      setError(err.message ?? "Nepavyko išsaugoti.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tikrai ištrinti šį įrašą?")) return;
    const prev = events;
    setEvents((cur) => cur.filter((e) => e.id !== id));
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      alert("Klaida trinant: " + error.message);
      setEvents(prev);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-500">Kraunama...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              Admin – įrašų tvarkymas
            </h1>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 sm:text-xs">
              Pridėk senų dienų įrašus, taisyk ar trink jau esančius.
            </p>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <a
              href="/profilis"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-3"
            >
              Profilis
            </a>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-slate-800 sm:px-3"
            >
              ← Pagrindinis
            </a>
          </div>
        </header>

        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Kūdikio duomenys
            </p>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Kūdikio registracija ir redagavimas perkeltas į{" "}
            <a
              href="/profilis"
              className="font-medium text-sky-600 underline-offset-2 hover:underline"
            >
              profilio puslapį
            </a>
            . Šiame lange gali tvarkyti tik įrašus.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,1fr)]">
          <div className="min-w-0 space-y-4 rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {isEditing ? "Redaguoti įrašą" : "Naujas įrašas"}
                </p>
                <p className="text-xs text-slate-500">
                  Tik administravimui – laisvas laiko pasirinkimas.
                </p>
              </div>
              {isEditing && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="shrink-0 text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline"
                >
                  Atšaukti redagavimą
                </button>
              )}
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-600">
                  Data ir laikas
                </label>
                <input
                  type="datetime-local"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-600">
                  Tipas
                </label>
                <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-200 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setType("feeding")}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                      type === "feeding"
                        ? "bg-sky-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Maitinimas
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("diaper")}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                      type === "diaper"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Sauskelnės
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("sleep")}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                      type === "sleep"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Miegas
                  </button>
                </div>
              </div>
            </div>

            {type === "feeding" && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-600">
                    Maitinimo būdas
                  </label>
                  <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-200 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setFeedingMethod("formula")}
                      className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                        feedingMethod === "formula"
                          ? "bg-sky-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Mišinėlis (ml)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedingMethod("breast")}
                      className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                        feedingMethod === "breast"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Krūtimi (min)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedingMethod("pumped")}
                      className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                        feedingMethod === "pumped"
                          ? "bg-sky-600 text-white shadow-sm"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      Mamos pienas (ml)
                    </button>
                  </div>
                </div>

                {feedingMethod === "formula" || feedingMethod === "pumped" ? (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-600">
                      Kiekis (ml)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={amountMl}
                      onChange={(e) => setAmountMl(e.target.value)}
                      placeholder="pvz. 90"
                      className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-600">
                      Trukmė (min)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                )}
              </div>
            )}

            {type === "diaper" && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-600">
                  Sauskelnės
                </label>
                <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-200 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setDiaperKind("wet")}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                      diaperKind === "wet"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Šlapias
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiaperKind("dirty")}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                      diaperKind === "dirty"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Purvinas
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiaperKind("both")}
                    className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${
                      diaperKind === "both"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Abu
                  </button>
                </div>
              </div>
            )}

            {type === "sleep" && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-600">
                  Miego pabaiga (nebūtina)
                </label>
                <input
                  type="datetime-local"
                  value={sleepEndInput}
                  onChange={(e) => setSleepEndInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </div>
            )}

            {error && (
              <p className="text-[11px] text-rose-600">{error}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60 sm:px-4 sm:py-2"
              >
                {isSaving
                  ? "Saugoma..."
                  : isEditing
                  ? "Išsaugoti pakeitimus"
                  : "Pridėti įrašą"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline"
              >
                Išvalyti formą
              </button>
            </div>
          </div>

          <div className="min-w-0 space-y-3 rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Visi įrašai (admin)
              </p>
              {isLoading && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-100">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                  Kraunama...
                </span>
              )}
            </div>
            <div className="max-h-[420px] min-w-0 space-y-3 overflow-y-auto pr-1 text-[11px] sm:text-xs">
              {sortedByDay.length === 0 && !isLoading && (
                <p className="text-[11px] text-slate-500">
                  Nėra įrašų.
                </p>
              )}
              {sortedByDay.map(([day, dayEvents]) => (
                <div
                  key={day}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[11px] font-semibold text-slate-700">
                      {day}
                    </p>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {dayEvents.length} įrašai
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1.5">
                    {dayEvents
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.time).getTime() -
                          new Date(b.time).getTime()
                      )
                      .map((e) => (
                        <div
                          key={e.id}
                          className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-100"
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="truncate text-[10px] font-medium text-slate-800 sm:text-[11px]">
                              <span className="font-mono">
                                {formatTimeLabel(e.time)}
                              </span>{" "}
                              <span className="whitespace-nowrap">
                                {e.type === "feeding" &&
                                  (e.feedingMethod === "formula"
                                    ? `Mišinėlis ${(e.amountMl ?? 0)} ml`
                                    : e.feedingMethod === "pumped"
                                    ? `Mamos pienas ${(e.amountMl ?? 0)} ml`
                                    : `Krūtimi ${(e.durationMinutes ?? 0)} min`)}
                                {e.type === "diaper" &&
                                  `Sauskel. ${
                                    e.diaperKind === "wet"
                                      ? "šlapias"
                                      : e.diaperKind === "dirty"
                                      ? "purvinas"
                                      : "abu"
                                  }`}
                                {e.type === "sleep" &&
                                  (e.sleepEnd
                                    ? `Miegas ${formatTimeLabel(
                                        e.time
                                      )}–${formatTimeLabel(
                                        e.sleepEnd
                                      )}`
                                    : `Miegas nuo ${formatTimeLabel(
                                        e.time
                                      )}`)}
                              </span>
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(e)}
                              className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-700 hover:bg-slate-200 sm:text-[10px]"
                            >
                              Redaguoti
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(e.id)}
                              className="rounded-full bg-rose-50 px-2 py-1 text-[9px] font-medium text-rose-600 hover:bg-rose-100 sm:text-[10px]"
                            >
                              Trinti
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

