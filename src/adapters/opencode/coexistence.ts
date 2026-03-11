export interface OpenCodeCoexistencePolicy {
  pluginId: "crewbee";
  dependsOnOhMyOpenCode: false;
  featureDevelopmentMode: "mutually-exclusive";
  safeWhenCoInstalled: boolean;
  reservedConfigKeyPrefix: string;
  reservedPublicNamePrefix: string;
  neverMutateForeignAgents: boolean;
}

export interface OpenCodeProjectionCollisionReport {
  configKeyCollisions: string[];
  publicNameCollisions: string[];
}

export interface OpenCodeProjectedIdentity {
  configKey: string;
  publicName: string;
}

export function createOpenCodeCoexistencePolicy(): OpenCodeCoexistencePolicy {
  return {
    pluginId: "crewbee",
    dependsOnOhMyOpenCode: false,
    featureDevelopmentMode: "mutually-exclusive",
    safeWhenCoInstalled: true,
    reservedConfigKeyPrefix: "crewbee.",
    reservedPublicNamePrefix: "[",
    neverMutateForeignAgents: true,
  };
}

export function detectOpenCodeProjectionCollisions(input: {
  projectedAgents: OpenCodeProjectedIdentity[];
  existingConfigKeys?: string[];
  existingPublicNames?: string[];
}): OpenCodeProjectionCollisionReport {
  const existingConfigKeys = new Set(input.existingConfigKeys ?? []);
  const existingPublicNames = new Set(input.existingPublicNames ?? []);

  return {
    configKeyCollisions: input.projectedAgents
      .filter((agent) => existingConfigKeys.has(agent.configKey))
      .map((agent) => agent.configKey),
    publicNameCollisions: input.projectedAgents
      .filter((agent) => existingPublicNames.has(agent.publicName))
      .map((agent) => agent.publicName),
  };
}
