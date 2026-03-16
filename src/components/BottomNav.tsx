"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function BottomNav() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const iconClass = "h-5 w-5 shrink-0";
  const navItems = [
    {
      href: "/",
      label: "Pagrindinis",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className={iconClass}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      label: "Atnaujinti",
      icon: (
        <svg
          viewBox="0 0 24 24"
          className={iconClass}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 21h5v-5" />
        </svg>
      ),
      isButton: true,
    },
  ] as const;

  const quickNavItems = [
    { href: "/svoris", label: "Svoris" },
    { href: "/skiepu-kalendorius", label: "Skiepų kalendorius" },
    { href: "/statistika", label: "Statistika" },
    { href: "/profilis", label: "Profilis" },
  ] as const;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex min-h-[72px] flex-col justify-center border-t border-slate-200 bg-white/95 px-2 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.08)] backdrop-blur supports-[padding:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]"
      aria-label="Pagrindinė navigacija"
    >
      {isMenuOpen && (
        <div className="mb-2 w-full px-1">
          <div className="w-full rounded-2xl bg-white/98 p-2 text-xs shadow-lg ring-1 ring-slate-200">
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Greita navigacija
            </p>
            <div className="flex flex-col gap-1.5">
              {quickNavItems.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center justify-center rounded-xl px-2 py-1.75 text-[11px] font-medium transition ${
                      isActive
                        ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-1 items-end justify-around gap-1 py-2">
        {navItems.map((item) => {
          if ("isButton" in item && item.isButton) {
            return (
              <button
                key="refresh"
                type="button"
                onClick={() => window.location.reload()}
                className="flex flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
                aria-label={item.label}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white hover:bg-slate-700">
                  {item.icon}
                </span>
                <span className="text-[10px] font-medium leading-tight">
                  {item.label}
                </span>
              </button>
            );
          }
          const { href, label, icon } = item as {
            href: string;
            label: string;
            icon: React.ReactNode;
          };
          const isActive =
            pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-full px-2 py-1.5 transition focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 ${
                isActive
                  ? "text-sky-600"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
              aria-label={label}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  isActive ? "bg-sky-100 text-sky-700" : ""
                }`}
              >
                {icon}
              </span>
              <span className="text-[10px] font-medium leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setIsMenuOpen((v) => !v)}
          className="flex flex-col items-center gap-0.5 rounded-full px-2 py-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
          aria-label="Meniu"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-700">
            <svg
              viewBox="0 0 24 24"
              className={iconClass}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </span>
          <span className="text-[10px] font-medium leading-tight">
            Daugiau
          </span>
        </button>
      </div>
    </nav>
  );
}
