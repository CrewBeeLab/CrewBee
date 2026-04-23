export interface CrewBeeManagedAgentOptions {
  managed: true;
  teamId: string;
  canonicalAgentId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isManagedCrewBeeAgentDefinition(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const options = value.options;
  if (!isRecord(options)) {
    return false;
  }

  const crewbee = options.crewbee;
  return isRecord(crewbee) && crewbee.managed === true;
}

export function createManagedCrewBeeAgentOptions(input: {
  teamId: string;
  canonicalAgentId: string;
  existingOptions?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    ...(input.existingOptions ?? {}),
    crewbee: {
      managed: true,
      teamId: input.teamId,
      canonicalAgentId: input.canonicalAgentId,
    } satisfies CrewBeeManagedAgentOptions,
  };
}
