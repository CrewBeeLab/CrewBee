import type { Plugin } from "@opencode/plugin";

import { logCrewBeeV2 } from "./logging";

export interface CrewBeeV2PromptBody {
  agent?: string;
  model?: { providerID: string; modelID: string };
  noReply?: boolean;
  parts: Array<{ type: "text"; text: string }>;
}

export interface CrewBeeV2PromptInput {
  path: { id: string };
  body: CrewBeeV2PromptBody;
}

export interface CrewBeeV2MessagePart {
  type: string;
  text?: string;
}

export interface CrewBeeV2SessionMessage {
  info: { role: string; id: string; time?: { created?: number } };
  parts: CrewBeeV2MessagePart[];
}

/**
 * Structural equivalent of the V1 SDK client subset used by CrewBee's delegation engine.
 * Keeping the same shape lets the existing, well-tested delegation code run unchanged on V2.
 */
export interface CrewBeeV2SessionClient {
  session: {
    abort(input: { path: { id: string } }): Promise<unknown>;
    create(input: { body: { parentID: string; title: string } }): Promise<unknown>;
    get(input: { path: { id: string } }): Promise<unknown>;
    messages(input: { path: { id: string } }): Promise<unknown>;
    prompt(input: CrewBeeV2PromptInput): Promise<unknown>;
    promptAsync(input: CrewBeeV2PromptInput): Promise<unknown>;
    todo(input: { path: { id: string } }): Promise<unknown>;
  };
}

interface V2MessageLike {
  id?: string;
  type?: string;
  role?: string;
  time?: { created?: number };
  content?: Array<{ type?: string; text?: string }>;
  error?: unknown;
}

function normalizeRole(message: V2MessageLike): string {
  if (typeof message.type === "string") {
    return message.type;
  }

  return typeof message.role === "string" ? message.role : "unknown";
}

function normalizeMessage(message: V2MessageLike): CrewBeeV2SessionMessage {
  const role = normalizeRole(message);
  const content = Array.isArray(message.content) ? message.content : [];
  const parts: CrewBeeV2MessagePart[] = [];

  for (const part of content) {
    if (part?.type === "text" && typeof part.text === "string") {
      parts.push({ type: "text", text: part.text });
    }
  }

  return {
    info: {
      role,
      id: typeof message.id === "string" ? message.id : "",
      time: message.time,
    },
    parts,
  };
}

function extractPromptText(body: CrewBeeV2PromptBody): string {
  return body.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

async function applySessionTarget(
  ctx: Plugin.Context,
  sessionID: string,
  body: CrewBeeV2PromptBody,
): Promise<void> {
  if (body.agent) {
    await ctx.session.switchAgent({ sessionID, agent: body.agent });
  }

  if (body.model) {
    await ctx.session.switchModel({
      sessionID,
      model: { providerID: body.model.providerID, id: body.model.modelID },
    });
  }
}

function describeLastAssistantError(messages: readonly unknown[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as V2MessageLike | undefined;
    if (!message || normalizeRole(message) !== "assistant" || message.error === undefined || message.error === null) {
      continue;
    }

    try {
      return JSON.stringify(message.error);
    } catch {
      return String(message.error);
    }
  }

  return undefined;
}

async function waitForSession(
  ctx: Plugin.Context,
  sessionID: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    await ctx.session.interrupt({ sessionID, resume: false }).catch(() => undefined);
    throw new Error("Delegated session aborted before execution.");
  }

  const onAbort = () => {
    void ctx.session.interrupt({ sessionID, resume: false }).catch(() => undefined);
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    await ctx.session.wait({ sessionID });
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }

  const info = await ctx.session.get({ sessionID }).catch(() => undefined) as { outcome?: string } | undefined;
  if (info?.outcome === "failed") {
    const messages = await ctx.session.context({ sessionID }).catch(() => []);
    const detail = describeLastAssistantError(messages) ?? "unknown error";
    throw new Error(`Delegated session execution failed: ${detail}`);
  }
}

async function runPrompt(
  ctx: Plugin.Context,
  input: CrewBeeV2PromptInput,
  options: { wait: boolean; signal?: AbortSignal },
): Promise<unknown> {
  await applySessionTarget(ctx, input.path.id, input.body);

  const text = extractPromptText(input.body);
  if (!text) {
    return { id: input.path.id };
  }

  await ctx.session.prompt({ sessionID: input.path.id, text });

  if (options.wait) {
    await waitForSession(ctx, input.path.id, options.signal);
  }

  return { id: input.path.id };
}

/**
 * Adapts the OpenCode V2 session domain to the V1-shaped client surface CrewBee already uses.
 *
 * V2 differences handled here:
 * - `prompt` only admits the message to the inbox: foreground delegation must `wait` for idle.
 * - `promptAsync` no longer exists: a non-awaited `prompt` has the same semantics.
 * - `todo` no longer exists: the continuity snapshot degrades to an empty list.
 * - messages are `SessionMessageInfo` records instead of `{info, parts}` pairs.
 */
export function createV2SessionClient(
  ctx: Plugin.Context,
  options: { getAbortSignal?: () => AbortSignal | undefined } = {},
): CrewBeeV2SessionClient {
  return {
    session: {
      async abort(input) {
        await ctx.session.interrupt({ sessionID: input.path.id, resume: false });
        return {};
      },
      async create(input) {
        return await ctx.session.create({
          parentID: input.body.parentID,
          title: input.body.title,
        });
      },
      async get(input) {
        return await ctx.session.get({ sessionID: input.path.id });
      },
      async messages(input) {
        const messages = await ctx.session.context({ sessionID: input.path.id });
        return (messages as readonly V2MessageLike[]).map(normalizeMessage);
      },
      async prompt(input) {
        return await runPrompt(ctx, input, { wait: true, signal: options.getAbortSignal?.() });
      },
      async promptAsync(input) {
        return await runPrompt(ctx, input, { wait: false, signal: options.getAbortSignal?.() });
      },
      async todo() {
        await logCrewBeeV2(
          "OpenCode V2 has no session todo API; delegation continuity snapshots are disabled",
          undefined,
          "debug",
        );
        return [];
      },
    },
  };
}
