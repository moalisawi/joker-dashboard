"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/auth";
import { logFailedLogin } from "@/lib/sessionLogger";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const msg  = err instanceof Error ? err.message : "فشل تسجيل الدخول، تحقق من البيانات";
      const code = (err as { code?: string }).code ?? msg;

      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else if (msg.includes("too-many-requests")) {
        setError("تم تعليق الحساب مؤقتاً بسبب محاولات متعددة، حاول لاحقاً");
      } else if (msg.includes("network") || msg.includes("fetch")) {
        setError("خطأ في الاتصال بالشبكة، يرجى المحاولة مرة أخرى");
      } else {
        setError("حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى");
      }

      logFailedLogin(email, code).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0f0c29 0%, #1a1050 40%, #24243e 100%)" }}>
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "rgba(139,92,246,0.6)", borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0f0c29 0%, #1a1050 45%, #24243e 100%)",
      }}
    >
      {/* ── Ambient orbs ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 20% 20%, rgba(91,95,239,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at 80% 80%, rgba(139,92,246,0.14) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 50% 50%, rgba(79,70,229,0.08) 0%, transparent 70%)
          `,
        }}
      />

      {/* ── Noise texture overlay ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          opacity: 0.025,
        }}
      />

      {/* ── Floating decorative grid lines ── */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── Main card container ── */}
      <motion.div
        className="w-full max-w-sm relative z-10"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
        }}
      >
        {/* ── Branding ── */}
        <motion.div
          className="text-center mb-7"
          variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }}
        >
          {/* Logo */}
          <div className="relative inline-flex items-center justify-center mb-5">
            {/* Glow ring */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-3xl"
              style={{
                background: "radial-gradient(circle, rgba(91,95,239,0.5) 0%, transparent 70%)",
                filter: "blur(18px)",
                transform: "scale(1.6)",
              }}
            />
            <motion.div
              className="relative flex items-center justify-center w-[72px] h-[72px]"
              initial={{ scale: 0.6, opacity: 0, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.06 }}
              style={{
                background: "linear-gradient(145deg, #6366f1, #4f46e5)",
                borderRadius: 22,
                boxShadow: "0 8px 32px rgba(91,95,239,0.50), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <span className="text-white font-black text-[28px]" style={{ lineHeight: 1 }}>ج</span>
            </motion.div>
          </div>

          <h1
            className="font-black text-[26px] leading-tight"
            style={{
              color: "#FFFFFF",
              letterSpacing: "-0.03em",
              textShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            لوحة التحكم
          </h1>
          <p
            className="text-sm mt-1.5 font-medium tracking-wide"
            style={{ color: "rgba(199,210,254,0.75)" }}
          >
            إدارة مشتركين الجوكر
          </p>
        </motion.div>

        {/* ── Glass card ── */}
        <motion.div
          variants={{ hidden: { opacity: 0, y: 28 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } }}
          className="relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(28px) saturate(1.4)",
            WebkitBackdropFilter: "blur(28px) saturate(1.4)",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.10)",
            padding: "32px 30px 28px",
          }}
        >
          {/* Inner top shimmer */}
          <div
            aria-hidden
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)" }}
          />

          <h2
            className="text-base font-bold mb-6 text-center"
            style={{ color: "rgba(255,255,255,0.92)", letterSpacing: "-0.01em" }}
          >
            تسجيل الدخول
          </h2>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="login-error"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="mb-4 overflow-hidden"
              >
                <div
                  className="flex items-center gap-2 p-3 text-sm font-medium"
                  style={{
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.28)",
                    borderRadius: 14,
                    color: "#fca5a5",
                  }}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email field */}
            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{ color: "rgba(199,210,254,0.80)", letterSpacing: "0.02em" }}
              >
                البريد الإلكتروني
              </label>
              <motion.div
                animate={focusedField === "email" ? { scale: 1.005 } : { scale: 1 }}
                transition={{ duration: 0.18 }}
                style={{
                  borderRadius: 14,
                  boxShadow: focusedField === "email"
                    ? "0 0 0 3px rgba(99,102,241,0.35), 0 2px 8px rgba(0,0,0,0.2)"
                    : "0 2px 6px rgba(0,0,0,0.15)",
                  transition: "box-shadow 0.22s ease",
                }}
              >
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="example@email.com"
                  dir="ltr"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: focusedField === "email" ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${focusedField === "email" ? "rgba(99,102,241,0.50)" : "rgba(255,255,255,0.10)"}`,
                    borderRadius: 14,
                    color: "#FFFFFF",
                    fontSize: 14,
                    outline: "none",
                    transition: "all 0.22s ease",
                    letterSpacing: "0.01em",
                  }}
                  className="placeholder:text-white/25"
                />
              </motion.div>
            </div>

            {/* Password field */}
            <div>
              <label
                className="block text-xs font-semibold mb-2"
                style={{ color: "rgba(199,210,254,0.80)", letterSpacing: "0.02em" }}
              >
                كلمة المرور
              </label>
              <motion.div
                animate={focusedField === "password" ? { scale: 1.005 } : { scale: 1 }}
                transition={{ duration: 0.18 }}
                style={{
                  borderRadius: 14,
                  boxShadow: focusedField === "password"
                    ? "0 0 0 3px rgba(99,102,241,0.35), 0 2px 8px rgba(0,0,0,0.2)"
                    : "0 2px 6px rgba(0,0,0,0.15)",
                  transition: "box-shadow 0.22s ease",
                }}
              >
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  dir="ltr"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: focusedField === "password" ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.06)",
                    border: `1px solid ${focusedField === "password" ? "rgba(99,102,241,0.50)" : "rgba(255,255,255,0.10)"}`,
                    borderRadius: 14,
                    color: "#FFFFFF",
                    fontSize: 14,
                    outline: "none",
                    transition: "all 0.22s ease",
                    letterSpacing: "0.08em",
                  }}
                  className="placeholder:text-white/25"
                />
              </motion.div>
            </div>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={submitting}
              className="w-full relative overflow-hidden"
              style={{
                marginTop: 8,
                padding: "13px 20px",
                borderRadius: 14,
                background: submitting
                  ? "rgba(99,102,241,0.5)"
                  : "linear-gradient(135deg, #6366f1, #4f46e5 60%, #4338ca)",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: submitting
                  ? "none"
                  : "0 6px 24px rgba(79,70,229,0.55), 0 2px 8px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
                color: "#FFFFFF",
                fontSize: 14.5,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "all 0.22s ease",
              }}
              whileHover={submitting ? {} : { y: -2, boxShadow: "0 10px 32px rgba(79,70,229,0.7), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)" }}
              whileTap={submitting ? {} : { y: 0, scale: 0.98 }}
              transition={{ duration: 0.16 }}
            >
              {/* Button shimmer */}
              {!submitting && (
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)",
                  }}
                />
              )}

              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري الدخول...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  دخول
                  <svg className="w-4 h-4 opacity-75" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                  </svg>
                </span>
              )}
            </motion.button>
          </form>
        </motion.div>

        {/* Footer */}
        <motion.p
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { duration: 0.5, delay: 0.35 } } }}
          className="text-center text-xs mt-6 font-medium"
          style={{ color: "rgba(148,163,184,0.45)" }}
        >
          نظام الجوكر — لوحة إدارة المشتركين © 2026
        </motion.p>

        <motion.div
          variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5, delay: 0.45 } } }}
          className="mt-4"
        >
          <a
            href="/pitch"
            className="w-full flex items-center justify-center gap-2 font-bold transition-all duration-200"
            style={{
              padding: "13px 20px",
              borderRadius: 14,
              background: "rgba(165,180,252,0.08)",
              border: "1px solid rgba(165,180,252,0.22)",
              color: "rgba(165,180,252,0.90)",
              fontSize: 14.5,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = "rgba(165,180,252,0.14)";
              el.style.borderColor = "rgba(165,180,252,0.40)";
              el.style.color = "#FFFFFF";
              el.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.background = "rgba(165,180,252,0.08)";
              el.style.borderColor = "rgba(165,180,252,0.22)";
              el.style.color = "rgba(165,180,252,0.90)";
              el.style.transform = "translateY(0)";
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            شوف كيف يشتغل النظام
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}
