import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";
import { AuthGate } from "@/components/AuthGate";
import { BottomNav } from "@/components/BottomNav";
import { DocumentTitle } from "@/components/DocumentTitle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Adrijana",
  description:
    "Adrijanos maitinimo, sauskelnių ir miego sekimo dienoraštis.",
  icons: {
    icon: "/adrijana-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans bg-background text-foreground pb-20`}
      >
        <AuthProvider>
          <DocumentTitle />
          <AuthGate>
            {children}
            <BottomNav />
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
