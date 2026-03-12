"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type EventType = "feeding" | "diaper" | "sleep";

type FeedingMethod = "breast" | "formula" | "pumped";

type DiaperKind = "wet" | "dirty" | "both";

type FeedingEvent = {
  id: string;
  type: "feeding";
  time: string;
  notes?: string;
  feedingMethod: FeedingMethod;
  amountMl?: number;
  durationMinutes?: number;
};

type DiaperEvent = {
  id: string;
  type: "diaper";
  time: string;
  notes?: string;
  diaperKind: DiaperKind;
};

type SleepEvent = {
  id: string;
  type: "sleep";
  time: string;
  notes?: string;
  sleepEnd?: string;
};

type BabyEvent = FeedingEvent | DiaperEvent | SleepEvent;

const BABY_NAME = "Adrijana";
const BABY_BIRTH_ISO = "2026-03-04T14:28:00";

function formatTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function Home() {
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [codeInput, setCodeInput] = useState<string>("");
  const [codeError, setCodeError] = useState<string>("");

  const [feedingMethod, setFeedingMethod] = useState<FeedingMethod>("breast");
  const [amountMl, setAmountMl] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [diaperKind, setDiaperKind] = useState<DiaperKind>("wet");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<EventType | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(
        "baby-diary-unlocked-v1"
      );
      if (stored === "true") {
        setUnlocked(true);
      }
    }

    async function loadInitialData() {
      setIsLoading(true);

      const { data: eventsData, error: eventsError } = await supabase
        .from("events")
        .select("*")
        .order("time", { ascending: false });

      if (!eventsError && eventsData) {
        const mapped: BabyEvent[] = (eventsData as any[]).map((row) => {
          if (row.type === "feeding") {
            const feeding: FeedingEvent = {
              id: row.id,
              type: "feeding",
              time: row.time,
              notes: row.notes ?? undefined,
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
              notes: row.notes ?? undefined,
              diaperKind: row.diaper_kind,
            };
            return diaper;
          }

          const sleep: SleepEvent = {
            id: row.id,
            type: "sleep",
            time: row.time,
            notes: row.notes ?? undefined,
            sleepEnd: row.sleep_end ?? undefined,
          };
          return sleep;
        });
        setEvents(mapped);
      }

      setIsLoading(false);
    }

    loadInitialData();
  }, []);

  const todayEvents = useMemo(
    () => events.filter((e) => isToday(e.time)),
    [events]
  );

  const stats = useMemo(() => {
    const base = {
      todayFeedings: 0,
      todayFeedingsAmount: 0,
      todayBreastMinutes: 0,
      todayPumpedAmount: 0,
      todayDiapers: 0,
      todaySleepMinutes: 0,
      totalFeedings: 0,
      totalFeedingsAmount: 0,
      totalBreastMinutes: 0,
      totalPumpedAmount: 0,
      totalDiapers: 0,
      totalSleepMinutes: 0,
    };

    for (const e of events) {
      if (e.type === "feeding") {
        base.totalFeedings += 1;

        if (
          (e.feedingMethod === "formula" || e.feedingMethod === "pumped") &&
          typeof e.amountMl === "number"
        ) {
          base.totalFeedingsAmount += e.amountMl;
        }
        if (
          e.feedingMethod === "breast" &&
          typeof e.durationMinutes === "number"
        ) {
          base.totalBreastMinutes += e.durationMinutes;
        }

        if (isToday(e.time)) {
          base.todayFeedings += 1;

          if (
            (e.feedingMethod === "formula" || e.feedingMethod === "pumped") &&
            typeof e.amountMl === "number"
          ) {
            base.todayFeedingsAmount += e.amountMl;
            if (e.feedingMethod === "pumped") {
              base.todayPumpedAmount += e.amountMl;
            }
          }
          if (
            e.feedingMethod === "breast" &&
            typeof e.durationMinutes === "number"
          ) {
            base.todayBreastMinutes += e.durationMinutes;
          }
        }
      } else if (e.type === "diaper") {
        base.totalDiapers += 1;
        if (isToday(e.time)) {
          base.todayDiapers += 1;
        }
      } else if (e.type === "sleep" && e.sleepEnd) {
        const start = new Date(e.time).getTime();
        const end = new Date(e.sleepEnd).getTime();
        const minutes = Math.max(0, Math.round((end - start) / 60000));
        base.totalSleepMinutes += minutes;
        if (isToday(e.time)) {
          base.todaySleepMinutes += minutes;
        }
      }
    }

    return base;
  }, [events]);

  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  const babyAgeLabel = useMemo(() => {
    const birth = new Date(BABY_BIRTH_ISO);
    if (Number.isNaN(birth.getTime())) return "";

    const diffMs = now.getTime() - birth.getTime();
    if (diffMs <= 0) return "0 d. 0 val. 0 s.";

    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalDays = Math.floor(totalHours / 24);
    const years = Math.floor(totalDays / 365);
    const remainingDaysAfterYears = totalDays - years * 365;
    const months = Math.floor(remainingDaysAfterYears / 30);
    const days = remainingDaysAfterYears - months * 30;
    const hours = totalHours - totalDays * 24;
    const minutes = totalMinutes - totalHours * 60;
    const seconds = totalSeconds - totalMinutes * 60;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} m.`);
    if (months > 0) parts.push(`${months} mėn.`);
    if (days > 0 || parts.length === 0) parts.push(`${days} d.`);
    if (hours > 0) parts.push(`${hours} val.`);
    if (minutes > 0) parts.push(`${minutes} min.`);
    parts.push(`${seconds} s.`);
    return parts.join(" ");
  }, [now]);

  const archiveByDay = useMemo(() => {
    const groups: Record<string, BabyEvent[]> = {};
    for (const e of events) {
      const d = new Date(e.time);
      const key = d.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    const entries = Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
    return entries;
  }, [events]);

  const activeSleep = useMemo(
    () =>
      events.find(
        (e) => e.type === "sleep" && !e.sleepEnd
      ) as SleepEvent | undefined,
    [events]
  );

  const activeBreastFeeding = useMemo(
    () =>
      events.find(
        (e) =>
          e.type === "feeding" &&
          e.feedingMethod === "breast" &&
          (e as FeedingEvent).durationMinutes == null
      ) as FeedingEvent | undefined,
    [events]
  );

  function startEdit(event: BabyEvent) {
    if (event.type === "feeding") {
      setFeedingMethod(event.feedingMethod);
      setAmountMl(event.amountMl != null ? String(event.amountMl) : "");
      setDurationMinutes(
        event.durationMinutes != null ? String(event.durationMinutes) : ""
      );
      setEditingId(event.id);
      setEditingType("feeding");
    } else if (event.type === "diaper") {
      setDiaperKind(event.diaperKind);
      setEditingId(event.id);
      setEditingType("diaper");
    }
  }

  async function handleAddEvent(targetType: EventType) {
    const nowIso = new Date().toISOString();
    setIsSaving(true);

    if (targetType === "sleep") {
      const activeSleep = events.find(
        (e) => e.type === "sleep" && !e.sleepEnd
      ) as SleepEvent | undefined;

      if (!activeSleep) {
        const payload = {
          type: "sleep",
          time: nowIso,
          notes: null,
          sleep_end: null,
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

        if (!error && data) {
          const newEvent: SleepEvent = {
            id: data.id,
            type: "sleep",
            time: data.time,
            notes: data.notes ?? undefined,
            sleepEnd: data.sleep_end ?? undefined,
          };
          setEvents((prev) => [newEvent, ...prev]);
        }

        setIsSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from("events")
        .update({ sleep_end: nowIso })
        .eq("id", activeSleep.id)
        .select("*")
        .single();

      if (!error && data) {
        const updated: SleepEvent = {
          id: data.id,
          type: "sleep",
          time: data.time,
          notes: data.notes ?? undefined,
          sleepEnd: data.sleep_end ?? undefined,
        };
        setEvents((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        );
      }

      setIsSaving(false);
      return;
    }

    if (targetType === "feeding") {
      const isFormula = feedingMethod === "formula";
      const isBreast = feedingMethod === "breast";
      const isAmountBased =
        feedingMethod === "formula" || feedingMethod === "pumped";

      if (isBreast) {
        const active = activeBreastFeeding;

        if (!active) {
          const startPayload = {
            type: "feeding",
            time: nowIso,
            notes: null,
            feeding_method: "breast" as FeedingMethod,
            amount_ml: null,
            duration_minutes: null,
            diaper_kind: null,
          };

          const { data, error } = await supabase
            .from("events")
            .insert(startPayload)
            .select("*")
            .single();

          if (!error && data) {
            const newEvent: FeedingEvent = {
              id: data.id,
              type: "feeding",
              time: data.time,
              notes: data.notes ?? undefined,
              feedingMethod: data.feeding_method,
              amountMl: data.amount_ml ?? undefined,
              durationMinutes: data.duration_minutes ?? undefined,
            };
            setEvents((prev) => [newEvent, ...prev]);
          }
        } else {
          const startTime = new Date(active.time).getTime();
          const minutes = Math.max(
            0,
            Math.round((new Date(nowIso).getTime() - startTime) / 60000)
          );

          const { data, error } = await supabase
            .from("events")
            .update({
              duration_minutes: minutes,
            })
            .eq("id", active.id)
            .select("*")
            .single();

          if (!error && data) {
            const updated: FeedingEvent = {
              id: data.id,
              type: "feeding",
              time: data.time,
              notes: data.notes ?? undefined,
              feedingMethod: data.feeding_method,
              amountMl: data.amount_ml ?? undefined,
              durationMinutes: data.duration_minutes ?? undefined,
            };
            setEvents((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e))
            );
          }
        }
      } else {
        const payload = {
          type: "feeding",
          time: nowIso,
          notes: null,
          feeding_method: feedingMethod,
          amount_ml:
            isAmountBased && amountMl ? Number(amountMl) || null : null,
          duration_minutes:
            !isAmountBased && durationMinutes
              ? Number(durationMinutes) || null
              : null,
          diaper_kind: null,
        };

        if (editingId && editingType === "feeding") {
          const original = events.find((e) => e.id === editingId) as
            | FeedingEvent
            | undefined;

          const { data, error } = await supabase
            .from("events")
            .update({
              ...payload,
              time: original?.time ?? nowIso,
            })
            .eq("id", editingId)
            .select("*")
            .single();

          if (!error && data) {
            const updated: FeedingEvent = {
              id: data.id,
              type: "feeding",
              time: data.time,
              notes: data.notes ?? undefined,
              feedingMethod: data.feeding_method,
              amountMl: data.amount_ml ?? undefined,
              durationMinutes: data.duration_minutes ?? undefined,
            };
            setEvents((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e))
            );
          }
        } else {
          const { data, error } = await supabase
            .from("events")
            .insert(payload)
            .select("*")
            .single();

          if (!error && data) {
            const newEvent: FeedingEvent = {
              id: data.id,
              type: "feeding",
              time: data.time,
              notes: data.notes ?? undefined,
              feedingMethod: data.feeding_method,
              amountMl: data.amount_ml ?? undefined,
              durationMinutes: data.duration_minutes ?? undefined,
            };
            setEvents((prev) => [newEvent, ...prev]);
          }
        }
      }
    } else {
      const payload = {
        type: "diaper",
        time: nowIso,
        notes: null,
        diaper_kind: diaperKind,
        feeding_method: null,
        amount_ml: null,
        duration_minutes: null,
      };

      if (editingId && editingType === "diaper") {
        const original = events.find((e) => e.id === editingId) as
          | DiaperEvent
          | undefined;

        const { data, error } = await supabase
          .from("events")
          .update({
            ...payload,
            time: original?.time ?? nowIso,
          })
          .eq("id", editingId)
          .select("*")
          .single();

        if (!error && data) {
          const updated: DiaperEvent = {
            id: data.id,
            type: "diaper",
            time: data.time,
            notes: data.notes ?? undefined,
            diaperKind: data.diaper_kind,
          };
          setEvents((prev) =>
            prev.map((e) => (e.id === updated.id ? updated : e))
          );
        }
      } else {
        const { data, error } = await supabase
          .from("events")
          .insert(payload)
          .select("*")
          .single();

        if (!error && data) {
          const newEvent: DiaperEvent = {
            id: data.id,
            type: "diaper",
            time: data.time,
            notes: data.notes ?? undefined,
            diaperKind: data.diaper_kind,
          };
          setEvents((prev) => [newEvent, ...prev]);
        }
      }
    }

    setAmountMl("");
    setDurationMinutes("");
    setEditingId(null);
    setEditingType(null);
    setIsSaving(false);
  }

  function handleClearAll() {
    if (typeof window === "undefined") return;
    if (!window.confirm("Tikrai ištrinti visus įrašus?")) return;

    supabase
      .from("events")
      .delete()
      .then(() => {
        setEvents([]);
      });
  }

  return (
    <div className="min-h-screen text-slate-900">
      {!unlocked && (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-rose-50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-lg ring-1 ring-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M8 11V8a4 4 0 0 1 8 0v3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <rect
                    x="5"
                    y="11"
                    width="14"
                    height="9"
                    rx="2"
                    fill="currentColor"
                    opacity="0.9"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Užraktas
                </p>
                <p className="text-sm font-medium text-slate-800">
                  Įvesk prieigos kodą
                </p>
              </div>
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (codeInput.trim() === "1337") {
                  setUnlocked(true);
                  setCodeError("");
                  if (typeof window !== "undefined") {
                    window.localStorage.setItem("baby-diary-unlocked-v1", "true");
                  }
                } else {
                  setCodeError("Neteisingas kodas. Bandyk dar kartą.");
                }
              }}
            >
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Kodas
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    if (codeError) setCodeError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm tracking-[0.5em] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  placeholder="••••"
                />
              </div>
              {codeError && (
                <p className="text-[11px] text-rose-600">{codeError}</p>
              )}
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700"
              >
                Atrakinti
              </button>
            </form>
          </div>
        </div>
      )}
      {unlocked && (
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Mobile: gimimo data ir amžius vienoje kapsulėje */}
            <div className="block w-full sm:hidden">
              <span className="inline-flex w-full items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-[11px] text-slate-700 ring-1 ring-sky-100">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    aria-hidden="true"
                  >
                    <path
                      d="M7 4.5A2.5 2.5 0 0 1 9.5 2h5A2.5 2.5 0 0 1 17 4.5V6h1.5A1.5 1.5 0 0 1 20 7.5v11A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H7Z"
                      fill="currentColor"
                    />
                    <path
                      d="M9 3.5h6M8 10h8"
                      stroke="#e5e7eb"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="flex-1 truncate">
                  <span>gim. 2026-03-04 14:28</span>
                  <span className="mx-1.5">•</span>
                  <span>amžius {babyAgeLabel}</span>
                </span>
              </span>
            </div>

            {/* Desktop: atskiros gimimo datos ir amžiaus kapsulės */}
            <div className="hidden flex-wrap items-center gap-2 text-xs sm:flex sm:text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-slate-600 ring-1 ring-slate-100">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    d="M7 4.5A2.5 2.5 0 0 1 9.5 2h5A2.5 2.5 0 0 1 17 4.5V6h1.5A1.5 1.5 0 0 1 20 7.5v11A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H7Z"
                    fill="currentColor"
                    opacity="0.9"
                  />
                  <path
                    d="M9 3.5h6M8 10h8"
                    stroke="#e5e7eb"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <span>gim. 2026-03-04 14:28</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-indigo-700 ring-1 ring-indigo-100">
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    d="M12 4a8 8 0 1 1-8 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 4v5.5l3 2"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>amžius {babyAgeLabel}</span>
              </span>
            </div>

            {isLoading && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-100">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                  Kraunami įrašai...
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Šiandien – maitinimas ir miegas */}
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-sky-100 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M7 3h10v3a4 4 0 0 1-.4 1.8L14 14v5a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V3Z"
                      fill="currentColor"
                      opacity="0.8"
                    />
                    <path
                      d="M15 3h2a2 2 0 0 1 2 2v.5a2 2 0 0 1-2 2H15"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Šiandien – maitinimas
                  </p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {stats.todayFeedings}
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      kartai
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                <p className="flex items-center justify-between">
                  <span>Mišinėlis</span>
                  <span className="font-semibold text-sky-700">
                    {stats.todayFeedingsAmount} ml
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Krūtimi</span>
                  <span className="font-semibold text-sky-700">
                    {stats.todayBreastMinutes} min
                  </span>
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  {(() => {
                    const max =
                      Math.max(
                        stats.todayFeedingsAmount,
                        stats.todayBreastMinutes
                      ) || 1;
                    const formulaWidth =
                      (stats.todayFeedingsAmount / max) * 100 || 0;
                    const breastWidth =
                      (stats.todayBreastMinutes / max) * 100 || 0;
                    return (
                      <div className="flex h-full w-full">
                        <div
                          className="h-full bg-sky-400 transition-[width]"
                          style={{ width: `${formulaWidth}%` }}
                        />
                        <div
                          className="h-full bg-sky-200 transition-[width]"
                          style={{ width: `${breastWidth}%` }}
                        />
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Šiandien – sauskelnės */}
            <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-emerald-100 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v4.5A4.5 4.5 0 0 1 15.5 16h-.75L12 19.5 9.25 16H8.5A4.5 4.5 0 0 1 4 11.5V7Z"
                      fill="currentColor"
                      opacity="0.9"
                    />
                    <path
                      d="M7 7h3M14 7h3"
                      stroke="#ecfdf5"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Šiandien – sauskelnės
                  </p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {stats.todayDiapers}
                    <span className="ml-1 text-xs font-normal text-slate-500">
                      kartai
                    </span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                Reguliarus keitimas padeda greičiau pastebėti bet kokius
                pokyčius.
              </p>
            </div>

            {/* Viso laikotarpio – santrauka */}
            <div className="rounded-2xl bg-slate-950 text-slate-50 p-4 shadow-sm ring-1 ring-slate-900/40 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sky-200 ring-1 ring-sky-500/40">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 11a8 8 0 0 1 13.5-5.5A7 7 0 0 0 12 19h-.5A7.5 7.5 0 0 1 4 11Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                    Nuo pradžios
                  </p>
                  <p className="text-xs text-slate-400">
                    Bendra maitinimo ir miego istorija
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <p className="flex items-center justify-between text-slate-300">
                  <span>Maitinimai</span>
                  <span className="font-semibold text-sky-200">
                    {stats.totalFeedings}
                  </span>
                </p>
                <p className="flex items-center justify-between text-slate-300">
                  <span>Sauskelnių</span>
                  <span className="font-semibold text-emerald-200">
                    {stats.totalDiapers}
                  </span>
                </p>
                <p className="flex items-center justify-between text-slate-300">
                  <span>Mišinėlis</span>
                  <span className="font-semibold text-sky-200">
                    {stats.totalFeedingsAmount} ml
                  </span>
                </p>
                <p className="flex items-center justify-between text-slate-300">
                  <span>Mamos pienas</span>
                  <span className="font-semibold text-sky-200">
                    {stats.todayPumpedAmount} ml
                  </span>
                </p>
                <p className="flex items-center justify-between text-slate-300">
                  <span>Krūtimi</span>
                  <span className="font-semibold text-sky-200">
                    {stats.totalBreastMinutes} min
                  </span>
                </p>
                <p className="col-span-2 flex items-center justify-between text-slate-300">
                  <span>Bendras miegas</span>
                  <span className="font-semibold text-sky-200">
                    {stats.totalSleepMinutes} min
                  </span>
                </p>
              </div>

              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                {(() => {
                  const max =
                    Math.max(
                      stats.totalFeedings,
                      stats.totalDiapers,
                      Math.round(stats.totalSleepMinutes / 60)
                    ) || 1;
                  const feedWidth = (stats.totalFeedings / max) * 100 || 0;
                  const diaperWidth = (stats.totalDiapers / max) * 100 || 0;
                  const sleepWidth =
                    ((stats.totalSleepMinutes / 60) / max) * 100 || 0;
                  return (
                    <div className="flex h-full w-full">
                      <div
                        className="h-full bg-sky-400 transition-[width]"
                        style={{ width: `${feedWidth}%` }}
                      />
                      <div
                        className="h-full bg-emerald-400 transition-[width]"
                        style={{ width: `${diaperWidth}%` }}
                      />
                      <div
                        className="h-full bg-indigo-400 transition-[width]"
                        style={{ width: `${sleepWidth}%` }}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white/95 p-4 shadow-md ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Maitinimas */}
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M9 3h6v3.5a3.5 3.5 0 0 1-.35 1.53L13 11v7a2 2 0 0 1-2 2H9Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Maitinimas
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Krūtimi arba mišinėliu
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-slate-600">
                      Maitinimo tipas
                    </p>
                    <div className="flex flex-col gap-1 rounded-2xl bg-slate-100 p-1.5 text-[11px] font-medium">
                      <button
                        type="button"
                        onClick={() => setFeedingMethod("breast")}
                        className={`rounded-full px-3 py-2 transition ${
                          feedingMethod === "breast"
                            ? "bg-sky-600 text-white shadow-sm"
                            : "text-slate-700 hover:text-slate-900"
                        }`}
                      >
                        Krūtimi
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedingMethod("formula")}
                        className={`rounded-full px-3 py-2 transition ${
                          feedingMethod === "formula"
                            ? "bg-sky-600 text-white shadow-sm"
                            : "text-slate-700 hover:text-slate-900"
                        }`}
                      >
                        Mišinėlis
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedingMethod("pumped")}
                        className={`rounded-full px-3 py-2 transition ${
                          feedingMethod === "pumped"
                            ? "bg-sky-600 text-white shadow-sm"
                            : "text-slate-700 hover:text-slate-900"
                        }`}
                      >
                        Mamos pienas
                      </button>
                    </div>
                  </div>
                <div className="grid gap-2">
                  {(feedingMethod === "formula" || feedingMethod === "pumped") && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600">
                        Kiekis (ml)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={amountMl}
                        onChange={(e) => setAmountMl(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        placeholder="pvz. 90"
                      />
                    </div>
                  )}
                  {feedingMethod === "breast" && activeBreastFeeding && (
                    <div className="space-y-1 text-center">
                      <div className="mx-auto inline-flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 ring-1 ring-sky-200">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-200">
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sky-700" />
                        </span>
                        <span className="font-mono">
                          {(() => {
                            const diffMs =
                              now.getTime() -
                              new Date(activeBreastFeeding.time).getTime();
                            const totalSeconds = Math.max(
                              0,
                              Math.floor(diffMs / 1000)
                            );
                            const minutes = Math.floor(totalSeconds / 60);
                            const seconds = totalSeconds - minutes * 60;
                            return `${minutes
                              .toString()
                              .padStart(2, "0")}:${seconds
                              .toString()
                              .padStart(2, "0")} min`;
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAddEvent("feeding")}
                disabled={isSaving}
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                    Saugoma...
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="mr-1.5 h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M5 12.5A2.5 2.5 0 0 1 7.5 10H11V5.5A2.5 2.5 0 0 1 13.5 3h.5A2.5 2.5 0 0 1 16.5 5.5V10H19a2.5 2.5 0 0 1 0 5h-2.5V18.5A2.5 2.5 0 0 1 14 21h-.5A2.5 2.5 0 0 1 11 18.5V15H7.5A2.5 2.5 0 0 1 5 12.5Z"
                        fill="currentColor"
                      />
                    </svg>
                    {feedingMethod === "breast"
                      ? activeBreastFeeding
                        ? "Baigti žindymą"
                        : "Pradėti žindymą"
                      : editingId && editingType === "feeding"
                      ? "Atnaujinti maitinimą"
                      : "Išsaugoti maitinimą"}
                  </>
                )}
              </button>
              </div>

            {/* Sauskelnių keitimas */}
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M5 7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3.5A4.5 4.5 0 0 1 14.5 15H14l-2 2-2-2h-.5A4.5 4.5 0 0 1 5 10.5Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Sauskelnių keitimas
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Užfiksuok kiekvieną keitimą
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-slate-600">
                    Sauskelnių tipas
                  </p>
                  <div className="flex flex-col gap-1 rounded-2xl bg-slate-100 p-1.5 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setDiaperKind("wet")}
                      className={`rounded-full px-3 py-2 transition ${
                        diaperKind === "wet"
                          ? "bg-sky-600 text-white shadow-sm"
                          : "text-slate-700 hover:text-slate-900"
                      }`}
                    >
                      Šlapias
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiaperKind("dirty")}
                      className={`rounded-full px-3 py-2 transition ${
                        diaperKind === "dirty"
                          ? "bg-sky-600 text-white shadow-sm"
                          : "text-slate-700 hover:text-slate-900"
                      }`}
                    >
                      Purvinas
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiaperKind("both")}
                      className={`rounded-full px-3 py-2 transition ${
                        diaperKind === "both"
                          ? "bg-sky-600 text-white shadow-sm"
                          : "text-slate-700 hover:text-slate-900"
                      }`}
                    >
                      Abu
                    </button>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleAddEvent("diaper")}
                disabled={isSaving}
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                    Saugoma...
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      className="mr-1.5 h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 6h12v5.5A3.5 3.5 0 0 1 14.5 15H14l-2 2-2-2h-.5A3.5 3.5 0 0 1 6 11.5Z"
                        fill="currentColor"
                      />
                    </svg>
                    {editingId && editingType === "diaper"
                      ? "Atnaujinti sauskelnes"
                      : "Išsaugoti sauskelnes"}
                  </>
                )}
              </button>
            </div>

              {/* Miegas */}
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="M9 4.5A6.5 6.5 0 1 0 19.5 15 5.5 5.5 0 0 1 9 4.5Z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Miegas
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Pradžia ir pabaiga vienu mygtuku
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Paspausk, kai kūdikis užmiega, ir dar kartą – kai prabunda.
                </p>
                {activeSleep && (
                  <div className="text-center">
                    <div className="mx-auto inline-flex items-center gap-2 rounded-2xl bg-purple-50 px-3 py-2 text-sm font-semibold text-purple-800 ring-1 ring-purple-200">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-200">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-purple-700" />
                      </span>
                      <span className="font-mono">
                        {(() => {
                          const diffMs =
                            now.getTime() -
                            new Date(activeSleep.time).getTime();
                          const totalSeconds = Math.max(
                            0,
                            Math.floor(diffMs / 1000)
                          );
                          const minutes = Math.floor(totalSeconds / 60);
                          const seconds = totalSeconds - minutes * 60;
                          return `${minutes
                            .toString()
                            .padStart(2, "0")}:${seconds
                            .toString()
                            .padStart(2, "0")} min`;
                        })()}
                      </span>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleAddEvent("sleep")}
                  disabled={isSaving}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-purple-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? (
                    <>
                      <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                      Saugoma...
                    </>
                  ) : (
                    <>
                      <svg
                        viewBox="0 0 24 24"
                        className="mr-1.5 h-3.5 w-3.5"
                        aria-hidden="true"
                      >
                        <path
                          d="M9 4.5A6.5 6.5 0 1 0 19.5 15 5.5 5.5 0 0 1 9 4.5Z"
                          fill="currentColor"
                        />
                      </svg>
                      Pradėti / baigti miegą
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Šiandienos įrašai
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href="/archive"
                    className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 shadow-sm transition hover:bg-sky-600 hover:text-white"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z"
                        fill="currentColor"
                      />
                      <path
                        d="M9 8h6M9 11h3"
                        stroke="#e5f0ff"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                    ARCHYVAS
                  </Link>
                  <a
                    href="/admin"
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-slate-800"
                  >
                    NUSTATYMAI
                  </a>
                </div>
              </div>
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {todayEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Dar nėra šiandienos įrašų. Pradėk nuo naujo maitinimo ar
                    sauskelnių keitimo.
                  </p>
                ) : (
                  todayEvents.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm shadow-sm"
                    >
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-slate-800">
                          <span className="font-mono">
                            {formatTimeLabel(e.time)}
                          </span>
                          {" | "}
                          <span>
                            {e.type === "feeding"
                              ? "Maitinimas"
                              : e.type === "diaper"
                              ? "Sauskelnių keitimas"
                              : "Miegas"}
                          </span>
                          {" | "}
                          <span>
                            {e.type === "feeding"
                              ? e.feedingMethod === "breast"
                                ? "Krūtimi"
                                : e.feedingMethod === "pumped"
                                ? `Mamos pienas${
                                    e.amountMl ? ` ${e.amountMl} ml` : ""
                                  }`
                                : `Mišinėlis${
                                    e.amountMl &&
                                    e.feedingMethod === "formula"
                                      ? ` ${e.amountMl} ml`
                                      : ""
                                  }`
                              : e.type === "diaper"
                              ? e.diaperKind === "wet"
                                ? "Šlapias"
                                : e.diaperKind === "dirty"
                                ? "Purvinas"
                                : "Šlapias ir purvinas"
                              : e.sleepEnd
                              ? `nuo ${formatTimeLabel(
                                  e.time
                                )} iki ${formatTimeLabel(e.sleepEnd)}`
                              : `nuo ${formatTimeLabel(e.time)} (vyksta)`}
                          </span>
                          {e.type === "feeding" &&
                            e.feedingMethod === "breast" &&
                            e.durationMinutes != null && (
                              <>
                                {" | "}
                                <span>{e.durationMinutes} min</span>
                              </>
                            )}
                          {e.type === "sleep" && e.sleepEnd && (
                            <>
                              {" | "}
                              <span>
                                {Math.max(
                                  0,
                                  Math.round(
                                    (new Date(e.sleepEnd).getTime() -
                                      new Date(e.time).getTime()) /
                                      60000
                                  )
                                )}{" "}
                                min
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Archyvas perkeltas į atskirą /archive puslapį */}
      </main>
      )}
    </div>
  );
}

