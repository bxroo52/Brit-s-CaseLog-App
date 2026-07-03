import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { PWARegister } from "@/components/PWARegister";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ErrorBoundary } from "@/components/ErrorBoundary";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "CaseLog • Court Visitor Billing",
  description: "Court visitor billing — log once, get paid. Offline-first PWA for Alaska court visitors.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    shortcut: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CaseLog",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "CaseLog",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <OfflineBanner />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <Toaster position="top-center" richColors closeButton theme="dark" />
        <PWARegister />

          {/* ARIA Live Regions for screen reader announcements (visually hidden) */}
          <div
            id="live-region-polite"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          />
          <div
            id="live-region-assertive"
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="sr-only"
          />
      </body>
    </html>
  );
}
