"use client";

import { useEffect } from "react";
import { getBabyInfo } from "@/lib/babyStorage";

export function DocumentTitle() {
  useEffect(() => {
    const { name } = getBabyInfo();
    document.title = name ? `${name} – dienoraštis` : "Adrijana";
  }, []);
  return null;
}
