"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type FeedingMethod = "breast" | "formula";
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

function formatTimeLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("lt-LT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function ArchivePage() {
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

    loadArchive();
  }, []);

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex items-center justify-between gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-slate-800">
            Archyvas
          </h1>
          <a
            href="/"
            className="text-xs font-medium text-sky-700 underline-offset-2 hover:underline"
          >
            Atgal į pagrindinį
          </a>
        </header>

        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold tracking-wide text-slate-700">
              Visi įrašai pagal dienas
            </p>
            {isLoading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 ring-1 ring-sky-100">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
                Kraunama...
              </span>
            )}
          </div>

          <div className="mt-3 max-h-[70vh] space-y-3 overflow-y-auto pr-1 text-sm">
            {archiveByDay.length === 0 ? (
              <p className="text-slate-500">
                Įrašų dar nėra – pradėk nuo pirmojo maitinimo, sauskelnių
                keitimo ar miego.
              </p>
            ) : (
              archiveByDay.map(([date, dayEvents]) => (
                <div key={date} className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <span className="h-px w-4 rounded-full bg-slate-200" />
                    <span>
                      {new Date(date).toLocaleDateString("lt-LT", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {dayEvents.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs shadow-sm"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                e.type === "feeding"
                                  ? "bg-sky-100 text-sky-700"
                                  : e.type === "diaper"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              {e.type === "feeding"
                                ? "Maitinimas"
                                : e.type === "diaper"
                                ? "Sauskelnių"
                                : "Miegas"}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {formatTimeLabel(e.time)}
                            </span>
                          </div>
                          {e.type === "feeding" ? (
                            <p className="text-[11px] text-slate-700">
                              {e.feedingMethod === "breast"
                                ? "Krūtimi"
                                : "Mišinėlis"}
                              {e.amountMl ? ` • ${e.amountMl} ml` : null}
                              {e.durationMinutes
                                ? ` • ${e.durationMinutes} min`
                                : null}
                            </p>
                          ) : e.type === "diaper" ? (
                            <p className="text-[11px] text-slate-700">
                              {e.diaperKind === "wet" && "Šlapias"}
                              {e.diaperKind === "dirty" && "Purvinas"}
                              {e.diaperKind === "both" &&
                                "Šlapias ir purvinas"}
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-700">
                              Miegas nuo {formatTimeLabel(e.time)}
                              {e.sleepEnd
                                ? ` iki ${formatTimeLabel(e.sleepEnd)}`
                                : " (vyksta)"}
                            </p>
                          )}
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

