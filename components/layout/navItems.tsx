import {
  Home, Users, ScrollText, BarChart3, Bell, Briefcase, Users2, FileText,
  BookOpen, Shield, CreditCard, MessageSquare, MessageCircle, Scale,
  ListChecks, TrendingUp, Trophy,
} from "lucide-react";

/**
 * The navigation. Singular, deliberately.
 *
 * There used to be two: the sidebar rail listing fifteen destinations, and a row
 * of pill links in TopNav listing a different six. Neither was "the menu", so
 * neither could be trusted to be complete — which is most of why the app felt
 * scattered. Worse, two screens disagreeing about what exists meant the header
 * could not even name the page you were on: anything outside TopNav's six, /today
 * and /finance and /sales included, was labelled "لوحة التحكم".
 *
 * Both now read this file. Adding a destination in one place adds it everywhere,
 * and the header can always name where you are.
 *
 * The four bands follow the questions people arrive with — what do I do now, who
 * are my customers, how are we doing, who runs what — rather than the order the
 * features happened to be built in.
 */

export type NavGroup = "today" | "customers" | "money" | "admin";

export interface NavItem {
  href:        string;
  label:       string;
  group:       NavGroup;
  icon:        React.ReactNode;
  permission?: "canManageUsers" | "canViewLogs" | "canManagePaymentMethods" | "canViewRevenue";
  roles?:      string[];
}

export const NAV_ITEMS: NavItem[] = [
  // ── ما أفعله الآن ──
  { href: "/",                 group: "today",     label: "لوحة التحكم",    icon: <Home           size={18} /> },
  { href: "/today",            group: "today",     label: "مهام اليوم",     icon: <ListChecks     size={18} /> },
  { href: "/notifications",    group: "today",     label: "الإشعارات",      icon: <Bell           size={18} /> },

  // ── عملائي ──
  { href: "/subscribers",      group: "customers", label: "المشتركون",      icon: <Users          size={18} /> },
  { href: "/whatsapp-leads",               group: "customers", label: "واتساب ليدز", icon: <MessageSquare size={18} /> },
  { href: "/whatsapp-leads/conversations", group: "customers", label: "المحادثات",   icon: <MessageCircle size={18} /> },

  // ── المال والأداء ──
  { href: "/finance",          group: "money",     label: "المالية",        icon: <Scale      size={18} />, permission: "canViewRevenue" },
  { href: "/analytics",        group: "money",     label: "التحليلات",      icon: <BarChart3  size={18} /> },
  { href: "/reports",          group: "money",     label: "التقارير",       icon: <FileText   size={18} />, roles: ["owner", "admin"] },
  // Both of these existed, worked, and appeared in no menu at all — reachable
  // only by typing the URL. /sales was additionally scoring every employee zero;
  // see features/sales/lib/salesMetrics.ts.
  { href: "/sales",            group: "money",     label: "المبيعات",       icon: <TrendingUp size={18} /> },
  { href: "/leaderboards",     group: "money",     label: "المتصدرون",      icon: <Trophy     size={18} /> },
  { href: "/payment-methods",  group: "money",     label: "طرق الدفع",      icon: <CreditCard size={18} />, permission: "canManagePaymentMethods" },

  // ── من يدير ماذا ──
  // One entry, not two. "الموظفون" and "المستخدمون" pointed at two consoles for
  // the same job; /users is now a redirect here.
  { href: "/admin/employees",  group: "admin",     label: "المستخدمون",     icon: <Briefcase  size={18} />, permission: "canManageUsers" },
  { href: "/admin/teams",      group: "admin",     label: "الفرق",          icon: <Users2     size={18} />, permission: "canManageUsers" },
  { href: "/logs",             group: "admin",     label: "سجل العمليات",   icon: <ScrollText size={18} />, permission: "canViewLogs" },
  { href: "/sessions",         group: "admin",     label: "سجل الجلسات",    icon: <Shield     size={18} />, roles: ["owner", "admin"] },
  { href: "/guide",            group: "admin",     label: "دليل الاستخدام", icon: <BookOpen   size={18} /> },
];

/**
 * The label for a path — longest match wins.
 *
 * "/" prefix-matches everything, so a plain startsWith would name every page
 * "لوحة التحكم", and "/whatsapp-leads" would swallow its own conversations page.
 */
export function navLabelFor(pathname: string): string | null {
  let best: NavItem | null = null;
  for (const item of NAV_ITEMS) {
    const hit = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
    if (hit && (!best || item.href.length > best.href.length)) best = item;
  }
  return best?.label ?? null;
}
