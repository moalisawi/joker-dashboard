import { create } from "zustand";
import type { UserProfile, ExchangeRates, Permissions } from "@/types";
import type { GranularPermissions } from "@/types";
import { DEFAULT_RATES } from "@/lib/currency";
import {
  getPermissions,
  granularToFlat,
  canDoGranular,
  effectivePermissions,
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

  // All three answer from effectivePermissions, which clamps the user's grant to
  // ROLE_CEILING. These used to branch on whether the document carried
  // granularPermissions and consult a different table in each case — so the same
  // question got different answers depending on the shape of the record, and a
  // job preset could grant past the role.
  permissions: () => {
    const user = get().user;
    if (!user) return getPermissions("employee");
    return granularToFlat(effectivePermissions(user));
  },

  can: (name) => {
    const user = get().user;
    if (!user) return false;
    return granularToFlat(effectivePermissions(user))[name] ?? false;
  },

  perm: (category, action) => {
    const user = get().user;
    if (!user) return false;
    return canDoGranular(user.role, user.granularPermissions, category, action, user.employeeRole);
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
