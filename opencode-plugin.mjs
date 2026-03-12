import mod from "./dist/src/adapters/opencode/plugin.js"

const plugin = mod.OpenCodeCrewBeePlugin ?? mod.default ?? mod

export const OpenCodeCrewBeePlugin = plugin
export default plugin
