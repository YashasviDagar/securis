import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

/**
 * Securis - Root layout
 *
 * The outermost layout for the whole application. It:
 *   1. Loads the Geist font family (sans + mono). Mono is used for IPs, hashes,
 *      event IDs and log payloads throughout the SOC console.
 *   2. Permanently applies the `dark` class, because Securis ships a dark-only
 *      SOC theme (see app/globals.css).
 *   3. Mounts global providers: `TooltipProvider` (shadcn/ui tooltips) and the
 *      `Toaster` (sonner) used for action feedback.
 *
 * Connection: wraps app/(soc)/layout.tsx (authenticated console) and
 * app/(auth)/layout.tsx (login).
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Securis · Security Operations Platform",
    template: "%s",
  },
  description:
    "Securis is a Security Information and Event Management (SIEM) platform for collecting, detecting, investigating and responding to security events.",
  applicationName: "Securis",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {/* Tooltips require a provider near the root of the tree. */}
        <TooltipProvider delayDuration={200}>
          {children}
          {/* Global toast surface. Themed explicitly because Securis is dark-only. */}
          <Toaster theme="dark" position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
