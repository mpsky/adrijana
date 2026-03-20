"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent as ReactTouchEvent,
} from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { getBabyInfo, setBabyInfo } from "@/lib/babyStorage";
import { Button } from "@/components/Button";

type EventType = "feeding" | "diaper" | "sleep" | "pumping";

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

// Pagal LT/Europe/Vilnius laiko juostą
function dateKeyFromIso(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // formatas YYYY-MM-DD pagal LT lokalę ir Vilniaus laiką
  return d
    .toLocaleDateString("lt-LT", {
      timeZone: "Europe/Vilnius",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\./g, "-");
}

function todayKeyLt() {
  const now = new Date();
  return now
    .toLocaleDateString("lt-LT", {
      timeZone: "Europe/Vilnius",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\./g, "-");
}

function isToday(iso: string) {
  const key = dateKeyFromIso(iso);
  if (!key) return false;
  return key === todayKeyLt();
}

function isSameDayKey(iso: string, key: string) {
  if (!key) return false;
  return dateKeyFromIso(iso) === key;
}

function formatDelta(current: number, prev: number) {
  const diff = current - prev;
  if (!Number.isFinite(diff) || diff === 0) return "0";
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function formatAgo(fromIso: string, now: Date) {
  const t = new Date(fromIso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = now.getTime() - t;
  if (diffMs <= 0) return "dabar";
  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours - days * 24;
  const minutes = totalMinutes - totalHours * 60;

  if (days > 0) {
    return `prieš ${days} d.`;
  }
  if (totalHours > 0) {
    return `prieš ${totalHours} val.${minutes > 0 ? ` ${minutes} min.` : ""}`;
  }
  return `prieš ${Math.max(1, totalMinutes)} min.`;
}

export default function Home() {
  const { user } = useAuth();
  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  /** Ar vartotojas turi kūdikį (narystė baby_members). null = dar tikrinama. */
  const [hasBaby, setHasBaby] = useState<boolean | null>(null);
  /** Dabartinio kūdikio id (iš baby_members) – naudojamas įrašams pririšti prie kūdikio. */
  const [currentBabyId, setCurrentBabyId] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState<string>("");
  const [codeError, setCodeError] = useState<string>("");
  const [isAcceptingCode, setIsAcceptingCode] = useState(false);

  const [feedingMethod, setFeedingMethod] = useState<FeedingMethod>("breast");
  const [amountMl, setAmountMl] = useState<string>("");
  const [breastSide, setBreastSide] = useState<"left" | "right">("left");
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [diaperKind, setDiaperKind] = useState<DiaperKind>("wet");
  const [entryCategory, setEntryCategory] = useState<"feeding" | "diaper" | "sleep" | "pumping">("feeding");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<EventType | null>(null);

  const [babyInfo, setBabyInfo] = useState(() => getBabyInfo());
  const [babyGender, setBabyGender] = useState<"female" | "male" | "">("");
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => {
    return todayKeyLt();
  });

  // Patikrinti, ar vartotojas turi kūdikį (narystė baby_members)
  useEffect(() => {
    if (!user) {
      setHasBaby(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: member, error } = await supabase
        .from("baby_members")
        .select("baby_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setHasBaby(false);
        return;
      }
      setHasBaby(!!member?.baby_id);
      setCurrentBabyId(member?.baby_id ?? null);
      if (member?.baby_id && typeof window !== "undefined") {
        const { data: babyRow } = await supabase
          .from("babies")
          .select("name, birth_iso, gender")
          .eq("id", member.baby_id)
          .maybeSingle();
        if (cancelled || !babyRow) return;
        const name = (babyRow.name as string) ?? "";
        const birthIso = (babyRow.birth_iso as string) ?? "";
        const rawGender = (babyRow as { gender?: string | null }).gender;
        const genderNorm =
          typeof rawGender === "string" ? rawGender.trim().toLowerCase() : "";
        const gender =
          genderNorm === "female" || genderNorm === "male" ? genderNorm : "";
        setBabyGender(gender);
        if (birthIso) setBabyInfo({ name, birthIso });
        window.localStorage.setItem("baby-diary-unlocked-v1", "true");
      } else if (typeof window !== "undefined") {
        window.localStorage.removeItem("baby-diary-unlocked-v1");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBabyInfo(getBabyInfo());
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

    if (user && hasBaby) loadInitialData();

    const channel = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          let mapped: BabyEvent;
          if (row.type === "feeding") {
            mapped = {
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
          } else if (row.type === "diaper") {
            mapped = {
              id: row.id,
              type: "diaper",
              time: row.time,
              notes: row.notes ?? undefined,
              diaperKind: row.diaper_kind,
            };
          } else if (row.type === "pumping") {
            mapped = {
              id: row.id,
              type: "pumping",
              time: row.time,
              notes: row.notes ?? undefined,
              amountMl: row.amount_ml ?? undefined,
            };
          } else {
            mapped = {
              id: row.id,
              type: "sleep",
              time: row.time,
              notes: row.notes ?? undefined,
              sleepEnd: row.sleep_end ?? undefined,
            };
          }
          setEvents((prev) => {
            const without = prev.filter((e) => e.id !== mapped.id);
            return [mapped, ...without];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events" },
        (payload) => {
          const row = payload.new as any;
          if (!row) return;
          let mapped: BabyEvent;
          if (row.type === "feeding") {
            mapped = {
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
          } else if (row.type === "diaper") {
            mapped = {
              id: row.id,
              type: "diaper",
              time: row.time,
              notes: row.notes ?? undefined,
              diaperKind: row.diaper_kind,
            };
          } else {
            mapped = {
              id: row.id,
              type: "sleep",
              time: row.time,
              notes: row.notes ?? undefined,
              sleepEnd: row.sleep_end ?? undefined,
            };
          }
          setEvents((prev) =>
            prev.map((e) => (e.id === mapped.id ? mapped : e))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "events" },
        (payload) => {
          const row = payload.old as any;
          if (!row?.id) return;
          setEvents((prev) => prev.filter((e) => e.id !== row.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, hasBaby]);

  const todayEvents = useMemo(
    () => events.filter((e) => isToday(e.time)),
    [events]
  );

  const stats = useMemo(() => {
    const base = {
      todayFeedings: 0,
      todayFeedingsAmount: 0,
      todayFormulaAmount: 0,
      todayBreastMinutes: 0,
      todayPumpedAmount: 0,
      todayExpressedAndUsed: 0,
      todayDiapers: 0,
      todayWetDiapers: 0,
      todayDirtyDiapers: 0,
      todayBothDiapers: 0,
      todaySleepMinutes: 0,
      totalFeedings: 0,
      totalFeedingsAmount: 0,
      totalFormulaAmount: 0,
      totalBreastMinutes: 0,
      totalPumpedAmount: 0,
      totalExpressedAndUsed: 0,
      totalDiapers: 0,
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
            base.totalFeedingsAmount += e.amountMl;
          } else if (e.feedingMethod === "pumped") {
            // mamos pienas suvartotas iš buteliuko
            base.totalExpressedAndUsed += e.amountMl;
          }
        }
        if (
          e.feedingMethod === "breast" &&
          typeof e.durationMinutes === "number"
        ) {
          base.totalBreastMinutes += e.durationMinutes;
        }

        if (isSameDayKey(e.time, selectedDateKey)) {
          if (isRealFeeding) {
            base.todayFeedings += 1;
          }

          if (typeof e.amountMl === "number") {
            if (e.feedingMethod === "formula") {
              base.todayFormulaAmount += e.amountMl;
              base.todayFeedingsAmount += e.amountMl;
            } else if (e.feedingMethod === "pumped") {
              // mamos pienas suvartotas iš buteliuko šiandien
              base.todayExpressedAndUsed += e.amountMl;
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
        if (isSameDayKey(e.time, selectedDateKey)) {
          base.todayDiapers += 1;
          if (e.diaperKind === "wet") {
            base.todayWetDiapers += 1;
          } else if (e.diaperKind === "dirty") {
            base.todayDirtyDiapers += 1;
          } else if (e.diaperKind === "both") {
            base.todayBothDiapers += 1;
          }
        }
      } else if (e.type === "sleep" && e.sleepEnd) {
        const start = new Date(e.time).getTime();
        const end = new Date(e.sleepEnd).getTime();
        const minutes = Math.max(0, Math.round((end - start) / 60000));
        base.totalSleepMinutes += minutes;
        // Į dienos statistiką traukiame tik tuos miego įrašus,
        // kurių PRADŽIA ir PABAIGA yra toje pačioje pasirinktą dieną.
        if (
          isSameDayKey(e.time, selectedDateKey) &&
          isSameDayKey(e.sleepEnd, selectedDateKey)
        ) {
          base.todaySleepMinutes += minutes;
        }
      } else if (e.type === "pumping") {
        if (typeof e.amountMl === "number") {
          // Čia skaičiuojame tik pagamintą (nutrauktą) pieną,
          // be suvartojimo – suvartotas skaičiuojamas tik per feedingMethod === "pumped".
          base.totalPumpedAmount += e.amountMl;
          if (isSameDayKey(e.time, selectedDateKey)) {
            base.todayPumpedAmount += e.amountMl;
          }
        }
      }
    }

    return base;
  }, [events, selectedDateKey]);

  const todaySleepHoursLabel = useMemo(() => {
    const minutes = stats.todaySleepMinutes;
    if (!minutes) return "0 val.";
    const hours = minutes / 60;
    if (hours < 1) {
      return `${minutes} min`;
    }
    return `${hours.toFixed(1)} val.`;
  }, [stats.todaySleepMinutes]);

  const [now, setNow] = useState<Date>(new Date());
  const [show3hInfo, setShow3hInfo] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  const lastFeedingEvent = useMemo(
    () =>
      [...events]
        .filter((e) => e.type === "feeding")
        .sort(
          (a, b) =>
            new Date(b.time).getTime() - new Date(a.time).getTime()
        )[0] as FeedingEvent | undefined,
    [events]
  );

  const lastDiaperEvent = useMemo(
    () =>
      [...events]
        .filter((e) => e.type === "diaper")
        .sort(
          (a, b) =>
            new Date(b.time).getTime() - new Date(a.time).getTime()
        )[0] as DiaperEvent | undefined,
    [events]
  );

  const lastFinishedSleep = useMemo(
    () =>
      [...events]
        .filter(
          (e) => e.type === "sleep" && (e as SleepEvent).sleepEnd
        )
        .sort(
          (a, b) =>
            new Date((b as SleepEvent).sleepEnd as string).getTime() -
            new Date((a as SleepEvent).sleepEnd as string).getTime()
        )[0] as SleepEvent | undefined,
    [events]
  );

  const lastPumpingEvent = useMemo(
    () =>
      [...events]
        .filter(
          (e) =>
            e.type === "pumping" ||
            (e.type === "feeding" && e.feedingMethod === "pumped")
        )
        .sort(
          (a, b) =>
            new Date(b.time).getTime() - new Date(a.time).getTime()
        )[0] as (PumpingEvent | FeedingEvent) | undefined,
    [events]
  );

  const lastFeedingLabel = useMemo(() => {
    if (!lastFeedingEvent) return "Dar nėra maitinimų.";
    const ago = formatAgo(lastFeedingEvent.time, now);
    const typeText =
      lastFeedingEvent.feedingMethod === "breast"
        ? "krūtimi"
        : lastFeedingEvent.feedingMethod === "formula"
        ? "mišinėlis"
        : "nutrauktas";
    return `${ago} • ${typeText}`;
  }, [lastFeedingEvent, now]);

  const lastDiaperLabel = useMemo(() => {
    if (!lastDiaperEvent) return "Dar nėra sauskelnių keitimų.";
    const ago = formatAgo(lastDiaperEvent.time, now);
    let kind = "";
    if (lastDiaperEvent.diaperKind === "wet") kind = "šlapias";
    else if (lastDiaperEvent.diaperKind === "dirty") kind = "purvinas";
    else kind = "šlapias ir purvinas";
    return `${ago} • ${kind}`;
  }, [lastDiaperEvent, now]);

  const lastSleepLabel = useMemo(() => {
    if (!lastFinishedSleep) return "";
    const endIso = lastFinishedSleep.sleepEnd as string;
    return formatAgo(endIso, now);
  }, [lastFinishedSleep, now]);

  const threeHourLimitInfo = useMemo(() => {
    const birth = new Date(babyInfo.birthIso);
    if (Number.isNaN(birth.getTime())) {
      return { limit: 100, index: -1 };
    }
    const diffDays = Math.max(
      0,
      Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24))
    );
    // Amžiaus intervalai pagal pateiktą lentelę
    // 0: 1 diena, 1: 3 diena, 2: 8–10 diena, 3: 1 sav.–1 mėn.,
    // 4: 1–3 mėn., 5: 3–6 mėn., 6: 6–9 mėn., 7: 9–12 mėn.
    let index = 0;
    if (diffDays <= 1) index = 0;
    else if (diffDays <= 3) index = 1;
    else if (diffDays <= 10) index = 2;
    else if (diffDays <= 30) index = 3;
    else if (diffDays <= 90) index = 4;
    else if (diffDays <= 180) index = 5;
    else if (diffDays <= 270) index = 6;
    else index = 7;

    const limits = [15, 30, 60, 120, 180, 210, 240, 240];
    return { limit: limits[index] ?? 100, index };
  }, [babyInfo.birthIso, now]);

  const feedingGuidance = useMemo(() => {
    const nowMs = now.getTime();
    const threeHoursMs = 3 * 60 * 60 * 1_000;
    const dayMs = 24 * 60 * 60 * 1_000;
    const threeHourWindowStart = nowMs - threeHoursMs;
    const dayWindowStart = nowMs - dayMs;

    let last3hFormulaMl = 0;
    const last3hFeedings: {
      id: string;
      time: string;
      amountMl: number | null;
      method: FeedingEvent["feedingMethod"];
    }[] = [];
    let last3hEarliestMs: number | null = null;

    let last24hFormulaMl = 0;

    for (const e of events) {
      if (e.type !== "feeding") continue;
      const t = new Date(e.time).getTime();
      if (Number.isNaN(t)) continue;

      if (t >= threeHourWindowStart && t <= nowMs) {
        if (typeof e.amountMl === "number") {
          if (e.feedingMethod === "formula") {
            last3hFormulaMl += e.amountMl;
            last24hFormulaMl += e.amountMl;
          } else if (e.feedingMethod === "pumped") {
            // suvartotas nutrauktas pienas įtraukiamas į 3h suvartojimą,
            // bet ne į mišinėlio 24h limitą
            last3hFormulaMl += e.amountMl;
          }
        }
        last3hFeedings.push({
          id: e.id,
          time: e.time,
          amountMl: typeof e.amountMl === "number" ? e.amountMl : null,
          method: e.feedingMethod,
        });
        if (
          typeof e.amountMl === "number" &&
          (last3hEarliestMs == null || t < last3hEarliestMs)
        ) {
          last3hEarliestMs = t;
        }
      } else if (
        e.feedingMethod === "formula" &&
        t >= dayWindowStart &&
        t <= nowMs &&
        typeof e.amountMl === "number"
      ) {
        last24hFormulaMl += e.amountMl;
      }
    }

    const limit3h = threeHourLimitInfo.limit;
    const limit24h = 560;

    const remaining3h = Math.max(0, limit3h - last3hFormulaMl);

    let next3hAvailableAt: Date | null = null;
    let next3hAvailableInMinutes: number | null = null;

    if (remaining3h <= 0 && last3hEarliestMs != null) {
      const ts = last3hEarliestMs + threeHoursMs;
      if (ts > nowMs) {
        next3hAvailableAt = new Date(ts);
        next3hAvailableInMinutes = Math.max(
          0,
          Math.round((ts - nowMs) / 60_000)
        );
      }
    }

    const remaining24h = Math.max(0, limit24h - last24hFormulaMl);

    return {
      last3hFormulaMl,
      remaining3h,
      next3hAvailableAt,
      next3hAvailableInMinutes,
      last24hFormulaMl,
      remaining24h,
      limit3h,
      limit24h,
      last3hFeedings,
    };
  }, [events, now, threeHourLimitInfo.limit]);

  const babyAgeLabel = useMemo(() => {
    const birth = new Date(babyInfo.birthIso);
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

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} m.`);
    if (months > 0) parts.push(`${months} mėn.`);
    if (days > 0 || parts.length === 0) parts.push(`${days} d.`);
    if (hours > 0) parts.push(`${hours} val.`);
    if (minutes > 0) parts.push(`${minutes} min.`);
    return parts.join(" ");
  }, [now, babyInfo.birthIso]);

  const babyBirthDisplay = useMemo(() => {
    const d = new Date(babyInfo.birthIso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("lt-LT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }, [babyInfo.birthIso]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDateKey) return "";
    const d = new Date(selectedDateKey + "T00:00:00");
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("lt-LT", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }, [selectedDateKey]);

  const archiveByDay = useMemo(() => {
    const groups: Record<string, BabyEvent[]> = {};
    for (const e of events) {
      const key = dateKeyFromIso(e.time);
      if (!key) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    const entries = Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
    return entries;
  }, [events]);

  const availableDateKeys = useMemo(
    () => archiveByDay.map(([key]) => key),
    [archiveByDay]
  );

  const prevStats = useMemo(() => {
    // surandame „vakar“ pagal turimų įrašų sąrašą, o ne kalendoriaus datą.
    // availableDateKeys yra surūšiuotas DESC (naujausia diena pirmoje vietoje),
    // todėl „vakar“ yra elementas su indeksu idx + 1.
    const idx = availableDateKeys.findIndex((k) => k === selectedDateKey);
    // jei pasirinkta diena nerasta arba ji yra paskutinė sąraše – neturime su kuo lyginti
    if (idx === -1 || idx + 1 >= availableDateKeys.length) {
      return {
        todayFormulaAmount: 0,
        todayExpressedAndUsed: 0,
        todayDiapers: 0,
        todaySleepMinutes: 0,
        todayPumpedAmount: 0,
      };
    }
    const key = availableDateKeys[idx + 1];
    const base = {
      todayFormulaAmount: 0,
      todayExpressedAndUsed: 0,
      todayDiapers: 0,
      todaySleepMinutes: 0,
      todayPumpedAmount: 0,
    };
    for (const e of events) {
      if (!isSameDayKey(e.time, key)) continue;
      if (e.type === "feeding") {
        if (typeof e.amountMl === "number") {
          if (e.feedingMethod === "formula") {
            base.todayFormulaAmount += e.amountMl;
          } else if (e.feedingMethod === "pumped") {
            base.todayExpressedAndUsed += e.amountMl;
          }
        }
      } else if (e.type === "diaper") {
        base.todayDiapers += 1;
      } else if (e.type === "sleep" && e.sleepEnd) {
        const start = new Date(e.time).getTime();
        const end = new Date(e.sleepEnd).getTime();
        if (
          isSameDayKey(e.time, key) &&
          isSameDayKey(e.sleepEnd, key)
        ) {
          const minutes = Math.max(0, Math.round((end - start) / 60000));
          base.todaySleepMinutes += minutes;
        }
      } else if (e.type === "pumping") {
        if (typeof e.amountMl === "number") {
          base.todayPumpedAmount += e.amountMl;
        }
      }
    }
    return base;
  }, [events, availableDateKeys, selectedDateKey]);

  const daySummaryTouchStartRef = useRef<{ x: number; y: number } | null>(
    null
  );

  const [daySummarySlideOffsetPx, setDaySummarySlideOffsetPx] = useState(0);
  const [daySummarySlideTransition, setDaySummarySlideTransition] =
    useState<string>("none");
  const daySummarySlideAnimatingRef = useRef(false);
  const daySummarySlideTimeoutIdsRef = useRef<number[]>([]);

  function clearDaySummarySlideTimers() {
    for (const id of daySummarySlideTimeoutIdsRef.current) {
      window.clearTimeout(id);
    }
    daySummarySlideTimeoutIdsRef.current = [];
  }

  useEffect(() => {
    return () => clearDaySummarySlideTimers();
  }, []);

  function handleDaySummaryTouchStart(
    e: ReactTouchEvent<HTMLDListElement>
  ) {
    const t = e.touches[0];
    if (!t) return;
    daySummaryTouchStartRef.current = { x: t.clientX, y: t.clientY };
  }

  function handleDaySummaryTouchEnd(
    e: ReactTouchEvent<HTMLDListElement>
  ) {
    const start = daySummaryTouchStartRef.current;
    daySummaryTouchStartRef.current = null;
    if (!start) return;

    const t = e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Prioritetas horizontalui; jei daugiau juda vertikaliai - laikom scroll'u.
    const swipeThresholdPx = 70;
    if (absDx < swipeThresholdPx || absDy > absDx) return;

    const idx = availableDateKeys.findIndex((k) => k === selectedDateKey);
    if (idx === -1) return;
    if (availableDateKeys.length <= 1) return;

    // dx > 0: kairė -> dešinė => senesnė (idx + 1)
    // dx < 0: dešinė -> kairė => naujesnė (idx - 1)
    const nextIdx = dx > 0 ? idx + 1 : idx - 1;
    if (nextIdx < 0 || nextIdx >= availableDateKeys.length) return;

    const nextKey = availableDateKeys[nextIdx];
    if (nextKey === selectedDateKey) return;

    if (daySummarySlideAnimatingRef.current) return;
    daySummarySlideAnimatingRef.current = true;
    clearDaySummarySlideTimers();

    const dir = dx > 0 ? 1 : -1; // su judesiu
    const exitOffset = dir * 60;
    const enterOffset = -dir * 60;

    // 1) stumiame dabartinę sekciją iš ekrano
    setDaySummarySlideTransition("transform 140ms ease-out");
    setDaySummarySlideOffsetPx(exitOffset);

    const t1 = window.setTimeout(() => {
      // 2) pakeičiam datą, įkeliant turinį iš kitos pusės
      setSelectedDateKey(nextKey);
      setDaySummarySlideTransition("none");
      setDaySummarySlideOffsetPx(enterOffset);

      requestAnimationFrame(() => {
        setDaySummarySlideTransition("transform 180ms ease-in-out");
        setDaySummarySlideOffsetPx(0);

        const t2 = window.setTimeout(() => {
          daySummarySlideAnimatingRef.current = false;
        }, 190);
        daySummarySlideTimeoutIdsRef.current.push(t2);
      });
    }, 140);

    daySummarySlideTimeoutIdsRef.current.push(t1);
  }

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

  // Jei yra aktyvus maitinimas krūtimi, UI turi atspindėti pasirinktą krūtį
  // ir neleisti pasirinkti kitos kol laikmatis vyksta (taip pat po puslapio perkrovimo).
  useEffect(() => {
    if (activeBreastFeeding) {
      setFeedingMethod("breast");
      const side = activeBreastFeeding.breastSide;
      if (side === "right") {
        setBreastSide("right");
      } else {
        setBreastSide("left");
      }
    }
  }, [activeBreastFeeding]);

  useEffect(() => {
    // Jei yra aktyvus laikmatis, automatiškai rodyk atitinkamą įrašo tabą.
    // Taip įkėlus puslapį ar prisijungus UI bus "aktualus" (miegas / žindymas).
    if (activeSleep) {
      setEntryCategory("sleep");
    } else if (activeBreastFeeding) {
      setEntryCategory("feeding");
    }
  }, [activeSleep, activeBreastFeeding]);

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
          user_id: user?.id,
          baby_id: currentBabyId ?? undefined,
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
          // Kai baigiam miegą, UI logikai svarbu iškart matyti, kad laikmatis baigtas.
          // Jei DB atsako su null, vis tiek užbaigiame pagal dabar.
          sleepEnd: data.sleep_end ?? nowIso,
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
            user_id: user?.id,
            baby_id: currentBabyId ?? undefined,
            type: "feeding",
            time: nowIso,
            notes: null,
            feeding_method: "breast" as FeedingMethod,
            amount_ml: null,
            duration_minutes: null,
            diaper_kind: null,
            breast_side: breastSide,
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
              breastSide:
                data.breast_side === "left" || data.breast_side === "right"
                  ? data.breast_side
                  : null,
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
              time: data.time ?? active.time,
              notes: data.notes ?? undefined,
              feedingMethod: data.feeding_method,
              amountMl: data.amount_ml ?? undefined,
              // Kai baigiama žindyti, laikmačiu laikomas įrašas su durationMinutes == null.
              // Jei DB atsako null, UI vis tiek turi persijungti į "Pradėti žindymą".
              durationMinutes:
                typeof data.duration_minutes === "number"
                  ? data.duration_minutes
                  : minutes,
              breastSide:
                data.breast_side === "left" || data.breast_side === "right"
                  ? data.breast_side
                  : null,
            };
            setEvents((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e))
            );
          }
        }
      } else {
        const payload = {
          user_id: user?.id,
          baby_id: currentBabyId ?? undefined,
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
    } else if (targetType === "diaper") {
      const payload = {
        user_id: user?.id,
        baby_id: currentBabyId ?? undefined,
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
    } else if (targetType === "pumping") {
      const payload = {
        user_id: user?.id,
        baby_id: currentBabyId ?? undefined,
        type: "pumping",
        time: nowIso,
        notes: null,
        diaper_kind: null,
        feeding_method: null,
        amount_ml: amountMl ? Number(amountMl) || null : null,
        duration_minutes: null,
      };

      const { data, error } = await supabase
        .from("events")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        if (typeof window !== "undefined") {
          console.error("Nutraukimo įrašo klaida:", error);
          window.alert(
            `Nepavyko išsaugoti nutraukimo: ${
              (error as any).message ?? "nežinoma klaida"
            }`
          );
        }
      } else if (data) {
        const newEvent: PumpingEvent = {
          id: data.id,
          type: "pumping",
          time: data.time,
          notes: data.notes ?? undefined,
          amountMl: data.amount_ml ?? undefined,
        };
        setEvents((prev) => [newEvent, ...prev]);
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

  async function handleAcceptInviteCode(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const code = codeInput.trim().toUpperCase();
    if (!code) {
      setCodeError("Įvesk pakvietimo kodą.");
      return;
    }
    setIsAcceptingCode(true);
    setCodeError("");
    try {
      const { data: inviteRow, error: inviteError } = await supabase
        .from("baby_invites")
        .select("id, code, baby_id, used_by, used_at, babies(name, birth_iso)")
        .eq("code", code)
        .maybeSingle();

      if (inviteError) throw new Error(inviteError.message);
      if (!inviteRow) {
        setCodeError("Pakvietimas nerastas.");
        return;
      }
      const invite = inviteRow as any;
      if (invite.used_by) {
        setCodeError("Šis pakvietimo kodas jau panaudotas.");
        return;
      }

      const babyId = invite.baby_id as string;
      const { error: memberError } = await supabase.from("baby_members").insert({
        baby_id: babyId,
        user_id: user.id,
        role: "parent",
      });
      if (memberError && memberError.code !== "23505") throw memberError;

      await supabase
        .from("baby_invites")
        .update({
          used_by: user.id,
          used_at: new Date().toISOString(),
        })
        .eq("id", invite.id);

      const baby = invite.babies;
      const birthIso = baby?.birth_iso ?? null;
      if (birthIso) {
        setBabyInfo({
          name: (baby?.name as string) ?? "",
          birthIso,
        });
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("baby-diary-unlocked-v1", "true");
      }
      setHasBaby(true);
      setCurrentBabyId(babyId);
      setCodeInput("");
      setCodeError("");
      setBabyInfo(getBabyInfo());
    } catch (err: any) {
      setCodeError(err.message ?? "Nepavyko priimti pakvietimo.");
    } finally {
      setIsAcceptingCode(false);
    }
  }

  const showInviteForm = user && hasBaby === false;
  const showDiary = user && hasBaby === true;
  const showLoadingBaby = user && hasBaby === null;

  return (
    <div className="min-h-screen text-slate-900">
      {showLoadingBaby && (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-500">Kraunama...</p>
        </div>
      )}
      {showInviteForm && (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-rose-50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-lg ring-1 ring-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Prisijunk prie kūdikio
                </p>
                <p className="text-sm font-medium text-slate-800">
                  Įvesk pakvietimo kodą, kurį gavai nuo kūdikio savininko
                </p>
              </div>
            </div>
            <form className="mt-4 space-y-3" onSubmit={handleAcceptInviteCode}>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">
                  Pakvietimo kodas
                </label>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  maxLength={20}
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    if (codeError) setCodeError("");
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-[16px] tracking-wider outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  placeholder="pvz. ABCD1234"
                />
              </div>
              {codeError && (
                <p className="text-[11px] text-rose-600">{codeError}</p>
              )}
              <Button
                type="submit"
                disabled={isAcceptingCode}
                className="w-full bg-sky-600 text-xs text-white hover:bg-sky-700"
              >
                {isAcceptingCode ? "Prijungiama..." : "Prisijungti prie kūdikio"}
              </Button>
            </form>
            <p className="mt-4 text-center text-[11px] text-slate-500">
              Neturi kodo?{" "}
              <a href="/profilis" className="text-sky-600 underline">
                Užregistruok kūdikį profilyje
              </a>
            </p>
          </div>
        </div>
      )}
      {showDiary && (
        <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 pb-24 pt-6 sm:px-6 sm:py-10">
        {/* Kūdikio info viršuje */}
        <section>
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-800 shadow-sm ring-1 ring-slate-100 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4S14.21 4 12 4 8 5.79 8 8s1.79 4 4 4Z" />
                  <path d="M4 20c0-2.761 3.134-5 7-5s7 2.239 7 5" />
                </svg>
              </div>
              <p className="flex min-w-0 items-center gap-2 truncate text-[13px] text-slate-900">
                <span className="font-semibold">
                  {babyInfo.name || "Kūdikis"}
                </span>
                <span className="flex items-center gap-1 text-[11px] font-normal text-slate-600">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M12 6v6l3 3" />
                    <circle cx="12" cy="12" r="8" />
                  </svg>
                  <span className="truncate">
                    {babyBirthDisplay ? `Gimė ${babyBirthDisplay}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-[11px] font-normal text-slate-600">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M7 8.5C7 6.567 8.567 5 10.5 5s3.5 1.567 3.5 3.5S12.433 12 10.5 12H7v1.5" />
                    <path d="M7 16h7" />
                    <rect x="4" y="4" width="16" height="16" rx="8" />
                  </svg>
                  <span className="truncate">{babyAgeLabel}</span>
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Šiandien – santrauka + paskutiniai įrašai */}
        <section className="space-y-3">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-sky-100 via-rose-100 to-indigo-100 p-[1px] shadow-sm">
            <div className="relative rounded-[1.35rem] bg-white px-4 py-4 text-xs text-slate-800 sm:px-5 sm:py-5">
              {/* Header */}
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700 ring-1 ring-sky-200">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="4" width="18" height="15" rx="4" />
                      <path d="M8 9h8" />
                    </svg>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Dienos statistika
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDateKey}
                    onChange={(e) => setSelectedDateKey(e.target.value)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] text-slate-700 shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                  >
                    {availableDateKeys.length === 0 && (
                      <option value={selectedDateKey}>
                        {selectedDateLabel || "Pasirink dieną"}
                      </option>
                    )}
                    {availableDateKeys.map((key) => (
                      <option key={key} value={key}>
                        {new Date(key + "T00:00:00").toLocaleDateString("lt-LT", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })}
                      </option>
                    ))}
                  </select>
                  <span className="hidden items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200 sm:inline-flex">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-7 w-7"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    >
                      <circle cx="12" cy="12" r="8" />
                      <path
                        d="M12 8v4l2.5 1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>
                      Dabar{" "}
                      {now.toLocaleTimeString("lt-LT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </div>
              </div>

              {/* Today summary */}
              <dl
                className="mt-3 space-y-1.5 text-xs text-slate-600"
                onTouchStart={handleDaySummaryTouchStart}
                onTouchEnd={handleDaySummaryTouchEnd}
                style={{
                  touchAction: "pan-y",
                  transform: `translateX(${daySummarySlideOffsetPx}px)`,
                  transition: daySummarySlideTransition,
                }}
              >
                <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
                  <dt className="text-[11px] font-medium text-slate-700">
                    Mišinėlis
                  </dt>
                  <dd className="flex items-center justify-end gap-1 text-right text-[11px] font-semibold text-sky-700">
                    <span>{stats.todayFormulaAmount} ml</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        stats.todayFormulaAmount -
                          prevStats.todayFormulaAmount >
                        0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : stats.todayFormulaAmount -
                              prevStats.todayFormulaAmount <
                            0
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {formatDelta(
                        stats.todayFormulaAmount,
                        prevStats.todayFormulaAmount
                      )}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-rose-50 px-3 py-2 ring-1 ring-rose-100">
                  <dt className="text-[11px] font-medium text-slate-700">
                    Suvartotas nutrauktas pienas
                  </dt>
                  <dd className="flex items-center justify-end gap-1 text-right text-[11px] font-semibold text-rose-700">
                    <span>{stats.todayExpressedAndUsed} ml</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        stats.todayExpressedAndUsed -
                          prevStats.todayExpressedAndUsed >
                        0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : stats.todayExpressedAndUsed -
                              prevStats.todayExpressedAndUsed <
                            0
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {formatDelta(
                        stats.todayExpressedAndUsed,
                        prevStats.todayExpressedAndUsed
                      )}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-rose-50/70 px-3 py-2 ring-1 ring-rose-100/80">
                  <dt className="text-[11px] font-medium text-slate-700">
                    Nutrauktas pienas
                  </dt>
                  <dd className="flex items-center justify-end gap-1 text-right text-[11px] font-semibold text-rose-700">
                    <span>{stats.todayPumpedAmount} ml</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        stats.todayPumpedAmount - prevStats.todayPumpedAmount > 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : stats.todayPumpedAmount - prevStats.todayPumpedAmount < 0
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {formatDelta(
                        stats.todayPumpedAmount,
                        prevStats.todayPumpedAmount
                      )}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">
                  <dt className="text-[11px] font-medium text-slate-700">
                    Sauskelnės
                  </dt>
                  <dd className="flex items-center justify-end gap-1 text-right text-[11px] font-semibold text-emerald-700">
                    <span>{stats.todayDiapers} kartai</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        stats.todayDiapers - prevStats.todayDiapers > 0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : stats.todayDiapers - prevStats.todayDiapers < 0
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {formatDelta(
                        stats.todayDiapers,
                        prevStats.todayDiapers
                      )}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50/60 px-3 py-1.5 text-[11px] ring-1 ring-emerald-100/70">
                  <div className="flex flex-1 items-stretch justify-between gap-4">
                    <div className="flex flex-1 items-baseline gap-1">
                      <span className="font-medium text-slate-600">
                        Šlapios
                      </span>
                      <span className="font-semibold text-emerald-800">
                        {stats.todayWetDiapers}
                      </span>
                    </div>
                    <div className="flex flex-1 items-baseline gap-1 border-l border-emerald-200 pl-4">
                      <span className="font-medium text-slate-600">
                        Purvinos
                      </span>
                      <span className="font-semibold text-emerald-800">
                        {stats.todayDirtyDiapers}
                      </span>
                    </div>
                    <div className="flex flex-1 items-baseline gap-1 border-l border-emerald-200 pl-4">
                      <span className="font-medium text-slate-600">
                        Abu
                      </span>
                      <span className="font-semibold text-emerald-800">
                        {stats.todayBothDiapers}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-purple-50 px-3 py-2 ring-1 ring-purple-100">
                  <dt className="text-[11px] font-medium text-slate-700">
                    Miegas
                  </dt>
                  <dd className="flex items-center justify-end gap-1 text-right text-[11px] font-semibold text-purple-700">
                    <span>{todaySleepHoursLabel}</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        stats.todaySleepMinutes -
                          prevStats.todaySleepMinutes >
                        0
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : stats.todaySleepMinutes -
                              prevStats.todaySleepMinutes <
                            0
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {formatDelta(
                        stats.todaySleepMinutes,
                        prevStats.todaySleepMinutes
                      )}{" "}
                      min
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section>
          <div className="w-full rounded-2xl bg-sky-50/80 p-4 shadow-sm ring-1 ring-sky-100 backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 17V11" />
                    <circle cx="12" cy="8" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Rekomendacija
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShow3hInfo((v) => !v)}
                className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50 active:scale-95"
                aria-label="Informacija"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[11px]">
                  i
                </span>
                <span>Informacija</span>
              </button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <p className="flex items-center gap-1">
                  <span>Per paskutines 3 val.</span>
                  <span className="font-semibold text-sky-700">
                    {Math.round(feedingGuidance.last3hFormulaMl)} ml
                  </span>
                </p>
                <p className="flex items-center gap-1">
                  <span>Liko iki ribos</span>
                  <span className="font-semibold text-emerald-700">
                    {Math.max(0, Math.round(feedingGuidance.remaining3h))} ml
                  </span>
                </p>
              </div>
              <div className="relative h-6 w-full overflow-hidden rounded-full bg-sky-100/70 ring-1 ring-sky-200">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-sky-500"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        (feedingGuidance.last3hFormulaMl /
                          Math.max(feedingGuidance.limit3h || 1, 1)) *
                          100
                      )
                    )}%`,
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-sky-900">
                  {Math.round(feedingGuidance.last3hFormulaMl)} /{" "}
                  {feedingGuidance.limit3h} ml
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                <span>Kada galima vėl?</span>
                <span className="text-right">
                  {feedingGuidance.next3hAvailableInMinutes != null &&
                  feedingGuidance.next3hAvailableInMinutes > 0
                    ? `Maždaug po ${
                        feedingGuidance.next3hAvailableInMinutes
                      } min`
                    : "Jau galima."}
                </span>
              </div>
              {feedingGuidance.last3hFeedings.length > 0 && (
                <div className="mt-2 rounded-xl bg-white/70 p-2 text-[11px] text-slate-600 ring-1 ring-sky-100">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Per paskutines 3 val. suvartota
                  </p>
                  <ul className="space-y-0.5">
                    {feedingGuidance.last3hFeedings
                      .slice()
                      .sort(
                        (a, b) =>
                          new Date(b.time).getTime() -
                          new Date(a.time).getTime()
                      )
                      .map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center justify-between"
                        >
                          <span className="text-[10px] text-slate-500">
                            {new Date(f.time).toLocaleTimeString("lt-LT", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            <span>
                              {f.method === "formula"
                                ? "Mišinėlis"
                                : f.method === "pumped"
                                ? "Nutrauktas pienas"
                                : "Krūtimi"}
                            </span>
                            {typeof f.amountMl === "number" && (
                              <span className="font-semibold text-slate-800">
                                {f.amountMl} ml
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
            {show3hInfo && (
              <div className="mt-3 rounded-2xl bg-white/90 p-3 text-[11px] text-slate-600 ring-1 ring-sky-100">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Skrandžio talpa (mišinėlio kiekiai)
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="min-w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-left">
                        <th className="py-1 pr-4 font-medium text-slate-600">
                          Amžius
                        </th>
                        <th className="py-1 font-medium text-slate-600">
                          Kiekis (ml)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        className={`border-b border-slate-100 ${
                          threeHourLimitInfo.index === 0
                            ? "bg-sky-50/80 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-1 pr-4">1 diena (24 val.)</td>
                        <td className="py-1">~15 ml</td>
                      </tr>
                      <tr
                        className={`border-b border-slate-100 ${
                          threeHourLimitInfo.index === 1
                            ? "bg-sky-50/80 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-1 pr-4">3 diena (72 val.)</td>
                        <td className="py-1">15–30 ml</td>
                      </tr>
                      <tr
                        className={`border-b border-slate-100 ${
                          threeHourLimitInfo.index === 2
                            ? "bg-sky-50/80 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-1 pr-4">
                          8–10 diena (&lt;2 savaitės)
                        </td>
                        <td className="py-1">45–60 ml</td>
                      </tr>
                      <tr
                        className={`border-b border-slate-100 ${
                          threeHourLimitInfo.index === 3
                            ? "bg-sky-50/80 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-1 pr-4">1 savaitė – 1 mėnuo</td>
                        <td className="py-1">60–120 ml</td>
                      </tr>
                      <tr
                        className={`border-b border-slate-100 ${
                          threeHourLimitInfo.index === 4
                            ? "bg-sky-50/80 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-1 pr-4">1 – 3 mėnesiai</td>
                        <td className="py-1">120–180 ml</td>
                      </tr>
                      <tr
                        className={`border-b border-slate-100 ${
                          threeHourLimitInfo.index === 5
                            ? "bg-sky-50/80 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-1 pr-4">3 – 6 mėnesiai</td>
                        <td className="py-1">180–210 ml</td>
                      </tr>
                      <tr
                        className={`border-b border-slate-100 ${
                          threeHourLimitInfo.index === 6
                            ? "bg-sky-50/80 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-1 pr-4">6 – 9 mėnesiai</td>
                        <td className="py-1">210–240 ml</td>
                      </tr>
                      <tr
                        className={
                          threeHourLimitInfo.index === 7
                            ? "bg-sky-50/80 font-semibold"
                            : ""
                        }
                      >
                        <td className="py-1 pr-4">9 – 12 mėnesių</td>
                        <td className="py-1">210–240 ml</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[9px] text-slate-400">
                  Remiantis „Stomach Capacity“, Alabama Department of Public
                  Health (.gov).
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl bg-white/95 p-4 shadow-md ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
            <div className="space-y-4">
              {/* Kategorijos pasirinkimas */}
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Naujas įrašas
                </p>
                <div className="flex items-center gap-2 text-[11px] font-medium">
                  <button
                    type="button"
                    onClick={() => setEntryCategory("feeding")}
                    className={`flex flex-1 aspect-[2/1] items-center justify-center rounded-2xl transition ${
                      entryCategory === "feeding"
                        ? "bg-[#ffd6d6] text-rose-900 shadow-sm"
                        : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                    aria-label="Maitinimas"
                  >
                    <svg
                      viewBox="0 0 64 64"
                      className="h-8 w-8"
                      aria-hidden="true"
                      fill="currentColor"
                    >
                      <path d="M50.74,9l-2.41,2.41c-2.8-1.59-5.95-1.71-8.13-.22l-.07-.07a3,3,0,0,0-4.24,0,3,3,0,0,0-.76,1.32,3,3,0,0,0-2.78.8L9,36.6a3,3,0,0,0,0,4.24L23.16,55h0a3,3,0,0,0,4.24,0L50.74,31.65A3,3,0,0,0,51.21,28a2.86,2.86,0,0,0,.94-.64,3,3,0,0,0,.54-3.47c1.6-2.18,1.5-5.4-.12-8.26L55,13.26A3,3,0,0,0,50.74,9Zm-1.42,5.66c2.39,2.39,3.18,5.6,2,7.67l-9.7-9.7C43.72,11.5,46.93,12.29,49.32,14.68Zm-12-2.13a1,1,0,0,1,1.42,0l12,12a1,1,0,0,1,0,1.41,1,1,0,0,1-1.42,0l-12-12a1,1,0,0,1,0-1.42ZM26,53.57a1,1,0,0,1-1.41,0h0L10.43,39.42a1,1,0,0,1,0-1.41l17-17L43,36.6,41.55,38l-5.66-5.66a1,1,0,0,0-1.41,1.42l5.65,5.65L37.3,42.25l-3.53-3.53a1,1,0,0,0-1.42,0,1,1,0,0,0,0,1.41l3.54,3.54L33.06,46.5,27.4,40.84A1,1,0,0,0,26,42.25l5.66,5.66-2.83,2.83L25.28,47.2a1,1,0,0,0-1.41,0,1,1,0,0,0,0,1.42l3.53,3.53ZM49.32,30.23l-5,4.95L28.82,19.63l5-4.95a1,1,0,0,1,1.41,0l.71.7,12,12,1.41,1.42A1,1,0,0,1,49.32,30.23Zm4.25-18.38L51.45,14,50,12.55l2.12-2.12a1,1,0,0,1,1.42,1.42Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryCategory("diaper")}
                    className={`flex flex-1 aspect-[2/1] items-center justify-center rounded-2xl transition ${
                      entryCategory === "diaper"
                        ? "bg-[#eee2f5] text-purple-900 shadow-sm"
                        : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                    }`}
                    aria-label="Sauskelnės"
                  >
                    <svg
                      viewBox="0 0 64 64"
                      className="h-8 w-8"
                      aria-hidden="true"
                      fill="currentColor"
                    >
                      <path d="M55,15a1,1,0,0,0-1-1H10a1,1,0,0,0-1,1V31a22.76,22.76,0,0,0,.26,3.42h0v0c.07.46.16.92.25,1.37,0,.15.07.29.1.44.07.3.15.6.23.89s.1.37.16.54.16.52.25.77c.14.41.29.8.45,1.19,0,.12.09.24.14.36.13.3.26.59.4.88,0,.06,0,.11.08.16A22.91,22.91,0,0,0,21.8,51.61l.45.22.69.31.87.35.32.13h0a23,23,0,0,0,15.68,0h0l.33-.14.86-.34.69-.31.45-.22A23,23,0,0,0,52.68,41.07l.09-.19.39-.86.15-.39c.16-.38.3-.76.44-1.16s.17-.51.25-.77.11-.37.16-.55.15-.59.22-.88.08-.3.11-.45c.09-.45.18-.91.25-1.36v0h0A22.76,22.76,0,0,0,55,31ZM52.59,35.1c0,.11-.05.23-.07.34-.13.58-.27,1.15-.44,1.71,0,0,0,.08,0,.12a17,17,0,0,1-.68,1.85.69.69,0,0,1,0,.1A21.06,21.06,0,0,1,40.23,50.31l-.1,0-.27.1a10.36,10.36,0,0,1-1.86-6,10.49,10.49,0,0,1,14.63-9.65C52.61,34.93,52.61,35,52.59,35.1ZM48.5,32A12.37,12.37,0,0,0,43,33.29V22H53v9c0,.61,0,1.21-.09,1.81A12.27,12.27,0,0,0,48.5,32ZM53,20H43V16H53ZM24.14,50.46l-.26-.1-.12,0a21.1,21.1,0,0,1-11.08-11.1l0-.08A18,18,0,0,1,12,37.27s0-.08,0-.11c-.17-.56-.31-1.14-.44-1.72,0-.11-.05-.23-.07-.34s0-.17,0-.25A10.49,10.49,0,0,1,24.14,50.46ZM15.5,32a12.27,12.27,0,0,0-4.41.81C11,32.21,11,31.61,11,31V22h9V32.85A12.46,12.46,0,0,0,15.5,32ZM20,16v4H11V16Zm6.08,35.14A12.46,12.46,0,0,0,22,33.84V16H41V34a1.06,1.06,0,0,0,.11.44,12.45,12.45,0,0,0-3.19,16.7,20.81,20.81,0,0,1-11.84,0Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryCategory("sleep")}
                    className={`flex flex-1 aspect-[2/1] items-center justify-center rounded-2xl transition ${
                      entryCategory === "sleep"
                        ? "bg-[#ffe5bf] text-amber-900 shadow-sm"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                    aria-label="Miegas"
                  >
                    <svg
                      viewBox="0 0 66 66"
                      className="h-8 w-8"
                      aria-hidden="true"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <g transform="translate(1,2)">
                        <path d="M48.7,45.8 C30.8,45.8 16.3,31.3 16.3,13.4 C16.3,8.6 17.3,4.1 19.2,0.1 C7.9,5.2 0.1,16.5 0.1,29.7 C0.1,47.6 14.6,62.1 32.5,62.1 C45.7,62.1 57,54.3 62.1,43 C57.9,44.8 53.4,45.8 48.7,45.8 L48.7,45.8 Z" />
                        <path d="M28.7,1.8 L33.2,5.5 L38.8,4 L36.6,9.4 L39.8,14.3 L34,13.9 L30.3,18.4 L28.9,12.7 L23.5,10.7 L28.4,7.6 L28.7,1.8 Z" />
                        <path d="M49.5,22.5 L50.2,28.3 L55.4,31 L50.1,33.5 L49.2,39.2 L45.2,35 L39.4,35.9 L42.2,30.8 L39.6,25.6 L45.3,26.6 L49.5,22.5 Z" />
                        <path d="M56.7,3.8 L56.3,8.5 L59.9,11.6 L55.3,12.6 L53.5,17 L51.1,12.9 L46.4,12.6 L49.5,9 L48.3,4.4 L52.7,6.3 L56.7,3.8 Z" />
                      </g>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryCategory("pumping")}
                    className={`flex flex-1 aspect-[2/1] items-center justify-center rounded-2xl transition ${
                      entryCategory === "pumping"
                        ? "bg-[#fde7ff] text-fuchsia-900 shadow-sm"
                        : "bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100"
                    }`}
                    aria-label="Nutrauktas pienas"
                  >
                    <svg
                      viewBox="0 0 512 512"
                      className="h-8 w-8"
                      aria-hidden="true"
                      fill="currentColor"
                    >
                      <path d="M288.209,331.768c-13.486,0-25.843-2.991-37.793-5.891c-11.956-2.888-24.313-5.885-37.688-5.885c-10.64,0-20.838,1.883-31.166,5.753l-4.05,1.509V445.54c0,3.696,1.032,7.11,3.08,10.156c1.974,2.907,4.811,5.254,8.003,6.604c2.257,0.948,4.57,1.419,7.068,1.419h120.653c3.704-0.007,7.117-1.046,10.15-3.088c2.914-1.959,5.254-4.805,6.611-8.017c0.941-2.222,1.412-4.597,1.412-7.054V320.324l-8.619,3.565C313.02,329.186,300.697,331.768,288.209,331.768z" />
                      <path d="M381.115,200.834c0.028-4.888-0.215-21.71-4.458-32.759c-5.303-13.777-19.322-35.134-34.892-47.581c-5.096-4.085-10.911-8.19-17.065-12.538c-7.304-5.157-19.98-14.116-25.255-19.716c0.146-0.235,0.298-0.471,0.443-0.686c4.05-6.265,10.841-16.739,10.841-32.815C310.729,24.563,286.18,0,256.003,0c-30.184,0-54.732,24.563-54.732,54.74c0,16.068,6.791,26.55,10.841,32.815c0.145,0.215,0.298,0.45,0.45,0.686c-5.282,5.593-17.958,14.559-25.262,19.716c-6.148,4.348-11.97,8.453-17.072,12.538c-15.563,12.454-29.588,33.811-34.885,47.581c-4.236,11.049-4.479,27.871-4.458,32.759l0.07,11.603h-0.07v235.719c0,8.626,1.696,16.982,5.061,24.86c4.866,11.402,12.924,21.122,23.295,28.08c10.62,7.13,23.047,10.904,35.93,10.904h121.636c8.674,0,17.1-1.689,25.02-5.026c11.506-4.833,21.295-12.822,28.294-23.123c7.2-10.55,11-22.894,10.994-35.694V212.437h-0.07L381.115,200.834z M155.731,175.905c4.209-10.952,16.151-28.772,28.135-38.367c17.051-13.632,48.163-31.305,51.389-45.269c3.136-13.61-12.15-18.45-12.15-37.529c0-18.18,14.726-32.904,32.898-32.904c18.166,0,32.898,14.725,32.898,32.904c0,19.08-15.293,23.919-12.157,37.529c3.226,13.964,34.338,31.638,51.389,45.269c11.984,9.595,23.926,27.415,28.135,38.367c3.109,8.072,3.012,24.812,3.012,24.812H152.72C152.72,200.717,152.623,183.977,155.731,175.905z M359.653,233.732v16.373v198.051c0,5.753-1.128,11.319-3.364,16.553c-3.233,7.615-8.612,14.094-15.542,18.74c-7.089,4.742-15.376,7.248-23.954,7.255H195.206c-5.788,0-11.402-1.128-16.671-3.343c-7.67-3.213-14.199-8.543-18.879-15.424c-4.784-7.034-7.304-15.259-7.31-23.78V250.105v-16.373v-11.18h0.374h206.56h0.374V233.732z" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Turinys pagal pasirinktą kategoriją */}
              {entryCategory === "feeding" && (
                <div className="space-y-3 rounded-2xl border border-[#ffd6d6] bg-[#fff0f0] p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffd6d6] text-rose-800">
                      <svg
                        viewBox="0 0 64 64"
                        className="h-4 w-4"
                        aria-hidden="true"
                        fill="currentColor"
                      >
                        <path d="M50.74,9l-2.41,2.41c-2.8-1.59-5.95-1.71-8.13-.22l-.07-.07a3,3,0,0,0-4.24,0,3,3,0,0,0-.76,1.32,3,3,0,0,0-2.78.8L9,36.6a3,3,0,0,0,0,4.24L23.16,55h0a3,3,0,0,0,4.24,0L50.74,31.65A3,3,0,0,0,51.21,28a2.86,2.86,0,0,0,.94-.64,3,3,0,0,0,.54-3.47c1.6-2.18,1.5-5.4-.12-8.26L55,13.26A3,3,0,0,0,50.74,9Zm-1.42,5.66c2.39,2.39,3.18,5.6,2,7.67l-9.7-9.7C43.72,11.5,46.93,12.29,49.32,14.68Zm-12-2.13a1,1,0,0,1,1.42,0l12,12a1,1,0,0,1,0,1.41,1,1,0,0,1-1.42,0l-12-12a1,1,0,0,1,0-1.42ZM26,53.57a1,1,0,0,1-1.41,0h0L10.43,39.42a1,1,0,0,1,0-1.41l17-17L43,36.6,41.55,38l-5.66-5.66a1,1,0,0,0-1.41,1.42l5.65,5.65L37.3,42.25l-3.53-3.53a1,1,0,0,0-1.42,0,1,1,0,0,0,0,1.41l3.54,3.54L33.06,46.5,27.4,40.84A1,1,0,0,0,26,42.25l5.66,5.66-2.83,2.83L25.28,47.2a1,1,0,0,0-1.41,0,1,1,0,0,0,0,1.42l3.53,3.53ZM49.32,30.23l-5,4.95L28.82,19.63l5-4.95a1,1,0,0,1,1.41,0l.71.7,12,12,1.41,1.42A1,1,0,0,1,49.32,30.23Zm4.25-18.38L51.45,14,50,12.55l2.12-2.12a1,1,0,0,1,1.42,1.42Z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Maitinimas
                    </p>
                  </div>

                  {/* Maitinimo tipas */}
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-slate-600">
                      Tipas
                    </p>
                    <div className="flex flex-col gap-1 rounded-2xl bg-[#ffe5e5] p-1.5 text-[11px] font-medium">
                      <button
                        type="button"
                        onClick={() => setFeedingMethod("breast")}
                        disabled={!!activeBreastFeeding}
                        className={`rounded-full px-3 py-2 transition ${
                          feedingMethod === "breast"
                            ? "bg-[#ffbcbc] text-rose-900 shadow-sm"
                            : "text-rose-900 hover:text-rose-700"
                        } ${activeBreastFeeding ? "opacity-60 cursor-not-allowed" : ""}`}
                      >
                        Krūtimi
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedingMethod("formula")}
                        className={`rounded-full px-3 py-2 transition ${
                          feedingMethod === "formula"
                            ? "bg-[#ffbcbc] text-rose-900 shadow-sm"
                            : "text-rose-900 hover:text-rose-700"
                        }`}
                      >
                        Mišinėlis
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedingMethod("pumped")}
                        className={`rounded-full px-3 py-2 transition ${
                          feedingMethod === "pumped"
                            ? "bg-[#ffbcbc] text-rose-900 shadow-sm"
                            : "text-rose-900 hover:text-rose-700"
                        }`}
                      >
                        Nutrauktas
                      </button>
                    </div>
                  </div>

                  {/* Papildomi laukai pagal tipą */}
                  {feedingMethod === "breast" && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-slate-600">
                        Krūtis
                      </p>
                      <div className="flex w-full items-center gap-2 rounded-full bg-[#ffe5e5] px-1.5 py-1 ring-1 ring-[#ffd6d6]">
                        <button
                          type="button"
                          onClick={() => setBreastSide("left")}
                          disabled={!!activeBreastFeeding}
                          className={`flex-1 rounded-full px-3 py-1.75 text-[11px] font-medium transition active:scale-95 ${
                            breastSide === "left"
                              ? "bg-[#ffbcbc] text-rose-900 shadow-sm"
                              : "bg-transparent text-slate-600 hover:bg-[#ffe5e5]"
                          } ${activeBreastFeeding ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          Kairė
                        </button>
                        <button
                          type="button"
                          onClick={() => setBreastSide("right")}
                          disabled={!!activeBreastFeeding}
                          className={`flex-1 rounded-full px-3 py-1.75 text-[11px] font-medium transition active:scale-95 ${
                            breastSide === "right"
                              ? "bg-[#ffbcbc] text-rose-900 shadow-sm"
                              : "bg-transparent text-slate-600 hover:bg-[#ffe5e5]"
                          } ${activeBreastFeeding ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          Dešinė
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-2">
                    {(feedingMethod === "formula" ||
                      feedingMethod === "pumped") && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-600">
                          Kiekis (ml)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={amountMl}
                          onChange={(e) => setAmountMl(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                          placeholder="pvz. 90"
                        />
                      </div>
                    )}

                    {feedingMethod === "breast" && activeBreastFeeding && (
                      <div className="space-y-1 text-center">
                        <div className="mx-auto inline-flex max-w-full items-center gap-3 rounded-2xl bg-[#ffe5e5] px-5 py-3.5 text-lg font-semibold text-rose-900 ring-1 ring-[#ffd6d6]">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ffbcbc]">
                            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-700" />
                          </span>
                          <span className="font-mono text-2xl sm:text-3xl">
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
                                .padStart(2, "0")}`;
                            })()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleAddEvent("feeding")}
                    disabled={isSaving}
                    className="w-full bg-[#ffbcbc] text-xs text-rose-900 hover:bg-[#ffb0b0] disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                        Saugoma...
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 64 64"
                          className="mr-1.5 h-3.5 w-3.5"
                          aria-hidden="true"
                          fill="currentColor"
                        >
                          <path d="M50.74,9l-2.41,2.41c-2.8-1.59-5.95-1.71-8.13-.22l-.07-.07a3,3,0,0,0-4.24,0,3,3,0,0,0-.76,1.32,3,3,0,0,0-2.78.8L9,36.6a3,3,0,0,0,0,4.24L23.16,55h0a3,3,0,0,0,4.24,0L50.74,31.65A3,3,0,0,0,51.21,28a2.86,2.86,0,0,0,.94-.64,3,3,0,0,0,.54-3.47c1.6-2.18,1.5-5.4-.12-8.26L55,13.26A3,3,0,0,0,50.74,9Zm-1.42,5.66c2.39,2.39,3.18,5.6,2,7.67l-9.7-9.7C43.72,11.5,46.93,12.29,49.32,14.68Zm-12-2.13a1,1,0,0,1,1.42,0l12,12a1,1,0,0,1,0,1.41,1,1,0,0,1-1.42,0l-12-12a1,1,0,0,1,0-1.42ZM26,53.57a1,1,0,0,1-1.41,0h0L10.43,39.42a1,1,0,0,1,0-1.41l17-17L43,36.6,41.55,38l-5.66-5.66a1,1,0,0,0-1.41,1.42l5.65,5.65L37.3,42.25l-3.53-3.53a1,1,0,0,0-1.42,0,1,1,0,0,0,0,1.41l3.54,3.54L33.06,46.5,27.4,40.84A1,1,0,0,0,26,42.25l5.66,5.66-2.83,2.83L25.28,47.2a1,1,0,0,0-1.41,0,1,1,0,0,0,0,1.42l3.53,3.53ZM49.32,30.23l-5,4.95L28.82,19.63l5-4.95a1,1,0,0,1,1.41,0l.71.7,12,12,1.41,1.42A1,1,0,0,1,49.32,30.23Zm4.25-18.38L51.45,14,50,12.55l2.12-2.12a1,1,0,0,1,1.42,1.42Z" />
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
                  </Button>
                </div>
              )}

              {entryCategory === "diaper" && (
                <div className="space-y-3 rounded-2xl border border-[#e2d4f2] bg-[#f6edf9] p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eee2f5] text-purple-800">
                      <svg
                        viewBox="0 0 64 64"
                        className="h-4 w-4"
                        aria-hidden="true"
                        fill="currentColor"
                      >
                        <path d="M55,15a1,1,0,0,0-1-1H10a1,1,0,0,0-1,1V31a22.76,22.76,0,0,0,.26,3.42h0v0c.07.46.16.92.25,1.37,0,.15.07.29.1.44.07.3.15.6.23.89s.1.37.16.54.16.52.25.77c.14.41.29.8.45,1.19,0,.12.09.24.14.36.13.3.26.59.4.88,0,.06,0,.11.08.16A22.91,22.91,0,0,0,21.8,51.61l.45.22.69.31.87.35.32.13h0a23,23,0,0,0,15.68,0h0l.33-.14.86-.34.69-.31.45-.22A23,23,0,0,0,52.68,41.07l.09-.19.39-.86.15-.39c.16-.38.3-.76.44-1.16s.17-.51.25-.77.11-.37.16-.55.15-.59.22-.88.08-.3.11-.45c.09-.45.18-.91.25-1.36v0h0A22.76,22.76,0,0,0,55,31ZM52.59,35.1c0,.11-.05.23-.07.34-.13.58-.27,1.15-.44,1.71,0,0,0,.08,0,.12a17,17,0,0,1-.68,1.85.69.69,0,0,1,0,.1A21.06,21.06,0,0,1,40.23,50.31l-.1,0-.27.1a10.36,10.36,0,0,1-1.86-6,10.49,10.49,0,0,1,14.63-9.65C52.61,34.93,52.61,35,52.59,35.1ZM48.5,32A12.37,12.37,0,0,0,43,33.29V22H53v9c0,.61,0,1.21-.09,1.81A12.27,12.27,0,0,0,48.5,32ZM53,20H43V16H53ZM24.14,50.46l-.26-.1-.12,0a21.1,21.1,0,0,1-11.08-11.1l0-.08A18,18,0,0,1,12,37.27s0-.08,0-.11c-.17-.56-.31-1.14-.44-1.72,0-.11-.05-.23-.07-.34s0-.17,0-.25A10.49,10.49,0,0,1,24.14,50.46ZM15.5,32a12.27,12.27,0,0,0-4.41.81C11,32.21,11,31.61,11,31V22h9V32.85A12.46,12.46,0,0,0,15.5,32ZM20,16v4H11V16Zm6.08,35.14A12.46,12.46,0,0,0,22,33.84V16H41V34a1.06,1.06,0,0,0,.11.44,12.45,12.45,0,0,0-3.19,16.7,20.81,20.81,0,0,1-11.84,0Z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Sauskelnių keitimas
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-slate-600">
                        Sauskelnių tipas
                      </p>
                      <div className="flex flex-col gap-1 rounded-2xl bg-[#ebe0f7] p-1.5 text-[11px] font-medium">
                        <button
                          type="button"
                          onClick={() => setDiaperKind("wet")}
                          className={`rounded-full px-3 py-2 transition ${
                            diaperKind === "wet"
                              ? "bg-[#d8c8f3] text-purple-900 shadow-sm"
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
                              ? "bg-[#d8c8f3] text-purple-900 shadow-sm"
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
                              ? "bg-[#d8c8f3] text-purple-900 shadow-sm"
                              : "text-slate-700 hover:text-slate-900"
                          }`}
                        >
                          Abu
                        </button>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleAddEvent("diaper")}
                    disabled={isSaving}
                    className="w-full bg-[#d8c8f3] text-xs text-purple-900 hover:bg-[#cfbdf0] disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                        Saugoma...
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 64 64"
                          className="mr-1.5 h-3.5 w-3.5"
                          aria-hidden="true"
                          fill="currentColor"
                        >
                          <path d="M55,15a1,1,0,0,0-1-1H10a1,1,0,0,0-1,1V31a22.76,22.76,0,0,0,.26,3.42h0v0c.07.46.16.92.25,1.37,0,.15.07.29.1.44.07.3.15.6.23.89s.1.37.16.54.16.52.25.77c.14.41.29.8.45,1.19,0,.12.09.24.14.36.13.3.26.59.4.88,0,.06,0,.11.08.16A22.91,22.91,0,0,0,21.8,51.61l.45.22.69.31.87.35.32.13h0a23,23,0,0,0,15.68,0h0l.33-.14.86-.34.69-.31.45-.22A23,23,0,0,0,52.68,41.07l.09-.19.39-.86.15-.39c.16-.38.3-.76.44-1.16s.17-.51.25-.77.11-.37.16-.55.15-.59.22-.88.08-.3.11-.45c.09-.45.18-.91.25-1.36v0h0A22.76,22.76,0,0,0,55,31ZM52.59,35.1c0,.11-.05.23-.07.34-.13.58-.27,1.15-.44,1.71,0,0,0,.08,0,.12a17,17,0,0,1-.68,1.85.69.69,0,0,1,0,.1A21.06,21.06,0,0,1,40.23,50.31l-.1,0-.27.1a10.36,10.36,0,0,1-1.86-6,10.49,10.49,0,0,1,14.63-9.65C52.61,34.93,52.61,35,52.59,35.1ZM48.5,32A12.37,12.37,0,0,0,43,33.29V22H53v9c0,.61,0,1.21-.09,1.81A12.27,12.27,0,0,0,48.5,32ZM53,20H43V16H53ZM24.14,50.46l-.26-.1-.12,0a21.1,21.1,0,0,1-11.08-11.1l0-.08A18,18,0,0,1,12,37.27s0-.08,0-.11c-.17-.56-.31-1.14-.44-1.72,0-.11-.05-.23-.07-.34s0-.17,0-.25A10.49,10.49,0,0,1,24.14,50.46ZM15.5,32a12.27,12.27,0,0,0-4.41.81C11,32.21,11,31.61,11,31V22h9V32.85A12.46,12.46,0,0,0,15.5,32ZM20,16v4H11V16Zm6.08,35.14A12.46,12.46,0,0,0,22,33.84V16H41V34a1.06,1.06,0,0,0,.11.44,12.45,12.45,0,0,0-3.19,16.7,20.81,20.81,0,0,1-11.84,0Z" />
                        </svg>
                        {editingId && editingType === "diaper"
                          ? "Atnaujinti sauskelnes"
                          : "Išsaugoti sauskelnes"}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {entryCategory === "sleep" && (
                <div className="space-y-3 rounded-2xl border border-[#ffe5bf] bg-[#fff5dd] p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ffe5bf] text-amber-800">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-6 w-6"
                        aria-hidden="true"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          clipRule="evenodd"
                          d="M18 2.75C17.5858 2.75 17.25 2.41421 17.25 2C17.25 1.58579 17.5858 1.25 18 1.25H22C22.3034 1.25 22.5768 1.43273 22.6929 1.71299C22.809 1.99324 22.7449 2.31583 22.5304 2.53033L19.8107 5.25H22C22.4142 5.25 22.75 5.58579 22.75 6C22.75 6.41421 22.4142 6.75 22 6.75H18C17.6967 6.75 17.4232 6.56727 17.3071 6.28701C17.191 6.00676 17.2552 5.68417 17.4697 5.46967L20.1894 2.75H18ZM13.5 8.75C13.0858 8.75 12.75 8.41421 12.75 8C12.75 7.58579 13.0858 7.25 13.5 7.25H16.5C16.8034 7.25 17.0768 7.43273 17.1929 7.71299C17.309 7.99324 17.2449 8.31583 17.0304 8.53033L15.3107 10.25H16.5C16.9142 10.25 17.25 10.5858 17.25 11C17.25 11.4142 16.9142 11.75 16.5 11.75H13.5C13.1967 11.75 12.9232 11.5673 12.8071 11.287C12.691 11.0068 12.7552 10.6842 12.9697 10.4697L14.6894 8.75H13.5Z"
                        />
                        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 11.5373 21.3065 11.4608 21.0672 11.8568C19.9289 13.7406 17.8615 15 15.5 15C11.9101 15 9 12.0899 9 8.5C9 6.13845 10.2594 4.07105 12.1432 2.93276C12.5392 2.69347 12.4627 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Miegas
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Paspausk, kai kūdikis užmiega, ir dar kartą – kai prabunda.
                  </p>
                  {activeSleep && (
                    <div className="text-center">
                      <div className="mx-auto inline-flex max-w-full items-center gap-3 rounded-2xl bg-[#ffeedd] px-5 py-3.5 text-lg font-semibold text-amber-900 ring-1 ring-[#ffe5bf]">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ffdca7]">
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-700" />
                        </span>
                        <span className="font-mono text-2xl sm:text-3xl">
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
                              .padStart(2, "0")}`;
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                  <Button
                    type="button"
                    onClick={() => handleAddEvent("sleep")}
                    disabled={isSaving}
                    className="w-full bg-[#ffe5bf] text-xs text-amber-900 hover:bg-[#ffdca7] disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                        Saugoma...
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 64 64"
                          className="mr-1.5 h-3.5 w-3.5"
                          aria-hidden="true"
                          fill="currentColor"
                        >
                          <path d="M48.9,30.65a11,11,0,1,0-18.76-7.42c0,1-1.21,3-2.33,4.39-1.44-2.48-1.84-4.49-1.64-5.48a3.47,3.47,0,0,0-.52-2.62,3.49,3.49,0,0,0-4.85-1,3.46,3.46,0,0,0-1.49,2.23A14.19,14.19,0,0,0,20.68,29a11.64,11.64,0,0,0-5.37,3.06A11.75,11.75,0,0,0,31.93,48.68,11.58,11.58,0,0,0,35,43.16a19.63,19.63,0,0,0,7.51,1.6,3.5,3.5,0,1,0,0-7h0a13,13,0,0,1-6.08-1.65c1.33-1.08,3.34-2.29,4.22-2.26A11,11,0,0,0,48.9,30.65ZM29.33,39.76a5.74,5.74,0,1,1-5.26-5.12s.07,0,.11,0a31.62,31.62,0,0,0,2.45,2.74A30.28,30.28,0,0,0,29.33,39.76Zm1.19,7.51a9.75,9.75,0,1,1-8.91-16.43c.34.61.71,1.22,1.13,1.85a7.74,7.74,0,1,0,8.58,8.5c.63.41,1.24.76,1.85,1.09A9.69,9.69,0,0,1,30.52,47.27Zm12-7.51h0a1.51,1.51,0,0,1,1.06.43,1.51,1.51,0,0,1-1.06,2.57C39.66,42.76,34,41.87,28,36s-7.39-11.71-6.77-14.79a1.47,1.47,0,0,1,.64-.95,1.44,1.44,0,0,1,.82-.25,1.53,1.53,0,0,1,.3,0,1.47,1.47,0,0,1,1,.63,1.51,1.51,0,0,1,.22,1.13c-.49,2.46,1.16,7.29,5.95,12.08C35.32,39,40.13,39.76,42.54,39.76Zm-11-7.34A26.49,26.49,0,0,1,29,29.36c1.25-1.37,3.25-4.29,3.19-6.2a9,9,0,0,1,18-.79,9,9,0,0,1-9.35,9.49c-2-.09-4.86,2-6.1,3.15A22.65,22.65,0,0,1,31.58,32.42Z" />
                        </svg>
                        {activeSleep ? "Baigti miegą" : "Pradėti miegą"}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {entryCategory === "pumping" && (
                <div className="space-y-3 rounded-2xl border border-[#fde7ff] bg-[#fff4ff] p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fde7ff] text-fuchsia-800">
                      <svg
                        viewBox="0 0 512 512"
                        className="h-4 w-4"
                        aria-hidden="true"
                        fill="currentColor"
                      >
                        <path d="M288.209,331.768c-13.486,0-25.843-2.991-37.793-5.891c-11.956-2.888-24.313-5.885-37.688-5.885c-10.64,0-20.838,1.883-31.166,5.753l-4.05,1.509V445.54c0,3.696,1.032,7.11,3.08,10.156c1.974,2.907,4.811,5.254,8.003,6.604c2.257,0.948,4.57,1.419,7.068,1.419h120.653c3.704-0.007,7.117-1.046,10.15-3.088c2.914-1.959,5.254-4.805,6.611-8.017c0.941-2.222,1.412-4.597,1.412-7.054V320.324l-8.619,3.565C313.02,329.186,300.697,331.768,288.209,331.768z" />
                        <path d="M381.115,200.834c0.028-4.888-0.215-21.71-4.458-32.759c-5.303-13.777-19.322-35.134-34.892-47.581c-5.096-4.085-10.911-8.19-17.065-12.538c-7.304-5.157-19.98-14.116-25.255-19.716c0.146-0.235,0.298-0.471,0.443-0.686c4.05-6.265,10.841-16.739,10.841-32.815C310.729,24.563,286.18,0,256.003,0c-30.184,0-54.732,24.563-54.732,54.74c0,16.068,6.791,26.55,10.841,32.815c0.145,0.215,0.298,0.45,0.45,0.686c-5.282,5.593-17.958,14.559-25.262,19.716c-6.148,4.348-11.97,8.453-17.072,12.538c-15.563,12.454-29.588,33.811-34.885,47.581c-4.236,11.049-4.479,27.871-4.458,32.759l0.07,11.603h-0.07v235.719c0,8.626,1.696,16.982,5.061,24.86c4.866,11.402,12.924,21.122,23.295,28.08c10.62,7.13,23.047,10.904,35.93,10.904h121.636c8.674,0,17.1-1.689,25.02-5.026c11.506-4.833,21.295-12.822,28.294-23.123c7.2-10.55,11-22.894,10.994-35.694V212.437h-0.07L381.115,200.834z M155.731,175.905c4.209-10.952,16.151-28.772,28.135-38.367c17.051-13.632,48.163-31.305,51.389-45.269c3.136-13.61-12.15-18.45-12.15-37.529c0-18.18,14.726-32.904,32.898-32.904c18.166,0,32.898,14.725,32.898,32.904c0,19.08-15.293,23.919-12.157,37.529c3.226,13.964,34.338,31.638,51.389,45.269c11.984,9.595,23.926,27.415,28.135,38.367c3.109,8.072,3.012,24.812,3.012,24.812H152.72C152.72,200.717,152.623,183.977,155.731,175.905z M359.653,233.732v16.373v198.051c0,5.753-1.128,11.319-3.364,16.553c-3.233,7.615-8.612,14.094-15.542,18.74c-7.089,4.742-15.376,7.248-23.954,7.255H195.206c-5.788,0-11.402-1.128-16.671-3.343c-7.67-3.213-14.199-8.543-18.879-15.424c-4.784-7.034-7.304-15.259-7.31-23.78V250.105v-16.373v-11.18h0.374h206.56h0.374V233.732z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Nutrauktas pienas
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Užfiksuok, kiek nutraukto pieno surinkta šiuo metu.
                  </p>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-slate-600">
                        Kiekis (ml)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={amountMl}
                        onChange={(e) => setAmountMl(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        placeholder="pvz. 60"
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleAddEvent("pumping")}
                    disabled={isSaving}
                    className="w-full bg-[#fde7ff] text-xs text-fuchsia-900 hover:bg-[#f9d9ff] disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <>
                        <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                        Saugoma...
                      </>
                    ) : (
                      <>Išsaugoti nutraukimą</>
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Šiandienos įrašai
                </p>
                <a
                  href="/archive"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  <span>Įrašų archyvas</span>
                  <span aria-hidden="true">›</span>
                </a>
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
                              : e.type === "sleep"
                              ? "Miegas"
                              : "Nutrauktas pienas"}
                          </span>
                          {" | "}
                          <span>
                            {e.type === "feeding"
                              ? e.feedingMethod === "breast"
                                ? `Krūtimi${
                                    (e as FeedingEvent).breastSide === "left"
                                      ? " (kairė)"
                                      : (e as FeedingEvent).breastSide ===
                                        "right"
                                      ? " (dešinė)"
                                      : ""
                                  }`
                                : e.feedingMethod === "formula"
                                ? `Mišinėlis${
                                    e.amountMl ? ` ${e.amountMl} ml` : ""
                                  }`
                                : `Nutrauktas${
                                    e.amountMl ? ` ${e.amountMl} ml` : ""
                                  }`
                              : e.type === "diaper"
                              ? e.diaperKind === "wet"
                                ? "Šlapias"
                                : e.diaperKind === "dirty"
                                ? "Purvinas"
                                : "Šlapias ir purvinas"
                              : e.type === "pumping"
                              ? e.amountMl
                                ? `${e.amountMl} ml`
                                : ""
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

