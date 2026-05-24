"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/auth";
import { logFailedLogin } from "@/lib/sessionLogger";
import { useAuthStore } from "@/store/authStore";
import { staggerContainer, fadeUpVariants } from "@/lib/animations";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      // redirect handled by useEffect above
    } catch (err: unknown) {
      const msg  = err instanceof Error ? err.message : "فشل تسجيل الدخول، تحقق من البيانات";
      const code = (err as { code?: string }).code ?? msg;

      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      } else if (msg.includes("too-many-requests")) {
        setError("تم حظر الحساب مؤقتاً بسبب محاولات متعددة، حاول لاحقاً");
      } else if (msg.includes("network") || msg.includes("fetch")) {
        setError("خطأ في الاتصال بالشبكة، يرجى المحاولة مرة أخرى");
      } else {
        setError("حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى");
      }

      // Log failed attempt server-side (non-blocking)
      logFailedLogin(email, code).catch(() => {});
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--page-bg)" }}>
        <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: "#5B5FEF", borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--page-bg)" }}
    >
      <motion.div
        className="w-full max-w-sm"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Logo */}
        <motion.div variants={fadeUpVariants} className="text-center mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-16 h-16 mb-4"
            initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.05 }}
            style={{
              background: "#5B5FEF",
              borderRadius: 18,
              boxShadow: "0 6px 16px rgba(91,95,239,0.30)",
            }}
          >
            <span className="text-white font-black text-2xl">ج</span>
          </motion.div>
          <h1 className="text-2xl font-black" style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}>نظام الجوكر</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>إدارة مشتركي الأكاديمية</p>
        </motion.div>

        {/* Card */}
        <motion.div
          variants={fadeUpVariants}
          className="p-8"
          style={{
            background: "#FFFFFF",
            borderRadius: 28,
            boxShadow: "0px 10px 30px rgba(15,23,42,0.08)",
            border: "1px solid #EEF2F7",
          }}
        >
          <h2 className="text-lg font-bold mb-6 text-center" style={{ color: "var(--text-primary)" }}>تسجيل الدخول</h2>

          <AnimatePresence>
            {error && (
              <motion.div
                key="login-error"
                initial={{ opacity: 0, y: -10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -10, height: 0 }}
                transition={{ duration: 0.22 }}
                className="mb-4 overflow-hidden"
              >
                <div
                  className="p-3 text-sm font-medium"
                  style={{
                    background: "rgba(239,68,68,.10)",
                    border: "1px solid rgba(239,68,68,.25)",
                    borderRadius: "var(--radius-md)",
                    color: "#EF4444",
                  }}
                >
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                البريد الإلكتروني
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                dir="ltr"
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                كلمة المرور
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="form-input"
              />
            </div>

            <motion.button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-2"
              style={{ padding: "13px 20px", fontSize: 14.5, justifyContent: "center" }}
              whileHover={{ scale: submitting ? 1 : 1.02 }}
              whileTap={{ scale: submitting ? 1 : 0.97 }}
              transition={{ duration: 0.15 }}
            >
              {submitting ? "جاري الدخول..." : "دخول"}
            </motion.button>
          </form>
        </motion.div>

        <motion.p variants={fadeUpVariants} className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          نظام إدارة أكاديمية التغذية © 2026
        </motion.p>
      </motion.div>
    </div>
  );
}
