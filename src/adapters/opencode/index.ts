export { createOpenCodeCapabilityContract } from "./capabilities";
export { applyOpenCodeAgentConfigPatch, type OpenCodeConfigLike, type OpenCodeConfigMergeResult } from "./config-merge";
export {
  createOpenCodeCoexistencePolicy,
  detectOpenCodeProjectionCollisions,
  type OpenCodeCoexistencePolicy,
  type OpenCodeProjectedIdentity,
  type OpenCodeProjectionCollisionReport,
} from "./coexistence";
export {
  createOpenCodeAdapterDefinition,
  createOpenCodeBootstrap,
  type OpenCodeAdapterDefaults,
  type OpenCodeBootstrapInput,
  type OpenCodeBootstrapOutput,
} from "./plugin";
export {
  createOpenCodeConfigKey,
  createOpenCodeAgentConfigPatch,
  createOpenCodeAgentDefinition,
  createOpenCodePublicAgentName,
  findProjectedAgentByConfigKey,
  findProjectedAgentByPublicName,
  projectCatalogAgentToOpenCode,
  projectCatalogToOpenCodeAgents,
  resolveProjectedAgentSelection,
  type OpenCodeAgentSelectionInput,
  type OpenCodeAgentConfigPatch,
  type OpenCodeAgentDefinition,
  type OpenCodeAgentConfig,
  type OpenCodeAgentCapabilities,
  type OpenCodeAgentMetadata,
  type OpenCodeAgentMode,
} from "./projection";

export { createOpenCodePermissionRules, type OpenCodePermissionAction, type OpenCodePermissionRule } from "./permission-mapper";
export { createOpenCodeAgentPrompt } from "./prompt-builder";
export { createOpenCodeToolDomainPlan, type OpenCodeToolDomainPlan } from "./tool-domain";
