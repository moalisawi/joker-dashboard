"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/auth";
import { logSessionLogout } from "@/lib/sessionLogger";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";
import { NAV_ITEMS, type NavItem as SharedNavItem } from "./navItems";

type NavItem = SharedNavItem & { badge?: () => number };

interface TooltipState {
  label: string;
  icon:  React.ReactNode;
  y:     number;
}

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, can }     = useAuthStore();
  const { unreadCount }   = useNotificationStore();
  const [open, setOpen]   = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const uid = user?.uid ?? "";

  // The list itself lives in navItems.tsx so TopNav reads the same one. Only the
  // unread badge is added here, since it needs this component's store.
  const NAV: NavItem[] = NAV_ITEMS.map((item) =>
    item.href === "/notifications" ? { ...item, badge: () => unreadCount(uid) } : item,
  );

  async function handleLogout() {
    await logSessionLogout();
    await signOut(auth);
    router.push("/login");
  }

  const visibleItems = NAV.filter((item) => {
    if (item.permission && !can(item.permission)) return false;
    if (item.roles && (!user || !item.roles.includes(user.role))) return false;
    return true;
  });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  function showTooltip(e: React.MouseEvent, label: string, icon: React.ReactNode) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ label, icon, y: rect.top + rect.height / 2 });
  }

  const railContent = (
    <aside style={{
      width: 80,
      padding: "20px 0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 14,
      flexShrink: 0,
      height: "100%",
      background: "transparent",
    }}>

      {/* Logo */}
      <motion.div
        whileHover={{ scale: 1.08, rotate: 3 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        style={{
          width: 46, height: 46, borderRadius: 14,
          background: "linear-gradient(135deg, #5B5FEF, #4338CA)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 21, fontWeight: 800,
          fontFamily: "inherit",
          boxShadow: "0 6px 20px rgba(91,95,239,0.38)",
          marginBottom: 4, flexShrink: 0,
          userSelect: "none",
          cursor: "pointer",
        }}
      >
        ج
      </motion.div>

      {/* Nav pill */}
      <div style={{
        flex: 1,
        display: "flex", flexDirection: "column", gap: 6,
        padding: "12px 0", alignItems: "center",
        background: "rgba(255,255,255,0.62)",
        backdropFilter: "blur(16px) saturate(1.6)",
        WebkitBackdropFilter: "blur(16px) saturate(1.6)",
        border: "1px solid rgba(255,255,255,0.78)",
        borderRadius: 999,
        boxShadow: "0 2px 12px rgba(16,20,26,.07), 0 1px 3px rgba(16,20,26,.04)",
        width: 56,
        overflowY: "auto",
        overflowX: "visible",
        scrollbarWidth: "none",
      }}>
        {visibleItems.map((item, i) => {
          const active     = isActive(item.href);
          const badgeCount = item.badge?.() ?? 0;
          // A rail of icons cannot carry group headings, so the bands are shown
          // as separators instead — structure without labels.
          const startsBand = i > 0 && visibleItems[i - 1].group !== item.group;

          return (
            <Fragment key={item.href}>
            {startsBand && (
              <div aria-hidden="true" style={{
                height: 1, margin: "7px 12px", background: "var(--jk-divider)", flexShrink: 0,
              }} />
            )}
            <Link
              href={item.href}
              onClick={() => setOpen(false)}
              onMouseEnter={(e) => showTooltip(e, item.label, item.icon)}
              onMouseLeave={() => setTooltip(null)}
              style={{
                width: 40, height: 40, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", flexShrink: 0,
                color: active ? "#fff" : "#6B7280",
                textDecoration: "none",
                transition: "color .15s ease",
              }}
            >
              {/* Active background */}
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "linear-gradient(135deg, #5B5FEF, #4338CA)",
                    boxShadow: "0 4px 14px rgba(91,95,239,0.38)",
                  }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}

              {/* Hover background */}
              {!active && (
                <motion.span
                  className="sidebar-hover-bg"
                  whileHover={{ opacity: 1 }}
                  initial={{ opacity: 0 }}
                  style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "rgba(91,95,239,0.09)",
                  }}
                />
              )}

              <span style={{ position: "relative", zIndex: 1, display: "flex" }}>
                {item.icon}
              </span>

              {badgeCount > 0 && (
                <span style={{ position: "absolute", top: 4, insetInlineEnd: 4, zIndex: 2 }}>
                  <motion.span
                    style={{
                      position: "absolute", inset: -2, borderRadius: "50%",
                      background: "#EF4444", display: "block",
                    }}
                    animate={{ scale: [1, 2.4, 2.4], opacity: [0.5, 0, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", times: [0, 0.55, 1] }}
                  />
                  <span style={{
                    display: "block", width: 8, height: 8, borderRadius: "50%",
                    background: "#EF4444",
                    boxShadow: "0 0 0 2px rgba(232,234,238,.95)",
                    position: "relative",
                  }} />
                </span>
              )}
            </Link>
            </Fragment>
          );
        })}
      </div>

      {/* Logout */}
      <motion.button
        onClick={handleLogout}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onMouseEnter={(e) => showTooltip(e, "تسجيل الخروج", <LogOut size={16} />)}
        onMouseLeave={() => setTooltip(null)}
        style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.18)",
          color: "#EF4444", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .15s ease",
        }}
      >
        <LogOut size={16} />
      </motion.button>

      {/* Premium hover tooltip panel */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, x: -6, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -4, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.6 }}
            style={{
              position: "fixed",
              right: 90,
              top: tooltip.y,
              transform: "translateY(-50%)",
              zIndex: 9999,
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
              gap: 0,
            }}
          >
            {/* Arrow */}
            <span style={{
              width: 0, height: 0,
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              borderLeft: "7px solid rgba(255,255,255,0.97)",
              filter: "drop-shadow(1px 0 2px rgba(0,0,0,0.06))",
              flexShrink: 0,
            }} />
            {/* Panel */}
            <div style={{
              background: "rgba(255,255,255,0.97)",
              backdropFilter: "blur(20px) saturate(1.8)",
              WebkitBackdropFilter: "blur(20px) saturate(1.8)",
              border: "1px solid rgba(229,231,235,0.9)",
              borderRadius: 12,
              padding: "9px 14px 9px 12px",
              boxShadow: "0 8px 32px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 9,
              whiteSpace: "nowrap",
              fontFamily: "var(--font-cairo)",
            }}>
              <span style={{
                width: 30, height: 30, borderRadius: "50%",
                background: "rgba(91,95,239,0.10)",
                border: "1px solid rgba(91,95,239,0.18)",
                color: "#5B5FEF",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {tooltip.icon}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: "#111827",
                letterSpacing: "0.005em",
              }}>
                {tooltip.label}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 md:hidden p-2 text-white shadow-lg"
        style={{
          background: "linear-gradient(135deg, #5B5FEF, #4338CA)",
          borderRadius: 999,
          boxShadow: "0 6px 16px rgba(91,95,239,0.38)",
        }}
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed right-0 top-0 h-full z-50 md:hidden"
          >
            <div className="relative h-full">
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 left-4 z-10 p-1"
                style={{ color: "#111827" }}
              >
                <X size={20} />
              </button>
              {railContent}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <div className="hidden md:block h-screen sticky top-0 flex-shrink-0">
        {railContent}
      </div>
    </>
  );
}
