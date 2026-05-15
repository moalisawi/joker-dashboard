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
      className={`flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 ${className}`}
      style={{ background: "var(--surface-2)" }}
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
      className={`
        relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150
        ${isActive
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
        }
      `}
      style={isActive ? { boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 1px 2px rgba(15,23,42,0.06)" } : {}}
    >
      {children}
      {badge != null && badge > 0 && (
        <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center ${
          isActive ? "bg-rose-500 text-white" : "bg-slate-300 text-slate-600"
        }`}>
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
