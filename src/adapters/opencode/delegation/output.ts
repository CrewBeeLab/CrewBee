import { unwrapSdkResponse } from "./sdk-response";

interface PartLike {
  type: string;
  text?: string;
}

interface SessionMessageWithParts {
  info: { role: string; id: string; time?: { created?: number } };
  parts: PartLike[];
}

function isTextPart(part: PartLike): part is PartLike & { type: "text"; text: string } {
  return part.type === "text" && typeof part.text === "string";
}

function isAssistantMessage(message: SessionMessageWithParts): boolean {
  return message.info.role === "assistant";
}

function readMessageText(message: SessionMessageWithParts): string {
  return message.parts.filter(isTextPart).map((part) => part.text).join("\n").trim();
}

export async function listSessionMessages(client: { session: { messages(input: { path: { id: string } }): Promise<unknown> } }, sessionID: string): Promise<SessionMessageWithParts[]> {
  return unwrapSdkResponse(await client.session.messages({ path: { id: sessionID } })) as SessionMessageWithParts[];
}

export async function getSessionAnchor(client: { session: { messages(input: { path: { id: string } }): Promise<unknown> } }, sessionID: string): Promise<number> {
  return (await listSessionMessages(client, sessionID)).length;
}

export async function extractAssistantText(client: { session: { messages(input: { path: { id: string } }): Promise<unknown> } }, sessionID: string, anchor: number): Promise<string> {
  const messages = await listSessionMessages(client, sessionID);
  const next = messages.slice(anchor).filter(isAssistantMessage);
  return next.map(readMessageText).filter(Boolean).at(-1) ?? "";
}

export async function hasNoTextTail(client: { session: { messages(input: { path: { id: string } }): Promise<unknown> } }, sessionID: string, compactedAt: number): Promise<boolean> {
  const messages = await listSessionMessages(client, sessionID);
  const latest = [...messages].reverse().find((item) => isAssistantMessage(item));
  if (!latest) {
    return false;
  }

  const created = latest.info.time?.created ?? 0;
  if (created < compactedAt) {
    return false;
  }

  return readMessageText(latest).length === 0;
}
