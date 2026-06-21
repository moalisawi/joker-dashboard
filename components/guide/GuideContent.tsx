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

// ─── Design tokens ─────────────────────────────────────────────────────────────

const P = {
  primary:    "#5B5FEF",
  primaryBg:  "rgba(91,95,239,0.08)",
  primaryBdr: "rgba(91,95,239,0.20)",
  success:    "#22C55E",
  successBg:  "#ECFDF3",
  successBdr: "rgba(34,197,94,0.25)",
  warning:    "#F59E0B",
  warningBg:  "#FFFBEB",
  warningBdr: "rgba(245,158,11,0.25)",
  danger:     "#EF4444",
  dangerBg:   "#FEF2F2",
  dangerBdr:  "rgba(239,68,68,0.25)",
  info:       "#3B82F6",
  infoBg:     "#EFF6FF",
  infoBdr:    "rgba(59,130,246,0.25)",
  purple:     "#8B5CF6",
  purpleBg:   "rgba(139,92,246,0.08)",
  purpleBdr:  "rgba(139,92,246,0.20)",
  cyan:       "#06B6D4",
  cyanBg:     "rgba(6,182,212,0.08)",
  cyanBdr:    "rgba(6,182,212,0.20)",
  orange:     "#F97316",
  orangeBg:   "rgba(249,115,22,0.08)",
  orangeBdr:  "rgba(249,115,22,0.20)",
  text:       "var(--jk-text)",
  muted:      "var(--jk-muted)",
  subtle:     "var(--jk-subtle)",
  surface:    "var(--jk-surface)",
  border:     "var(--jk-border)",
  divider:    "var(--jk-divider)",
  shadow:     "var(--jk-shadow-card)",
};

// ─── Color maps ────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string; dot: string }> = {
  green:  { bg: P.successBg,  border: P.successBdr,  color: P.success,  dot: P.success  },
  blue:   { bg: P.infoBg,     border: P.infoBdr,     color: P.info,     dot: P.info     },
  yellow: { bg: P.warningBg,  border: P.warningBdr,  color: P.warning,  dot: P.warning  },
  red:    { bg: P.dangerBg,   border: P.dangerBdr,   color: P.danger,   dot: P.danger   },
  purple: { bg: P.purpleBg,   border: P.purpleBdr,   color: P.purple,   dot: P.purple   },
  gray:   { bg: "#F1F5F9",    border: "rgba(148,163,184,0.25)", color: "#6B7280", dot: "#9CA3AF" },
  orange: { bg: P.orangeBg,   border: P.orangeBdr,   color: P.orange,   dot: P.orange   },
  cyan:   { bg: P.cyanBg,     border: P.cyanBdr,     color: P.cyan,     dot: P.cyan     },
};

const WORKFLOW_COLOR: Record<string, string> = {
  blue:   P.primary,
  green:  P.success,
  yellow: P.warning,
  red:    P.danger,
  purple: P.purple,
  gray:   "#6B7280",
  cyan:   P.cyan,
  orange: P.orange,
};

const CALLOUT_STYLE: Record<CalloutVariant, { bg: string; border: string; icon: React.ReactNode }> = {
  tip:     { bg: P.infoBg,    border: P.infoBdr,    icon: <Lightbulb    size={16} style={{ color: P.info,    flexShrink: 0, marginTop: 2 }} /> },
  info:    { bg: P.infoBg,    border: P.infoBdr,    icon: <Info         size={16} style={{ color: P.info,    flexShrink: 0, marginTop: 2 }} /> },
  warning: { bg: P.warningBg, border: P.warningBdr, icon: <AlertTriangle size={16} style={{ color: P.warning, flexShrink: 0, marginTop: 2 }} /> },
  danger:  { bg: P.dangerBg,  border: P.dangerBdr,  icon: <XCircle      size={16} style={{ color: P.danger,  flexShrink: 0, marginTop: 2 }} /> },
  success: { bg: P.successBg, border: P.successBdr, icon: <CheckCircle2 size={16} style={{ color: P.success, flexShrink: 0, marginTop: 2 }} /> },
};

