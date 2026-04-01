const mod = await import("./dist/opencode-plugin.mjs")

const plugin = mod.default ?? mod

export default plugin
export const id = plugin.id
export const server = plugin.server
