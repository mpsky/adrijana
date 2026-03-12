"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type EventType = "feeding" | "diaper" | "sleep";
type FeedingMethod = "breast" | "formula";
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

function toLocalDateTimeInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalDateTimeInputValue(value: string) {
  // value is in local time; create Date then toISOString for UTC storage
  const d = new Date(value);
  return d.toISOString();
}

function formatTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function AdminPage() {
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

  useEffect(() => {
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
  }, []);

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
          const isFormula = feedingMethod === "formula";
          const payload = {
            type: "feeding",
            time: timeIso,
            feeding_method: feedingMethod,
            amount_ml:
              isFormula && amountMl ? Number(amountMl) || null : null,
            duration_minutes:
              !isFormula && durationMinutes
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
          const isFormula = feedingMethod === "formula";
          const payload = {
            type: "feeding",
            time: timeIso,
            feeding_method: feedingMethod,
            amount_ml:
              isFormula && amountMl ? Number(amountMl) || null : null,
            duration_minutes:
              !isFormula && durationMinutes
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
              Admin – įrašų tvarkymas
            </h1>
            <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 sm:text-xs">
              Pridėk senų dienų įrašus, taisyk ar trink jau esančius.
            </p>
          </div>
          <a
            href="/"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-slate-800 sm:px-3"
          >
            <span>← Atgal į pagrindinį</span>
          </a>
        </header>

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-3 rounded-3xl bg-white/95 p-3 shadow-sm ring-1 ring-slate-100 sm:p-4">
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
                  className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline"
                >
                  Atšaukti redagavimą
                </button>
              )}
            </div>

            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-600">
                  Tipas
                </label>
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-50 p-1 ring-1 ring-slate-200">
                  <button
                    type="button"
                    onClick={() => setType("feeding")}
                    className={`rounded-xl px-1.5 py-1.5 text-[10px] font-medium sm:text-[11px] ${
                      type === "feeding"
                        ? "bg-sky-600 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Maitinimas
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("diaper")}
                    className={`rounded-xl px-1.5 py-1.5 text-[10px] font-medium sm:text-[11px] ${
                      type === "diaper"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Sauskelnės
                  </button>
                  <button
                    type="button"
                    onClick={() => setType("sleep")}
                    className={`rounded-xl px-1.5 py-1.5 text-[10px] font-medium sm:text-[11px] ${
                      type === "sleep"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Miegas
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-600">
                  Data ir laikas
                </label>
                <input
                  type="datetime-local"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            {type === "feeding" && (
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-600">
                    Maitinimo būdas
                  </label>
                  <div className="inline-flex w-full gap-1 rounded-2xl bg-slate-50 p-1 ring-1 ring-slate-200">
                    <button
                      type="button"
                      onClick={() => setFeedingMethod("formula")}
                      className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${
                        feedingMethod === "formula"
                          ? "bg-sky-600 text-white shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      Mišinėlis (ml)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedingMethod("breast")}
                      className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${
                        feedingMethod === "breast"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      Krūtimi (min)
                    </button>
                  </div>
                </div>

                {feedingMethod === "formula" ? (
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-600">
                      Kiekis (ml)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={amountMl}
                      onChange={(e) => setAmountMl(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
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
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                )}
              </div>
            )}

            {type === "diaper" && (
              <div className="space-y-1.5 text-xs">
                <label className="block text-[11px] font-medium text-slate-600">
                  Sauskelnės
                </label>
                <div className="inline-flex w-full gap-1 rounded-2xl bg-slate-50 p-1 ring-1 ring-slate-200">
                  <button
                    type="button"
                    onClick={() => setDiaperKind("wet")}
                    className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${
                      diaperKind === "wet"
                        ? "bg-sky-500 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Šlapias
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiaperKind("dirty")}
                    className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${
                      diaperKind === "dirty"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Purvinas
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiaperKind("both")}
                    className={`flex-1 rounded-xl px-2 py-1.5 text-[11px] font-medium ${
                      diaperKind === "both"
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-slate-600"
                    }`}
                  >
                    Abu
                  </button>
                </div>
              </div>
            )}

            {type === "sleep" && (
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-600">
                    Miego pabaiga (nebūtina)
                  </label>
                  <input
                    type="datetime-local"
                    value={sleepEndInput}
                    onChange={(e) => setSleepEndInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                </div>
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

          <div className="space-y-3 rounded-3xl bg-white/95 p-3 shadow-sm ring-1 ring-slate-100 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Visi įrašai (admin)
              </p>
              {isLoading && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-100">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                  Kraunama...
                </span>
              )}
            </div>
            <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1 text-[11px] sm:text-xs">
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
                          className="flex items-start justify-between gap-2 rounded-xl bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-100"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[10px] font-medium text-slate-800 sm:text-[11px]">
                              <span className="font-mono">
                                {formatTimeLabel(e.time)}
                              </span>{" "}
                              <span className="whitespace-normal break-words">
                                {e.type === "feeding" &&
                                  (e.feedingMethod === "formula"
                                    ? `Mišinėlis ${
                                        e.amountMl ?? 0
                                      } ml`
                                    : `Krūtimi ${
                                        e.durationMinutes ?? 0
                                      } min`)}
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