const GRID_STYLE: Record<string, { bg: string; border: string }> = {
  blue:   { bg: P.infoBg,    border: P.infoBdr    },
  purple: { bg: P.purpleBg,  border: P.purpleBdr  },
  green:  { bg: P.successBg, border: P.successBdr },
  orange: { bg: P.orangeBg,  border: P.orangeBdr  },
  red:    { bg: P.dangerBg,  border: P.dangerBdr  },
  cyan:   { bg: P.cyanBg,    border: P.cyanBdr    },
};

// ─── Block renderers ──────────────────────────────────────────────────────────

function BlockText({ content }: { content: string }) {
  return (
    <p style={{ fontSize: 14, color: P.muted, lineHeight: 1.75, margin: 0 }}>{content}</p>
  );
}

function BlockHeading({ level, content }: { level: 2 | 3; content: string }) {
  if (level === 2) {
    return (
      <h2 style={{ fontSize: 17, fontWeight: 800, color: P.text, marginTop: 8, marginBottom: 4, lineHeight: 1.3 }}>
        {content}
      </h2>
    );
  }
  return (
    <h3 style={{ fontSize: 15, fontWeight: 700, color: P.text, marginTop: 4, marginBottom: 2, lineHeight: 1.3 }}>
      {content}
    </h3>
  );
}

function BlockCallout({ variant, title, content }: { variant: CalloutVariant; title?: string; content: string }) {
  const cfg = CALLOUT_STYLE[variant];
  return (
    <div style={{
      borderRadius: 14,
      border: `1px solid ${cfg.border}`,
      padding: "14px 16px",
      background: cfg.bg,
    }}>
      <div style={{ display: "flex", gap: 10 }}>
        {cfg.icon}
        <div>
          {title && (
            <p style={{ fontSize: 14, fontWeight: 700, color: P.text, marginBottom: 4, margin: "0 0 4px" }}>
              {title}
            </p>
          )}
          <p style={{ fontSize: 14, color: P.muted, lineHeight: 1.7, margin: 0 }}>{content}</p>
        </div>
      </div>
    </div>
  );
}

function BlockSteps({ items }: { items: { title: string; description: string }[] }) {
  return (
    <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: "flex", gap: 12 }}>
          <span style={{
            flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
            background: P.primary, color: "#fff",
            fontSize: 12, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            marginTop: 2,
          }}>
            {i + 1}
          </span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: P.text, margin: "0 0 3px", lineHeight: 1.4 }}>{item.title}</p>
            <p style={{ fontSize: 13, color: P.muted, margin: 0, lineHeight: 1.65 }}>{item.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function BlockTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 14, border: `1px solid ${P.border}` }}>
      <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#F8FAFC" }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: "10px 16px",
                textAlign: "right",
                fontWeight: 700,
                color: P.text,
                borderBottom: `1px solid ${P.border}`,
                whiteSpace: "nowrap",
                fontSize: 13,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "#fff" : "#F9FAFB" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "10px 16px",
                  color: P.muted,
                  borderBottom: `1px solid ${P.divider}`,
                  lineHeight: 1.6,
                  fontSize: 13,
                }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item, i) => {
        const s = STATUS_STYLE[item.color] ?? STATUS_STYLE.gray;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 12,
            padding: "12px 14px", borderRadius: 12,
            border: `1px solid ${s.border}`,
            background: s.bg,
          }}>
            <span style={{
              flexShrink: 0, width: 9, height: 9, borderRadius: "50%",
              background: s.dot, marginTop: 5,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: s.color }}>{item.label}</span>
                {item.badge && (
                  <code style={{
                    fontSize: 11, fontFamily: "monospace",
                    padding: "1px 7px", borderRadius: 6,
                    background: "rgba(0,0,0,0.06)",
                    color: P.muted,
                  }}>
                    {item.badge}
                  </code>
                )}
              </div>
              <p style={{ fontSize: 12, margin: "3px 0 0", opacity: 0.8, lineHeight: 1.6, color: P.muted }}>
                {item.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlockAccordion({ items }: { items: { title: string; content: string }[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, i) => {
        const isOpen = openIdx === i;
        return (
          <div key={i} style={{ borderRadius: 12, border: `1px solid ${P.border}`, overflow: "hidden" }}>
            <button
              style={{
                width: "100%", display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 12,
                padding: "12px 16px", textAlign: "right", fontSize: 14,
                fontWeight: 600, color: P.text,
                background: isOpen ? P.primaryBg : P.surface,
                border: "none", cursor: "pointer", fontFamily: "inherit",
                transition: "background .15s",
              }}
              onClick={() => setOpenIdx(isOpen ? null : i)}
            >
              <span style={{ flex: 1 }}>{item.title}</span>
              {isOpen
                ? <ChevronUp size={15} style={{ flexShrink: 0, color: P.primary }} />
                : <ChevronDown size={15} style={{ flexShrink: 0, color: P.subtle }} />}
            </button>
            {isOpen && (
              <div style={{
                padding: "12px 16px 16px",
                fontSize: 14, color: P.muted, lineHeight: 1.7,
                borderTop: `1px solid ${P.divider}`,
                background: "#F9FAFB",
              }}>
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
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 999,
              background: WORKFLOW_COLOR[step.color ?? "blue"] ?? P.primary,
              color: "#fff", fontSize: 12, fontWeight: 700,
            }}>
              {step.label}
            </div>
            {step.description && (
              <p style={{ fontSize: 11, color: P.subtle, marginTop: 4, maxWidth: 100, lineHeight: 1.4 }}>
                {step.description}
              </p>
            )}
          </div>
          {i < steps.length - 1 && (
            <ChevronLeft size={15} style={{ color: P.border, flexShrink: 0, marginBottom: 14 }} />
          )}
        </div>
      ))}
    </div>
  );
}

