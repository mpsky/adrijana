"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";

type QuestionEntry = {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
};

export default function KlausimaiPage() {
  const { user } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");

  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchQuestions = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("questions")
      .select("id, question, answer, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadError(error.message);
      setIsLoading(false);
      return;
    }

    setQuestions(
      (data || []).map((row: { id: string; question: string; answer: string | null; created_at: string }) => ({
        id: row.id,
        question: row.question,
        answer: row.answer ?? "",
        createdAt: row.created_at,
      }))
    );
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem("baby-diary-unlocked-v1") === "true") {
      setUnlocked(true);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    fetchQuestions();
  }, [unlocked, fetchQuestions]);

  const addQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = newQuestion.trim();
    if (!q) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const createdAt = new Date().toISOString();

    setQuestions((prev) => [
      ...prev,
      { id, question: q, answer: "", createdAt },
    ]);
    setNewQuestion("");

    const { error } = await supabase.from("questions").insert({
      id,
      user_id: user?.id ?? undefined,
      question: q,
      answer: "",
    });

    if (error) {
      setQuestions((prev) => prev.filter((item) => item.id !== id));
      setNewQuestion(q);
      alert("Nepavyko išsaugoti: " + error.message);
    }
  };

  const setAnswerLocal = (id: string, answer: string) => {
    setQuestions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, answer } : item))
    );
  };

  const saveAnswer = async (id: string, answer: string) => {
    setSavingId(id);
    const { error } = await supabase
      .from("questions")
      .update({ answer })
      .eq("id", id);
    setSavingId(null);

    if (error) {
      alert("Nepavyko išsaugoti atsakymo: " + error.message);
      fetchQuestions();
    }
  };

  const removeQuestion = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("Ištrinti šį klausimą?")) return;

    const prev = questions;
    setQuestions((cur) => cur.filter((q) => q.id !== id));

    const { error } = await supabase.from("questions").delete().eq("id", id);

    if (error) {
      alert("Klaida trinant: " + error.message);
      setQuestions(prev);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen text-slate-900">
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-rose-50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-lg ring-1 ring-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <rect x="5" y="11" width="14" height="9" rx="2" fill="currentColor" opacity="0.9" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Užraktas</p>
                <p className="text-sm font-medium text-slate-800">Įvesk prieigos kodą</p>
              </div>
            </div>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (codeInput.trim() === "1337") {
                  setUnlocked(true);
                  setCodeError("");
                  window.localStorage.setItem("baby-diary-unlocked-v1", "true");
                } else {
                  setCodeError("Neteisingas kodas. Bandyk dar kartą.");
                }
              }}
            >
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600">Kodas</label>
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
              {codeError && <p className="text-[11px] text-rose-600">{codeError}</p>}
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700"
              >
                Atrakinti
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900">
      <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href="/" className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 shadow-sm transition hover:bg-sky-600 hover:text-white">
                Pradžia
              </Link>
              <Link href="/archive" className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 shadow-sm transition hover:bg-sky-600 hover:text-white">
                Archyvas
              </Link>
              <Link href="/svoris" className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 shadow-sm transition hover:bg-rose-600 hover:text-white">
                Svoris
              </Link>
              <Link href="/admin" className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-medium text-white shadow-sm transition hover:bg-slate-800">
                Nustatymai
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-100 backdrop-blur sm:p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                Klausimai daktarui
              </p>
              <p className="text-xs text-slate-500">
                Užsirašyk klausimus prieš vizitą. Atsakymai saugomi duomenų bazėje.
              </p>
            </div>
          </div>

          <form onSubmit={addQuestion} className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Pridėk klausimą..."
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-100"
            />
            <button
              type="submit"
              disabled={!newQuestion.trim()}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pridėti klausimą
            </button>
          </form>

          <div className="mt-6 space-y-4">
            {isLoading ? (
              <p className="text-sm text-slate-500">Kraunama...</p>
            ) : loadError ? (
              <p className="text-sm text-rose-600">
                Klaida įkeliant klausimus: {loadError}
              </p>
            ) : questions.length === 0 ? (
              <p className="text-sm text-slate-500">
                Dar nėra klausimų. Pridėk klausimą, kurį norėtum užduoti daktarui, o atsakymą įrašyk po vizito.
              </p>
            ) : (
              [...questions].reverse().map((q) => (
                <div
                  key={q.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{q.question}</p>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Ištrinti klausimą"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-3">
                    <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Atsakymas (po vizito pas daktarą)
                      {savingId === q.id && (
                        <span className="ml-1 text-amber-600">Saugoma...</span>
                      )}
                    </label>
                    <textarea
                      value={q.answer}
                      onChange={(e) => setAnswerLocal(q.id, e.target.value)}
                      onBlur={(e) => saveAnswer(q.id, e.target.value)}
                      placeholder="Įrašyk atsakymą po vizito..."
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    />
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
