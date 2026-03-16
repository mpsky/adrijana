"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";
import { Button } from "@/components/Button";

type WeightEntry = { id: string; time: string; weightGrams: number };
type HeadEntry = { id: string; time: string; headCircMm: number };
type LengthEntry = { id: string; time: string; lengthMm: number };

export default function SvorisPage() {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [codeInput, setCodeInput] = useState<string>("");
  const [codeError, setCodeError] = useState<string>("");

  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [headEntries, setHeadEntries] = useState<HeadEntry[]>([]);
  const [lengthEntries, setLengthEntries] = useState<LengthEntry[]>([]);
  const [weightInput, setWeightInput] = useState<string>("");
  const [weightDateInput, setWeightDateInput] = useState<string>("");
  const [headInput, setHeadInput] = useState<string>("");
  const [headDateInput, setHeadDateInput] = useState<string>("");
  const [lengthInput, setLengthInput] = useState<string>("");
  const [lengthDateInput, setLengthDateInput] = useState<string>("");

  const [editingWeightId, setEditingWeightId] = useState<string | null>(null);
  const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
  const [editingLengthId, setEditingLengthId] = useState<string | null>(null);

  const [showWeightInfo, setShowWeightInfo] = useState<boolean>(false);
  const [showHeadInfo, setShowHeadInfo] = useState<boolean>(false);
  const [showLengthInfo, setShowLengthInfo] = useState<boolean>(false);
  const [weightInfoSex, setWeightInfoSex] = useState<"girl" | "boy">("girl");

  const [babyBirthIso, setBabyBirthIso] = useState<string | null>(null);

  const [babyId, setBabyId] = useState<string | null>(null);
  const [isBabyLoading, setIsBabyLoading] = useState(true);
  const [babyError, setBabyError] = useState<string | null>(null);

  const sortedWeightEntries = useMemo(
    () => [...weightEntries].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
    [weightEntries]
  );
  const sortedHeadEntries = useMemo(
    () => [...headEntries].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
    [headEntries]
  );
  const sortedLengthEntries = useMemo(
    () => [...lengthEntries].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
    [lengthEntries]
  );

  const weightChartData = useMemo(() => {
    const list = sortedWeightEntries;
    return list.map((w, idx) => {
      const current = w.weightGrams as number;
      const prev = idx === 0 ? undefined : (list[idx - 1].weightGrams as number);
      const diff = prev !== undefined ? current - prev : null;
      const d = new Date(w.time);
      const label = d.toLocaleDateString("lt-LT", { month: "2-digit", day: "2-digit" });
      return { id: w.id, label, value: current, diff };
    });
  }, [sortedWeightEntries]);

  const headChartData = useMemo(() => {
    const list = sortedHeadEntries;
    return list.map((w, idx) => {
      const current = w.headCircMm as number;
      const prev = idx === 0 ? undefined : (list[idx - 1].headCircMm as number);
      const diff = prev !== undefined ? current - prev : null;
      const d = new Date(w.time);
      const label = d.toLocaleDateString("lt-LT", { month: "2-digit", day: "2-digit" });
      return { id: w.id, label, value: current, diff };
    });
  }, [sortedHeadEntries]);

  const weightInfoHighlightMonth = useMemo(() => {
    if (!babyBirthIso || sortedWeightEntries.length === 0) return null;
    const birth = new Date(babyBirthIso);
    const latest = new Date(sortedWeightEntries[sortedWeightEntries.length - 1].time);
    if (isNaN(birth.getTime()) || isNaN(latest.getTime())) return null;

    const diffMonths =
      (latest.getFullYear() - birth.getFullYear()) * 12 +
      (latest.getMonth() - birth.getMonth());
    const target = Math.min(24, Math.max(0, diffMonths));

    const refMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24];
    let best = refMonths[0];
    let bestDiff = Math.abs(refMonths[0] - target);
    for (const m of refMonths) {
      const d = Math.abs(m - target);
      if (d < bestDiff) {
        bestDiff = d;
        best = m;
      }
    }
    return best;
  }, [babyBirthIso, sortedWeightEntries]);

  const headInfoHighlightMonth = useMemo(() => {
    if (!babyBirthIso || sortedHeadEntries.length === 0) return null;
    const birth = new Date(babyBirthIso);
    const latest = new Date(sortedHeadEntries[sortedHeadEntries.length - 1].time);
    if (isNaN(birth.getTime()) || isNaN(latest.getTime())) return null;
    const diffMonths = (latest.getFullYear() - birth.getFullYear()) * 12 + (latest.getMonth() - birth.getMonth());
    const target = Math.min(24, Math.max(0, diffMonths));
    const refMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24];
    let best = refMonths[0], bestDiff = Math.abs(refMonths[0] - target);
    for (const m of refMonths) {
      const d = Math.abs(m - target);
      if (d < bestDiff) { bestDiff = d; best = m; }
    }
    return best;
  }, [babyBirthIso, sortedHeadEntries]);

  const lengthInfoHighlightMonth = useMemo(() => {
    if (!babyBirthIso || sortedLengthEntries.length === 0) return null;
    const birth = new Date(babyBirthIso);
    const latest = new Date(sortedLengthEntries[sortedLengthEntries.length - 1].time);
    if (isNaN(birth.getTime()) || isNaN(latest.getTime())) return null;
    const diffMonths = (latest.getFullYear() - birth.getFullYear()) * 12 + (latest.getMonth() - birth.getMonth());
    const target = Math.min(24, Math.max(0, diffMonths));
    const refMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15, 18, 21, 24];
    let best = refMonths[0], bestDiff = Math.abs(refMonths[0] - target);
    for (const m of refMonths) {
      const d = Math.abs(m - target);
      if (d < bestDiff) { bestDiff = d; best = m; }
    }
    return best;
  }, [babyBirthIso, sortedLengthEntries]);

  const lengthChartData = useMemo(() => {
    const list = sortedLengthEntries;
    return list.map((w, idx) => {
      const current = w.lengthMm as number;
      const prev = idx === 0 ? undefined : (list[idx - 1].lengthMm as number);
      const diff = prev !== undefined ? current - prev : null;
      const d = new Date(w.time);
      const label = d.toLocaleDateString("lt-LT", {
        month: "2-digit",
        day: "2-digit",
      });
      return { id: w.id, label, value: current, diff };
    });
  }, [sortedLengthEntries]);


  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("baby-diary-unlocked-v1");
      if (stored === "true") {
        setUnlocked(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!user || !unlocked) return;
    let cancelled = false;
    (async () => {
      setIsBabyLoading(true);
      setBabyError(null);
      const { data: member, error } = await supabase
        .from("baby_members")
        .select("baby_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setBabyError(error.message);
        setIsBabyLoading(false);
        return;
      }
      if (!member?.baby_id) {
        setBabyId(null);
        setBabyBirthIso(null);
        setWeightEntries([]);
        setHeadEntries([]);
        setLengthEntries([]);
        setIsBabyLoading(false);
        return;
      }
      setBabyId(member.baby_id as string);

      const { data: babyRow } = await supabase
        .from("babies")
        .select("birth_iso")
        .eq("id", member.baby_id)
        .maybeSingle();
      setBabyBirthIso(
        babyRow && babyRow.birth_iso ? (babyRow.birth_iso as string) : null
      );

      const [weightsRes, headRes, lengthRes] = await Promise.all([
        supabase.from("weights").select("id, time, weight_grams").eq("baby_id", member.baby_id).order("time", { ascending: true }),
        supabase.from("head_circ_measurements").select("id, time, head_circ_mm").eq("baby_id", member.baby_id).order("time", { ascending: true }),
        supabase.from("length_height_measurements").select("id, time, length_mm").eq("baby_id", member.baby_id).order("time", { ascending: true }),
      ]);

      if (cancelled) return;
      if (weightsRes.error) {
        setBabyError(weightsRes.error.message);
        setIsBabyLoading(false);
        return;
      }
      if (headRes.error) {
        setBabyError(headRes.error.message);
        setIsBabyLoading(false);
        return;
      }
      if (lengthRes.error) {
        setBabyError(lengthRes.error.message);
        setIsBabyLoading(false);
        return;
      }

      setWeightEntries((weightsRes.data || []).map((row: any) => ({ id: row.id, time: row.time, weightGrams: row.weight_grams })));
      setHeadEntries((headRes.data || []).map((row: any) => ({ id: row.id, time: row.time, headCircMm: row.head_circ_mm })));
      setLengthEntries((lengthRes.data || []).map((row: any) => ({ id: row.id, time: row.time, lengthMm: row.length_mm })));
      setIsBabyLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, unlocked]);

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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-[16px] tracking-[0.5em] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  placeholder="••••"
                />
              </div>
              {codeError && (
                <p className="text-[11px] text-rose-600">{codeError}</p>
              )}
              <Button
                type="submit"
                className="w-full bg-sky-600 text-xs text-white hover:bg-sky-700"
              >
                Atrakinti
              </Button>
            </form>
          </div>
        </div>
      )}
      {unlocked && (
        <div className="min-h-screen bg-slate-50 text-slate-900">
          <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
            <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
                  Matavimai
                </h1>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-3"
                >
                  ← Pagrindinis
                </Link>
              </div>
            </section>

          {/* Blokas: Kūdikio svoris */}
          <section className="rounded-3xl bg-white/95 p-3 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.0002 6L11.0064 9M16.5 6C17.8978 6 18.5967 6 19.1481 6.22836C19.8831 6.53284 20.4672 7.11687 20.7716 7.85195C21 8.40326 21 9.10218 21 10.5V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V10.5C3 9.10218 3 8.40326 3.22836 7.85195C3.53284 7.11687 4.11687 6.53284 4.85195 6.22836C5.40326 6 6.10218 6 7.5 6M10 17H14M10.5415 3H13.4588C14.5397 3 15.0802 3 15.4802 3.18541C16.0136 3.43262 16.4112 3.90199 16.5674 4.46878C16.6845 4.89387 16.5957 5.42698 16.418 6.4932C16.2862 7.28376 16.2203 7.67904 16.0449 7.98778C15.8111 8.39944 15.4388 8.71481 14.9943 8.87778C14.661 9 14.2602 9 13.4588 9H10.5415C9.74006 9 9.33933 9 9.00596 8.87778C8.56146 8.71481 8.18918 8.39944 7.95536 7.98778C7.77999 7.67904 7.71411 7.28376 7.58235 6.4932C7.40465 5.42698 7.3158 4.89387 7.43291 4.46878C7.58906 3.90199 7.98669 3.43262 8.52009 3.18541C8.92014 3 9.46061 3 10.5415 3Z" />
                  </svg>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Kūdikio svoris
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-700 shadow-sm hover:bg-rose-100"
                onClick={() => setShowWeightInfo((v) => !v)}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span>Kaip vertinti svorį?</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3 w-3 transition-transform ${showWeightInfo ? "rotate-180" : "rotate-0"}`}
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>

            {showWeightInfo && (
              <div className="mt-3 rounded-2xl border border-rose-100 bg-rose-50/60 p-3 text-[11px] text-slate-700 shadow-inner">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">
                      WHO orientaciniai svoriai
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Palygink savo kūdikio svorį su orientacine lentele žemiau. Kiekvienas vaikas auga skirtingai –
                      dėl konkretaus svorio visada pasitark su šeimos gydytoju.
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-1 rounded-full bg-white/70 p-0.5 text-[10px] text-slate-700 shadow-inner sm:mt-0">
                    <button
                      type="button"
                      onClick={() => setWeightInfoSex("girl")}
                      className={`flex-1 rounded-full px-2 py-1 text-center font-medium ${
                        weightInfoSex === "girl"
                          ? "bg-rose-500 text-white shadow-sm"
                          : "text-rose-700"
                      }`}
                    >
                      Mergaitė
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeightInfoSex("boy")}
                      className={`flex-1 rounded-full px-2 py-1 text-center font-medium ${
                        weightInfoSex === "boy"
                          ? "bg-sky-500 text-white shadow-sm"
                          : "text-sky-700"
                      }`}
                    >
                      Berniukas
                    </button>
                  </div>
                </div>
                <div
                  className={`mt-3 overflow-hidden rounded-xl border bg-white ${
                    weightInfoSex === "girl" ? "border-rose-100" : "border-sky-100"
                  }`}
                >
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead
                      className={
                        weightInfoSex === "girl"
                          ? "bg-rose-50/80 text-rose-800"
                          : "bg-sky-50/80 text-sky-800"
                      }
                    >
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold">Amžius</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Vidutinis svoris (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(weightInfoSex === "girl"
                        ? [
                            { age: "Gimimas", weight: 3.2, month: 0 },
                            { age: "1 mėn.", weight: 4.2, month: 1 },
                            { age: "2 mėn.", weight: 5.1, month: 2 },
                            { age: "3 mėn.", weight: 5.8, month: 3 },
                            { age: "4 mėn.", weight: 6.4, month: 4 },
                            { age: "5 mėn.", weight: 6.9, month: 5 },
                            { age: "6 mėn.", weight: 7.3, month: 6 },
                            { age: "7 mėn.", weight: 7.6, month: 7 },
                            { age: "8 mėn.", weight: 7.9, month: 8 },
                            { age: "9 mėn.", weight: 8.2, month: 9 },
                            { age: "10 mėn.", weight: 8.5, month: 10 },
                            { age: "11 mėn.", weight: 8.7, month: 11 },
                            { age: "12 mėn.", weight: 8.9, month: 12 },
                            { age: "1 m. 3 mėn.", weight: 9.6, month: 15 },
                            { age: "1 m. 6 mėn.", weight: 10.2, month: 18 },
                            { age: "1 m. 9 mėn.", weight: 10.8, month: 21 },
                            { age: "2 metai", weight: 11.5, month: 24 },
                          ]
                        : [
                            { age: "Gimimas", weight: 3.3, month: 0 },
                            { age: "1 mėn.", weight: 4.5, month: 1 },
                            { age: "2 mėn.", weight: 5.6, month: 2 },
                            { age: "3 mėn.", weight: 6.4, month: 3 },
                            { age: "4 mėn.", weight: 7.0, month: 4 },
                            { age: "5 mėn.", weight: 7.5, month: 5 },
                            { age: "6 mėn.", weight: 7.9, month: 6 },
                            { age: "7 mėn.", weight: 8.3, month: 7 },
                            { age: "8 mėn.", weight: 8.6, month: 8 },
                            { age: "9 mėn.", weight: 8.9, month: 9 },
                            { age: "10 mėn.", weight: 9.2, month: 10 },
                            { age: "11 mėn.", weight: 9.4, month: 11 },
                            { age: "12 mėn.", weight: 9.6, month: 12 },
                            { age: "1 m. 3 mėn.", weight: 10.3, month: 15 },
                            { age: "1 m. 6 mėn.", weight: 10.9, month: 18 },
                            { age: "1 m. 9 mėn.", weight: 11.5, month: 21 },
                            { age: "2 metai", weight: 12.2, month: 24 },
                          ]
                      ).map((row) => {
                        const isHighlight =
                          weightInfoHighlightMonth != null &&
                          row.month === weightInfoHighlightMonth;
                        const baseClass =
                          weightInfoSex === "girl"
                            ? "odd:bg-white even:bg-rose-50/40"
                            : "odd:bg-white even:bg-sky-50/40";
                        const rowClass = isHighlight
                          ? "bg-amber-100 font-semibold text-slate-900 border-l-2 border-r-2 border-amber-400"
                          : baseClass;
                        return (
                          <tr
                            key={row.age}
                            className={rowClass}
                          >
                            <td className="px-3 py-1.5">{row.age}</td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {row.weight.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-rose-700">
                  Šie duomenys yra apytikriai ir skirti tik orientacijai. Lentelės sudarytos remiantis
                  Pasaulio sveikatos organizacijos vaikų augimo standartais (
                  <a
                    href="https://www.who.int/tools/child-growth-standards/standards/weight-for-age"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    WHO Weight-for-age
                  </a>
                  ).
                </p>
              </div>
            )}

            <form
              className="mt-4 grid w-full gap-1.5 text-xs grid-cols-[minmax(0,1fr),minmax(0,1fr)]"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!user) {
                  alert("Reikia būti prisijungus.");
                  return;
                }
                if (!babyId) {
                  alert("Pirmiausia užregistruok kūdikį profilyje.");
                  return;
                }

                const weight = Number(weightInput.replace(",", "."));
                if (!weight || !Number.isFinite(weight)) return;

                const timeIso = weightDateInput
                  ? new Date(weightDateInput + "T12:00:00").toISOString()
                  : new Date().toISOString();

                const { data, error } = await supabase
                  .from("weights")
                  .insert({
                    baby_id: babyId,
                    time: timeIso,
                    weight_grams: Math.round(weight),
                    created_by: user.id,
                  })
                  .select("id, time, weight_grams")
                  .single();

                if (error) {
                  alert("Nepavyko išsaugoti svorio: " + error.message);
                  return;
                }

                setWeightEntries((prev) => [...prev, { id: data.id as string, time: data.time as string, weightGrams: data.weight_grams as number }]);
                setWeightInput("");
              }}
            >
              <div className="space-y-0.5">
                <label className="block text-[10px] font-medium text-slate-600">
                  Svoris (g)
                </label>
                <input
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                  placeholder="pvz. 3200"
                />
              </div>
              <div className="space-y-0.5">
                <label className="block text-[10px] font-medium text-slate-600">
                  Data
                </label>
                <input
                  type="date"
                  value={weightDateInput}
                  onChange={(e) => setWeightDateInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                />
              </div>
              <div className="mt-2">
                <Button
                  type="submit"
                  className="w-full bg-rose-500 text-[11px] text-white hover:bg-rose-600"
                >
                  Pridėti svorį
                </Button>
              </div>
            </form>

            {weightChartData.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Svoris pagal datą (g)
                </p>
                <div className="flex items-end justify-between gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100" style={{ minHeight: 100 }}>
                  {weightChartData.map(({ id, label, value }) => {
                    const maxVal = Math.max(1, ...weightChartData.map((d) => d.value || 0));
                    const h = (value / maxVal) * 80;
                    return (
                      <div key={id} className="flex flex-1 flex-col items-center gap-0.5">
                        <div className="flex w-full flex-col justify-end" style={{ height: 84 }}>
                          <div
                            className="w-full max-w-[24px] rounded-t transition-all mx-auto"
                            style={{
                              height: h || 4,
                              backgroundColor: "rgb(244 114 182)",
                            }}
                            title={`${value} g`}
                          />
                        </div>
                        <span className="font-mono text-[9px] text-slate-500">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-4">
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1 text-[11px] text-slate-600">
                {sortedWeightEntries.length === 0 ? (
                  <p className="text-slate-400">
                    Dar nėra svorio įrašų. Pradėk nuo gimimo ar išleidimo namo
                    svorio.
                  </p>
                ) : (
                  sortedWeightEntries
                    .slice()
                    .reverse()
                    .map((w, idx, arr) => {
                      const latest = arr[0]?.weightGrams as number | undefined;
                      const current = w.weightGrams as number;
                      const diff =
                        latest !== undefined ? current - latest : undefined;
                      const d = new Date(w.time);
                      const label = d.toLocaleDateString("lt-LT", {
                        month: "2-digit",
                        day: "2-digit",
                      });
                      const isEditing = editingWeightId === w.id;
                      const dateStr = w.time.slice(0, 10);
                      return (
                        <div
                          key={w.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-2 py-1 shadow-sm ring-1 ring-slate-100"
                        >
                          {isEditing ? (
                            <>
                              <div className="flex flex-1 flex-wrap items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  defaultValue={current}
                                  id={`weight-edit-${w.id}`}
                                  className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-[11px]"
                                />
                                <span className="text-slate-400">g</span>
                                <input
                                  type="date"
                                  defaultValue={dateStr}
                                  id={`weight-date-${w.id}`}
                                  className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px]"
                                />
                              </div>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="rounded bg-rose-500 px-2 py-0.5 text-[10px] text-white hover:bg-rose-600"
                                  onClick={async () => {
                                    const inp = document.getElementById(`weight-edit-${w.id}`) as HTMLInputElement;
                                    const dateInp = document.getElementById(`weight-date-${w.id}`) as HTMLInputElement;
                                    const val = Number(inp?.value);
                                    const timeIso = dateInp?.value ? new Date(dateInp.value + "T12:00:00").toISOString() : w.time;
                                    if (!Number.isFinite(val)) return;
                                    const { error } = await supabase.from("weights").update({ weight_grams: Math.round(val), time: timeIso }).eq("id", w.id);
                                    if (error) {
                                      alert("Nepavyko atnaujinti: " + error.message);
                                      return;
                                    }
                                    setWeightEntries((prev) =>
                                      prev.map((e) => (e.id === w.id ? { ...e, time: timeIso, weightGrams: Math.round(val) } : e))
                                    );
                                    setEditingWeightId(null);
                                  }}
                                >
                                  Išsaugoti
                                </button>
                                <button
                                  type="button"
                                  className="rounded bg-slate-300 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-400"
                                  onClick={() => setEditingWeightId(null)}
                                >
                                  Atšaukti
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="font-mono text-[10px] text-slate-500">{label}</span>
                              <span className="text-[11px] font-medium text-slate-800">
                                {current} g
                                {diff != null && diff !== 0 && (
                                  <span className={`ml-1 font-normal ${diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                    {diff > 0 ? "+" : ""}
                                    {diff} g
                                  </span>
                                )}
                              </span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-600 hover:bg-sky-50"
                                  onClick={() => setEditingWeightId(w.id)}
                                  aria-label="Redaguoti"
                                  title="Redaguoti"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M3 21h6l11-11-6-6L3 15v6z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                  onClick={async () => {
                                    if (!confirm("Ištrinti šį matavimą?")) return;
                                    const { error } = await supabase.from("head_circ_measurements").delete().eq("id", w.id);
                                    if (error) {
                                      alert("Nepavyko ištrinti: " + error.message);
                                      return;
                                    }
                                    setHeadEntries((prev) => prev.filter((e) => e.id !== w.id));
                                  }}
                                  aria-label="Ištrinti"
                                  title="Ištrinti"
                                >
                                  <svg
                                    viewBox="0 0 24 24"
                                    className="h-3 w-3"
                                    aria-hidden="true"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                    <path d="M10 11v6" />
                                    <path d="M14 11v6" />
                                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                  </svg>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </section>

          {/* Blokas: Galvos apimtis */}
          <section className="rounded-3xl bg-white/95 p-3 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 10a8 8 0 0 1 16 0v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
                    <path d="M9 10a3 3 0 0 1 6 0" />
                  </svg>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Galvos apimtis
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-medium text-sky-700 shadow-sm hover:bg-sky-100"
                onClick={() => setShowHeadInfo((v) => !v)}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                <span>Kaip vertinti galvos apimtį?</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3 w-3 transition-transform ${showHeadInfo ? "rotate-180" : "rotate-0"}`}
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>

            {/* Info: galvos apimties orientacinė lentelė */}
            {showHeadInfo && (
                <div className="mt-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-3 text-[11px] text-slate-700 shadow-inner">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                        WHO orientacinės galvos apimtys
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600">
                        Palygink savo kūdikio galvos apimtį su orientacine lentele žemiau. Kiekvienas vaikas auga skirtingai –
                        dėl konkrečių matavimų visada pasitark su šeimos gydytoju.
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-1 rounded-full bg-white/70 p-0.5 text-[10px] text-slate-700 shadow-inner sm:mt-0">
                      <button
                        type="button"
                        onClick={() => setWeightInfoSex("girl")}
                        className={`flex-1 rounded-full px-2 py-1 text-center font-medium ${
                          weightInfoSex === "girl"
                            ? "bg-rose-500 text-white shadow-sm"
                            : "text-rose-700"
                        }`}
                      >
                        Mergaitė
                      </button>
                      <button
                        type="button"
                        onClick={() => setWeightInfoSex("boy")}
                        className={`flex-1 rounded-full px-2 py-1 text-center font-medium ${
                          weightInfoSex === "boy"
                            ? "bg-sky-500 text-white shadow-sm"
                            : "text-sky-700"
                        }`}
                      >
                        Berniukas
                      </button>
                    </div>
                  </div>
                  <div
                    className={`mt-3 overflow-hidden rounded-xl border bg-white ${
                      weightInfoSex === "girl" ? "border-rose-100" : "border-sky-100"
                    }`}
                  >
                    <table className="min-w-full border-collapse text-[11px]">
                      <thead
                        className={
                          weightInfoSex === "girl"
                            ? "bg-rose-50/80 text-rose-800"
                            : "bg-sky-50/80 text-sky-800"
                        }
                      >
                        <tr>
                          <th className="px-3 py-1.5 text-left font-semibold">Amžius</th>
                          <th className="px-3 py-1.5 text-right font-semibold">Vidutinė galvos apimtis (cm)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(weightInfoSex === "girl"
                          ? [
                              { age: "Gimimas", head: 34.0, month: 0 },
                              { age: "1 mėn.", head: 36.5, month: 1 },
                              { age: "2 mėn.", head: 38.0, month: 2 },
                              { age: "3 mėn.", head: 39.5, month: 3 },
                              { age: "4 mėn.", head: 40.6, month: 4 },
                              { age: "5 mėn.", head: 41.6, month: 5 },
                              { age: "6 mėn.", head: 42.4, month: 6 },
                              { age: "7 mėn.", head: 43.1, month: 7 },
                              { age: "8 mėn.", head: 43.8, month: 8 },
                              { age: "9 mėn.", head: 44.3, month: 9 },
                              { age: "10 mėn.", head: 44.8, month: 10 },
                              { age: "11 mėn.", head: 45.2, month: 11 },
                              { age: "12 mėn.", head: 45.6, month: 12 },
                              { age: "1 m. 3 mėn.", head: 46.2, month: 15 },
                              { age: "1 m. 6 mėn.", head: 46.7, month: 18 },
                              { age: "1 m. 9 mėn.", head: 47.1, month: 21 },
                              { age: "2 metai", head: 47.5, month: 24 },
                            ]
                          : [
                              { age: "Gimimas", head: 34.5, month: 0 },
                              { age: "1 mėn.", head: 37.3, month: 1 },
                              { age: "2 mėn.", head: 39.1, month: 2 },
                              { age: "3 mėn.", head: 40.5, month: 3 },
                              { age: "4 mėn.", head: 41.6, month: 4 },
                              { age: "5 mėn.", head: 42.6, month: 5 },
                              { age: "6 mėn.", head: 43.5, month: 6 },
                              { age: "7 mėn.", head: 44.2, month: 7 },
                              { age: "8 mėn.", head: 44.8, month: 8 },
                              { age: "9 mėn.", head: 45.4, month: 9 },
                              { age: "10 mėn.", head: 45.9, month: 10 },
                              { age: "11 mėn.", head: 46.3, month: 11 },
                              { age: "12 mėn.", head: 46.7, month: 12 },
                              { age: "1 m. 3 mėn.", head: 47.4, month: 15 },
                              { age: "1 m. 6 mėn.", head: 47.9, month: 18 },
                              { age: "1 m. 9 mėn.", head: 48.3, month: 21 },
                              { age: "2 metai", head: 48.7, month: 24 },
                            ]
                        ).map((row) => {
                          const isHighlight =
                            headInfoHighlightMonth != null &&
                            row.month === headInfoHighlightMonth;
                          const baseClass =
                            weightInfoSex === "girl"
                              ? "odd:bg-white even:bg-rose-50/40"
                              : "odd:bg-white even:bg-sky-50/40";
                          const rowClass = isHighlight
                            ? "bg-amber-100 font-semibold text-slate-900 border-l-2 border-r-2 border-amber-400"
                            : baseClass;
                          return (
                            <tr key={row.age} className={rowClass}>
                              <td className="px-3 py-1.5">{row.age}</td>
                              <td className="px-3 py-1.5 text-right font-mono">
                                {row.head.toFixed(1)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2 text-[10px] text-sky-700">
                    Šie duomenys yra apytikriai ir skirti tik orientacijai. Lentelės sudarytos remiantis
                    Pasaulio sveikatos organizacijos vaikų augimo standartais (
                    <a
                      href="https://www.who.int/tools/child-growth-standards/standards/head-circumference-for-age"
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      WHO Head circumference-for-age
                    </a>
                    ).
                  </p>
                </div>
              )}

            <form
                className="mt-4 grid w-full gap-1.5 text-xs grid-cols-[minmax(0,1fr),minmax(0,1fr)]"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!user) {
                    alert("Reikia būti prisijungus.");
                    return;
                  }
                  if (!babyId) {
                    alert("Pirmiausia užregistruok kūdikį profilyje.");
                    return;
                  }

                  if (!headInput.trim()) return;
                  const head = Number(headInput.replace(",", "."));
                  if (!head || !Number.isFinite(head)) return;

                  const timeIso = headDateInput
                    ? new Date(headDateInput + "T12:00:00").toISOString()
                    : new Date().toISOString();

                  const { data, error } = await supabase
                    .from("head_circ_measurements")
                    .insert({
                      baby_id: babyId,
                      time: timeIso,
                      head_circ_mm: Math.round(head),
                      created_by: user.id,
                    })
                    .select("id, time, head_circ_mm")
                    .single();

                  if (error) {
                    alert("Nepavyko išsaugoti galvos apimties: " + error.message);
                    return;
                  }

                  setHeadEntries((prev) => [...prev, { id: data.id as string, time: data.time as string, headCircMm: data.head_circ_mm as number }]);
                  setHeadInput("");
                  setHeadDateInput("");
                }}
              >
                <div className="space-y-0.5">
                  <label className="block text-[10px] font-medium text-slate-600">
                    Galvos apimtis (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={headInput}
                    onChange={(e) => setHeadInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                    placeholder="pvz. 350"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="block text-[10px] font-medium text-slate-600">
                    Data
                  </label>
                  <input
                    type="date"
                    value={headDateInput}
                    onChange={(e) => setHeadDateInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                  />
                </div>
                <div className="mt-2">
                  <Button
                    type="submit"
                    className="w-full bg-sky-600 text-[11px] text-white hover:bg-sky-700"
                  >
                    Pridėti galvos apimtį
                  </Button>
                </div>
              </form>

              {headChartData.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Galvos apimtis pagal datą (mm)
                  </p>
                  <div className="flex items-end justify-between gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100" style={{ minHeight: 100 }}>
                    {headChartData.map(({ id, label, value }) => {
                      const maxVal = Math.max(1, ...headChartData.map((d) => d.value || 0));
                      const h = (value / maxVal) * 80;
                      return (
                        <div key={id} className="flex flex-1 flex-col items-center gap-0.5">
                          <div className="flex w-full flex-col justify-end" style={{ height: 84 }}>
                            <div
                              className="w-full max-w-[24px] rounded-t transition-all mx-auto"
                              style={{
                                height: h || 4,
                                backgroundColor: "rgb(56 189 248)",
                              }}
                              title={`${value} mm`}
                            />
                          </div>
                          <span className="font-mono text-[9px] text-slate-500">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {headEntries.length > 0 && (
                <div className="mt-4">
                  <div className="max-h-80 space-y-1 overflow-y-auto pr-1 text-[11px] text-slate-600">
                    {sortedHeadEntries
                      .slice()
                      .reverse()
                      .map((w, idx, arr) => {
                        const latest = arr[0]?.headCircMm as number | undefined;
                        const current = w.headCircMm as number;
                        const diff =
                          latest !== undefined ? current - latest : undefined;
                        const d = new Date(w.time);
                        const label = d.toLocaleDateString("lt-LT", {
                          month: "2-digit",
                          day: "2-digit",
                        });
                        const isEditing = editingHeadId === w.id;
                        const dateStr = w.time.slice(0, 10);
                        return (
                          <div
                            key={w.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-2 py-1 shadow-sm ring-1 ring-slate-100"
                          >
                            {isEditing ? (
                              <>
                                <div className="flex flex-1 flex-wrap items-center gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    defaultValue={current}
                                    id={`head-edit-${w.id}`}
                                    className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-[11px]"
                                  />
                                  <span className="text-slate-400">mm</span>
                                  <input
                                    type="date"
                                    defaultValue={dateStr}
                                    id={`head-date-${w.id}`}
                                    className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px]"
                                  />
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className="rounded bg-sky-600 px-2 py-0.5 text-[10px] text-white hover:bg-sky-700"
                                    onClick={async () => {
                                      const inp = document.getElementById(`head-edit-${w.id}`) as HTMLInputElement;
                                      const dateInp = document.getElementById(`head-date-${w.id}`) as HTMLInputElement;
                                      const val = Number(inp?.value);
                                      const timeIso = dateInp?.value ? new Date(dateInp.value + "T12:00:00").toISOString() : w.time;
                                      if (!Number.isFinite(val)) return;
                                      const { error } = await supabase.from("head_circ_measurements").update({ head_circ_mm: Math.round(val), time: timeIso }).eq("id", w.id);
                                      if (error) {
                                        alert("Nepavyko atnaujinti: " + error.message);
                                        return;
                                      }
                                      setHeadEntries((prev) =>
                                        prev.map((e) => (e.id === w.id ? { ...e, time: timeIso, headCircMm: Math.round(val) } : e))
                                      );
                                      setEditingHeadId(null);
                                    }}
                                  >
                                    Išsaugoti
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded bg-slate-300 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-400"
                                    onClick={() => setEditingHeadId(null)}
                                  >
                                    Atšaukti
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="font-mono text-[10px] text-slate-500">{label}</span>
                                <span className="text-[11px] font-medium text-slate-800">
                                  {current} mm
                                  {diff != null && diff !== 0 && (
                                    <span className={`ml-1 font-normal ${diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                      {diff > 0 ? "+" : ""}
                                      {diff} mm
                                    </span>
                                  )}
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-600 hover:bg-sky-50"
                                    onClick={() => setEditingHeadId(w.id)}
                                    aria-label="Redaguoti"
                                    title="Redaguoti"
                                  >
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M3 21h6l11-11-6-6L3 15v6z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                    onClick={async () => {
                                      if (!confirm("Ištrinti šį matavimą?")) return;
                                      const { error } = await supabase.from("weights").delete().eq("id", w.id);
                                      if (error) {
                                        alert("Nepavyko ištrinti: " + error.message);
                                        return;
                                      }
                                      setWeightEntries((prev) => prev.filter((e) => e.id !== w.id));
                                    }}
                                    aria-label="Ištrinti"
                                    title="Ištrinti"
                                  >
                                    <svg
                                      viewBox="0 0 24 24"
                                      className="h-3 w-3"
                                      aria-hidden="true"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                      <path d="M10 11v6" />
                                      <path d="M14 11v6" />
                                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                    </svg>
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
          </section>

          {/* Blokas: Ilgis / ūgis */}
          <section className="rounded-3xl bg-white/95 p-3 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 21V5a3 3 0 0 1 3-3h10" />
                    <path d="M9 8h8" />
                    <path d="M9 12h8" />
                    <path d="M9 16h8" />
                  </svg>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  Ilgis / ūgis
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-700 shadow-sm hover:bg-emerald-100"
                onClick={() => setShowLengthInfo((v) => !v)}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Kaip vertinti ilgį / ūgį?</span>
                <svg
                  viewBox="0 0 24 24"
                  className={`h-3 w-3 transition-transform ${showLengthInfo ? "rotate-180" : "rotate-0"}`}
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>

            {showLengthInfo && (
              <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-[11px] text-slate-700 shadow-inner">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      WHO orientaciniai ilgio / ūgio duomenys
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Lygink kūdikio ilgį / ūgį su lentele žemiau. Kiekvienas vaikas auga skirtingai – dėl konkrečių
                      matavimų visada pasitark su šeimos gydytoju.
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-1 rounded-full bg-white/70 p-0.5 text-[10px] text-slate-700 shadow-inner sm:mt-0">
                    <button
                      type="button"
                      onClick={() => setWeightInfoSex("girl")}
                      className={`flex-1 rounded-full px-2 py-1 text-center font-medium ${
                        weightInfoSex === "girl"
                          ? "bg-rose-500 text-white shadow-sm"
                          : "text-rose-700"
                      }`}
                    >
                      Mergaitė
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeightInfoSex("boy")}
                      className={`flex-1 rounded-full px-2 py-1 text-center font-medium ${
                        weightInfoSex === "boy"
                          ? "bg-sky-500 text-white shadow-sm"
                          : "text-sky-700"
                      }`}
                    >
                      Berniukas
                    </button>
                  </div>
                </div>
                <div
                  className={`mt-3 overflow-hidden rounded-xl border bg-white ${
                    weightInfoSex === "girl" ? "border-rose-100" : "border-sky-100"
                  }`}
                >
                  <table className="min-w-full border-collapse text-[11px]">
                    <thead
                      className={
                        weightInfoSex === "girl"
                          ? "bg-rose-50/80 text-rose-800"
                          : "bg-sky-50/80 text-sky-800"
                      }
                    >
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold">Amžius</th>
                        <th className="px-3 py-1.5 text-right font-semibold">Vidutinis ūgis (cm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(weightInfoSex === "girl"
                        ? [
                            { age: "Gimimas", h: 49.0, month: 0 },
                            { age: "1 mėn.", h: 53.5, month: 1 },
                            { age: "2 mėn.", h: 57.0, month: 2 },
                            { age: "3 mėn.", h: 59.8, month: 3 },
                            { age: "4 mėn.", h: 62.1, month: 4 },
                            { age: "5 mėn.", h: 64.0, month: 5 },
                            { age: "6 mėn.", h: 65.7, month: 6 },
                            { age: "7 mėn.", h: 67.3, month: 7 },
                            { age: "8 mėn.", h: 68.7, month: 8 },
                            { age: "9 mėn.", h: 70.1, month: 9 },
                            { age: "10 mėn.", h: 71.5, month: 10 },
                            { age: "11 mėn.", h: 72.8, month: 11 },
                            { age: "12 mėn.", h: 74.0, month: 12 },
                            { age: "1 m. 3 mėn.", h: 77.0, month: 15 },
                            { age: "1 m. 6 mėn.", h: 80.0, month: 18 },
                            { age: "1 m. 9 mėn.", h: 83.0, month: 21 },
                            { age: "2 metai", h: 86.0, month: 24 },
                          ]
                        : [
                            { age: "Gimimas", h: 49.9, month: 0 },
                            { age: "1 mėn.", h: 54.7, month: 1 },
                            { age: "2 mėn.", h: 58.4, month: 2 },
                            { age: "3 mėn.", h: 61.4, month: 3 },
                            { age: "4 mėn.", h: 63.9, month: 4 },
                            { age: "5 mėn.", h: 65.9, month: 5 },
                            { age: "6 mėn.", h: 67.6, month: 6 },
                            { age: "7 mėn.", h: 69.2, month: 7 },
                            { age: "8 mėn.", h: 70.6, month: 8 },
                            { age: "9 mėn.", h: 72.0, month: 9 },
                            { age: "10 mėn.", h: 73.3, month: 10 },
                            { age: "11 mėn.", h: 74.5, month: 11 },
                            { age: "12 mėn.", h: 75.7, month: 12 },
                            { age: "1 m. 3 mėn.", h: 79.0, month: 15 },
                            { age: "1 m. 6 mėn.", h: 82.0, month: 18 },
                            { age: "1 m. 9 mėn.", h: 85.0, month: 21 },
                            { age: "2 metai", h: 87.8, month: 24 },
                          ]
                      ).map((row) => {
                        const isHighlight =
                          lengthInfoHighlightMonth != null &&
                          row.month === lengthInfoHighlightMonth;
                        const baseClass =
                          weightInfoSex === "girl"
                            ? "odd:bg-white even:bg-rose-50/40"
                            : "odd:bg-white even:bg-sky-50/40";
                        const rowClass = isHighlight
                          ? "bg-amber-100 font-semibold text-slate-900 border-l-2 border-r-2 border-amber-400"
                          : baseClass;
                        return (
                          <tr key={row.age} className={rowClass}>
                            <td className="px-3 py-1.5">{row.age}</td>
                            <td className="px-3 py-1.5 text-right font-mono">
                              {row.h.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-emerald-700">
                  Šie duomenys yra apytikriai ir skirti tik orientacijai. Lentelės sudarytos remiantis
                  Pasaulio sveikatos organizacijos vaikų augimo standartais.
                </p>
              </div>
            )}

            <form
              className="mt-4 grid w-full gap-1.5 text-xs grid-cols-[minmax(0,1fr),minmax(0,1fr)]"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!user) { alert("Reikia būti prisijungus."); return; }
                if (!babyId) { alert("Pirmiausia užregistruok kūdikį profilyje."); return; }
                if (!lengthInput.trim()) return;
                const len = Number(lengthInput.replace(",", "."));
                if (!len || !Number.isFinite(len)) return;
                const timeIso = lengthDateInput ? new Date(lengthDateInput + "T12:00:00").toISOString() : new Date().toISOString();
                const { data, error } = await supabase.from("length_height_measurements").insert({
                  baby_id: babyId,
                  time: timeIso,
                  length_mm: Math.round(len),
                  created_by: user.id,
                }).select("id, time, length_mm").single();
                if (error) { alert("Nepavyko išsaugoti ilgio: " + error.message); return; }
                setLengthEntries((prev) => [...prev, { id: data.id as string, time: data.time as string, lengthMm: data.length_mm as number }]);
                setLengthInput("");
                setLengthDateInput("");
              }}
            >
              <div className="space-y-0.5">
                <label className="block text-[10px] font-medium text-slate-600">
                  Ilgis / ūgis (mm)
                </label>
                <input type="number" min={0} inputMode="decimal" value={lengthInput} onChange={(e) => setLengthInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100" placeholder="pvz. 520" />
              </div>
              <div className="space-y-0.5">
                <label className="block text-[10px] font-medium text-slate-600">Data</label>
                <input type="date" value={lengthDateInput} onChange={(e) => setLengthDateInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[16px] shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div className="mt-2">
                <Button type="submit" className="w-full bg-emerald-600 text-[11px] text-white hover:bg-emerald-700">
                  Pridėti ilgį / ūgį
                </Button>
              </div>
            </form>
            {lengthChartData.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Ilgis / ūgis pagal datą (mm)
                </p>
                <div className="flex items-end justify-between gap-1 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100" style={{ minHeight: 100 }}>
                  {lengthChartData.map(({ id, label, value }) => {
                    const maxVal = Math.max(1, ...lengthChartData.map((d) => d.value || 0));
                    const h = (value / maxVal) * 80;
                    return (
                      <div key={id} className="flex flex-1 flex-col items-center gap-0.5">
                        <div className="flex w-full flex-col justify-end" style={{ height: 84 }}>
                          <div className="mx-auto w-full max-w-[24px] rounded-t bg-emerald-400 transition-all" style={{ height: h || 4 }} title={`${value} mm`} />
                        </div>
                        <span className="font-mono text-[9px] text-slate-500">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {lengthEntries.length > 0 && (
              <div className="mt-4">
                <div className="max-h-80 space-y-1 overflow-y-auto pr-1 text-[11px] text-slate-600">
                  {sortedLengthEntries.slice().reverse().map((w, idx, arr) => {
                    const latest = arr[0]?.lengthMm as number | undefined;
                    const current = w.lengthMm as number;
                    const diff = latest !== undefined ? current - latest : undefined;
                    const label = new Date(w.time).toLocaleDateString("lt-LT", { month: "2-digit", day: "2-digit" });
                    const isEditing = editingLengthId === w.id;
                    const dateStr = w.time.slice(0, 10);
                    return (
                      <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-2 py-1 shadow-sm ring-1 ring-slate-100">
                        {isEditing ? (
                          <>
                            <div className="flex flex-1 flex-wrap items-center gap-2">
                              <input type="number" min={0} defaultValue={current} id={`length-edit-${w.id}`} className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-[11px]" />
                              <span className="text-slate-400">mm</span>
                              <input type="date" defaultValue={dateStr} id={`length-date-${w.id}`} className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px]" />
                            </div>
                            <div className="flex gap-1">
                              <button type="button" className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] text-white hover:bg-emerald-700"
                                onClick={async () => {
                                  const inp = document.getElementById(`length-edit-${w.id}`) as HTMLInputElement;
                                  const dateInp = document.getElementById(`length-date-${w.id}`) as HTMLInputElement;
                                  const val = Number(inp?.value);
                                  const timeIso = dateInp?.value ? new Date(dateInp.value + "T12:00:00").toISOString() : w.time;
                                  if (!Number.isFinite(val)) return;
                                  const { error } = await supabase.from("length_height_measurements").update({ length_mm: Math.round(val), time: timeIso }).eq("id", w.id);
                                  if (error) { alert("Nepavyko atnaujinti: " + error.message); return; }
                                  setLengthEntries((prev) => prev.map((e) => e.id === w.id ? { ...e, time: timeIso, lengthMm: Math.round(val) } : e));
                                  setEditingLengthId(null);
                                }}>Išsaugoti</button>
                              <button type="button" className="rounded bg-slate-300 px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-400" onClick={() => setEditingLengthId(null)}>Atšaukti</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="font-mono text-[10px] text-slate-500">{label}</span>
                            <span className="text-[11px] font-medium text-slate-800">
                              {current} mm
                              {diff != null && diff !== 0 && (
                                <span className={`ml-1 font-normal ${diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>{diff > 0 ? "+" : ""}{diff} mm</span>
                              )}
                            </span>
                            <div className="flex gap-1">
                              <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50" onClick={() => setEditingLengthId(w.id)} aria-label="Redaguoti" title="Redaguoti">
                                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h6l11-11-6-6L3 15v6z" /></svg>
                              </button>
                              <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                onClick={async () => {
                                  if (!confirm("Ištrinti šį matavimą?")) return;
                                  const { error } = await supabase.from("length_height_measurements").delete().eq("id", w.id);
                                  if (error) { alert("Nepavyko ištrinti: " + error.message); return; }
                                  setLengthEntries((prev) => prev.filter((e) => e.id !== w.id));
                                }} aria-label="Ištrinti" title="Ištrinti">
                                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          </main>
        </div>
      )}
    </div>
  );
}
