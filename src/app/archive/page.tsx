"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";

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
  breastSide?: "left" | "right" | null;
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

type PumpingEvent = {
  id: string;
  type: "pumping";
  time: string;
  notes?: string;
  amountMl?: number;
};

type BabyEvent = FeedingEvent | DiaperEvent | SleepEvent | PumpingEvent;

function formatTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ArchivePage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasBaby, setHasBaby] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setHasBaby(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: member } = await supabase
        .from("baby_members")
        .select("baby_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setHasBaby(!!member?.baby_id);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !hasBaby) {
      setIsLoading(false);
      return;
    }
    async function loadArchive() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("time", { ascending: false });

      if (!error && data) {
        const mapped: BabyEvent[] = (data as any[]).map((row) => {
          if (row.type === "feeding") {
            const feeding: FeedingEvent = {
              id: row.id,
              type: "feeding",
              time: row.time,
              notes: row.notes ?? undefined,
              feedingMethod: row.feeding_method,
              amountMl: row.amount_ml ?? undefined,
              durationMinutes: row.duration_minutes ?? undefined,
              breastSide:
                row.breast_side === "left" || row.breast_side === "right"
                  ? row.breast_side
                  : null,
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
          if (row.type === "pumping") {
            const pumping: PumpingEvent = {
              id: row.id,
              type: "pumping",
              time: row.time,
              notes: row.notes ?? undefined,
              amountMl: row.amount_ml ?? undefined,
            };
            return pumping;
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
    loadArchive();
  }, [user, hasBaby]);

  const archiveByDay = useMemo(() => {
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

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Kraunama...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
              Archyvas
            </h1>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-3"
            >
              ← Pagrindinis
            </Link>
          </div>
        </section>

        {/* Visi įrašai pagal dienas */}
        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Visi įrašai pagal dienas
            </p>
            {isLoading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                Kraunama...
              </span>
            )}
          </div>

          <div className="mt-4 max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            {archiveByDay.length === 0 && !isLoading ? (
              <p className="text-sm text-slate-500">
                Įrašų dar nėra – pradėk nuo pirmojo maitinimo, sauskelnių
                keitimo ar miego.
              </p>
            ) : (
              archiveByDay.map(([date, dayEvents]) => (
                <div key={date} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                    <span className="h-px w-4 rounded-full bg-slate-200" />
                    {new Date(date).toLocaleDateString("lt-LT", {
                      year: "numeric",
                      month: "short",
                      day: "2-digit",
                    })}
                  </div>
                  <div className="space-y-2">
                    {dayEvents
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(a.time).getTime() - new Date(b.time).getTime()
                      )
                      .map((e) => (
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
                                  : e.type === "pumping"
                                  ? "Nutrauktas pienas"
                                  : "Miegas"}
                              </span>
                              {" | "}
                              <span>
                                {e.type === "feeding"
                                  ? e.feedingMethod === "breast"
                                    ? `Krūtimi${
                                        (e as FeedingEvent).breastSide ===
                                        "left"
                                          ? " (kairė)"
                                          : (e as FeedingEvent).breastSide ===
                                            "right"
                                          ? " (dešinė)"
                                          : ""
                                      }`
                                    : e.feedingMethod === "pumped"
                                    ? `Nutrauktas${
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
                                  : e.type === "pumping"
                                  ? (e as PumpingEvent).amountMl
                                    ? `Nutrauktas pienas ${
                                        (e as PumpingEvent).amountMl
                                      } ml`
                                    : "Nutrauktas pienas"
                                  : e.sleepEnd
                                  ? `nuo ${formatTimeLabel(e.time)} iki ${formatTimeLabel(
                                      e.sleepEnd
                                    )}`
                                  : `nuo ${formatTimeLabel(e.time)} (vyksta)`}
                              </span>
                              {e.type === "feeding" &&
                                e.feedingMethod === "breast" &&
                                e.durationMinutes != null && (
                                  <> {" | "} <span>{e.durationMinutes} min</span></>
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
                      ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

