export type CalloutVariant = "tip" | "warning" | "info" | "danger" | "success";

export interface TextBlock {
  type: "text";
  content: string;
}

export interface HeadingBlock {
  type: "heading";
  level: 2 | 3;
  content: string;
}

export interface CalloutBlock {
  type: "callout";
  variant: CalloutVariant;
  title?: string;
  content: string;
}

export interface StepItem {
  title: string;
  description: string;
}

export interface StepsBlock {
  type: "steps";
  items: StepItem[];
}

export interface TableBlock {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface StatusItem {
  label: string;
  color: "green" | "blue" | "yellow" | "red" | "purple" | "gray" | "orange" | "cyan";
  description: string;
  badge?: string;
}

export interface StatusesBlock {
  type: "statuses";
  items: StatusItem[];
}

export interface AccordionItem {
  title: string;
  content: string;
}

export interface AccordionBlock {
  type: "accordion";
  items: AccordionItem[];
}

export interface WorkflowStep {
  label: string;
  description?: string;
  color?: "blue" | "green" | "yellow" | "red" | "purple" | "gray" | "cyan" | "orange";
}

export interface WorkflowBlock {
  type: "workflow";
  steps: WorkflowStep[];
}

export interface GridItem {
  icon: string;
  title: string;
  description: string;
  color?: string;
}

export interface GridBlock {
  type: "grid";
  items: GridItem[];
}

export type GuideBlock =
  | TextBlock
  | HeadingBlock
  | CalloutBlock
  | StepsBlock
  | TableBlock
  | StatusesBlock
  | AccordionBlock
  | WorkflowBlock
  | GridBlock;

export interface GuideSubSection {
  id: string;
  title: string;
  blocks: GuideBlock[];
}

export interface GuideSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  badge?: string;
  subSections: GuideSubSection[];
}

export interface GuideData {
  title: string;
  subtitle: string;
  lastUpdated: string;
  version: string;
  sections: GuideSection[];
}
