import fs from "node:fs"
import path from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const built = path.join(root, "dist", "src", "adapters", "opencode", "plugin.js")

if (!fs.existsSync(built)) {
  throw new Error("Missing build output. Run `npm run build` before running the simulator.")
}

const args = parseArgs({
  options: {
    worktree: { type: "string" },
    agent: { type: "string" },
    session: { type: "string" },
    json: { type: "boolean" },
    outdir: { type: "string" },
  },
})

const worktree = args.values.worktree ? path.resolve(args.values.worktree) : root
const sessionID = args.values.session ?? "sim-session-1"
const selected = args.values.agent
const asJson = Boolean(args.values.json)
const outroot = args.values.outdir ? path.resolve(args.values.outdir) : path.join(root, "simulators", "runs")
const pluginEntry = pathToFileURL(path.join(root, "opencode-plugin.mjs")).href

function stamp(now = new Date()) {
  const pad = (n, size = 2) => String(n).padStart(size, "0")
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`
}

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function reserve(dir) {
  if (!fs.existsSync(dir)) {
    mkdir(dir)
    return dir
  }

  let i = 1
  while (true) {
    const next = `${dir}-${i}`
    if (!fs.existsSync(next)) {
      mkdir(next)
      return next
    }
    i += 1
  }
}

function writeJson(dir, name, value) {
  fs.writeFileSync(path.join(dir, name), `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(dir, name, value) {
  fs.writeFileSync(path.join(dir, name), value.endsWith("\n") ? value : `${value}\n`)
}

const logs = []
const shell = () => {
  throw new Error("Shell access is not available in the simulator.")
}

const input = {
  client: {
    app: {
      log: async ({ body }) => {
        logs.push(body)
      },
    },
  },
  project: {
    id: "simulated-project",
    directory: worktree,
    worktree,
  },
  directory: worktree,
  worktree,
  get serverUrl() {
    throw new Error("serverUrl is no longer supported in plugins")
  },
  $: shell,
}

async function loadHooks() {
  const mod = await import(pluginEntry)
  const seen = new Set()
  const hooks = []
  const loaded = []

  for (const [name, fn] of Object.entries(mod)) {
    if (typeof fn !== "function") continue
    if (seen.has(fn)) continue
    seen.add(fn)
    const value = await fn(input)
    hooks.push({ name, value })
    loaded.push({
      exportName: name,
      hookNames: Object.keys(value),
    })
  }

  return { hooks, loaded }
}

async function applyConfig(hooks, cfg) {
  for (const hook of hooks) {
    if (!hook.value.config) continue
    await hook.value.config(cfg)
  }
}

async function triggerMessage(hooks, agent) {
  const input = {
    sessionID,
    agent,
  }
  const output = {
    message: { role: "user", parts: [] },
    parts: [],
  }

  for (const hook of hooks) {
    if (!hook.value["chat.message"]) continue
    await hook.value["chat.message"](input, output)
  }

  return { input, output }
}

async function triggerSystem(hooks) {
  const input = {
    sessionID,
    model: {
      id: "simulated-model",
      providerID: "simulated",
      modelID: "simulated",
    },
  }
  const output = { system: [] }

  for (const hook of hooks) {
    if (!hook.value["experimental.chat.system.transform"]) continue
    await hook.value["experimental.chat.system.transform"](input, output)
  }

  return { input, output }
}

function summarizeConfig(cfg) {
  const agents = Object.entries(cfg.agent ?? {}).map(([key, value]) => ({
    key,
    value,
  }))
  const visible = agents.filter((agent) => !agent.value.hidden)
  const hidden = agents.filter((agent) => agent.value.hidden)

  return {
    defaultAgent: cfg.default_agent ?? null,
    agentCount: agents.length,
    visibleAgentCount: visible.length,
    hiddenAgentCount: hidden.length,
    visibleAgents: visible.map((agent) => ({
      key: agent.key,
      name: agent.value.name,
      mode: agent.value.mode,
    })),
  }
}

function createSummary(run) {
  return {
    timestamp: run.timestamp,
    outputDir: run.outputDir,
    worktree: run.worktree,
    pluginEntry: run.pluginEntry,
    sessionID: run.sessionID,
    selectedAgent: run.selectedAgent,
    loadedPlugins: run.loaded,
    config: summarizeConfig(run.config.after),
    logs: run.logs,
    systemLines: run.system.output.system,
  }
}

function createTextSummary(summary) {
  const lines = [
    "OpenCode Runtime Simulator",
    "==========================",
    `Timestamp: ${summary.timestamp}`,
    `Output Dir: ${summary.outputDir}`,
    `Worktree: ${summary.worktree}`,
    `Plugin Entry: ${summary.pluginEntry}`,
    `Session ID: ${summary.sessionID}`,
    `Selected Agent: ${summary.selectedAgent ?? "(none)"}`,
    "",
    "Loaded Plugin Exports",
    "---------------------",
    ...summary.loadedPlugins.map((plugin) => `- ${plugin.exportName}: ${plugin.hookNames.join(", ") || "no hooks"}`),
    "",
    "Config Result",
    "-------------",
    `Default Agent: ${summary.config.defaultAgent ?? "(none)"}`,
    `Agent Count: ${summary.config.agentCount}`,
    `Visible Agents: ${summary.config.visibleAgentCount}`,
    `Hidden Agents: ${summary.config.hiddenAgentCount}`,
    ...summary.config.visibleAgents.map((agent) => `- ${agent.name} -> ${agent.key} (${agent.mode})`),
    "",
    "System Output",
    "-------------",
    ...(summary.systemLines.length ? summary.systemLines : ["(none)"]),
    "",
    "Plugin Logs",
    "-----------",
    ...(summary.logs.length
      ? summary.logs.map((log) => `- [${log.level}] ${log.message}`)
      : ["(none)"]),
  ]

  return `${lines.join("\n")}\n`
}

const { hooks, loaded } = await loadHooks()
const before = { agent: {} }
const cfg = structuredClone(before)

await applyConfig(hooks, cfg)

const chosenAgent = selected
  ?? (typeof cfg.default_agent === "string" ? cfg.default_agent : undefined)
  ?? Object.keys(cfg.agent ?? {})[0]

const message = await triggerMessage(hooks, chosenAgent)
const system = await triggerSystem(hooks)

const timestamp = stamp()
const outputDir = reserve(path.join(outroot, timestamp))

const run = {
  timestamp,
  outputDir,
  worktree,
  pluginEntry: "opencode-plugin.mjs",
  sessionID,
  selectedAgent: chosenAgent ?? null,
  loaded,
  logs,
  config: {
    before,
    after: cfg,
  },
  message,
  system,
}

const summary = createSummary(run)

writeJson(outputDir, "plugin-load.json", loaded)
writeJson(outputDir, "config.before.json", before)
writeJson(outputDir, "config.after.json", cfg)
writeJson(outputDir, "chat.message.input.json", message.input)
writeJson(outputDir, "chat.message.output.json", message.output)
writeJson(outputDir, "system.input.json", system.input)
writeJson(outputDir, "system.output.json", system.output)
writeJson(outputDir, "logs.json", logs)
writeJson(outputDir, "summary.json", summary)
writeText(outputDir, "summary.txt", createTextSummary(summary))

if (asJson) {
  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
}

process.stdout.write(createTextSummary(summary))
console.log(`Artifacts written to: ${outputDir}`)
