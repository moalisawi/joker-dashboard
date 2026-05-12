import type { BaseDocument } from "./base";

export type TeamType = "sales" | "nutrition";

export interface Team extends BaseDocument {
  name: string;
  type: TeamType;
  active: boolean;
}
