"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { getBabyInfo, setBabyInfo } from "@/lib/babyStorage";
import { Button } from "@/components/Button";

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
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [diaperKind, setDiaperKind] = useState<DiaperKind>("wet");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<EventType | null>(null);

  const [babyInfo, setBabyInfo] = useState(() => getBabyInfo());

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
          .select("name, birth_iso")
          .eq("id", member.baby_id)
          .maybeSingle();
        if (cancelled || !babyRow) return;
        const name = (babyRow.name as string) ?? "";
        const birthIso = (babyRow.birth_iso as string) ?? "";
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
      totalDiapers: 0,
      totalSleepMinutes: 0,
    };

    for (const e of events) {
      if (e.type === "feeding") {
        base.totalFeedings += 1;

        if (typeof e.amountMl === "number") {
          if (e.feedingMethod === "formula") {
            base.totalFormulaAmount += e.amountMl;
            base.totalFeedingsAmount += e.amountMl;
          } else if (e.feedingMethod === "pumped") {
            base.totalPumpedAmount += e.amountMl;
            base.totalFeedingsAmount += e.amountMl;
          }
        }
        if (
          e.feedingMethod === "breast" &&
          typeof e.durationMinutes === "number"
        ) {
          base.totalBreastMinutes += e.durationMinutes;
        }

        if (isToday(e.time)) {
          base.todayFeedings += 1;

          if (typeof e.amountMl === "number") {
            if (e.feedingMethod === "formula") {
              base.todayFormulaAmount += e.amountMl;
              base.todayFeedingsAmount += e.amountMl;
            } else if (e.feedingMethod === "pumped") {
              base.todayPumpedAmount += e.amountMl;
              base.todayFeedingsAmount += e.amountMl;
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

  const feedingGuidance = useMemo(() => {
    const nowMs = now.getTime();
    const threeHoursMs = 3 * 60 * 60 * 1_000;
    const dayMs = 24 * 60 * 60 * 1_000;
    const threeHourWindowStart = nowMs - threeHoursMs;
    const dayWindowStart = nowMs - dayMs;

    let last3hFormulaMl = 0;
    let last3hEarliestMs: number | null = null;

    let last24hFormulaMl = 0;

    for (const e of events) {
      if (e.type !== "feeding" || e.feedingMethod !== "formula") continue;
      const t = new Date(e.time).getTime();
      if (Number.isNaN(t)) continue;

      if (t >= threeHourWindowStart && t <= nowMs && typeof e.amountMl === "number") {
        last3hFormulaMl += e.amountMl;
        if (last3hEarliestMs == null || t < last3hEarliestMs) {
          last3hEarliestMs = t;
        }
      }

      if (t >= dayWindowStart && t <= nowMs && typeof e.amountMl === "number") {
        last24hFormulaMl += e.amountMl;
      }
    }

    const limit3h = 100;
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
    };
  }, [events, now]);

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
    const seconds = totalSeconds - totalMinutes * 60;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} m.`);
    if (months > 0) parts.push(`${months} mėn.`);
    if (days > 0 || parts.length === 0) parts.push(`${days} d.`);
    if (hours > 0) parts.push(`${hours} val.`);
    if (minutes > 0) parts.push(`${minutes} min.`);
    parts.push(`${seconds} s.`);
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
            user_id: user?.id,
            baby_id: currentBabyId ?? undefined,
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
    } else {
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
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Mobile: gimimo data ir amžius – viena eilutė, be žodžių */}
            <div className="block w-full sm:hidden">
              <div className="flex w-full items-center gap-2 rounded-2xl bg-sky-50 px-3 py-1.5 text-[10px] text-slate-700 ring-1 ring-sky-100">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-100 text-sky-700 shrink-0">
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
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span className="flex-1 truncate">
                  <span>{babyBirthDisplay}</span>
                  <span className="mx-1.5">•</span>
                  <span>{babyAgeLabel}</span>
                </span>
              </div>
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
                <span>gim. {babyBirthDisplay}</span>
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
                  <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden="true" fill="currentColor">
                    <path d="M50.74,9l-2.41,2.41c-2.8-1.59-5.95-1.71-8.13-.22l-.07-.07a3,3,0,0,0-4.24,0,3,3,0,0,0-.76,1.32,3,3,0,0,0-2.78.8L9,36.6a3,3,0,0,0,0,4.24L23.16,55h0a3,3,0,0,0,4.24,0L50.74,31.65A3,3,0,0,0,51.21,28a2.86,2.86,0,0,0,.94-.64,3,3,0,0,0,.54-3.47c1.6-2.18,1.5-5.4-.12-8.26L55,13.26A3,3,0,0,0,50.74,9Zm-1.42,5.66c2.39,2.39,3.18,5.6,2,7.67l-9.7-9.7C43.72,11.5,46.93,12.29,49.32,14.68Zm-12-2.13a1,1,0,0,1,1.42,0l12,12a1,1,0,0,1,0,1.41,1,1,0,0,1-1.42,0l-12-12a1,1,0,0,1,0-1.42ZM26,53.57a1,1,0,0,1-1.41,0h0L10.43,39.42a1,1,0,0,1,0-1.41l17-17L43,36.6,41.55,38l-5.66-5.66a1,1,0,0,0-1.41,1.42l5.65,5.65L37.3,42.25l-3.53-3.53a1,1,0,0,0-1.42,0,1,1,0,0,0,0,1.41l3.54,3.54L33.06,46.5,27.4,40.84A1,1,0,0,0,26,42.25l5.66,5.66-2.83,2.83L25.28,47.2a1,1,0,0,0-1.41,0,1,1,0,0,0,0,1.42l3.53,3.53ZM49.32,30.23l-5,4.95L28.82,19.63l5-4.95a1,1,0,0,1,1.41,0l.71.7,12,12,1.41,1.42A1,1,0,0,1,49.32,30.23Zm4.25-18.38L51.45,14,50,12.55l2.12-2.12a1,1,0,0,1,1.42,1.42Z" />
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
                    {stats.todayFormulaAmount} ml
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Mamos pienas</span>
                  <span className="font-semibold text-rose-700">
                    {stats.todayPumpedAmount} ml
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
                        stats.todayFormulaAmount,
                        stats.todayPumpedAmount,
                        stats.todayBreastMinutes
                      ) || 1;
                    const formulaWidth =
                      (stats.todayFormulaAmount / max) * 100 || 0;
                    const pumpedWidth =
                      (stats.todayPumpedAmount / max) * 100 || 0;
                    const breastWidth =
                      (stats.todayBreastMinutes / max) * 100 || 0;
                    return (
                      <div className="flex h-full w-full">
                        <div
                          className="h-full bg-sky-400 transition-[width]"
                          style={{ width: `${formulaWidth}%` }}
                        />
                        <div
                          className="h-full bg-rose-300 transition-[width]"
                          style={{ width: `${pumpedWidth}%` }}
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
                  <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden="true" fill="currentColor">
                    <path d="M55,15a1,1,0,0,0-1-1H10a1,1,0,0,0-1,1V31a22.76,22.76,0,0,0,.26,3.42h0v0c.07.46.16.92.25,1.37,0,.15.07.29.1.44.07.3.15.6.23.89s.1.37.16.54.16.52.25.77c.14.41.29.8.45,1.19,0,.12.09.24.14.36.13.3.26.59.4.88,0,.06,0,.11.08.16A22.91,22.91,0,0,0,21.8,51.61l.45.22.69.31.87.35.32.13h0a23,23,0,0,0,15.68,0h0l.33-.14.86-.34.69-.31.45-.22A23,23,0,0,0,52.68,41.07l.09-.19.39-.86.15-.39c.16-.38.3-.76.44-1.16s.17-.51.25-.77.11-.37.16-.55.15-.59.22-.88.08-.3.11-.45c.09-.45.18-.91.25-1.36v0h0A22.76,22.76,0,0,0,55,31ZM52.59,35.1c0,.11-.05.23-.07.34-.13.58-.27,1.15-.44,1.71,0,0,0,.08,0,.12a17,17,0,0,1-.68,1.85.69.69,0,0,1,0,.1A21.06,21.06,0,0,1,40.23,50.31l-.1,0-.27.1a10.36,10.36,0,0,1-1.86-6,10.49,10.49,0,0,1,14.63-9.65C52.61,34.93,52.61,35,52.59,35.1ZM48.5,32A12.37,12.37,0,0,0,43,33.29V22H53v9c0,.61,0,1.21-.09,1.81A12.27,12.27,0,0,0,48.5,32ZM53,20H43V16H53ZM24.14,50.46l-.26-.1-.12,0a21.1,21.1,0,0,1-11.08-11.1l0-.08A18,18,0,0,1,12,37.27s0-.08,0-.11c-.17-.56-.31-1.14-.44-1.72,0-.11-.05-.23-.07-.34s0-.17,0-.25A10.49,10.49,0,0,1,24.14,50.46ZM15.5,32a12.27,12.27,0,0,0-4.41.81C11,32.21,11,31.61,11,31V22h9V32.85A12.46,12.46,0,0,0,15.5,32ZM20,16v4H11V16Zm6.08,35.14A12.46,12.46,0,0,0,22,33.84V16H41V34a1.06,1.06,0,0,0,.11.44,12.45,12.45,0,0,0-3.19,16.7,20.81,20.81,0,0,1-11.84,0Z" />
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
              <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                <p className="flex items-center justify-between">
                  <span>Šlapias</span>
                  <span className="font-semibold text-emerald-700">
                    {stats.todayWetDiapers}
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Purvinas</span>
                  <span className="font-semibold text-emerald-700">
                    {stats.todayDirtyDiapers}
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Abu</span>
                  <span className="font-semibold text-emerald-700">
                    {stats.todayBothDiapers}
                  </span>
                </p>
              </div>
            </div>

            {/* Viso laikotarpio – santrauka */}
            <div className="rounded-2xl bg-slate-950 text-slate-50 p-4 shadow-sm ring-1 ring-slate-900/40 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sky-200 ring-1 ring-sky-500/40">
                  <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden="true" fill="currentColor">
                    <path d="M57.94,15.09,46.31,8.58h0l-.14-.08s0,0-.07,0l-.16-.07L37.44,6h0a1.06,1.06,0,0,0-.31,0h-.14a1,1,0,0,0-.37.17h0a7.44,7.44,0,0,1-9.12,0h0A1,1,0,0,0,27.06,6h-.14a1.08,1.08,0,0,0-.31,0h-.05L18.07,8.4h0a.85.85,0,0,0-.22.09L6.06,15.09a1,1,0,0,0-.39,1.35l5.19,9.44a1,1,0,0,0,1,.51L16.66,26c-.78,6.1-1.16,26.13-1.21,28.6a1,1,0,0,0,.79,1L27.09,58a1,1,0,0,0,1.13-.58L32,48.71l3.78,8.69a1,1,0,0,0,.92.6l.21,0,10.85-2.36a1,1,0,0,0,.79-1c0-2.47-.43-22.5-1.21-28.6l4.85.37a1,1,0,0,0,1-.51l5.19-9.44A1,1,0,0,0,57.94,15.09ZM36.41,8.65c.13,1.43.11,3.63-1,5A4.06,4.06,0,0,1,32,15.05a4.06,4.06,0,0,1-3.41-1.37c-1.11-1.4-1.13-3.6-1-5A9.43,9.43,0,0,0,36.41,8.65ZM12.3,24.35l-4.4-8,10.16-5.69c3.85,5.65.29,11.77-.74,13.3Zm25,31.5L32.92,45.8a1,1,0,0,0-1.84,0L26.71,55.85l-9.24-2c.15-7.72.63-25.52,1.33-28.49a18.37,18.37,0,0,0,2.44-5.22A12.32,12.32,0,0,0,20,9.94l5.63-1.56c-.17,1.75-.15,4.57,1.41,6.53A5.62,5.62,0,0,0,31,17v9.48H28.74a1,1,0,1,0,0,2H32a1,1,0,0,0,1-1V17a5.62,5.62,0,0,0,4-2.08c1.56-2,1.58-4.78,1.41-6.53L44.05,10a12.29,12.29,0,0,0-1.26,10.18,17.82,17.82,0,0,0,2.4,5.15c.71,2.78,1.19,20.78,1.34,28.56ZM51.7,24.35l-5-.38c-1-1.53-4.54-7.7-.75-13.3L56.1,16.35Z" />
                    <path d="M35.19,18.89a.87.87,0,1,0,.87.86A.87.87,0,0,0,35.19,18.89Z" />
                    <path d="M35.19,23.46a.87.87,0,1,0,.87.86A.86.86,0,0,0,35.19,23.46Z" />
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

              <div className="mt-3 grid grid-cols-1 gap-y-1.5 text-xs sm:grid-cols-2 sm:gap-x-6">
                <p className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="truncate">Maitinimai</span>
                  <span className="shrink-0 font-semibold text-sky-200">
                    {stats.totalFeedings}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="truncate">Sauskelnių</span>
                  <span className="shrink-0 font-semibold text-emerald-200">
                    {stats.totalDiapers}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="truncate">Mišinėlis</span>
                  <span className="shrink-0 font-semibold text-sky-200">
                    {stats.totalFormulaAmount} ml
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="truncate">Mamos pienas</span>
                  <span className="shrink-0 font-semibold text-sky-200">
                    {stats.totalPumpedAmount} ml
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="truncate">Krūtimi</span>
                  <span className="shrink-0 font-semibold text-sky-200">
                    {stats.totalBreastMinutes} min
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3 text-slate-300 sm:col-span-2">
                  <span className="truncate">Bendras miegas</span>
                  <span className="shrink-0 font-semibold text-sky-200">
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

        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-sky-50/80 p-4 shadow-sm ring-1 ring-sky-100 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 17V11" />
                  <circle cx="12" cy="8" r="1" fill="currentColor" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Rekomendacija per 3 val.
                </p>
                <p className="text-[11px] text-slate-500">
                  Iki {feedingGuidance.limit3h} ml mišinėlio.
                </p>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <dt>Per paskutines 3 val.</dt>
                <dd className="font-semibold text-sky-700">
                  {Math.round(feedingGuidance.last3hFormulaMl)} ml
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Liko iki ribos</dt>
                <dd className="font-semibold text-emerald-700">
                  {Math.max(
                    0,
                    Math.round(feedingGuidance.remaining3h)
                  )}{" "}
                  ml
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Kada galima vėl?</dt>
                <dd className="text-right">
                  {feedingGuidance.next3hAvailableInMinutes != null &&
                  feedingGuidance.next3hAvailableInMinutes > 0
                    ? `Maždaug po ${
                        feedingGuidance.next3hAvailableInMinutes
                      } min`
                    : "–"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl bg-amber-50/80 p-4 shadow-sm ring-1 ring-amber-100 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M12 17V11" />
                  <circle cx="11" cy="9" r="1" fill="currentColor" />
                  <path d="M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Rekomendacija per 24 val.
                </p>
                <p className="text-[11px] text-slate-500">
                  Apie {feedingGuidance.limit24h} ml mišinėlio per parą.
                </p>
              </div>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <dt>Per paskutines 24 val.</dt>
                <dd className="font-semibold text-sky-700">
                  {Math.round(feedingGuidance.last24hFormulaMl)} ml
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Liko iki ribos</dt>
                <dd className="font-semibold text-emerald-700">
                  {Math.max(
                    0,
                    Math.round(feedingGuidance.remaining24h)
                  )}{" "}
                  ml
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="rounded-3xl bg-white/95 p-4 shadow-md ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[2fr,3fr]">
            <div className="grid gap-4 sm:grid-cols-3">
            {/* Maitinimas */}
            <div className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                    <svg viewBox="0 0 64 64" className="h-4 w-4" aria-hidden="true" fill="currentColor">
                      <path d="M50.74,9l-2.41,2.41c-2.8-1.59-5.95-1.71-8.13-.22l-.07-.07a3,3,0,0,0-4.24,0,3,3,0,0,0-.76,1.32,3,3,0,0,0-2.78.8L9,36.6a3,3,0,0,0,0,4.24L23.16,55h0a3,3,0,0,0,4.24,0L50.74,31.65A3,3,0,0,0,51.21,28a2.86,2.86,0,0,0,.94-.64,3,3,0,0,0,.54-3.47c1.6-2.18,1.5-5.4-.12-8.26L55,13.26A3,3,0,0,0,50.74,9Zm-1.42,5.66c2.39,2.39,3.18,5.6,2,7.67l-9.7-9.7C43.72,11.5,46.93,12.29,49.32,14.68Zm-12-2.13a1,1,0,0,1,1.42,0l12,12a1,1,0,0,1,0,1.41,1,1,0,0,1-1.42,0l-12-12a1,1,0,0,1,0-1.42ZM26,53.57a1,1,0,0,1-1.41,0h0L10.43,39.42a1,1,0,0,1,0-1.41l17-17L43,36.6,41.55,38l-5.66-5.66a1,1,0,0,0-1.41,1.42l5.65,5.65L37.3,42.25l-3.53-3.53a1,1,0,0,0-1.42,0,1,1,0,0,0,0,1.41l3.54,3.54L33.06,46.5,27.4,40.84A1,1,0,0,0,26,42.25l5.66,5.66-2.83,2.83L25.28,47.2a1,1,0,0,0-1.41,0,1,1,0,0,0,0,1.42l3.53,3.53ZM49.32,30.23l-5,4.95L28.82,19.63l5-4.95a1,1,0,0,1,1.41,0l.71.7,12,12,1.41,1.42A1,1,0,0,1,49.32,30.23Zm4.25-18.38L51.45,14,50,12.55l2.12-2.12a1,1,0,0,1,1.42,1.42Z" />
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
                    <div className="flex flex-col gap-1 rounded-2xl bg-rose-50 p-1.5 text-[11px] font-medium">
                      <button
                        type="button"
                        onClick={() => setFeedingMethod("breast")}
                        className={`rounded-full px-3 py-2 transition ${
                          feedingMethod === "breast"
                            ? "bg-rose-500 text-white shadow-sm"
                            : "text-rose-900 hover:text-rose-700"
                        }`}
                      >
                        Krūtimi
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedingMethod("formula")}
                        className={`rounded-full px-3 py-2 transition ${
                          feedingMethod === "formula"
                            ? "bg-rose-500 text-white shadow-sm"
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
                            ? "bg-rose-500 text-white shadow-sm"
                            : "text-rose-900 hover:text-rose-700"
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
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                        placeholder="pvz. 90"
                      />
                    </div>
                  )}
                  {feedingMethod === "breast" && activeBreastFeeding && (
                    <div className="space-y-1 text-center">
                      <div className="mx-auto inline-flex max-w-full items-center gap-3 rounded-2xl bg-rose-50 px-5 py-3.5 text-lg font-semibold text-rose-800 ring-1 ring-rose-200">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-200">
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
              </div>
              <Button
                type="button"
                onClick={() => handleAddEvent("feeding")}
                disabled={isSaving}
                className="w-full bg-rose-500 text-xs text-white hover:bg-rose-600 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                    Saugoma...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 64 64" className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" fill="currentColor">
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

            {/* Sauskelnių keitimas */}
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                  <svg viewBox="0 0 64 64" className="h-4 w-4" aria-hidden="true" fill="currentColor">
                    <path d="M55,15a1,1,0,0,0-1-1H10a1,1,0,0,0-1,1V31a22.76,22.76,0,0,0,.26,3.42h0v0c.07.46.16.92.25,1.37,0,.15.07.29.1.44.07.3.15.6.23.89s.1.37.16.54.16.52.25.77c.14.41.29.8.45,1.19,0,.12.09.24.14.36.13.3.26.59.4.88,0,.06,0,.11.08.16A22.91,22.91,0,0,0,21.8,51.61l.45.22.69.31.87.35.32.13h0a23,23,0,0,0,15.68,0h0l.33-.14.86-.34.69-.31.45-.22A23,23,0,0,0,52.68,41.07l.09-.19.39-.86.15-.39c.16-.38.3-.76.44-1.16s.17-.51.25-.77.11-.37.16-.55.15-.59.22-.88.08-.3.11-.45c.09-.45.18-.91.25-1.36v0h0A22.76,22.76,0,0,0,55,31ZM52.59,35.1c0,.11-.05.23-.07.34-.13.58-.27,1.15-.44,1.71,0,0,0,.08,0,.12a17,17,0,0,1-.68,1.85.69.69,0,0,1,0,.1A21.06,21.06,0,0,1,40.23,50.31l-.1,0-.27.1a10.36,10.36,0,0,1-1.86-6,10.49,10.49,0,0,1,14.63-9.65C52.61,34.93,52.61,35,52.59,35.1ZM48.5,32A12.37,12.37,0,0,0,43,33.29V22H53v9c0,.61,0,1.21-.09,1.81A12.27,12.27,0,0,0,48.5,32ZM53,20H43V16H53ZM24.14,50.46l-.26-.1-.12,0a21.1,21.1,0,0,1-11.08-11.1l0-.08A18,18,0,0,1,12,37.27s0-.08,0-.11c-.17-.56-.31-1.14-.44-1.72,0-.11-.05-.23-.07-.34s0-.17,0-.25A10.49,10.49,0,0,1,24.14,50.46ZM15.5,32a12.27,12.27,0,0,0-4.41.81C11,32.21,11,31.61,11,31V22h9V32.85A12.46,12.46,0,0,0,15.5,32ZM20,16v4H11V16Zm6.08,35.14A12.46,12.46,0,0,0,22,33.84V16H41V34a1.06,1.06,0,0,0,.11.44,12.45,12.45,0,0,0-3.19,16.7,20.81,20.81,0,0,1-11.84,0Z" />
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
              <Button
                type="button"
                onClick={() => handleAddEvent("diaper")}
                disabled={isSaving}
                className="w-full bg-sky-600 text-xs text-white hover:bg-sky-700 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                    Saugoma...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 64 64" className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" fill="currentColor">
                      <path d="M55,15a1,1,0,0,0-1-1H10a1,1,0,0,0-1,1V31a22.76,22.76,0,0,0,.26,3.42h0v0c.07.46.16.92.25,1.37,0,.15.07.29.1.44.07.3.15.6.23.89s.1.37.16.54.16.52.25.77c.14.41.29.8.45,1.19,0,.12.09.24.14.36.13.3.26.59.4.88,0,.06,0,.11.08.16A22.91,22.91,0,0,0,21.8,51.61l.45.22.69.31.87.35.32.13h0a23,23,0,0,0,15.68,0h0l.33-.14.86-.34.69-.31.45-.22A23,23,0,0,0,52.68,41.07l.09-.19.39-.86.15-.39c.16-.38.3-.76.44-1.16s.17-.51.25-.77.11-.37.16-.55.15-.59.22-.88.08-.3.11-.45c.09-.45.18-.91.25-1.36v0h0A22.76,22.76,0,0,0,55,31ZM52.59,35.1c0,.11-.05.23-.07.34-.13.58-.27,1.15-.44,1.71,0,0,0,.08,0,.12a17,17,0,0,1-.68,1.85.69.69,0,0,1,0,.1A21.06,21.06,0,0,1,40.23,50.31l-.1,0-.27.1a10.36,10.36,0,0,1-1.86-6,10.49,10.49,0,0,1,14.63-9.65C52.61,34.93,52.61,35,52.59,35.1ZM48.5,32A12.37,12.37,0,0,0,43,33.29V22H53v9c0,.61,0,1.21-.09,1.81A12.27,12.27,0,0,0,48.5,32ZM53,20H43V16H53ZM24.14,50.46l-.26-.1-.12,0a21.1,21.1,0,0,1-11.08-11.1l0-.08A18,18,0,0,1,12,37.27s0-.08,0-.11c-.17-.56-.31-1.14-.44-1.72,0-.11-.05-.23-.07-.34s0-.17,0-.25A10.49,10.49,0,0,1,24.14,50.46ZM15.5,32a12.27,12.27,0,0,0-4.41.81C11,32.21,11,31.61,11,31V22h9V32.85A12.46,12.46,0,0,0,15.5,32ZM20,16v4H11V16Zm6.08,35.14A12.46,12.46,0,0,0,22,33.84V16H41V34a1.06,1.06,0,0,0,.11.44,12.45,12.45,0,0,0-3.19,16.7,20.81,20.81,0,0,1-11.84,0Z" />
                    </svg>
                    {editingId && editingType === "diaper"
                      ? "Atnaujinti sauskelnes"
                      : "Išsaugoti sauskelnes"}
                  </>
                )}
              </Button>
            </div>

              {/* Miegas */}
              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                    <svg viewBox="0 0 64 64" className="h-4 w-4" aria-hidden="true" fill="currentColor">
                      <path d="M48.9,30.65a11,11,0,1,0-18.76-7.42c0,1-1.21,3-2.33,4.39-1.44-2.48-1.84-4.49-1.64-5.48a3.47,3.47,0,0,0-.52-2.62,3.49,3.49,0,0,0-4.85-1,3.46,3.46,0,0,0-1.49,2.23A14.19,14.19,0,0,0,20.68,29a11.64,11.64,0,0,0-5.37,3.06A11.75,11.75,0,0,0,31.93,48.68,11.58,11.58,0,0,0,35,43.16a19.63,19.63,0,0,0,7.51,1.6,3.5,3.5,0,1,0,0-7h0a13,13,0,0,1-6.08-1.65c1.33-1.08,3.34-2.29,4.22-2.26A11,11,0,0,0,48.9,30.65ZM29.33,39.76a5.74,5.74,0,1,1-5.26-5.12s.07,0,.11,0a31.62,31.62,0,0,0,2.45,2.74A30.28,30.28,0,0,0,29.33,39.76Zm1.19,7.51a9.75,9.75,0,1,1-8.91-16.43c.34.61.71,1.22,1.13,1.85a7.74,7.74,0,1,0,8.58,8.5c.63.41,1.24.76,1.85,1.09A9.69,9.69,0,0,1,30.52,47.27Zm12-7.51h0a1.51,1.51,0,0,1,1.06.43,1.51,1.51,0,0,1-1.06,2.57C39.66,42.76,34,41.87,28,36s-7.39-11.71-6.77-14.79a1.47,1.47,0,0,1,.64-.95,1.44,1.44,0,0,1,.82-.25,1.53,1.53,0,0,1,.3,0,1.47,1.47,0,0,1,1,.63,1.51,1.51,0,0,1,.22,1.13c-.49,2.46,1.16,7.29,5.95,12.08C35.32,39,40.13,39.76,42.54,39.76Zm-11-7.34A26.49,26.49,0,0,1,29,29.36c1.25-1.37,3.25-4.29,3.19-6.2a9,9,0,0,1,18-.79,9,9,0,0,1-9.35,9.49c-2-.09-4.86,2-6.1,3.15A22.65,22.65,0,0,1,31.58,32.42Z" />
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
                    <div className="mx-auto inline-flex max-w-full items-center gap-3 rounded-2xl bg-purple-50 px-5 py-3.5 text-lg font-semibold text-purple-800 ring-1 ring-purple-200">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-200">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-purple-700" />
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
                  className="w-full bg-purple-600 text-xs text-white hover:bg-purple-700 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border border-white/70 border-b-transparent" />
                      Saugoma...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 64 64" className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" fill="currentColor">
                        <path d="M48.9,30.65a11,11,0,1,0-18.76-7.42c0,1-1.21,3-2.33,4.39-1.44-2.48-1.84-4.49-1.64-5.48a3.47,3.47,0,0,0-.52-2.62,3.49,3.49,0,0,0-4.85-1,3.46,3.46,0,0,0-1.49,2.23A14.19,14.19,0,0,0,20.68,29a11.64,11.64,0,0,0-5.37,3.06A11.75,11.75,0,0,0,31.93,48.68,11.58,11.58,0,0,0,35,43.16a19.63,19.63,0,0,0,7.51,1.6,3.5,3.5,0,1,0,0-7h0a13,13,0,0,1-6.08-1.65c1.33-1.08,3.34-2.29,4.22-2.26A11,11,0,0,0,48.9,30.65ZM29.33,39.76a5.74,5.74,0,1,1-5.26-5.12s.07,0,.11,0a31.62,31.62,0,0,0,2.45,2.74A30.28,30.28,0,0,0,29.33,39.76Zm1.19,7.51a9.75,9.75,0,1,1-8.91-16.43c.34.61.71,1.22,1.13,1.85a7.74,7.74,0,1,0,8.58,8.5c.63.41,1.24.76,1.85,1.09A9.69,9.69,0,0,1,30.52,47.27Zm12-7.51h0a1.51,1.51,0,0,1,1.06.43,1.51,1.51,0,0,1-1.06,2.57C39.66,42.76,34,41.87,28,36s-7.39-11.71-6.77-14.79a1.47,1.47,0,0,1,.64-.95,1.44,1.44,0,0,1,.82-.25,1.53,1.53,0,0,1,.3,0,1.47,1.47,0,0,1,1,.63,1.51,1.51,0,0,1,.22,1.13c-.49,2.46,1.16,7.29,5.95,12.08C35.32,39,40.13,39.76,42.54,39.76Zm-11-7.34A26.49,26.49,0,0,1,29,29.36c1.25-1.37,3.25-4.29,3.19-6.2a9,9,0,0,1,18-.79,9,9,0,0,1-9.35,9.49c-2-.09-4.86,2-6.1,3.15A22.65,22.65,0,0,1,31.58,32.42Z" />
                      </svg>
                      Pradėti / baigti miegą
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Šiandienos įrašai
                </p>
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

