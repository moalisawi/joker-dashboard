"use client";

import { createContext, useContext, useState } from "react";

interface TabsContextValue {
  active: string;
  setActive: (v: string) => void;
}

const TabsCtx = createContext<TabsContextValue>({ active: "", setActive: () => {} });

export function Tabs({
  defaultValue,
  children,
  className = "",
}: {
  defaultValue: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [active, setActive] = useState(defaultValue);
  return (
    <TabsCtx.Provider value={{ active, setActive }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabList({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      role="tablist"
      className={`inline-flex items-center gap-1 ${className}`}
      style={{
        padding: 5,
        borderRadius: 999,
        background: "var(--jk-surface)",
        border: "1px solid var(--jk-border)",
        boxShadow: "var(--jk-shadow-flat)",
      }}
    >
      {children}
    </div>
  );
}

export function Tab({
  value,
  children,
  badge,
}: {
  value: string;
  children: React.ReactNode;
  badge?: number;
}) {
  const { active, setActive } = useContext(TabsCtx);
  const isActive = active === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActive(value)}
      className="relative flex items-center gap-2 transition-all duration-150"
      style={{
        padding: "10px 22px",
        borderRadius: 999,
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 13,
        fontWeight: 600,
        background: isActive ? "#5B5FEF" : "transparent",
        color: isActive ? "#fff" : "var(--jk-muted)",
        boxShadow: isActive ? "var(--jk-shadow-nav)" : "none",
      }}
    >
      {children}
      {badge != null && badge > 0 && (
        <span
          className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center"
          style={{
            background: isActive ? "rgba(255,255,255,.22)" : "#EF4444",
            color: "#fff",
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

export function TabPanel({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  const { active } = useContext(TabsCtx);
  if (active !== value) return null;
  return <div role="tabpanel">{children}</div>;
}
