const STORAGE_KEY = "baby-diary-baby-v1";
const GENDER_KEY = "baby-diary-baby-gender-v1";

export type BabyInfo = {
  name: string;
  birthIso: string;
};

export type BabyGender = "female" | "male" | "";

export function getBabyGender(): BabyGender {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(GENDER_KEY);
    if (raw === "female" || raw === "male") return raw;
  } catch {
    // ignore
  }
  return "";
}

export function setBabyGenderStorage(gender: BabyGender): void {
  if (typeof window === "undefined") return;
  if (gender === "female" || gender === "male") {
    window.localStorage.setItem(GENDER_KEY, gender);
  } else {
    window.localStorage.removeItem(GENDER_KEY);
  }
}

const DEFAULT_BABY: BabyInfo = {
  name: "Adrijana",
  birthIso: "2026-03-04T14:28:00",
};

export function getBabyInfo(): BabyInfo {
  if (typeof window === "undefined") return DEFAULT_BABY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BABY;
    const parsed = JSON.parse(raw) as BabyInfo;
    if (
      parsed &&
      typeof parsed.name === "string" &&
      typeof parsed.birthIso === "string"
    ) {
      return {
        name: parsed.name.trim() || DEFAULT_BABY.name,
        birthIso: parsed.birthIso,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_BABY;
}

export function setBabyInfo(info: BabyInfo): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      name: (info.name || DEFAULT_BABY.name).trim(),
      birthIso: info.birthIso || DEFAULT_BABY.birthIso,
    })
  );
}

export function toLocalDateTimeInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function fromLocalDateTimeInputValue(value: string): string {
  if (!value) return DEFAULT_BABY.birthIso;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? DEFAULT_BABY.birthIso : d.toISOString();
}

