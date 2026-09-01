"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { navLabelFor } from "./navItems";
import { motion } from "framer-motion";
import { Bell, Search} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useSearchStore } from "@/store/searchStore";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";


export default function TopNav() {
  const pathname        = usePathname();
  const { user }        = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const { openSearch }  = useSearchStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const uid        = user?.uid ?? "";
  const badgeCount = unreadCount(uid);

  // Named from the one shared list, so every page can be named — including the
  // ones TopNav's own six never knew about.
  const currentPage = navLabelFor(pathname) ?? "لوحة التحكم";

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

        {/*
          * The second navigation used to live here: a row of six pill links,
          * a different six from the fifteen in the sidebar. Two menus showing
          * different subsets of the same app is most of why it felt scattered —
          * neither was "the menu", so neither could be trusted to be complete.
          *
          * Navigation is the sidebar's job now. This bar keeps what it is
          * genuinely for: where you are, and the tools that apply everywhere.
          */}
        <div style={{ flex: 1, minWidth: 0, paddingInlineStart: 16 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--jk-text)", whiteSpace: "nowrap" }}>
            {currentPage}
          </span>
        </div>

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
