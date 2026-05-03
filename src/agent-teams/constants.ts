export const TEAM_CONFIG_ROOT = "teams";
export const CREWBEE_CONFIG_FILE = "crewbee.json";
export const BUILTIN_CODING_TEAM_ID = "coding-team";
export const DEFAULT_EMBEDDED_TEAM_PRIORITY = 0;
export const DEFAULT_FILE_TEAM_PRIORITY = 1;

export const EMBEDDED_TEAM_IDS = [BUILTIN_CODING_TEAM_ID] as const;

export const BUILTIN_CODING_TEAM_MODEL_PRESET = "sota-2026-05";
export const BUILTIN_CODING_TEAM_MODEL_FALLBACK = "builtin-role-chain";
export const BUILTIN_CODING_TEAM_FALLBACK_TO_HOST_DEFAULT = true;

export const BUILTIN_CODING_TEAM_AGENT_MODELS: Record<string, string> = {
  "coding-leader": "openai/gpt-5.5",
  "coordination-leader": "openai/gpt-5.5",
  "coding-executor": "openai/gpt-5.5",
  "codebase-explorer": "openai/gpt-5.4-mini",
  "web-researcher": "google/gemini-3.1-pro-preview",
  reviewer: "anthropic/claude-opus-4-7",
  "principal-advisor": "anthropic/claude-opus-4-7",
  "multimodal-looker": "google/gemini-3.1-pro-preview",
};
