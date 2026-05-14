export const teamFeatureKeys = {
  all:     ["teams"]                        as const,
  detail:  (id: string) => ["teams", id]   as const,
  members: (id: string) => ["teams", id, "members"] as const,
};
