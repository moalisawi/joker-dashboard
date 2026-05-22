import type { BalancePeriod } from "./types";

export const paymentMethodKeys = {
  all:     ()                          => ["paymentMethods"] as const,
  lists:   ()                          => ["paymentMethods", "list"] as const,
  list:    (filters?: object)          => ["paymentMethods", "list", filters ?? {}] as const,
  detail:  (id: string)                => ["paymentMethods", "detail", id] as const,
  balance: (id: string, period: BalancePeriod) => ["paymentMethods", "balance", id, period] as const,
  payers:  (id: string, period: BalancePeriod) => ["paymentMethods", "payers", id, period] as const,
};
