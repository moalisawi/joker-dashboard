/**
 * Centralized React Query key factory for the subscribers domain.
 *
 * Hierarchy: ["subscribers"] → ["subscribers", "list"] → ["subscribers", "detail", id]
 *
 * Invalidating the root key ["subscribers"] cascades to all subscriber queries.
 */
export const subscriberKeys = {
  all:    ()         => ["subscribers"]                 as const,
  lists:  ()         => ["subscribers", "list"]         as const,
  list:   (uid?: string) => ["subscribers", "list", uid ?? "all"] as const,
  detail: (id: string)   => ["subscribers", "detail", id]         as const,
} as const;
