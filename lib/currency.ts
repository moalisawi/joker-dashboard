import type { Currency, ExchangeRates } from "@/types";

export const DEFAULT_RATES: ExchangeRates = {
  USD: 1,
  EGP: 47.5,
  JOD: 0.71,
  ILS: 3.65,
};

export const CURRENCY_INFO: Record<Currency, { name: string; code: Currency }> = {
  USD: { name: "دولار", code: "USD" },
  EGP: { name: "جنيه", code: "EGP" },
  JOD: { name: "دينار", code: "JOD" },
  ILS: { name: "شيكل", code: "ILS" },
};

export function toUSD(amount: number, currency: Currency, rates: ExchangeRates): number {
  const rate = rates[currency] || 1;
  return amount / rate;
}

export function formatCurrency(amount: number, currency: Currency): string {
  return `${amount.toFixed(2)} ${CURRENCY_INFO[currency]?.name || currency}`;
}
