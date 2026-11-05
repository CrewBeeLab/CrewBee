import { OpenCodeCrewBeePlugin } from "./plugin-v1";
import { crewBeePluginV2, setupCrewBeeV2 } from "./v2/plugin";

export { OpenCodeCrewBeePlugin };
export { crewBeePluginV2, setupCrewBeeV2 };
export { CREWBEE_PLUGIN_ID } from "./v2/plugin";

/**
 * Dual OpenCode plugin entry point.
 *
 * - OpenCode V2 reads `id` + `setup` from the default export.
 * - OpenCode V1 reads `server` (a V1 plugin function) from the same default export.
 *
 * This is the compatibility shape documented by OpenCode for packages that must support both
 * plugin APIs during the V1 → V2 migration.
 */
const plugin = {
  ...crewBeePluginV2,
  server: OpenCodeCrewBeePlugin,
};

export const id = plugin.id;
export const setup = plugin.setup;
export const server = plugin.server;

export default plugin;
