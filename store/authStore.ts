import { create } from "zustand";
import type { UserProfile, ExchangeRates, Permissions } from "@/types";
import type { GranularPermissions } from "@/types";
import { DEFAULT_RATES } from "@/lib/currency";
import {
  getPermissions,
  hasPermission,
  granularToFlat,
  canDoGranular,
  getDefaultGranularPermissions,
} from "@/lib/permissions";

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  exchangeRates: ExchangeRates;

  setUser:         (user: UserProfile | null) => void;
  setLoading:      (loading: boolean) => void;
  setExchangeRates:(rates: ExchangeRates) => void;

  /** Returns the full flat Permissions object (backward compat) */
  permissions: () => Permissions;

  /**
   * Check a flat permission key (backward compat).
   * When granularPermissions are present on the user doc they take precedence.
   */
  can: (name: keyof Permissions) => boolean;

  /**
   * Check a granular permission.
   * Example: perm("subscriptions", "freeze")
   */
  perm: (category: keyof GranularPermissions, action: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:          null,
  loading:       true,
  exchangeRates: DEFAULT_RATES,

  setUser:          (user)  => set({ user }),
  setLoading:       (loading) => set({ loading }),
  setExchangeRates: (rates) => set({ exchangeRates: rates }),

  permissions: () => {
    const user = get().user;
    if (!user) return getPermissions("employee");
    if (user.granularPermissions) return granularToFlat(user.granularPermissions);
    return getPermissions(user.role);
  },

  can: (name) => {
    const user = get().user;
    if (!user) return false;

    // Granular permissions take precedence when present
    if (user.granularPermissions) {
      return granularToFlat(user.granularPermissions)[name] ?? false;
    }

    return hasPermission(user.role, name);
  },

  perm: (category, action) => {
    const user = get().user;
    if (!user) return false;
    return canDoGranular(user.role, user.granularPermissions, category, action);
  },
}));

/** Read a single granular permission directly from a UserProfile (used in services) */
export function checkPerm(
  user: UserProfile | null,
  category: keyof GranularPermissions,
  action: string
): boolean {
  if (!user) return false;
  const gp = user.granularPermissions ?? getDefaultGranularPermissions(user.role);
  return Boolean((gp as unknown as Record<string, Record<string, boolean>>)[category]?.[action]);
}