function BlockGrid({ items }: { items: GridItem[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {items.map((item, i) => {
        const gs = GRID_STYLE[item.color ?? "blue"] ?? GRID_STYLE.blue;
        return (
          <div key={i} style={{
            borderRadius: 14, border: `1px solid ${gs.border}`,
            padding: "14px 16px", background: gs.bg,
            display: "flex", alignItems: "flex-start", gap: 12,
          }}>
            <span style={{ fontSize: 24, flexShrink: 0 }}>{item.icon}</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: P.text, margin: "0 0 4px" }}>{item.title}</p>
              <p style={{ fontSize: 12, color: P.muted, margin: 0, lineHeight: 1.6 }}>{item.description}</p>
            </div>
          </div>
        );
      })}
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
    <div id={id} style={{ scrollMarginTop: 96 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 16 }}
           className="group">
        <h3 style={{ fontSize: 15, fontWeight: 800, color: P.text, lineHeight: 1.4, margin: 0 }}>
          {sub.title}
        </h3>
        <button
          onClick={copyLink}
          title="نسخ الرابط"
          style={{
            flexShrink: 0, marginTop: 2, padding: "6px 7px", borderRadius: 8,
            border: "none", cursor: "pointer", fontFamily: "inherit",
            background: "transparent",
            color: copied ? P.success : P.subtle,
            transition: "color .15s, background .15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = P.primaryBg; (e.currentTarget as HTMLElement).style.color = P.primary; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = copied ? P.success : P.subtle; }}
        >
          {copied ? <CheckCircle2 size={14} /> : <Link2 size={14} />}
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
    <section id={section.id} style={{ scrollMarginTop: 80 }}>
      {/* Section header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        marginBottom: 24, paddingBottom: 18,
        borderBottom: `1px solid ${P.border}`,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 16, flexShrink: 0,
          background: P.primaryBg, border: `1px solid ${P.primaryBdr}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>
          {section.icon}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: P.text, margin: 0, lineHeight: 1.2 }}>
              {section.title}
            </h2>
            {section.badge && (
              <span style={{
                padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: P.primary, color: "#fff",
              }}>
                {section.badge}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13, color: P.muted, margin: "4px 0 0", lineHeight: 1.5 }}>
            {section.description}
          </p>
        </div>
      </div>

      {/* SubSections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {filteredSubs.map((sub) => (
          <div
            key={sub.id}
            style={{
              background: P.surface,
              border: `1px solid ${P.border}`,
              borderRadius: 20,
              padding: "20px 22px",
              boxShadow: P.shadow,
            }}
          >
            <SubSectionBlock sub={sub} sectionId={section.id} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── TOC sidebar ─────────────────────────────────────────────────────────────

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
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {sections.map((sec) => {
        const isActive = activeId === sec.id || activeId.startsWith(sec.id + "-");
        return (
          <button
            key={sec.id}
            onClick={() => onNavigate(sec.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px", borderRadius: 10, textAlign: "right",
              fontSize: 13, fontWeight: isActive ? 700 : 500,
              background: isActive ? P.primaryBg : "transparent",
              color: isActive ? P.primary : P.muted,
              border: `1px solid ${isActive ? P.primaryBdr : "transparent"}`,
              cursor: "pointer", fontFamily: "inherit",
              transition: "all .15s",
            }}
            onMouseEnter={e => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "#F8FAFC";
                (e.currentTarget as HTMLElement).style.color = P.text;
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = P.muted;
              }
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0 }}>{sec.icon}</span>
            <span style={{ flex: 1, textAlign: "right", lineHeight: 1.4 }}>{sec.title}</span>
            {sec.badge && (
              <span style={{
                flexShrink: 0, fontSize: 9, fontWeight: 700,
                padding: "2px 6px", borderRadius: 999,
                background: isActive ? P.primary : "#E5E7EB",
                color: isActive ? "#fff" : "#6B7280",
              }}>
                {sec.badge === "ابدأ هنا" ? "●" : "جديد"}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Reading progress bar ─────────────────────────────────────────────────────

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
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0,
      height: 3, background: "rgba(229,231,235,0.5)", zIndex: 50,
    }} className="print:hidden">
      <div
        style={{
          height: "100%",
          background: `linear-gradient(to left, #8B5CF6, ${P.primary})`,
          width: `${progress}%`,
          transition: "width 75ms linear",
        }}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function GuideContent({ data }: { data: GuideData }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId]       = useState(data.sections[0]?.id ?? "");
  const [showBackTop, setShowBackTop] = useState(false);
  const [allExpanded, setAllExpanded] = useState(true);
  const mainRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const ids = data.sections.map((s) => s.id);
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
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

  useEffect(() => {
    function onScroll() { setShowBackTop(window.scrollY > 400); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

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

      <div style={{ minHeight: "100vh", background: "var(--background)" }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <div
          className="print:hidden"
          style={{
            background: "linear-gradient(135deg, #0B1020 0%, #1A2050 45%, #5B5FEF 100%)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 24px" }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(147,197,253,0.7)", marginBottom: 24 }}>
              <BookOpen size={12} />
              <span>النظام</span>
              <ChevronLeft size={10} />
              <span style={{ color: "rgba(219,234,254,0.9)", fontWeight: 600 }}>{data.title}</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 24 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <h1 style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 900, color: "#fff", margin: "0 0 8px", lineHeight: 1.2 }}>
                  {data.title}
                </h1>
                <p style={{ color: "rgba(147,197,253,0.8)", fontSize: 15, margin: "0 0 16px", lineHeight: 1.6, maxWidth: 520 }}>
                  {data.subtitle}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, fontSize: 12, color: "rgba(147,197,253,0.6)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", display: "inline-block", animation: "pulse 2s infinite" }} />
                    الإصدار {data.version}
                  </span>
                  <span>·</span>
                  <span>آخر تحديث: {data.lastUpdated}</span>
                  <span>·</span>
                  <span>{data.sections.length} قسم</span>
                </div>
              </div>

              {/* Toolbar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }} className="print:hidden">
                <button
                  onClick={() => window.print()}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                    color: "rgba(219,234,254,0.9)", background: "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <Printer size={14} />
                  <span>طباعة</span>
                </button>
                <button
                  onClick={() => navigator.clipboard.writeText(window.location.href).catch(() => {})}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                    color: "rgba(219,234,254,0.9)", background: "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <Link2 size={14} />
                  <span>نسخ الرابط</span>
                </button>
              </div>
            </div>

            {/* Search */}
            <div style={{ marginTop: 24, position: "relative", maxWidth: 520 }}>
              <Search size={15} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "rgba(147,197,253,0.55)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="ابحث في الدليل..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                dir="rtl"
                style={{
                  width: "100%", paddingRight: 40, paddingLeft: searchQuery ? 36 : 16,
                  paddingTop: 10, paddingBottom: 10,
                  borderRadius: 14, fontSize: 14,
                  background: "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff", outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(147,197,253,0.6)",
                  }}
                >
                  <XCircle size={14} />
                </button>
              )}
            </div>
            {searchQuery && (
              <p style={{ marginTop: 8, fontSize: 12, color: "rgba(147,197,253,0.6)" }}>
                {filteredSections.length === 0 ? "لا توجد نتائج" : `${filteredSections.length} قسم يطابق البحث`}
              </p>
            )}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 16px" }}>
          <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }} dir="rtl">

            {/* ── TOC Sidebar ─────────────────────────────────────────────── */}
            <aside style={{ width: 240, flexShrink: 0 }} className="hidden lg:block print:hidden">
              <div style={{ position: "sticky", top: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Sections nav */}
                <div style={{
                  background: P.surface,
                  border: `1px solid ${P.border}`,
                  borderRadius: 20, overflow: "hidden",
                  boxShadow: P.shadow,
                }}>
                  <div style={{
                    padding: "12px 14px", borderBottom: `1px solid ${P.divider}`,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: P.subtle, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                      الأقسام
                    </p>
                    <button
                      onClick={() => setAllExpanded(!allExpanded)}
                      title={allExpanded ? "طي الكل" : "فتح الكل"}
                      style={{ background: "none", border: "none", cursor: "pointer", color: P.subtle, padding: 4, borderRadius: 6 }}
                    >
                      {allExpanded ? <Minimize size={12} /> : <Expand size={12} />}
                    </button>
                  </div>
                  <div style={{ padding: 8 }}>
                    <TOC sections={data.sections} activeId={activeId} onNavigate={scrollToSection} />
                  </div>
                </div>

                {/* Quick stats */}
                <div style={{
                  background: P.surface,
                  border: `1px solid ${P.border}`,
                  borderRadius: 20, padding: "16px",
                  boxShadow: P.shadow,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: P.subtle, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 12px" }}>
                    الدليل يغطي
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: "الأقسام", value: `${data.sections.length}` },
                      { label: "الموضوعات", value: `${data.sections.reduce((a, s) => a + s.subSections.length, 0)}` },
                    ].map((item) => (
                      <div key={item.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: P.muted }}>{item.label}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color: P.text,
                          background: "#F1F5F9", padding: "2px 10px", borderRadius: 999,
                        }}>
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* ── Main content ─────────────────────────────────────────────── */}
            <main ref={mainRef} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 48 }}>
              {filteredSections.length === 0 ? (
                <div style={{ textAlign: "center", padding: "80px 0" }}>
                  <Search size={40} style={{ margin: "0 auto 16px", color: P.border, display: "block" }} />
                  <p style={{ color: P.muted, fontWeight: 500, fontSize: 15 }}>لا توجد نتائج لـ &quot;{searchQuery}&quot;</p>
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      marginTop: 12, fontSize: 13, color: P.primary,
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "inherit", textDecoration: "underline",
                    }}
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
              <div style={{
                paddingTop: 32,
                borderTop: `1px solid ${P.border}`,
                textAlign: "center",
                fontSize: 12,
                color: P.subtle,
                lineHeight: 1.8,
              }}>
                <p style={{ margin: "0 0 2px" }}>نظام الجوكر — دليل الاستخدام</p>
                <p style={{ margin: 0 }}>آخر تحديث: {data.lastUpdated} · الإصدار {data.version}</p>
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* ── Back to top ──────────────────────────────────────────────────────── */}
      {showBackTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="print:hidden"
          style={{
            position: "fixed", bottom: 24, insetInlineStart: 24, zIndex: 40,
            padding: 12, borderRadius: 16,
            background: P.primary,
            color: "#fff",
            boxShadow: `0 8px 24px rgba(91,95,239,0.35)`,
            border: "none", cursor: "pointer",
            transition: "transform .2s, box-shadow .2s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; }}
          title="العودة للأعلى"
        >
          <ArrowUp size={18} />
        </button>
      )}

      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </>
  );
}
