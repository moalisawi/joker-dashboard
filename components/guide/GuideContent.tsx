"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, ChevronDown, ChevronUp, Link2, Printer,
  CheckCircle2, AlertTriangle, Info, XCircle, Lightbulb,
  ChevronLeft, ArrowUp, BookOpen, Expand, Minimize,
} from "lucide-react";
import type {
  GuideData, GuideSection, GuideSubSection, GuideBlock,
  CalloutVariant, StatusItem, WorkflowStep, GridItem,
} from "@/lib/guide/types";

// ─── Color maps ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  green:  "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
  blue:   "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
  yellow: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40",
  red:    "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/40",
  purple: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/40",
  gray:   "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700/40 dark:text-slate-300 dark:border-slate-600/40",
  orange: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/40",
  cyan:   "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-700/40",
};

const STATUS_DOT: Record<string, string> = {
  green:  "bg-emerald-500",
  blue:   "bg-blue-500",
  yellow: "bg-amber-500",
  red:    "bg-rose-500",
  purple: "bg-violet-500",
  gray:   "bg-slate-400",
  orange: "bg-orange-500",
  cyan:   "bg-cyan-500",
};

const WORKFLOW_COLOR: Record<string, string> = {
  blue:   "bg-blue-600",
  green:  "bg-emerald-600",
  yellow: "bg-amber-500",
  red:    "bg-rose-600",
  purple: "bg-violet-600",
  gray:   "bg-slate-500",
  cyan:   "bg-cyan-600",
  orange: "bg-orange-500",
};

