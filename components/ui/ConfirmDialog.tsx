"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Spinner } from "@heroui/react";

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
  const accent = destructive ? "#EF4444" : "#5B5FEF";

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
              className="absolute top-4 left-4 flex items-center justify-center transition"
              style={{ color: "var(--jk-muted)", width: 36, height: 36, borderRadius: "50%", background: "var(--jk-panel)", border: "none" }}
            >
              <X size={15} />
            </button>

            <div className="flex items-start gap-4 mb-4">
              <div
                className="h-10 w-10 flex items-center justify-center shrink-0"
                style={{ background: `${accent}14`, borderRadius: "50%", border: `1px solid ${accent}28` }}
              >
                <AlertTriangle size={18} style={{ color: accent }} />
              </div>
              <div>
                <p style={{ color: "var(--jk-text)", fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
                  {title}
                </p>
                {description && (
                  <p style={{ color: "var(--jk-muted)", fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
                    {description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={onConfirm}
                disabled={loading}
                className={destructive ? "btn-danger" : "btn-primary"}
                style={{ flex: 1, padding: "11px 20px" }}
              >
                {loading ? <Spinner size="sm" color="current" /> : confirmLabel}
              </button>
              <button
                onClick={onClose}
                disabled={loading}
                className="btn-secondary"
                style={{ flex: 1, padding: "11px 20px" }}
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
