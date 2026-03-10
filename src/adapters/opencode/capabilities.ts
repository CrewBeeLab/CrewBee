import type { HostCapabilityContract } from "../../core";

export function createOpenCodeCapabilityContract(): HostCapabilityContract {
  return {
    supportsAgentRegistration: true,
    supportsAgentSwitching: true,
    supportsNativeAgentSelection: true,
    supportsNativeModelSelection: true,
    supportsCliOverrides: true,
    supportsSingleExecutorMode: true,
    supportsTeamCollaboration: true,
    supportsRuntimeEvents: true,
    supportsToolDomainInjection: true,
    supportsSessionLogExport: true,
  };
}
