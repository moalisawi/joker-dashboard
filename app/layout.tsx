import type { Metadata } from "next";
import { Cairo } from "next/font/google";
// globals.css starts with `@import "@heroui/styles"`, so HeroUI arrives through
// it. This file used to import "@heroui/styles/css" as well — the same
// dist/index.css a second time — and Next emitted it as a second stylesheet:
// 408 KB of duplicate CSS on every route, including the login page. Do not
// re-add it; add HeroUI imports to globals.css instead.
import "./globals.css";
import ThemeProvider from "@/components/layout/ThemeProvider";
import QueryProvider from "@/components/layout/QueryProvider";
import AuthProvider from "@/components/layout/AuthProvider";
import NavigationProgress from "@/components/ui/NavigationProgress";
import { Toaster } from "sonner";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-cairo",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "نظام إدارة المشتركين - الجوكر",
  description: "لوحة تحكم إدارة مشتركي أكاديمية التغذية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable} data-scroll-behavior="smooth">
      <body className="min-h-screen">
        <div className="jk-bg-orb-c" aria-hidden="true" />
        <QueryProvider>
          <NavigationProgress />
          <AuthProvider />
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster
            position="top-center"
            dir="rtl"
            richColors
            closeButton
            toastOptions={{ style: { fontFamily: "var(--font-cairo), sans-serif" } }}
          />
        </QueryProvider>
      </body>
    </html>
  );
}