const CALLOUT_CONFIG: Record<CalloutVariant, { bg: string; border: string; icon: React.ReactNode; title?: string }> = {
  tip:     { bg: "bg-blue-50 dark:bg-blue-900/20",    border: "border-blue-300 dark:border-blue-700",   icon: <Lightbulb   size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" /> },
  info:    { bg: "bg-sky-50 dark:bg-sky-900/20",      border: "border-sky-300 dark:border-sky-700",     icon: <Info        size={16} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" /> },
  warning: { bg: "bg-amber-50 dark:bg-amber-900/20",  border: "border-amber-300 dark:border-amber-700", icon: <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" /> },
  danger:  { bg: "bg-rose-50 dark:bg-rose-900/20",    border: "border-rose-300 dark:border-rose-700",   icon: <XCircle     size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" /> },
  success: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-300 dark:border-emerald-700", icon: <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" /> },
};

// ─── Block renderers ──────────────────────────────────────────────────────────

function BlockText({ content }: { content: string }) {
  return (
    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{content}</p>
  );
}

function BlockHeading({ level, content }: { level: 2 | 3; content: string }) {
  if (level === 2) {
    return <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-2 mb-1">{content}</h2>;
  }
  return <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200 mt-1">{content}</h3>;
}

function BlockCallout({ variant, title, content }: { variant: CalloutVariant; title?: string; content: string }) {
  const cfg = CALLOUT_CONFIG[variant];
  return (
    <div className={`rounded-xl border p-4 ${cfg.bg} ${cfg.border}`}>
      <div className="flex gap-2.5">
        {cfg.icon}
        <div>
          {title && <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-0.5">{title}</p>}
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{content}</p>
        </div>
      </div>
    </div>
  );
}

function BlockSteps({ items }: { items: { title: string; description: string }[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{item.title}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{item.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function BlockTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? "bg-white dark:bg-slate-900/40" : "bg-slate-50/60 dark:bg-slate-800/20"}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-slate-600 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800/60 leading-relaxed">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlockStatuses({ items }: { items: StatusItem[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border ${STATUS_COLOR[item.color]}`}>
          <span className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${STATUS_DOT[item.color]}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">{item.label}</span>
              {item.badge && (
                <code className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10">
                  {item.badge}
                </code>
              )}
            </div>
            <p className="text-xs mt-0.5 opacity-80 leading-relaxed">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function BlockAccordion({ items }: { items: { title: string; content: string }[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              onClick={() => setOpenIdx(isOpen ? null : i)}
            >
              <span className="flex-1">{item.title}</span>
              {isOpen ? <ChevronUp size={16} className="shrink-0 text-slate-400" /> : <ChevronDown size={16} className="shrink-0 text-slate-400" />}
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BlockWorkflow({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="text-center">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold ${WORKFLOW_COLOR[step.color ?? "blue"]}`}>
              {step.label}
            </div>
            {step.description && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[100px] leading-tight">{step.description}</p>
            )}
          </div>
          {i < steps.length - 1 && (
            <ChevronLeft size={16} className="text-slate-300 dark:text-slate-600 shrink-0 -mt-4" />
          )}
        </div>
      ))}
    </div>
  );
}

function BlockGrid({ items }: { items: GridItem[] }) {
  const GRID_BG: Record<string, string> = {
    blue:   "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/40",
    purple: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/40",
    green:  "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/40",
    red:    "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/40",
    cyan:   "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800/40",
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((item, i) => (
        <div key={i} className={`rounded-xl border p-4 ${GRID_BG[item.color ?? "blue"]}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">{item.icon}</span>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-0.5">{item.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{item.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function renderBlock(block: GuideBlock, index: number) {
  switch (block.type) {
    case "text":      return <BlockText key={index} content={block.content} />;
    case "heading":   return <BlockHeading key={index} level={block.level} content={block.content} />;
    case "callout":   return <BlockCallout key={index} variant={block.variant} title={block.title} content={block.content} />;
    case "steps":     return <BlockSteps key={index} items={block.items} />;
    case "table":     return <BlockTable key={index} headers={block.headers} rows={block.rows} />;
    case "statuses":  return <BlockStatuses key={index} items={block.items} />;
    case "accordion": return <BlockAccordion key={index} items={block.items} />;
    case "workflow":  return <BlockWorkflow key={index} steps={block.steps} />;
    case "grid":      return <BlockGrid key={index} items={block.items} />;
    default:          return null;
  }
}

// ─── SubSection ───────────────────────────────────────────────────────────────

function SubSectionBlock({ sub, sectionId }: { sub: GuideSubSection; sectionId: string }) {
  const id = `${sectionId}-${sub.id}`;
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div id={id} className="scroll-mt-24">
      <div className="flex items-start justify-between gap-2 mb-4 group">
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">{sub.title}</h3>
        <button
          onClick={copyLink}
          title="نسخ الرابط"
          className="shrink-0 mt-0.5 p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors opacity-0 group-hover:opacity-100"
        >
          {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Link2 size={14} />}
        </button>
      </div>
      <div className="space-y-4">
        {sub.blocks.map((block, i) => renderBlock(block, i))}
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function SectionBlock({ section, searchQuery }: { section: GuideSection; searchQuery: string }) {
  const filteredSubs = searchQuery
    ? section.subSections.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          JSON.stringify(s.blocks).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : section.subSections;

  if (searchQuery && filteredSubs.length === 0) return null;

  return (
    <section id={section.id} className="scroll-mt-20">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-700/60">
        <span className="text-3xl">{section.icon}</span>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-50">{section.title}</h2>
            {section.badge && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white">
                {section.badge}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{section.description}</p>
        </div>
      </div>

      {/* SubSections */}
      <div className="space-y-8">
        {filteredSubs.map((sub) => (
          <div
            key={sub.id}
            className="bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 p-5 shadow-sm"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <SubSectionBlock sub={sub} sectionId={section.id} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── TOC (Sticky sidebar) ─────────────────────────────────────────────────────

function TOC({
  sections,
  activeId,
  onNavigate,
}: {
  sections: GuideSection[];
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <nav className="space-y-0.5">
      {sections.map((sec) => {
        const isActive = activeId === sec.id || activeId.startsWith(sec.id + "-");
        return (
          <button
            key={sec.id}
            onClick={() => onNavigate(sec.id)}
            className={`
              w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-right text-sm transition-all
              ${isActive
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
              }
            `}
          >
            <span className="text-base shrink-0">{sec.icon}</span>
            <span className="flex-1 text-right leading-tight">{sec.title}</span>
            {sec.badge && (
              <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}`}>
                {sec.badge === "ابدأ هنا" ? "●" : "جديد"}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const scrollTop = el.scrollTop || document.body.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] bg-slate-200/50 dark:bg-slate-700/50 z-50 print:hidden">
      <div
        className="h-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-75"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ─── Main GuideContent ────────────────────────────────────────────────────────

export default function GuideContent({ data }: { data: GuideData }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId]       = useState(data.sections[0]?.id ?? "");
  const [showBackTop, setShowBackTop] = useState(false);
  const [allExpanded, setAllExpanded] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Intersection observer for active section tracking
  useEffect(() => {
    const ids = data.sections.map((s) => s.id);
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current!.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, [data.sections]);

  // Back to top
  useEffect(() => {
    function onScroll() {
      setShowBackTop(window.scrollY > 400);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  function handleCopyPageLink() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }

  // Filter sections based on search
  const filteredSections = searchQuery
    ? data.sections.filter(
        (sec) =>
          sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sec.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sec.subSections.some(
            (s) =>
              s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              JSON.stringify(s.blocks).toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : data.sections;

  return (
    <>
      <ReadingProgress />

      <div className="min-h-screen" style={{ background: "var(--page-bg)" }}>

        {/* ── Hero header ─────────────────────────────────────────────────── */}
        <div
          className="print:hidden"
          style={{
            background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="max-w-7xl mx-auto px-6 py-10">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-xs text-blue-200/70 mb-6">
              <BookOpen size={12} />
              <span>النظام</span>
              <ChevronLeft size={10} />
              <span className="text-blue-100 font-semibold">{data.title}</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-end gap-6">
              <div className="flex-1">
                <h1 className="text-3xl md:text-4xl font-black text-white leading-tight">
                  {data.title}
                </h1>
                <p className="mt-2 text-blue-200/80 text-base leading-relaxed max-w-2xl">
                  {data.subtitle}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-blue-200/60">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    الإصدار {data.version}
                  </span>
                  <span>·</span>
                  <span>آخر تحديث: {data.lastUpdated}</span>
                  <span>·</span>
                  <span>{data.sections.length} قسم</span>
                </div>
              </div>

              {/* Toolbar */}
              <div className="flex items-center gap-2 print:hidden">
                <button
                  onClick={() => window.print()}
                  title="طباعة"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-blue-100 bg-white/10 hover:bg-white/20 border border-white/15 transition-colors"
                >
                  <Printer size={14} />
                  <span className="hidden sm:inline">طباعة</span>
                </button>
                <button
                  onClick={handleCopyPageLink}
                  title="نسخ رابط الصفحة"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-blue-100 bg-white/10 hover:bg-white/20 border border-white/15 transition-colors"
                >
                  <Link2 size={14} />
                  <span className="hidden sm:inline">نسخ الرابط</span>
                </button>
              </div>
            </div>

            {/* Search bar */}
            <div className="mt-6 relative max-w-lg">
              <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-300/60" />
              <input
                type="text"
                placeholder="ابحث في الدليل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm bg-white/10 border border-white/15 text-white placeholder-blue-200/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition-all"
                dir="rtl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-200/50 hover:text-white"
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>

            {searchQuery && (
              <p className="mt-2 text-xs text-blue-200/60">
                {filteredSections.length === 0
                  ? "لا توجد نتائج"
                  : `${filteredSections.length} قسم يطابق البحث`}
              </p>
            )}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
          <div className="flex gap-8" dir="rtl">

            {/* ── TOC Sidebar ─────────────────────────────────────────────── */}
            <aside className="hidden lg:block w-60 xl:w-64 shrink-0 print:hidden">
              <div className="sticky top-6 space-y-4">
                <div
                  className="rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden"
                  style={{ background: "var(--surface)", boxShadow: "var(--shadow-card)" }}
                >
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">الأقسام</p>
                    <button
                      onClick={() => setAllExpanded(!allExpanded)}
                      title={allExpanded ? "طي الكل" : "فتح الكل"}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 rounded"
                    >
                      {allExpanded ? <Minimize size={12} /> : <Expand size={12} />}
                    </button>
                  </div>
                  <div className="p-2">
                    <TOC
                      sections={data.sections}
                      activeId={activeId}
                      onNavigate={scrollToSection}
                    />
                  </div>
                </div>

                {/* Quick stats */}
                <div
                  className="rounded-2xl border border-slate-200 dark:border-slate-700/60 p-4"
                  style={{ background: "var(--surface)", boxShadow: "var(--shadow-card)" }}
                >
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">الدليل يغطي</p>
                  <div className="space-y-2">
                    {[
                      { label: "الأقسام", value: `${data.sections.length}` },
                      { label: "الموضوعات", value: `${data.sections.reduce((a, s) => a + s.subSections.length, 0)}` },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">{item.label}</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* ── Main content ─────────────────────────────────────────────── */}
            <main ref={mainRef} className="flex-1 min-w-0 space-y-12">
              {filteredSections.length === 0 ? (
                <div className="text-center py-20">
                  <Search size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="text-slate-500 dark:text-slate-400 font-medium">لا توجد نتائج لـ "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery("")}
                    className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    مسح البحث
                  </button>
                </div>
              ) : (
                filteredSections.map((section) => (
                  <SectionBlock key={section.id} section={section} searchQuery={searchQuery} />
                ))
              )}

              {/* Footer */}
              <div className="pt-8 border-t border-slate-200 dark:border-slate-700/60 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
                <p>نظام الجوكر — دليل الاستخدام</p>
                <p>آخر تحديث: {data.lastUpdated} · الإصدار {data.version}</p>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* ── Back to top ─────────────────────────────────────────────────────── */}
      {showBackTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 left-6 z-40 p-3 rounded-2xl bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all print:hidden"
          title="العودة للأعلى"
        >
          <ArrowUp size={18} />
        </button>
      )}

      {/* ── Print styles ─────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          body { background: white !important; }
          .sidebar-bg { display: none !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
