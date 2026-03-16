"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";

const ageColumns = [
  "Iki 24 val.",
  "2–3 paros",
  "1 mėn.",
  "2 mėn.",
  "3 mėn.",
  "4 mėn.",
  "5 mėn.",
  "6 mėn.",
  "12–15 mėn.",
  "15–16 mėn.",
  "18 mėn.",
  "6–7 metai",
  "11 metų",
  "15–16 metų",
] as const;

type AgeColumn = (typeof ageColumns)[number];

type VaccineRow = {
  number: string;
  name: string;
  code?: string;
  doses: Partial<Record<AgeColumn, string>>;
};

const schedule2026: VaccineRow[] = [
  {
    number: "1",
    name: "Tuberkuliozės vakcina",
    code: "BCG",
    doses: {
      "2–3 paros": "BCG",
    },
  },
  {
    number: "2",
    name: "Hepatito B vakcina",
    code: "HepB",
    doses: {
      "Iki 24 val.": "HepB*",
      "1 mėn.": "HepB",
      "6 mėn.": "HepB",
    },
  },
  {
    number: "3",
    name: "Kokliušo, difterijos, stabligės vakcina",
    code: "DTaP",
    doses: {
      "2 mėn.": "DTaP",
      "4 mėn.": "DTaP",
      "6 mėn.": "DTaP",
      "18 mėn.": "DTaP",
      "6–7 metai": "DTaP",
      "11 metų": "DTaP",
      "15–16 metų": "DTaP",
    },
  },
  {
    number: "4",
    name: "B tipo Haemophilus influenzae infekcijos vakcina",
    code: "Hib",
    doses: {
      "2 mėn.": "Hib",
      "4 mėn.": "Hib",
      "6 mėn.": "Hib",
      "18 mėn.": "Hib",
    },
  },
  {
    number: "5",
    name: "Poliomielito vakcina",
    code: "IPV",
    doses: {
      "2 mėn.": "IPV",
      "4 mėn.": "IPV",
      "6 mėn.": "IPV",
      "18 mėn.": "IPV",
      "6–7 metai": "IPV",
    },
  },
  {
    number: "6",
    name: "Pneumokokinės infekcijos vakcina",
    code: "PCV",
    doses: {
      "2 mėn.": "PCV",
      "4 mėn.": "PCV",
      "12–15 mėn.": "PCV**",
    },
  },
  {
    number: "7",
    name: "Tymų, epideminio parotito, raudonukės vakcina",
    code: "MMR",
    doses: {
      "12–15 mėn.": "MMR**",
      "6–7 metai": "MMR",
    },
  },
  {
    number: "8",
    name: "Žmogaus papilomos viruso infekcijos vakcina",
    code: "HPV",
    doses: {
      "11 metų": "HPV1 / HPV2***",
    },
  },
  {
    number: "9",
    name: "B tipo meningokokinės infekcijos vakcina",
    code: "MenB",
    doses: {
      "3 mėn.": "MenB",
      "5 mėn.": "MenB",
      "12–15 mėn.": "MenB",
      "15–16 mėn.": "MenB**",
    },
  },
  {
    number: "10",
    name: "Rotavirusinės infekcijos vakcina",
    code: "RV",
    doses: {
      "2 mėn.": "RV",
      "4 mėn.": "RV",
      "6 mėn.": "RV*****",
    },
  },
];

type DoseItem = {
  id: string;
  age: AgeColumn;
  vaccineName: string;
  vaccineCode?: string;
  label: string;
};

const allDoses: DoseItem[] = ageColumns.flatMap((age) =>
  schedule2026.flatMap((row) => {
    const label = row.doses[age];
    if (!label) return [];
    return [
      {
        id: `${age}__${row.code ?? row.name}`,
        age,
        vaccineName: row.name,
        vaccineCode: row.code,
        label,
      },
    ];
  })
);

