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
  type OpenCodeBootstrapDefaults,
  type OpenCodeBootstrapInput,
  type OpenCodeBootstrapOutput,
} from "./bootstrap";
export { OpenCodeCrewBeePlugin } from "./plugin";
export {
  createOpenCodeAgentConfig,
  createOpenCodeAgentConfigs,
  createProjectedAgentAliasEntries,
  createProjectedAgentAliasIndex,
  createProjectedAgentTaskAliasHelpLines,
  createOpenCodeConfigKey,
  createOpenCodeAgentConfigPatch,
  createOpenCodeAgentDefinition,
  createOpenCodePublicAgentName,
  findProjectedAgentByConfigKey,
  findProjectedAgentByPublicName,
  resolveProjectedAgentAlias,
  resolveProjectedAgentSelection,
  type OpenCodeAgentSelectionInput,
  type OpenCodeAgentAliasEntry,
  type OpenCodeAgentConfigPatch,
  type OpenCodeAgentDefinition,
  type OpenCodeAgentConfig,
  type OpenCodeAgentRuntimeConfig,
  type OpenCodeAgentMetadata,
  type OpenCodeAgentMode,
} from "./projection";

export { createOpenCodePermissionRules, type OpenCodePermissionAction, type OpenCodePermissionRule } from "./permission-mapper";
export { createOpenCodeAgentPrompt } from "./prompt-builder";
export { createOpenCodeToolDomainPlan, type OpenCodeToolDomainPlan } from "./tool-domain";
