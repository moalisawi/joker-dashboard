// AuditLog is now defined in types/auditLog.ts — re-export for backward compat
export type { AuditLog } from "./auditLog";

export interface PhoneCountry {
  name: string;
  iso: string;
  dialCode: string;
}

export interface ExchangeRates {
  USD: number;
  EGP: number;
  JOD: number;
  ILS: number;
  [key: string]: number;
}
