"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";

type FeedingMethod = "breast" | "formula" | "pumped";
type DiaperKind = "wet" | "dirty" | "both";

type FeedingEvent = {
  id: string;
  type: "feeding";
  time: string;
  feedingMethod: FeedingMethod;
  amountMl?: number;
  durationMinutes?: number;
  breastSide?: "left" | "right" | null;
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

export default function StatistikaPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function loadAll() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("time", { ascending: true });
      if (cancelled) return;
      if (!error && data) {
        const mapped: BabyEvent[] = (data as any[]).map((row) => {
          if (row.type === "feeding") {
            return {
              id: row.id,
              type: "feeding",
              time: row.time,
              feedingMethod: row.feeding_method,
              amountMl: row.amount_ml ?? undefined,
              durationMinutes: row.duration_minutes ?? undefined,
              breastSide:
                row.breast_side === "left" || row.breast_side === "right"
                  ? row.breast_side
                  : null,
            };
          }
          if (row.type === "diaper") {
            return {
              id: row.id,
              type: "diaper",
              time: row.time,
              diaperKind: row.diaper_kind,
            };
          }
          return {
            id: row.id,
            type: "sleep",
            time: row.time,
            sleepEnd: row.sleep_end ?? undefined,
          };
        });
        setEvents(mapped);
      }
      setIsLoading(false);
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const stats = useMemo(() => {
    const base = {
      totalFeedings: 0,
      totalFormulaAmount: 0,
      totalPumpedAmount: 0,
      totalBreastMinutes: 0,
      totalBreastLeft: 0,
      totalBreastRight: 0,
      totalDiapers: 0,
      totalWetDiapers: 0,
      totalDirtyDiapers: 0,
      totalBothDiapers: 0,
      totalSleepMinutes: 0,
    };

    for (const e of events) {
      if (e.type === "feeding") {
        const isRealFeeding =
          e.feedingMethod === "breast" || e.feedingMethod === "formula";
        if (isRealFeeding) {
          base.totalFeedings += 1;
        }
        if (typeof e.amountMl === "number") {
          if (e.feedingMethod === "formula") {
            base.totalFormulaAmount += e.amountMl;
          } else if (e.feedingMethod === "pumped") {
            base.totalPumpedAmount += e.amountMl;
          }
        }
        if (
          e.feedingMethod === "breast" &&
          typeof e.durationMinutes === "number"
        ) {
          base.totalBreastMinutes += e.durationMinutes;
          if (e.breastSide === "left") base.totalBreastLeft += e.durationMinutes;
          if (e.breastSide === "right")
            base.totalBreastRight += e.durationMinutes;
        }
      } else if (e.type === "diaper") {
        base.totalDiapers += 1;
        if (e.diaperKind === "wet") base.totalWetDiapers += 1;
        else if (e.diaperKind === "dirty") base.totalDirtyDiapers += 1;
        else if (e.diaperKind === "both") base.totalBothDiapers += 1;
      } else if (e.type === "sleep" && e.sleepEnd) {
        const start = new Date(e.time).getTime();
        const end = new Date(e.sleepEnd).getTime();
        const minutes = Math.max(0, Math.round((end - start) / 60000));
        base.totalSleepMinutes += minutes;
      }
    }

    return base;
  }, [events]);

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Prisijunk, kad matytum statistiką.</p>
      </div>
    );
  }

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
              Statistika
            </h1>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-3"
            >
              ← Pagrindinis
            </Link>
          </div>
        </section>

        {events.length > 0 && (
          <section className="space-y-4">
            {/* Maitinimas */}
            <div className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-rose-100 backdrop-blur sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-500">
                  Maitinimas (viso)
                </p>
              </div>
              <div className="mt-3 space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Iš viso maitinimų</span>
                  <span className="font-semibold text-slate-900">
                    {stats.totalFeedings}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Mišinėlis</span>
                  <span className="font-semibold text-rose-600">
                    {stats.totalFormulaAmount} ml
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Nutrauktas</span>
                  <span className="font-semibold text-sky-600">
                    {stats.totalPumpedAmount} ml
                  </span>
                </div>
                <div className="pt-1 border-t border-dashed border-rose-100 mt-2">
                  <div className="flex items-center justify-between">
                    <span>Krūtimi (viso)</span>
                    <span className="font-semibold text-rose-700">
                      {stats.totalBreastMinutes} min
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <p className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Kairė</span>
                      <span>{stats.totalBreastLeft} min</span>
                    </p>
                    <p className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>Dešinė</span>
                      <span>{stats.totalBreastRight} min</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sauskelnių keitimas */}
            <div className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-emerald-100 backdrop-blur sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500">
                Sauskelnių keitimas (viso)
              </p>
              <div className="mt-3 space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Viso sauskelnių</span>
                  <span className="font-semibold text-slate-900">
                    {stats.totalDiapers}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                  <p className="flex items-center justify-between">
                    <span>Šlapias</span>
                    <span className="font-semibold text-emerald-700">
                      {stats.totalWetDiapers}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Purvinas</span>
                    <span className="font-semibold text-emerald-700">
                      {stats.totalDirtyDiapers}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Abu</span>
                    <span className="font-semibold text-emerald-700">
                      {stats.totalBothDiapers}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Miegas */}
            <div className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-indigo-100 backdrop-blur sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">
                Miegas (viso)
              </p>
              <div className="mt-3 space-y-2 text-xs text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Bendras miegas</span>
                  <span className="font-semibold text-slate-900">
                    {stats.totalSleepMinutes} min
                  </span>
                </div>
                {/* Papildomos grafikos čia nenaudojamos – rodome tik bendrą miego trukmę. */}
              </div>
            </div>
          </section>
        )}

        {/* Išsamūs įrašų sąrašai rodomi /archive puslapyje */}
      </main>
    </div>
  );
}

