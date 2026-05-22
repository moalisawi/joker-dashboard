"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Mail, Search } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useSearchStore } from "@/store/searchStore";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";

interface NavLink {
  href:   string;
  label:  string;
  gate?:  "canManageUsers" | "canViewLogs" | "canViewRevenue";
  roles?: string[];
}

const NAV_LINKS: NavLink[] = [
  { href: "/",               label: "المشتركون" },
  { href: "/analytics",      label: "التحليلات",     gate: "canViewRevenue" },
  { href: "/admin/employees",label: "الموظفون",      gate: "canManageUsers" },
  { href: "/admin/teams",    label: "الفرق",          gate: "canManageUsers" },
  { href: "/logs",           label: "سجل العمليات",  gate: "canViewLogs" },
  { href: "/reports",        label: "التقارير",       roles: ["owner", "admin"] },
];

export default function TopNav() {
  const pathname           = usePathname();
  const { user, can }      = useAuthStore();
  const { unreadCount }    = useNotificationStore();
  const { openSearch }     = useSearchStore();
  const [notifOpen, setNotifOpen] = useState(false);

  const uid      = user?.uid ?? "";
  const badgeCount = unreadCount(uid);

  const visibleLinks = NAV_LINKS.filter((l) => {
    if (l.gate  && !can(l.gate))                           return false;
    if (l.roles && (!user || !l.roles.includes(user.role))) return false;
    return true;
  });

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const iconBtn: React.CSSProperties = {
    width: 40, height: 40, borderRadius: "50%",
    background: "var(--jk-surface)",
    border: "1px solid var(--jk-border-strong)",
    color: "var(--jk-text)", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    position: "relative",
    boxShadow: "var(--jk-shadow-flat)",
    transition: "all .15s ease",
    flexShrink: 0,
  } as React.CSSProperties;

  const iconBtnActive: React.CSSProperties = {
    ...iconBtn,
    background: "#10141A",
    color: "#fff",
    borderColor: "#10141A",
    boxShadow: "var(--jk-shadow-nav)",
  };

  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 16,
      padding: "10px 8px 10px 4px",
      marginBottom: 16,
    }}>

      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingInlineEnd: 16, flexShrink: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: "#10141A",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 18, fontWeight: 800,
          fontFamily: "inherit",
          boxShadow: "var(--jk-shadow-logo)",
          flexShrink: 0,
        }}>ج</div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--jk-text)", letterSpacing: "-0.01em", lineHeight: 1 }}>نظام الجوكر</div>
          <div style={{ fontSize: 10.5, color: "var(--jk-muted)", marginTop: 2 }}>إدارة المبيعات</div>
        </div>
      </div>

      {/* Pill nav links */}
      <nav style={{
        flex: 1,
        display: "flex", alignItems: "center", gap: 2,
        overflowX: "auto", scrollbarWidth: "none",
      }}>
        {visibleLinks.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "10px 22px",
                borderRadius: 999,
                background: active ? "#10141A" : "transparent",
                color: active ? "#fff" : "var(--jk-muted)",
                fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                boxShadow: active ? "var(--jk-shadow-nav)" : "none",
                transition: "all .15s ease",
                textDecoration: "none",
                display: "inline-block",
              }}
              onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = "var(--jk-text)"; el.style.background = "rgba(16,20,26,.05)"; } }}
              onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = "var(--jk-muted)"; el.style.background = "transparent"; } }}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      {/* Right cluster */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

        {/* Search */}
        <button onClick={openSearch} title="بحث" style={iconBtn}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--jk-surface-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--jk-surface)"; }}
        >
          <Search size={17} />
        </button>

        {/* Mail / inbox (links to notifications page) */}
        <Link href="/notifications" title="الرسائل" style={{ ...iconBtn, textDecoration: "none" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--jk-surface-hover)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--jk-surface)"; }}
        >
          <Mail size={17} />
        </Link>

        {/* Bell with dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            title="الإشعارات"
            style={notifOpen ? iconBtnActive : iconBtn}
            onMouseEnter={e => { if (!notifOpen) (e.currentTarget as HTMLElement).style.background = "var(--jk-surface-hover)"; }}
            onMouseLeave={e => { if (!notifOpen) (e.currentTarget as HTMLElement).style.background = "var(--jk-surface)"; }}
          >
            <Bell size={17} />
            {badgeCount > 0 && (
              <span style={{
                position: "absolute", top: 2, insetInlineEnd: 2,
                width: 9, height: 9, borderRadius: "50%",
                background: "#CE6969",
                boxShadow: "0 0 0 2px #EBEEF2",
              }} />
            )}
          </button>
          {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
        </div>

        {/* Avatar */}
        {user && (
          <div style={{ marginInlineStart: 4 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "linear-gradient(135deg, #83A2DB, #83A2DBcc)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 15, fontWeight: 700,
              boxShadow: "0 1px 2px rgba(16,20,26,.10), inset 0 1px 0 rgba(255,255,255,.18)",
              position: "relative", cursor: "default", userSelect: "none",
              flexShrink: 0,
            }}>
              {user.name.charAt(0)}
              {/* Online dot */}
              <span style={{
                position: "absolute", bottom: 1, insetInlineEnd: 1,
                width: 10, height: 10, borderRadius: "50%",
                background: "#22C55E",
                border: "2px solid #E8EAEE",
                boxShadow: "0 0 0 1px rgba(34,197,94,.25)",
              }} />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