export default function SkiepuKalendoriusPage() {
  const { user } = useAuth();
  const [babyId, setBabyId] = useState<string | null>(null);
  const [isBabyLoading, setIsBabyLoading] = useState(true);
  const [babyError, setBabyError] = useState<string | null>(null);
  const [dateMap, setDateMap] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBabyId(null);
      setIsBabyLoading(false);
      setBabyError(null);
      return;
    }
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
      setBabyId(member?.baby_id ?? null);
      setIsBabyLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !babyId) {
      setDateMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("vaccine_doses")
        .select("dose_key, date")
        .eq("baby_id", babyId);
      if (cancelled || error || !data) return;
      const next: Record<string, string> = {};
      for (const row of data as { dose_key: string; date: string }[]) {
        next[row.dose_key] = row.date;
      }
      setDateMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, babyId]);

  const setDoseDate = async (id: string, value: string) => {
    if (!user || !babyId) return;
    setDateMap((prev) => {
      const next = { ...prev };
      if (!value) {
        delete next[id];
      } else {
        next[id] = value;
      }
      return next;
    });

    if (!value) {
      await supabase
        .from("vaccine_doses")
        .delete()
        .eq("baby_id", babyId)
        .eq("dose_key", id);
    } else {
      await supabase.from("vaccine_doses").upsert(
        {
          baby_id: babyId,
          user_id: user.id,
          dose_key: id,
          date: value,
        },
        { onConflict: "baby_id,dose_key" }
      );
    }
  };

  const sortedDoses = useMemo(() => allDoses, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
              Skiepų kalendorius
            </h1>
            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-3"
            >
              ← Pagrindinis
            </Link>
          </div>
        </section>

        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M8 2v4M16 2v4M3 10h18" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Lietuvos vaikų profilaktinių skiepijimų kalendorius 2026
              </p>
              <p className="text-xs text-slate-600">
                Šis kalendorius sudarytas pagal Lietuvos Respublikos vaikų profilaktinių skiepijimų kalendorių,
                patvirtintą sveikatos apsaugos ministro ir atnaujintą 2026 metams, bei Nacionalinio visuomenės sveikatos
                centro skelbiamą informaciją. Tai yra informacinis vaizdas – dėl individualių skiepų schemų visada
                pasitark su savo šeimos gydytoju ar pediatru.
              </p>
              <p className="inline-block rounded-xl bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-900 ring-1 ring-amber-100">
                Kalendorius parengtas vadovaujantis{" "}
                <a
                  href="https://www.e-tar.lt/portal/lt/legalAct/333a8c10ab9211e88f64a5ecc703f89b/asr"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Lietuvos Respublikos vaikų profilaktinių skiepijimų kalendorių patvirtinančiu įsakymu V‑955
                </a>
                .
              </p>
              <p className="text-[11px] text-slate-500">
                Kiekvienai dozei gali pažymėti, kad skiepas jau atliktas. Žymėjimai saugomi tavo paskyroje konkrečiam
                kūdikiui.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Terminas | vakcina (paspausk eilutę, kad įvestum datą)</span>
          </div>

          <div className="space-y-1.5">
            {sortedDoses.map((dose) => {
              const date = dateMap[dose.id] ?? "";
              const done = !!date;
              return (
                <div
                  key={dose.id}
                  className={`rounded-2xl border px-3 py-2 text-[11px] shadow-sm transition ${
                    done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-100 bg-slate-50/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId((prev) => (prev === dose.id ? null : dose.id))}
                    className="flex w-full items-center gap-1.5 text-left"
                  >
                    <span className="flex-1 font-medium text-slate-800">{dose.age}</span>
                    <span className="flex-[3] truncate text-slate-800">
                      {dose.vaccineName}
                      {dose.vaccineCode && (
                        <span className="ml-1 text-[10px] uppercase text-slate-400">({dose.vaccineCode})</span>
                      )}
                      <span className="ml-1 text-[10px] text-slate-400">{dose.label}</span>
                      {done && (
                        <span className="ml-1 text-[10px] text-emerald-600">
                          • {date}
                        </span>
                      )}
                    </span>
                  </button>
                  {openId === dose.id && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDoseDate(dose.id, e.target.value)}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      />
                      <button
                        type="button"
                        onClick={() => setOpenId(null)}
                        className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-medium text-white shadow-sm transition hover:bg-slate-800"
                      >
                        Patvirtinti
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-1 text-[10px] text-slate-500">
            <p>
              <span className="font-semibold">BCG</span> – tuberkuliozės vakcina;{" "}
              <span className="font-semibold">HepB</span> – hepatito B vakcina;{" "}
              <span className="font-semibold">DTaP</span> – kokliušo, difterijos, stabligės vakcina;{" "}
              <span className="font-semibold">Hib</span> – B tipo Haemophilus influenzae vakcina;{" "}
              <span className="font-semibold">IPV</span> – inaktyvuota poliomielito vakcina;{" "}
              <span className="font-semibold">PCV</span> – pneumokokinės infekcijos vakcina;{" "}
              <span className="font-semibold">MMR</span> – tymų, epideminio parotito ir raudonukės vakcina;{" "}
              <span className="font-semibold">HPV</span> – žmogaus papilomos viruso vakcina;{" "}
              <span className="font-semibold">MenB</span> – B tipo meningokokinės infekcijos vakcina;{" "}
              <span className="font-semibold">RV</span> – rotavirusinės infekcijos vakcina.
            </p>
            <p>
              Žvaigždutės (*, **, ***, *****) atitinka oficialiame kalendoriuje pateiktas pastabas dėl papildomų
              indikacijų, vakcinų tipų ar schemų. Tikslias pastabas visada tikrink oficialiuose dokumentuose ar
              pasitark su gydytoju.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

