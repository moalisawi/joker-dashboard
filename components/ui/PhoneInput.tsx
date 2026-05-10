"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { PHONE_COUNTRIES } from "@/lib/utils";

type Country = (typeof PHONE_COUNTRIES)[number];

interface Props {
  value: string;        // E.164: "+970599999999" | ""
  onChange: (e164: string) => void;
  required?: boolean;
  disabled?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function flag(iso: string) {
  return [...iso.toUpperCase()]
    .map((c) => String.fromCodePoint(c.charCodeAt(0) + 0x1f1a5))
    .join("");
}

const SORTED_BY_DIAL = [...PHONE_COUNTRIES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length
);

function parseE164(e164: string): { country: Country; local: string } | null {
  if (!e164.startsWith("+")) return null;
  for (const c of SORTED_BY_DIAL) {
    if (e164.startsWith(c.dialCode)) {
      return { country: c, local: e164.slice(c.dialCode.length) };
    }
  }
  return null;
}

const DEFAULT_COUNTRY = PHONE_COUNTRIES.find((c) => c.iso === "PS")!;

// ── Component ─────────────────────────────────────────────────────────────────

export default function PhoneInput({ value, onChange, required, disabled }: Props) {
  const parsed  = value ? parseE164(value) : null;
  const [country, setCountry] = useState<Country>(parsed?.country ?? DEFAULT_COUNTRY);
  const [local,   setLocal]   = useState(parsed?.local ?? "");
  const [open,    setOpen]    = useState(false);
  const [search,  setSearch]  = useState("");

  const dropRef    = useRef<HTMLDivElement>(null);
  const searchRef  = useRef<HTMLInputElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // Sync when parent resets value externally
  useEffect(() => {
    if (!value) { setLocal(""); return; }
    const p = parseE164(value);
    if (p && p.country.iso !== country.iso) setCountry(p.country);
    if (p) setLocal(p.local);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Focus search when dropdown opens
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 40);
  }, [open]);

  function handleNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    setLocal(digits);
    onChange(digits ? `${country.dialCode}${digits}` : "");
  }

  function selectCountry(c: Country) {
    setCountry(c);
    setOpen(false);
    setSearch("");
    onChange(local ? `${c.dialCode}${local}` : "");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const filtered = PHONE_COUNTRIES.filter(
    (c) =>
      c.name.includes(search) ||
      c.dialCode.includes(search) ||
      c.iso.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex gap-2" dir="ltr">

      {/* ── Country trigger ─────────────────────────────────────────────── */}
      <div className="relative shrink-0" ref={dropRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={[
            "flex items-center gap-1.5 px-3 py-2.5 h-full",
            "border border-slate-200 rounded-xl bg-slate-50 text-sm",
            "hover:bg-white hover:border-slate-300 transition",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          ].join(" ")}
        >
          <span className="text-lg leading-none">{flag(country.iso)}</span>
          <span className="font-mono text-xs text-slate-500 tracking-tight">
            {country.dialCode}
          </span>
          <ChevronDown
            size={12}
            className={`text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>

        {/* ── Dropdown ──────────────────────────────────────────────────── */}
        {open && (
          <div
            className="absolute top-full mt-1.5 z-[300] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
            style={{ left: 0, width: "16rem" }}
          >
            {/* Search bar */}
            <div className="p-2 border-b border-slate-100">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الرمز..."
                  dir="rtl"
                  className="flex-1 bg-transparent text-sm focus:outline-none text-slate-700 placeholder:text-slate-400"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="text-slate-400 hover:text-slate-600 transition"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Country list */}
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">لا نتائج</p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.iso}
                    type="button"
                    onClick={() => selectCountry(c)}
                    className={[
                      "w-full flex items-center gap-2.5 px-3 py-2 text-sm transition",
                      c.iso === country.iso
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <span className="text-base leading-none shrink-0">{flag(c.iso)}</span>
                    <span className="flex-1 text-right" dir="rtl">{c.name}</span>
                    <span className="font-mono text-xs text-slate-400 shrink-0">
                      {c.dialCode}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Number input ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent focus-within:bg-white">
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          value={local}
          onChange={handleNumberChange}
          placeholder="599 000 000"
          dir="ltr"
          required={required}
          disabled={disabled}
          className="flex-1 px-3 py-2.5 bg-transparent text-sm focus:outline-none min-w-0 disabled:opacity-50 disabled:cursor-not-allowed font-mono tracking-wide"
        />
        {local && !disabled && (
          <button
            type="button"
            onClick={() => { setLocal(""); onChange(""); }}
            className="px-2.5 text-slate-300 hover:text-slate-500 transition"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
