import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/layout/ThemeProvider";
import QueryProvider from "@/components/layout/QueryProvider";
import { Toaster } from "sonner";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
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
      <body className="min-h-screen bg-slate-50" style={{ fontFamily: "var(--font-cairo), sans-serif" }}>
        <QueryProvider>
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
