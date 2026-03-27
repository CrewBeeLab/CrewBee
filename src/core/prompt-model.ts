export interface PromptProjectionSpec {
  include?: string[];
  exclude?: string[];
  labels?: Record<string, string>;
}

export type LoadedDocumentKind = "team" | "agent";

export interface LoadedBodySection {
  key: string;
  title: string;
  rawMarkdown: string;
  order: number;
}

export interface LoadedProfileDocument {
  kind: LoadedDocumentKind;
  metadata: Record<string, unknown>;
  content: Record<string, unknown>;
  promptProjection?: PromptProjectionSpec;
  sourceOrder: string[];
  bodySections?: LoadedBodySection[];
}

export type PromptScalar = string | number | boolean;
export type PromptValue = PromptScalar | PromptValue[] | { [key: string]: PromptValue };

export interface PromptBlock {
  key: string;
  path: string;
  value: PromptValue;
  order: number;
  source: "frontmatter" | "body";
  title?: string;
}

export interface NormalizedProfileDocument {
  kind: LoadedDocumentKind;
  metadata: Record<string, PromptValue>;
  blocks: PromptBlock[];
  promptProjection?: PromptProjectionSpec;
}

export type PromptNodeKind = "scalar" | "array" | "object";

export interface PromptNode {
  path: string;
  key: string;
  label: string;
  kind: PromptNodeKind;
  value: PromptValue;
  children?: PromptNode[];
  order: number;
  visibleByDefault: boolean;
}

export interface PromptCatalog {
  kind: LoadedDocumentKind;
  nodes: PromptNode[];
}

export interface PromptPlanSection {
  path: string;
  title: string;
  order: number;
  node: PromptNode;
}

export interface PromptPlan {
  sections: PromptPlanSection[];
}
