"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import {
  setBabyInfo,
  setBabyGenderStorage,
  toLocalDateTimeInputValue,
  fromLocalDateTimeInputValue,
} from "@/lib/babyStorage";
import { Button } from "@/components/Button";

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

export default function ProfilisPage() {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();

  const [babyId, setBabyId] = useState<string | null>(null);
  const [babyName, setBabyName] = useState("");
  const [babyBirthInput, setBabyBirthInput] = useState("");
  const [babyGender, setBabyGender] = useState<string>("");
  const [isBabyLoading, setIsBabyLoading] = useState(true);
  const [babyError, setBabyError] = useState<string | null>(null);
  const [babySaved, setBabySaved] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [inviteHistory, setInviteHistory] = useState<{ id: string; code: string; created_at: string; used_by: string | null }[]>([]);
  const [acceptCodeInput, setAcceptCodeInput] = useState("");
  const [acceptInviteError, setAcceptInviteError] = useState<string | null>(null);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const [refreshBabyKey, setRefreshBabyKey] = useState(0);

  const [events, setEvents] = useState<BabyEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsSaving, setEventsSaving] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventType>("feeding");
  const [feedingMethod, setFeedingMethod] =
    useState<FeedingMethod>("formula");
  const [diaperKind, setDiaperKind] = useState<DiaperKind>("wet");
  const [timeInput, setTimeInput] = useState("");
  const [sleepEndInput, setSleepEndInput] = useState("");
  const [amountMl, setAmountMl] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

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
        setBabyGender("");
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
        setBabyGender("");
        setIsBabyLoading(false);
        return;
      }

      const id = babyRow.id as string;
      const name = (babyRow.name as string) ?? "";
      const birthIso = (babyRow.birth_iso as string) ?? null;
      const gender = (babyRow as { gender?: string }).gender ?? "";

      setBabyId(id);
      setBabyName(name);
      setBabyBirthInput(
        birthIso ? new Date(birthIso).toISOString().slice(0, 16) : ""
      );
      setBabyGender(gender);
      setIsBabyLoading(false);

      if (birthIso) {
        setBabyInfo({
          name,
          birthIso,
        });
      }
    }

    loadBaby();
  }, [user, refreshBabyKey]);

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

    const genderValue =
      babyGender === "female" || babyGender === "male" ? babyGender : null;

    try {
      if (babyId) {
        const { data, error } = await supabase
          .from("babies")
          .update({
            name,
            birth_iso: birthIso,
            gender: genderValue,
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
            gender: genderValue,
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
      setBabyGenderStorage(
        genderValue === "female" || genderValue === "male" ? genderValue : ""
      );
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
      loadInviteHistory();
    } catch (err: any) {
      setBabyError(err.message ?? "Nepavyko sugeneruoti pakvietimo.");
    } finally {
      setIsGeneratingInvite(false);
    }
  }

  async function loadInviteHistory() {
    if (!babyId) return;
    const { data } = await supabase
      .from("baby_invites")
      .select("id, code, created_at, used_by")
      .eq("baby_id", babyId)
      .order("created_at", { ascending: false })
      .limit(1);
    setInviteHistory((data as { id: string; code: string; created_at: string; used_by: string | null }[]) ?? []);
  }

  useEffect(() => {
    if (babyId) loadInviteHistory();
    else setInviteHistory([]);
  }, [babyId]);

  async function handleAcceptInvite(e: React.FormEvent) {
    e.preventDefault();
    const code = acceptCodeInput.trim().toUpperCase();
    if (!user || !code) return;
    setIsAcceptingInvite(true);
    setAcceptInviteError(null);
    setAcceptSuccess(false);
    try {
      const { data, error } = await supabase
        .from("baby_invites")
        .select("id, code, baby_id, used_by, used_at, babies(name, birth_iso)")
        .eq("code", code)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) {
        setAcceptInviteError("Pakvietimas nerastas.");
        return;
      }

      const inv = data as any;
      if (inv.used_by) {
        setAcceptInviteError("Šis pakvietimo kodas jau panaudotas.");
        return;
      }

      const { data: existing } = await supabase
        .from("baby_members")
        .select("baby_id")
        .eq("baby_id", inv.baby_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from("baby_members").insert({
          baby_id: inv.baby_id,
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
        .eq("id", inv.id);

      const baby = inv.babies;
      if (baby?.birth_iso) {
        setBabyInfo({
          name: baby.name ?? "Kūdikis",
          birthIso: baby.birth_iso,
        });
      }

      setAcceptCodeInput("");
      setAcceptSuccess(true);
      setRefreshBabyKey((k) => k + 1);
      loadInviteHistory();
    } catch (err: any) {
      setAcceptInviteError(err.message ?? "Nepavyko priimti pakvietimo.");
    } finally {
      setIsAcceptingInvite(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    async function loadEvents() {
      setEventsLoading(true);
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("time", { ascending: false });
      if (error) {
        setEventsError(error.message);
        setEventsLoading(false);
        return;
      }
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
      setEventsError(null);
      setEventsLoading(false);
    }
    loadEvents();
  }, [user]);

  const sortedByDay = useMemo(() => {
    const groups: Record<string, BabyEvent[]> = {};
    for (const e of events) {
      const key = new Date(e.time).toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    }
    return Object.entries(groups).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
    );
  }, [events]);

  function resetEventForm() {
    setEditingEventId(null);
    setEventType("feeding");
    setFeedingMethod("formula");
    setDiaperKind("wet");
    setAmountMl("");
    setDurationMinutes("");
    setSleepEndInput("");
    setEventsError(null);
    setTimeInput("");
  }

  function startEditEvent(e: BabyEvent) {
    setEditingEventId(e.id);
    setEventType(e.type);
    setTimeInput(toLocalDateTimeInputValue(e.time));
    if (e.type === "feeding") {
      setFeedingMethod(e.feedingMethod);
      setAmountMl(e.amountMl ? String(e.amountMl) : "");
      setDurationMinutes(e.durationMinutes ? String(e.durationMinutes) : "");
      setSleepEndInput("");
    } else if (e.type === "diaper") {
      setDiaperKind(e.diaperKind);
      setAmountMl("");
      setDurationMinutes("");
      setSleepEndInput("");
    } else {
      setAmountMl("");
      setDurationMinutes("");
      setSleepEndInput(
        e.sleepEnd ? toLocalDateTimeInputValue(e.sleepEnd) : ""
      );
    }
  }

  async function handleSaveEvent() {
    if (!user) return;
    try {
      setEventsSaving(true);
      setEventsError(null);
      if (!timeInput) {
        setEventsError("Pasirink laiką.");
        setEventsSaving(false);
        return;
      }
      const timeIso = fromLocalDateTimeInputValue(timeInput);

      if (!editingEventId) {
        if (eventType === "feeding") {
          const isAmountBased =
            feedingMethod === "formula" || feedingMethod === "pumped";
          const payload = {
            user_id: user.id,
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
          setEvents((prev) => [
            {
              id: data.id,
              type: "feeding",
              time: data.time,
              feedingMethod: data.feeding_method,
              amountMl: data.amount_ml ?? undefined,
              durationMinutes: data.duration_minutes ?? undefined,
            },
            ...prev,
          ]);
        } else if (eventType === "diaper") {
          const payload = {
            user_id: user.id,
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
          setEvents((prev) => [
            {
              id: data.id,
              type: "diaper",
              time: data.time,
              diaperKind: data.diaper_kind,
            },
            ...prev,
          ]);
        } else {
          const payload = {
            user_id: user.id,
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
          setEvents((prev) => [
            {
              id: data.id,
              type: "sleep",
              time: data.time,
              sleepEnd: data.sleep_end ?? undefined,
            },
            ...prev,
          ]);
        }
      } else {
        if (eventType === "feeding") {
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
            .eq("id", editingEventId)
            .select("*")
            .single();
          if (error) throw error;
          setEvents((prev) =>
            prev.map((e) =>
              e.id === data.id
                ? {
                    id: data.id,
                    type: "feeding" as const,
                    time: data.time,
                    feedingMethod: data.feeding_method,
                    amountMl: data.amount_ml ?? undefined,
                    durationMinutes: data.duration_minutes ?? undefined,
                  }
                : e
            )
          );
        } else if (eventType === "diaper") {
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
            .eq("id", editingEventId)
            .select("*")
            .single();
          if (error) throw error;
          setEvents((prev) =>
            prev.map((e) =>
              e.id === data.id
                ? {
                    id: data.id,
                    type: "diaper" as const,
                    time: data.time,
                    diaperKind: data.diaper_kind,
                  }
                : e
            )
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
            .eq("id", editingEventId)
            .select("*")
            .single();
          if (error) throw error;
          setEvents((prev) =>
            prev.map((e) =>
              e.id === data.id
                ? {
                    id: data.id,
                    type: "sleep" as const,
                    time: data.time,
                    sleepEnd: data.sleep_end ?? undefined,
                  }
                : e
            )
          );
        }
      }
      resetEventForm();
    } catch (err: any) {
      setEventsError(err.message ?? "Nepavyko išsaugoti.");
    } finally {
      setEventsSaving(false);
    }
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm("Tikrai ištrinti šį įrašą?")) return;
    const prev = events;
    setEvents((cur) => cur.filter((e) => e.id !== id));
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      alert("Klaida trinant: " + error.message);
      setEvents(prev);
    }
  }

  if (isLoading) {
    return (
      <div className=\"flex min-h-screen items-center justify-center\">
        <p className=\"text-sm text-slate-500\">Kraunama...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className=\"flex min-h-screen items-center justify-center\">
        <p className=\"text-sm text-slate-500\">Nukreipiama į prisijungimą...</p>
      </div>
    );
  }

  return (
    <div className=\"min-h-screen text-slate-900\">
      <main className=\"mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10\">
        <section className=\"rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5\">
          <div className=\"flex items-center gap-3\">
            <div className=\"flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700 ring-1 ring-sky-200\">
              <svg
                viewBox=\"0 0 24 24\"
                className=\"h-6 w-6\"
                fill=\"none\"
                stroke=\"currentColor\"
                strokeWidth=\"2\"
                strokeLinecap=\"round\"
                strokeLinejoin=\"round\"
              >
                <path d=\"M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2\" />
                <circle cx=\"12\" cy=\"7\" r=\"4\" />
              </svg>
            </div>
            <div className=\"min-w-0 flex-1\">
              <h1 className=\"text-sm font-semibold text-slate-800\">
                Mano profilis
              </h1>
              <p className=\"truncate text-xs text-slate-600\">{user.email}</p>
              {user.created_at && (
                <p className=\"mt-0.5 text-[11px] text-slate-400\">
                  Paskyra nuo{\" \"}
                  {new Date(user.created_at).toLocaleDateString(\"lt-LT\")}
                </p>
              )}
            </div>
          </div>

          <div className=\"mt-6 flex flex-wrap gap-3\">
            <Button
              type=\"button\"
              variant=\"secondary\"
              onClick={async () => {
                await signOut();
                router.push(\"/\");
                router.refresh();
              }}
              className=\"border border-slate-200 text-slate-700 hover:bg-slate-100\"
            >
              Atsijungti
            </Button>
          </div>
        </section>

        <div className=\"grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6\">
          <section className=\"rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5\">
            <h2 className=\"text-[11px] font-semibold uppercase tracking-wide text-slate-500\">
              Kūdikio registracija
            </h2>
            <p className=\"mt-1 text-xs text-slate-600\">
              Vardas, lytis, gimimo data ir laikas – rodomi pagrindiniame puslapyje ir svorio skyriuje.
            </p>
            {isBabyLoading ? (
              <p className=\"mt-2 text-xs text-slate-500\">Kraunama...</p>
            ) : (
              <form
                onSubmit={handleSaveBaby}
                className=\"mt-4 flex flex-col gap-3\"
              >
                <div className=\"min-w-0 flex-1 space-y-1\">
                  <label className=\"block text-[11px] font-medium text-slate-600\">
                    Vardas
                  </label>
                  <input
                    type=\"text\"
                    value={babyName}
                    onChange={(e) => setBabyName(e.target.value)}
                    placeholder=\"pvz. Adrijana\"
                    className=\"w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100\"
                  />
                </div>
                <div className=\"min-w-0 flex-1 space-y-1\">
                  <label className=\"block text-[11px] font-medium text-slate-600\">
                    Lytis
                  </label>
                  <div className=\"grid w-full grid-cols-2 gap-3\">
                    <button
                      type=\"button\"
                      onClick={() => setBabyGender(babyGender === \"female\" ? \"\" : \"female\")}
                      title=\"Mergaitė\"
                      className={`flex w-full min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 py-4 transition focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 ${
                        babyGender === \"female\"
                          ? \"border-sky-500 bg-sky-50 ring-2 ring-sky-200\"
                          : \"border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100\"
                      }`}
                    >
                      <img src=\"/icons/baby-girl.svg\" alt=\"\" className=\"h-14 w-14 shrink-0 sm:h-16 sm:w-16\" />
                      <span className=\"text-[11px] font-medium text-slate-700\">Mergaitė</span>
                    </button>
                    <button
                      type=\"button\"
                      onClick={() => setBabyGender(babyGender === \"male\" ? \"\" : \"male\")}
                      title=\"Berniukas\"
                      className={`flex w-full min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 py-4 transition focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 ${
                        babyGender === \"male\"
                          ? \"border-sky-500 bg-sky-50 ring-2 ring-sky-200\"
                          : \"border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100\"
                      }`}
                    >
                      <img src=\"/icons/baby-boy.svg\" alt=\"\" className=\"h-14 w-14 shrink-0 sm:h-16 sm:w-16\" />
                      <span className=\"text-[11px] font-medium text-slate-700\">Berniukas</span>
                    </button>
                  </div>
                </div>
                <div className=\"min-w-0 flex-1 space-y-1\">
                  <label className=\"block text-[11px] font-medium text-slate-600\">
                    Gimimo data ir laikas
                  </label>
                  <input
                    type=\"datetime-local\"
                    value={babyBirthInput}
                    onChange={(e) => setBabyBirthInput(e.target.value)}
                    className=\"w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100\"
                  />
                </div>
                <Button
                  type=\"submit\"
                  disabled={!babyName.trim()}
                  className=\"w-full bg-sky-600 text-xs text-white hover:bg-sky-700 sm:w-auto\"
                >
                  {babyId ? \"Išsaugoti kūdikį\" : \"Registruoti kūdikį\"}
                </Button>
              </form>
            )}
            {babySaved && (
              <p className=\"mt-2 text-[11px] text-emerald-600\">Kūdikio duomenys išsaugoti.</p>
            )}
            {babyError && (
              <p className=\"mt-2 text-[11px] text-rose-600\">{babyError}</p>
            )}
          </section>

          <section className=\"rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5\">
            <h2 className=\"text-[11px] font-semibold uppercase tracking-wide text-slate-500\">
              Pakviesti kitą tėtį / mamą
            </h2>
            <p className=\"mt-1 text-xs text-slate-600\">
              Sugeneruok pakvietimo kodą ir pasidalink juo su kitu tėčiu ar mama.
              Įvedę kodą, jie matys tą patį kūdikį ir įrašus.
            </p>
            <div className=\"mt-4 w-full\">
              <Button
                type=\"button\"
                disabled={!babyId || isGeneratingInvite}
                className=\"w-full bg-sky-600 text-xs text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60\"
                onClick={handleGenerateInvite}
              >
                {isGeneratingInvite ? \"Generuojama...\" : \"Sugeneruoti pakvietimo kodą\"}
              </Button>
              {!babyId && (
                <p className=\"mt-2 text-[11px] text-slate-500\">
                  Pirma užregistruok kūdikį kairėje.
                </p>
              )}
            </div>
            {inviteCode && (
              <div className=\"mt-3 rounded-2xl bg-sky-50 px-3 py-2 text-[11px] text-sky-800 ring-1 ring-sky-100\">
                <p className=\"font-semibold\">Pakvietimo kodas:</p>
                <p className=\"mt-1 font-mono text-sm tracking-wide\">
                  {inviteCode}
                </p>
                <p className=\"mt-1 text-[11px] text-sky-700\">
                  Nusiųsk šį kodą kitam tėčiui ar mamai. Jie gali jį įvesti
                  žemiau šiame bloke.
                </p>
              </div>
            )}
            <div className=\"mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-3\">
              <p className=\"text-[11px] font-semibold uppercase tracking-wide text-slate-600\">
                Priimti pakvietimą
              </p>
              <p className=\"mt-0.5 text-[11px] text-slate-500\">
                Gavote kodą iš kito tėčio ar mamos? Įveskite jį žemiau ir paspauskite „Priimti“.
              </p>
              <form onSubmit={handleAcceptInvite} className=\"mt-3 flex flex-col gap-2 sm:flex-row sm:items-center\">
                <input
                  type=\"text\"
                  value={acceptCodeInput}
                  onChange={(e) => setAcceptCodeInput(e.target.value.toUpperCase())}
                  placeholder=\"Pakvietimo kodas\"
                  className=\"min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[16px] font-mono tracking-wide shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100\"
                  maxLength={20}
                />
                <Button
                  type=\"submit\"
                  disabled={!acceptCodeInput.trim() || isAcceptingInvite}
                  className=\"shrink-0 bg-sky-600 text-xs text-white hover:bg-sky-700 disabled:opacity-60\"
                >
                  {isAcceptingInvite ? \"Vykdoma...\" : \"Priimti\"}
                </Button>
              </form>
              {acceptInviteError && (
                <p className=\"mt-2 text-[11px] text-rose-600\">{acceptInviteError}</p>
              )}
              {acceptSuccess && (
                <p className=\"mt-2 text-[11px] text-emerald-600\">Pakvietimas priimtas. Dabar matote tą patį kūdikį.</p>
              )}
            </div>
            {inviteHistory.length > 0 && (
              <div className=\"mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 px-3 py-2\">
                <p className=\"text-[11px] font-semibold uppercase tracking-wide text-slate-500\">
                  Paskutinis kodas
                </p>
                {(() => {
                  const inv = inviteHistory[0];
                  return (
                    <div className=\"mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-2 py-1.5 text-[11px] text-slate-700 ring-1 ring-slate-100\">
                      <span className=\"font-mono tracking-wide\">{inv.code}</span>
                      <span className=\"text-slate-500\">
                        {new Date(inv.created_at).toLocaleString(\"lt-LT\", {
                          dateStyle: \"short\",
                          timeStyle: \"short\",
                        })}
                        {inv.used_by ? (
                          <span className=\"ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700\">
                            Panaudotas
                          </span>
                        ) : null}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </section>
        </div>

        <section className=\"rounded-3xl border-2 border-slate-200 bg-slate-50/80 p-4 shadow-sm backdrop-blur sm:p-5\">
          <h2 className=\"text-[11px] font-semibold uppercase tracking-wide text-slate-600\">
            Įrašų tvarkymas (admin)
          </h2>
          <p className=\"mt-1 text-xs text-slate-600\">
            Pridėk senų dienų įrašus, redaguok ar trink – laisvas laiko pasirinkimas.
          </p>

          <div className=\"mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,1fr)]\">
            <div className=\"min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5\">
              <div className=\"flex items-center justify-between gap-2\">
                <p className=\"text-[11px] font-semibold uppercase tracking-wide text-slate-500\">
                  {editingEventId ? \"Redaguoti įrašą\" : \"Naujas įrašas\"}
                </p>
                {editingEventId && (
                  <button
                    type=\"button\"
                    onClick={resetEventForm}
                    className=\"shrink-0 text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline\"
                  >
                    Atšaukti
                  </button>
                )}
              </div>

              <div className=\"space-y-4 text-xs\">
                <div className=\"space-y-1.5\">
                  <label className=\"block text-[11px] font-medium text-slate-600\">Data ir laikas</label>
                  <input
                    type=\"datetime-local\"
                    value={timeInput}
                    onChange={(e) => setTimeInput(e.target.value)}
                    className=\"w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100\"
                  />
                </div>
                <div className=\"space-y-1.5\">
                  <label className=\"block text-[11px] font-medium text-slate-600\">Tipas</label>
                  <div className=\"flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-200 text-[11px] font-medium\">
                    <button
                      type=\"button\"
                      onClick={() => setEventType(\"feeding\")}
                      className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${eventType === \"feeding\" ? \"bg-sky-600 text-white shadow-sm\" : \"text-slate-600 hover:bg-slate-100\"}`}
                    >
                      Maitinimas
                    </button>
                    <button
                      type=\"button\"
                      onClick={() => setEventType(\"diaper\")}
                      className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${eventType === \"diaper\" ? \"bg-amber-500 text-white shadow-sm\" : \"text-slate-600 hover:bg-slate-100\"}`}
                    >
                      Sauskelnės
                    </button>
                    <button
                      type=\"button\"
                      onClick={() => setEventType(\"sleep\")}
                      className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${eventType === \"sleep\" ? \"bg-indigo-600 text-white shadow-sm\" : \"text-slate-600 hover:bg-slate-100\"}`}
                    >
                      Miegas
                    </button>
                  </div>
                </div>
              </div>

              {eventType === \"feeding\" && (
                <div className=\"space-y-4 text-xs\">
                  <div className=\"space-y-1.5\">
                    <label className=\"block text-[11px] font-medium text-slate-600\">Maitinimo būdas</label>
                    <div className=\"flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-200 text-[11px] font-medium\">
                      <button type=\"button\" onClick={() => setFeedingMethod(\"formula\")} className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${feedingMethod === \"formula\" ? \"bg-sky-600 text-white shadow-sm\" : \"text-slate-600 hover:bg-slate-100\"}`}>Mišinėlis (ml)</button>
                      <button type=\"button\" onClick={() => setFeedingMethod(\"breast\")} className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${feedingMethod === \"breast\" ? \"bg-emerald-600 text-white shadow-sm\" : \"text-slate-600 hover:bg-slate-100\"}`}>Krūtimi (min)</button>
                      <button type=\"button\" onClick={() => setFeedingMethod(\"pumped\")} className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${feedingMethod === \"pumped\" ? \"bg-sky-600 text-white shadow-sm\" : \"text-slate-600 hover:bg-slate-100\"}`}>Nutrauktas (ml)</button>
                    </div>
                  </div>
                  {feedingMethod === \"formula\" || feedingMethod === \"pumped\" ? (
                    <div className=\"space-y-1.5\">
                      <label className=\"block text-[11px] font-medium text-slate-600\">Kiekis (ml)</label>
                      <input type=\"number\" min={0} value={amountMl} onChange={(e) => setAmountMl(e.target.value)} placeholder=\"pvz. 90\" className=\"w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100\" />
                    </div>
                  ) : (
                    <div className=\"space-y-1.5\">
                      <label className=\"block text-[11px] font-medium text-slate-600\">Trukmė (min)</label>
                      <input type=\"number\" min={0} value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} className=\"w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100\" />
                    </div>
                  )}
                </div>
              )}

              {eventType === \"diaper\" && (
                <div className=\"space-y-1.5\">
                  <label className=\"block text-[11px] font-medium text-slate-600\">Sauskelnės</label>
                  <div className=\"flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-1.5 ring-1 ring-slate-200 text-[11px] font-medium\">
                    <button type=\"button\" onClick={() => setDiaperKind(\"wet\")} className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${diaperKind === \"wet\" ? \"bg-sky-500 text-white shadow-sm\" : \"text-slate-600 hover:bg-slate-100\"}`}>Šlapias</button>
                    <button type=\"button\" onClick={() => setDiaperKind(\"dirty\")} className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${diaperKind === \"dirty\" ? \"bg-amber-500 text-white shadow-sm\" : \"text-slate-600 hover:bg-slate-100\"}`}>Purvinas</button>
                    <button type=\"button\" onClick={() => setDiaperKind(\"both\")} className={`whitespace-nowrap rounded-xl px-3 py-2 transition ${diaperKind === \"both\" ? \"bg-emerald-500 text-white shadow-sm\" : \"text-slate-600 hover:bg-slate-100\"}`}>Abu</button>
                  </div>
                </div>
              )}

              {eventType === \"sleep\" && (
                <div className=\"space-y-1.5\">
                  <label className=\"block text-[11px] font-medium text-slate-600\">Miego pabaiga (nebūtina)</label>
                  <input type=\"datetime-local\" value={sleepEndInput} onChange={(e) => setSleepEndInput(e.target.value)} className=\"w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100\" />
                </div>
              )}

              {eventsError && <p className=\"text-[11px] text-rose-600\">{eventsError}</p>}

              <div className=\"mt-2 flex flex-wrap items-center justify-between gap-2\">
                <Button type=\"button\" onClick={handleSaveEvent} disabled={eventsSaving} className=\"bg-sky-600 text-xs text-white hover:bg-sky-700 disabled:opacity-60\">
                  {eventsSaving ? \"Saugoma...\" : editingEventId ? \"Išsaugoti pakeitimus\" : \"Pridėti įrašą\"}
                </Button>
                <button type=\"button\" onClick={resetEventForm} className=\"text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline\">Išvalyti formą</button>
              </div>
            </div>

            <div className=\"min-w-0 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100 sm:p-5\">
              <div className=\"flex min-w-0 items-center justify-between gap-2\">
                <p className=\"min-w-0 truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500\">Visi įrašai</p>
                {eventsLoading && <span className=\"shrink-0 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-100\"><span className=\"h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500\" /> Kraunama...</span>}
              </div>
              <div className=\"max-h-[420px] min-w-0 space-y-3 overflow-y-auto pr-1 text-[11px] sm:text-xs\">
                {sortedByDay.length === 0 && !eventsLoading && <p className=\"text-[11px] text-slate-500\">Nėra įrašų.</p>}
                {sortedByDay.map(([day, dayEvents]) => (
                  <div key={day} className=\"rounded-2xl border border-slate-100 bg-slate-50/60 p-2\">
                    <div className=\"flex items-center justify-between gap-2\">
                      <p className=\"truncate text-[11px] font-semibold text-slate-700\">{day}</p>
                      <span className=\"shrink-0 text-[10px] text-slate-400\">{dayEvents.length} įr.</span>
                    </div>
                    <div className=\"mt-1.5 space-y-1.5\">
                      {dayEvents.slice().sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()).map((e) => (
                        <div key={e.id} className=\"flex min-w-0 items-center justify-between gap-2 rounded-xl bg-white px-2 py-1.5 shadow-sm ring-1 ring-slate-100\">
                          <div className=\"min-w-0 flex-1\">
                            <p className=\"truncate text-[10px] font-medium text-slate-800 sm:text-[11px]\">
                              <span className=\"font-mono\">{formatTimeLabel(e.time)}</span>{\" "}
                              {e.type === \"feeding\" &&
                                (e.feedingMethod === \"formula\"
                                  ? `Mišinėlis ${(e.amountMl ?? 0)} ml`
                                  : e.feedingMethod === \"pumped\"
                                  ? `Nutrauktas ${(e.amountMl ?? 0)} ml`
                                  : `Krūtimi ${
                                      (e as FeedingEvent).breastSide === \"left\"
                                        ? \"(kairė) \"
                                        : (e as FeedingEvent).breastSide ===
                                          \"right\"
                                        ? \"(dešinė) \"
                                        : \"\"
                                    }${(e.durationMinutes ?? 0)} min`)}
                              {e.type === \"diaper\" && `Sauskel. ${e.diaperKind === \"wet\" ? \"šlapias\" : e.diaperKind === \"dirty\" ? \"purvinas\" : \"abu\"}`}
                              {e.type === \"sleep\" && (e.sleepEnd ? `Miegas ${formatTimeLabel(e.time)}–${formatTimeLabel(e.sleepEnd)}` : `Miegas nuo ${formatTimeLabel(e.time)}`)}
                            </p>
                          </div>
                          <div className=\"flex shrink-0 items-center gap-1\">
                            <button type=\"button\" onClick={() => startEditEvent(e)} className=\"rounded-full bg-slate-100 px-2 py-1 text-[9px] font-medium text-slate-700 hover:bg-slate-200 sm:text-[10px]\">Redaguoti</button>
                            <button type=\"button\" onClick={() => handleDeleteEvent(e.id)} className=\"rounded-full bg-rose-50 px-2 py-1 text-[9px] font-medium text-rose-600 hover:bg-rose-100 sm:text-[10px]\">Trinti</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

