import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const built = path.join(root, "dist", "src", "adapters", "opencode", "plugin.js")

if (!fs.existsSync(built)) {
  throw new Error("Missing build output. Run `npm run build` before running the compact check.")
}

const args = parseArgs({
  options: {
    json: { type: "boolean" },
    outdir: { type: "string" },
    worktree: { type: "string" },
  },
})

const asJson = Boolean(args.values.json)
const worktree = args.values.worktree ? path.resolve(args.values.worktree) : fs.mkdtempSync(path.join(os.tmpdir(), "crewbee-compact-check-"))
const outroot = args.values.outdir ? path.resolve(args.values.outdir) : path.join(root, "simulators", "runs")
const pluginEntry = pathToFileURL(path.join(root, "dist", "src", "adapters", "opencode", "plugin.js")).href

function mkdir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function stamp(now = new Date()) {
  const pad = (n, size = 2) => String(n).padStart(size, "0")
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}`
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

function parseJson(text) {
  return JSON.parse(text)
}

function createToolContext(sessionID) {
  return {
    sessionID,
    messageID: "msg-parent",
    agent: "coding-leader",
    directory: worktree,
    worktree,
    abort: new AbortController().signal,
    metadata() {},
  }
}

function createFixture() {
  const sessions = new Map()
  const logs = []
  let counter = 0

  const runPrompt = async ({ path: p, body }) => {
    const session = sessions.get(p.id)
    if (!session) {
      throw new Error(`missing session: ${p.id}`)
    }

    if (body.noReply) {
      session.messages.push({
        info: { role: "user", id: `msg-${++counter}`, time: { created: Date.now() } },
        parts: body.parts,
        _promptText: body.parts?.[0]?.text,
      })
      return { id: `msg-${counter}` }
    }

    session.messages.push({
      info: { role: "assistant", id: `msg-${++counter}`, time: { created: Date.now() } },
      parts: [{ type: "text", text: `done by ${body.agent}` }],
      _promptText: body.parts?.[0]?.text,
    })
    return { id: `msg-${counter}` }
  }

  sessions.set("ses-parent", {
    messages: [],
    todos: [{ id: "todo-1", content: "Ship feature", status: "in_progress", priority: "high" }],
  })

  return {
    logs,
    sessions,
    input: {
      client: {
        app: {
          log: async ({ body }) => {
            logs.push(body)
          },
        },
        session: {
          create: async ({ body }) => {
            const id = `ses-child-${++counter}`
            sessions.set(id, { parentID: body.parentID, title: body.title, messages: [], todos: [] })
            return { id }
          },
          get: async ({ path: p }) => {
            const session = sessions.get(p.id)
            if (!session) throw new Error("missing session")
            return { id: p.id, title: session.title ?? p.id }
          },
          messages: async ({ path: p }) => sessions.get(p.id)?.messages ?? [],
          prompt: runPrompt,
          promptAsync: runPrompt,
          abort: async () => true,
          todo: async ({ path: p }) => sessions.get(p.id)?.todos ?? [],
        },
      },
      project: { id: "compact-check", directory: worktree, worktree },
      directory: worktree,
      worktree,
      serverUrl: new URL("http://localhost:4096"),
      $() {
        throw new Error("shell unavailable")
      },
    },
  }
}

function evaluate(summary) {
  return {
    hasCheckpointSection: /Checkpointed Agent Configuration/.test(summary.compactionContext),
    hasTodoSnapshot: /Todo Snapshot/.test(summary.compactionContext) && /Ship feature/.test(summary.compactionContext),
    hasBackgroundDelegation: new RegExp(summary.background.session_id).test(summary.compactionContext),
    hasForegroundDelegation: new RegExp(summary.foreground.session_id).test(summary.compactionContext),
    compactedEventDidNotInjectMessages: summary.messageCounts.afterCompacted === summary.messageCounts.beforeCompacted,
  }
}

function createTextSummary(run) {
  const lines = [
    "CrewBee OpenCode Compact Check",
    "==============================",
    `Plugin Entry: ${run.pluginEntry}`,
    `Worktree: ${run.worktree}`,
    `Output Dir: ${run.outputDir}`,
    "",
    "Delegation Summary",
    "------------------",
    `Foreground session: ${run.foreground.session_id}`,
    `Background session: ${run.background.session_id}`,
    "",
    "Checks",
    "------",
    ...Object.entries(run.checks).map(([key, value]) => `- ${key}: ${value ? "PASS" : "FAIL"}`),
    "",
    "Message Counts",
    "--------------",
    `Before session.compacted: ${run.messageCounts.beforeCompacted}`,
    `After session.compacted: ${run.messageCounts.afterCompacted}`,
    "",
    "Compaction Context",
    "------------------",
    run.compactionContext,
    "",
    "Plugin Logs",
    "-----------",
    ...(run.logs.length ? run.logs.map((log) => `- [${log.level}] ${log.message}`) : ["(none)"]),
  ]

  return `${lines.join("\n")}\n`
}

const fixture = createFixture()
const mod = await import(pluginEntry)
const plugin = await mod.OpenCodeCrewBeePlugin(fixture.input)
const config = { agent: {} }

await plugin.config?.(config)
await plugin["chat.message"]?.(
  { sessionID: "ses-parent", agent: "coding-leader", model: { providerID: "openai", modelID: "gpt-5.4" } },
  { message: { role: "user", parts: [] }, parts: [] },
)

const foreground = parseJson(await plugin.tool.delegate_task.execute(
  { agent: "coding-reviewer", prompt: "Review the current implementation.", mode: "foreground" },
  createToolContext("ses-parent"),
))
const background = parseJson(await plugin.tool.delegate_task.execute(
  { agent: "coding-reviewer", prompt: "Review the current implementation.", mode: "background" },
  createToolContext("ses-parent"),
))

await plugin.event?.({ event: { type: "session.status", properties: { sessionID: background.session_id, status: { type: "busy" } } } })
await plugin.event?.({ event: { type: "session.idle", properties: { sessionID: background.session_id } } })

const compacting = { context: [], prompt: undefined }
await plugin["experimental.session.compacting"]?.({ sessionID: "ses-parent" }, compacting)

const beforeCompacted = fixture.sessions.get("ses-parent").messages.length
await plugin.event?.({ event: { type: "session.compacted", properties: { sessionID: "ses-parent" } } })
const afterCompacted = fixture.sessions.get("ses-parent").messages.length

const timestamp = stamp()
const outputDir = reserve(path.join(outroot, `compact-check-${timestamp}`))
const summary = {
  timestamp,
  outputDir,
  pluginEntry: "dist/src/adapters/opencode/plugin.js",
  worktree,
  foreground,
  background,
  compactionContext: compacting.context.join("\n\n"),
  messageCounts: {
    beforeCompacted,
    afterCompacted,
  },
  logs: fixture.logs,
}
summary.checks = evaluate(summary)
summary.ok = Object.values(summary.checks).every(Boolean)

writeJson(outputDir, "summary.json", summary)
writeText(outputDir, "summary.txt", createTextSummary(summary))
writeText(outputDir, "compaction-context.txt", summary.compactionContext)
writeJson(outputDir, "config.after.json", config)
writeJson(outputDir, "sessions.json", Object.fromEntries(fixture.sessions.entries()))

if (asJson) {
  console.log(JSON.stringify(summary, null, 2))
} else {
  process.stdout.write(createTextSummary(summary))
  console.log(`Artifacts written to: ${outputDir}`)
}

if (!summary.ok) {
  process.exitCode = 1
}
