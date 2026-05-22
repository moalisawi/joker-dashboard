"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/auth";
import { logSessionLogout } from "@/lib/sessionLogger";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import {
  Home, Users, ScrollText, LogOut, Menu, X,
  BarChart3, Bell, Briefcase, Users2, FileText, BookOpen, Shield, CreditCard,
  MessageSquare, MessageCircle,
} from "lucide-react";

interface NavItem {
  href:        string;
  label:       string;
  icon:        React.ReactNode;
  permission?: "canManageUsers" | "canViewLogs" | "canManagePaymentMethods";
  badge?:      () => number;
  roles?:      string[];
}

export default function Sidebar() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, can }     = useAuthStore();
  const { unreadCount }   = useNotificationStore();
  const [open, setOpen]   = useState(false);

  const uid = user?.uid ?? "";

  const NAV: NavItem[] = [
    { href: "/",                 label: "لوحة التحكم",    icon: <Home           size={18} /> },
    { href: "/subscribers",      label: "المشتركون",      icon: <Users          size={18} /> },
    { href: "/whatsapp-leads",               label: "واتساب ليدز",  icon: <MessageSquare  size={18} /> },
    { href: "/whatsapp-leads/conversations", label: "المحادثات",    icon: <MessageCircle  size={18} /> },
    { href: "/payment-methods",  label: "طرق الدفع",      icon: <CreditCard     size={18} />, permission: "canManagePaymentMethods" },
    { href: "/analytics",        label: "التحليلات",      icon: <BarChart3  size={18} /> },
    { href: "/reports",          label: "التقارير",       icon: <FileText   size={18} />, roles: ["owner", "admin"] },
    { href: "/notifications",    label: "الإشعارات",      icon: <Bell       size={18} />, badge: () => unreadCount(uid) },
    { href: "/admin/employees",  label: "الموظفون",       icon: <Briefcase  size={18} />, permission: "canManageUsers" },
    { href: "/admin/teams",      label: "الفرق",          icon: <Users2     size={18} />, permission: "canManageUsers" },
    { href: "/users",            label: "المستخدمون",     icon: <Users      size={18} />, permission: "canManageUsers" },
    { href: "/logs",             label: "سجل العمليات",   icon: <ScrollText size={18} />, permission: "canViewLogs" },
    { href: "/sessions",         label: "سجل الجلسات",   icon: <Shield     size={18} />, roles: ["owner", "admin"] },
    { href: "/guide",            label: "دليل الاستخدام", icon: <BookOpen   size={18} /> },
  ];

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
      background: "var(--bg-sidebar)",
    }}>

      {/* Logo */}
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: "#5B5FEF",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#fff", fontSize: 22, fontWeight: 800,
        fontFamily: "inherit",
        boxShadow: "0 6px 16px rgba(91,95,239,0.30)",
        marginBottom: 4, flexShrink: 0,
        userSelect: "none",
      }}>ج</div>

      {/* Nav pill */}
      <div style={{
        flex: 1,
        display: "flex", flexDirection: "column", gap: 8,
        padding: "14px 0", alignItems: "center",
        background: "rgba(255,255,255,.60)",
        backdropFilter: "blur(12px) saturate(1.4)",
        WebkitBackdropFilter: "blur(12px) saturate(1.4)",
        border: "1px solid rgba(255,255,255,.75)",
        borderRadius: 999,
        boxShadow: "0 2px 8px rgba(16,20,26,.06), 0 1px 2px rgba(16,20,26,.04)",
        width: 56,
        overflowY: "auto",
        scrollbarWidth: "none",
      }}>
        {visibleItems.map((item) => {
          const active     = isActive(item.href);
          const badgeCount = item.badge?.() ?? 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              title={item.label}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: active ? "#5B5FEF" : "transparent",
                color: active ? "#fff" : "#111827",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", flexShrink: 0,
                boxShadow: active ? "0 6px 16px rgba(91,95,239,0.30)" : "none",
                transition: "all .15s ease",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(16,20,26,.06)"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              {item.icon}

              {badgeCount > 0 && (
                <span style={{
                  position: "absolute", top: 5, insetInlineEnd: 5,
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#EF4444",
                  boxShadow: "0 0 0 2px rgba(232,234,238,.9)",
                }} />
              )}
            </Link>
          );
        })}
      </div>

      {/* Bottom: logout */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
        <button
          onClick={handleLogout}
          title="تسجيل الخروج"
          style={{
            width: 42, height: 42, borderRadius: "50%",
            background: "rgba(255,255,255,.55)",
            border: "1px solid rgba(255,255,255,.75)",
            color: "#EF4444", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s ease",
            boxShadow: "0 1px 3px rgba(16,20,26,.08)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,.10)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.55)"; }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 md:hidden p-2 text-white shadow-lg"
        style={{ background: "#5B5FEF", borderRadius: 999, boxShadow: "0 6px 16px rgba(91,95,239,0.30)" }}
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed right-0 top-0 h-full z-50 md:hidden transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
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
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block h-screen sticky top-0 flex-shrink-0">
        {railContent}
      </div>
    </>
  );
}
