"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getBabyInfo } from "@/lib/babyStorage";

type WeightEntry = {
  id: string;
  time: string;
  weightGrams: number;
};

export default function SvorisPage() {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [codeInput, setCodeInput] = useState<string>("");
  const [codeError, setCodeError] = useState<string>("");

  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [weightInput, setWeightInput] = useState<string>("");
  const [weightDateInput, setWeightDateInput] = useState<string>("");

  const [now, setNow] = useState<Date>(new Date());
  const [babyInfo, setBabyInfo] = useState(() => getBabyInfo());

  const sortedWeightEntries = useMemo(
    () =>
      [...weightEntries].sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
      ),
    [weightEntries]
  );

  const chartScale = useMemo(() => {
    if (sortedWeightEntries.length === 0) return { min: 0, max: 4000 };
    const values = sortedWeightEntries.map((e) => e.weightGrams);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max(50, Math.round((max - min) * 0.1) || 50);
    return { min: Math.max(0, min - padding), max: max + padding };
  }, [sortedWeightEntries]);

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

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBabyInfo(getBabyInfo());
      const stored = window.localStorage.getItem("baby-diary-unlocked-v1");
      if (stored === "true") {
        setUnlocked(true);
      }

      const storedWeights = window.localStorage.getItem("baby-diary-weight-v1");
      if (storedWeights) {
        try {
          const parsed = JSON.parse(storedWeights) as WeightEntry[];
          if (Array.isArray(parsed)) {
            setWeightEntries(
              parsed
                .filter(
                  (w) =>
                    typeof w.time === "string" &&
                    typeof w.weightGrams === "number"
                )
                .sort(
                  (a, b) =>
                    new Date(a.time).getTime() - new Date(b.time).getTime()
                )
            );
          }
        } catch {
          // ignore
        }
      }
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "baby-diary-weight-v1",
      JSON.stringify(weightEntries)
    );
  }, [weightEntries]);

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
              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 shadow-sm transition hover:bg-sky-600 hover:text-white"
                >
                  Pradžia
                </Link>
                <Link
                  href="/archive"
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 shadow-sm transition hover:bg-sky-600 hover:text-white"
                >
                  Archyvas
                </Link>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-slate-800"
                >
                  Nustatymai
                </Link>
              </div>
            </div>
          </section>

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
            </div>

            <form
              className="mt-4 grid w-full gap-1.5 text-xs grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] sm:w-auto"
              onSubmit={(e) => {
                e.preventDefault();
                const weight = Number(weightInput.replace(",", "."));
                if (!weight || !Number.isFinite(weight)) return;
                const timeIso = weightDateInput
                  ? new Date(weightDateInput + "T12:00:00").toISOString()
                  : new Date().toISOString();
                const entry: WeightEntry = {
                  id: `${timeIso}-${Math.random().toString(36).slice(2, 8)}`,
                  time: timeIso,
                  weightGrams: Math.round(weight),
                };
                setWeightEntries((prev) => [...prev, entry]);
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] shadow-sm outline-none transition focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] shadow-sm outline-none transition focus:border-rose-400 focus:bg-white focus:ring-2 focus:ring-rose-100"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-rose-500 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-rose-600 sm:w-auto"
                >
                  Pridėti svorį
                </button>
              </div>
            </form>

            {sortedWeightEntries.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Svorio kitimas
                </p>
                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <div
                    className="flex items-end gap-2"
                    style={{
                      minWidth: `${Math.max(sortedWeightEntries.length * 48, 240)}px`,
                      height: "200px",
                    }}
                  >
                    {sortedWeightEntries.map((w) => {
                      const { min, max } = chartScale;
                      const range = max - min || 1;
                      const pct = Math.max(8, Math.min(100, ((w.weightGrams - min) / range) * 100));
                      const barHeightPx = (pct / 100) * 180;
                      const d = new Date(w.time);
                      const dateLabel = d.toLocaleDateString("lt-LT", {
                        month: "2-digit",
                        day: "2-digit",
                      });
                      return (
                        <div
                          key={w.id}
                          className="group flex flex-col items-center gap-1"
                          style={{ width: "40px", flexShrink: 0 }}
                          title={`${dateLabel}: ${w.weightGrams} g`}
                        >
                          <span className="text-[11px] font-semibold text-rose-700">
                            {w.weightGrams}
                          </span>
                          <div
                            className="flex w-full flex-1 items-end justify-center"
                            style={{ minHeight: "180px" }}
                          >
                            <div
                              className="w-8 min-w-[28px] rounded-t-md bg-rose-500 shadow-md ring-1 ring-rose-200 transition group-hover:bg-rose-600"
                              style={{ height: `${barHeightPx}px` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-slate-600">
                            {dateLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                    <span>{chartScale.min} g</span>
                    <span>{chartScale.max} g</span>
                  </div>
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
                      const current = w.weightGrams;
                      const prev =
                        idx === arr.length - 1
                          ? undefined
                          : arr[idx + 1].weightGrams;
                      const diff =
                        prev !== undefined ? current - prev : undefined;
                      const d = new Date(w.time);
                      const label = d.toLocaleDateString("lt-LT", {
                        month: "2-digit",
                        day: "2-digit",
                      });
                      return (
                        <div
                          key={w.id}
                          className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 shadow-sm ring-1 ring-slate-100"
                        >
                          <span className="font-mono text-[10px] text-slate-500">
                            {label}
                          </span>
                          <span className="text-[11px] font-medium text-slate-800">
                            {current} g
                            {diff != null && diff !== 0 && (
                              <span
                                className={`ml-1 font-normal ${
                                  diff > 0
                                    ? "text-emerald-600"
                                    : "text-rose-600"
                                }`}
                              >
                                {diff > 0 ? "+" : ""}
                                {diff} g
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
