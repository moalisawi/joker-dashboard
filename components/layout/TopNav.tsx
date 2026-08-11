"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Search} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useSearchStore } from "@/store/searchStore";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";

interface NavLink {
  href:   string;
  label:  string;
  gate?:  "canManageUsers" | "canViewLogs" | "canViewRevenue" | "canManagePaymentMethods";
  roles?: string[];
}

const NAV_LINKS: NavLink[] = [
  { href: "/",               label: "لوحة التحكم" },
  { href: "/subscribers",    label: "المشتركون" },
  { href: "/analytics",      label: "التحليلات",  gate: "canViewRevenue" },
  { href: "/whatsapp-leads", label: "واتساب ليدز" },
  { href: "/payment-methods",label: "طرق الدفع",  gate: "canManagePaymentMethods" },
  { href: "/reports",        label: "التقارير",   roles: ["owner", "admin"] },
];

export default function TopNav() {
  const pathname        = usePathname();
  const { user, can }   = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const { openSearch }  = useSearchStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const uid        = user?.uid ?? "";
  const badgeCount = unreadCount(uid);

  const visibleLinks = NAV_LINKS.filter((l) => {
    if (l.gate  && !can(l.gate))                            return false;
    if (l.roles && (!user || !l.roles.includes(user.role))) return false;
    return true;
  });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const currentPage = visibleLinks.find((l) => isActive(l.href))?.label ?? "لوحة التحكم";

  const iconBtn: React.CSSProperties = {
    width: 36, height: 36, borderRadius: "50%",
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(229,231,235,0.8)",
    color: "#6B7280", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative",
    boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
    transition: "all .15s ease",
    flexShrink: 0,
    backdropFilter: "blur(8px)",
  };

  const iconBtnActive: React.CSSProperties = {
    ...iconBtn,
    background: "#5B5FEF",
    color: "#fff",
    borderColor: "#5B5FEF",
    boxShadow: "0 4px 12px rgba(91,95,239,0.30)",
  };

  return (
    <header className="topnav-header">

      {/* ── MOBILE layout ────────────────────────────────────────── */}
      <div className="topnav-mobile">
        <div style={{ width: 44, flexShrink: 0 }} />
        <span style={{
          flex: 1,
          fontSize: 15, fontWeight: 700, color: "var(--jk-text)",
          textAlign: "center",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {currentPage}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button onClick={openSearch} style={iconBtn}>
            <Search size={15} />
          </button>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              style={notifOpen ? iconBtnActive : iconBtn}
            >
              <Bell size={15} />
              {badgeCount > 0 && (
                <span style={{
                  position: "absolute", top: 1, insetInlineEnd: 1,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#EF4444", border: "2px solid #fff",
                }} />
              )}
            </button>
            {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
          </div>
          {user && (
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #5B5FEF, #4338CA)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 13, fontWeight: 700,
              flexShrink: 0, position: "relative",
              boxShadow: "0 2px 8px rgba(91,95,239,0.30)",
            }}>
              {user.name.charAt(0)}
              <span style={{
                position: "absolute", bottom: 0, insetInlineEnd: 0,
                width: 8, height: 8, borderRadius: "50%",
                background: "#22C55E", border: "2px solid #E8EAEE",
              }} />
            </div>
          )}
        </div>
      </div>

      {/* ── DESKTOP layout ───────────────────────────────────────── */}
      <div className="topnav-desktop">
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingInlineEnd: 14, flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #5B5FEF, #4338CA)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: 17, fontWeight: 800,
            boxShadow: "0 4px 12px rgba(91,95,239,0.30)", flexShrink: 0,
          }}>ج</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", letterSpacing: "-0.015em", lineHeight: 1 }}>
              نظام الجوكر
            </div>
            <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2, fontWeight: 500 }}>
              إدارة المبيعات
            </div>
          </div>
        </div>

        {/* Pill nav */}
        <nav style={{
          flex: 1, display: "flex", alignItems: "center", gap: 2,
          overflowX: "auto", scrollbarWidth: "none",
        }}>
          {visibleLinks.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  padding: "8px 16px", borderRadius: 999,
                  background: "transparent",
                  color: active ? "#fff" : "#6B7280",
                  fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                  transition: "color .15s, background .15s",
                  textDecoration: "none",
                  display: "inline-flex", alignItems: "center",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    const el = e.currentTarget as HTMLElement;
                    el.style.color = "var(--jk-text)";
                    el.style.background = "rgba(16,20,26,.05)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    const el = e.currentTarget as HTMLElement;
                    el.style.color = "#6B7280";
                    el.style.background = "transparent";
                  }
                }}
              >
                {active && (
                  <motion.span
                    layoutId="topnav-active"
                    style={{
                      position: "absolute", inset: 0, borderRadius: 999,
                      background: "linear-gradient(135deg, #5B5FEF, #4338CA)",
                      boxShadow: "0 4px 12px rgba(91,95,239,0.30)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span style={{ position: "relative", zIndex: 1 }}>{l.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right cluster */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

          {/* Live status */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999,
            background: "rgba(34,197,94,0.08)",
            border: "1px solid rgba(34,197,94,0.20)",
          }}>
            <span style={{ position: "relative", display: "flex" }}>
              <motion.span
                style={{
                  position: "absolute", inset: -2, borderRadius: "50%",
                  background: "#22C55E", display: "block",
                }}
                animate={{ scale: [1, 2.5, 2.5], opacity: [0.5, 0, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", times: [0, 0.5, 1] }}
              />
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: "#22C55E", display: "block", position: "relative",
              }} />
            </span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#22C55E" }}>
              النظام يعمل
            </span>
          </div>

          {/* Search */}
          <button
            onClick={openSearch}
            style={iconBtn}
            title="بحث (Ctrl+K)"
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "#fff";
              el.style.color = "#111827";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = "rgba(255,255,255,0.75)";
              el.style.color = "#6B7280";
            }}
          >
            <Search size={15} />
          </button>

          {/* Notifications */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setNotifOpen((v) => !v)}
              style={notifOpen ? iconBtnActive : iconBtn}
              onMouseEnter={e => {
                if (!notifOpen) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "#fff";
                  el.style.color = "#111827";
                }
              }}
              onMouseLeave={e => {
                if (!notifOpen) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background = "rgba(255,255,255,0.75)";
                  el.style.color = "#6B7280";
                }
              }}
            >
              <Bell size={15} />
              {badgeCount > 0 && (
                <span style={{ position: "absolute", top: 2, insetInlineEnd: 2 }}>
                  <motion.span
                    style={{ position: "absolute", inset: -2, borderRadius: "50%", background: "#EF4444", display: "block" }}
                    animate={{ scale: [1, 2.2, 2.2], opacity: [0.55, 0, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut", times: [0, 0.55, 1] }}
                  />
                  <span style={{
                    display: "block", width: 8, height: 8, borderRadius: "50%",
                    background: "#EF4444", boxShadow: "0 0 0 2px #EBEEF2", position: "relative",
                  }} />
                </span>
              )}
            </button>
            {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
          </div>

          {/* User avatar */}
          {user && (
            <div
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg, #5B5FEF, #4338CA)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 14, fontWeight: 800,
                boxShadow: "0 2px 8px rgba(91,95,239,0.30)",
                position: "relative", flexShrink: 0,
                cursor: "pointer",
                transition: "transform .15s ease, box-shadow .15s ease",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "translateY(-1px)";
                el.style.boxShadow = "0 6px 16px rgba(91,95,239,0.40)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement;
                el.style.transform = "none";
                el.style.boxShadow = "0 2px 8px rgba(91,95,239,0.30)";
              }}
              title={user.name}
            >
              {user.name.charAt(0)}
              <span style={{
                position: "absolute", bottom: 1, insetInlineEnd: 1,
                width: 9, height: 9, borderRadius: "50%",
                background: "#22C55E", border: "2px solid #E8EAEE",
              }} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
