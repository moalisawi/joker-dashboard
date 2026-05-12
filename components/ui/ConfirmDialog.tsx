"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  destructive?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "تأكيد",
  cancelLabel  = "إلغاء",
  loading,
  destructive  = false,
}: Props) {
  const accent = destructive ? "#f43f5e" : "#6366f1";

  return (
    <AnimatePresence>
      {open && (
        <div
          className="modal-overlay"
          onClick={onClose}
          style={{ zIndex: 60 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1,    y: 0 }}
            exit={{   opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.18 }}
            className="modal-panel max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 left-4 p-1 rounded-lg opacity-40 hover:opacity-70 transition-opacity"
              style={{ color: "var(--text-secondary)" }}
            >
              <X size={15} />
            </button>

            <div className="flex items-start gap-4 mb-4">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${accent}15` }}
              >
                <AlertTriangle size={18} style={{ color: accent }} />
              </div>
              <div>
                <p className="font-bold text-base leading-snug" style={{ color: "var(--text-primary)" }}>
                  {title}
                </p>
                {description && (
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition disabled:opacity-60"
                style={{ background: accent }}
              >
                {loading ? "جاري..." : confirmLabel}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl border font-semibold text-sm transition"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {cancelLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
