"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/auth";
import { logSessionLogout } from "@/lib/sessionLogger";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { ROLE_LABELS } from "@/lib/permissions";
import {
  Home, Users, ScrollText, LogOut, Menu, X,
  ChevronLeft, BarChart3, Bell, Briefcase, Users2, FileText, Search, BookOpen, Shield,
} from "lucide-react";
import NotificationBell from "@/components/notifications/NotificationBell";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { useSearchStore } from "@/store/searchStore";

interface NavItem {
  href:       string;
  label:      string;
  icon:       React.ReactNode;
  permission?: "canManageUsers" | "canViewLogs";
  badge?:     () => number;
  roles?:     string[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, can }          = useAuthStore();
  const { unreadCount }        = useNotificationStore();
  const [open, setOpen]        = useState(false);

  const uid = user?.uid ?? "";
  const { openSearch } = useSearchStore();

  const NAV: NavItem[] = [
    { href: "/",               label: "المشتركون",    icon: <Home       size={18} /> },
    { href: "/analytics",      label: "التحليلات",    icon: <BarChart3  size={18} /> },
    { href: "/reports",        label: "التقارير",     icon: <FileText   size={18} />, roles: ["owner", "admin"] },
    { href: "/notifications",  label: "الإشعارات",    icon: <Bell       size={18} />, badge: () => unreadCount(uid) },
    { href: "/admin/employees", label: "الموظفون",     icon: <Briefcase  size={18} />, permission: "canManageUsers" },
    { href: "/admin/teams",    label: "الفرق",        icon: <Users2     size={18} />, permission: "canManageUsers" },
    { href: "/users",          label: "المستخدمون",   icon: <Users      size={18} />, permission: "canManageUsers" },
    { href: "/logs",           label: "سجل العمليات", icon: <ScrollText size={18} />, permission: "canViewLogs" },
    { href: "/sessions",      label: "سجل الجلسات",  icon: <Shield     size={18} />, roles: ["owner", "admin"] },
    { href: "/guide",          label: "دليل الاستخدام", icon: <BookOpen   size={18} /> },
  ];

  async function handleLogout() {
    await logSessionLogout(); // mark session as logged_out before token is gone
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

  const sidebarContent = (
    <aside className="sidebar-bg h-full w-64 flex flex-col text-white select-none">

      {/* Logo + bell */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.4)" }}>
            <span className="font-black text-lg text-white">ج</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm leading-tight text-white">نظام الجوكر</p>
            <p className="text-white/40 text-xs mt-0.5 font-medium">نظام إدارة المبيعات</p>
          </div>
          {/* Quick-access notification bell */}
          <NotificationBell />
        </div>
      </div>

      {/* Global search trigger */}
      <div className="px-3 pt-4 pb-1">
        <button
          onClick={openSearch}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors text-white/40 hover:text-white/75 hover:bg-white/[0.07]"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Search size={14} className="shrink-0" />
          <span className="flex-1 text-right">بحث سريع</span>
          <span className="flex items-center gap-0.5 opacity-60">
            <kbd className="text-[9px] font-bold bg-white/10 rounded px-1 py-0.5">Ctrl</kbd>
            <kbd className="text-[9px] font-bold bg-white/10 rounded px-1 py-0.5">K</kbd>
          </span>
        </button>
      </div>

      {/* Section label */}
      <div className="px-5 pt-3 pb-1">
        <p className="section-label opacity-40 text-white">التنقل</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 pb-4 space-y-0.5">
        {visibleItems.map((item) => {
          const active      = isActive(item.href);
          const badgeCount  = item.badge?.() ?? 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`
                relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold
                transition-all duration-200 group
                ${active
                  ? "text-white"
                  : "text-white/55 hover:bg-white/[0.07] hover:text-white/90"
                }
              `}
              style={active ? {
                background: "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.07) 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 0 16px rgba(96,165,250,0.08)",
              } : {}}
            >
              {/* Active right accent bar */}
              {active && (
                <span
                  className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-l-full bg-blue-400"
                  style={{ boxShadow: "0 0 10px rgba(96,165,250,0.7), 0 0 4px rgba(96,165,250,0.5)" }}
                />
              )}

              <span className={`flex-shrink-0 transition-colors ${active ? "text-blue-300" : "text-white/50 group-hover:text-white/75"}`}>
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>

              {/* Unread badge on nav item */}
              {badgeCount > 0 && (
                <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}

              {active && badgeCount === 0 && (
                <ChevronLeft size={13} className="opacity-50 flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User info & logout */}
      <div className="border-t border-white/[0.06] p-4 space-y-3">
        {user && (
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0 text-blue-300 text-sm font-black">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate leading-tight">{user.name}</p>
              <p className="text-xs text-white/40 font-medium">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
        )}

        <ThemeToggle />

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/40 hover:bg-red-500/15 hover:text-red-300 text-sm font-semibold transition-all duration-150"
        >
          <LogOut size={15} />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-50 md:hidden p-2 rounded-xl text-white shadow-lg"
        style={{ background: "linear-gradient(135deg, #1e3a8a, #1e40af)" }}
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
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
            className="absolute top-4 left-4 text-white/60 hover:text-white z-10 p-1"
          >
            <X size={20} />
          </button>
          {sidebarContent}
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block h-screen sticky top-0 flex-shrink-0">
        {sidebarContent}
      </div>
    </>
  );
}
