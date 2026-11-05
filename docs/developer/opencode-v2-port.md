# CrewBee → OpenCode V2 — Analisi e piano di porting

> Documento di lavoro del fork `crewbee-v2`.
> Stato: **analisi completata, implementazione non ancora iniziata**.
> Autore del porting: Alessandro Muzzi (fork locale `~/Projects/crewbee-v2`, branch `feat/opencode-v2-port`).

---

## 1. Verdetto

CrewBee **non** è caricabile da OpenCode V2. Il pacchetto pubblicato (`crewbee@0.1.24`) implementa
l'API plugin di **OpenCode V1** (entrypoint = *funzione* plugin V1), mentre V2 richiede un
default export **oggetto** con `id` + `setup(ctx)`.

Il porting è fattibile: l'area interessata è circoscritta a `src/adapters/opencode/**` (5.162
righe incluse le deleghe), `src/install/**` (chiave di config) e `src/update/refresh.ts`.
Nessuna logica di dominio (Team library, projection, prompt building) deve essere riscritta:
 cambia solo il **contratto con l'host**.

Rischio stimato: **medio**. La parte delicata è la delegation (`task`/`subagent`), perché in V2
il tool si chiama `subagent`, l'evento di sessione ha una forma diversa e l'API `todo` non esiste più.

---

## 2. Ambiente di verifica

| Componente | Versione | Nota |
|---|---|---|
| opencode (installato) | **2.1.3** | `/opt/homebrew/Cellar/opencode-v2/2.1.3/bin/opencode` (homebrew-core `opencode` = 2.1.2) |
| `@opencode/plugin` (SDK V2) | **2.1.3** | analizzato per i tipi reali |
| `@opencode/plugin` latest npm | 2.2.0 | non allineato al binario locale |
| `@opencode-ai/plugin` (SDK V1) | 1.19.4 latest / 1.15.10 usato da CrewBee | linea V1 |
| `crewbee` npm latest | **0.1.24** | dipende da `@opencode-ai/plugin@1.14.48` |
| CrewBee upstream `main` | `3efe39b` (2026-07-25) | `package.json` → `@opencode-ai/plugin@1.15.10` |
| node / npm | 20.20.2 / 10.8.2 | `bun` **non** installato (i test upstream usano `node --test`) |

Documentazione di riferimento usata: `https://opencode.ai/v2/docs/build/plugins`,
`.../build/plugins/migrate-v1`, `.../build/plugins/server`, `.../agents`, `.../tools`.

---

## 3. Riproduzione del fallimento (V2)

Installazione isolata in `HOME` temporanea, `crewbee@0.1.24` scaricato da npm, poi:

```
$ opencode plugin add crewbee
Plugin "crewbee" installed and added to .../.config/opencode/opencode.json
$ opencode plugin list
ID  VERSION  SOURCE
-   -        crewbee
```

Log del server (`role=server`):

```
msg="loading plugin" id=crewbee entrypoint=file://.../crewbee/dist/opencode-plugin.mjs
level=WARN message="failed to load plugin" target=crewbee
  cause=PluginModule.LoadError: Plugin must export a default definition with an id and an effect or setup function.
        (cause: SchemaError(Expected object at ["default"]))
```

Conseguenze: nessun agente proiettato (`opencode debug agents` elenca solo `build`, `compaction`, …),
nessun tool `task`/`delegate_status`/`delegate_cancel`, nessun binding di sessione.

**Contro-prova V1** (stesso pacchetto, `opencode-ai@1.19.4`): il plugin si carica e proietta
`coding-coordination-leader`, `coding-executor`, `coding-codebase-explorer`, `coding-reviewer`, …
⇒ il problema è esclusivamente il contratto plugin, non la logica CrewBee.

---

## 4. Superficie V1 oggi usata da CrewBee

Riepilogo con file/linee (riferimenti a `main` @ `3efe39b`):

| # | Superficie V1 | Uso CrewBee | File |
|---|---|---|---|
| 1 | `PluginInput.client` (SDK V1) | sessioni, provider, log | `plugin.ts`, `logging.ts`, `delegation/*.ts` |
| 2 | `PluginInput.directory` / `.worktree` (stringa) | radice progetto / stato deleghe | `plugin.ts:38`, `delegation/store.ts` |
| 3 | `PluginInput.project` | — | non usato |
| 4 | hook `config` | iniezione agenti + `default_agent` | `config-hook.ts:73-123` |
| 5 | hook `tool` (map) | `task`, `delegate_status`, `delegate_cancel` | `plugin.ts:50-55`, `delegation/tools.ts` |
| 6 | hook `event` | fine deleghe background | `event-hook.ts` |
| 7 | hook `chat.message` | binding sessione↔team | `chat-message-hook.ts` |
| 8 | hook `tool.definition` | no-op | `tool-hooks.ts:76-78` |
| 9 | hook `tool.execute.before` | alias → config key di `subagent_type` | `tool-hooks.ts:80-99` |
| 10 | hook `tool.execute.after` | normalizzazione output del task | `tool-hooks.ts:101-125` |
| 11 | hook `experimental.chat.system.transform` | inietta contesto runtime CrewBee | `system-transform-hook.ts` |
| 12 | hook `experimental.session.compacting` | snapshot todo + contesto continuità | `compaction-hook.ts` |
| 13 | `client.session.create/prompt/promptAsync/messages/abort/todo` | motore di delegation | `delegation/tools.ts`, `output.ts`, `continuity.ts` |
| 14 | `client.config.providers()` | filtro disponibilità modelli | `model-availability.ts:30` |
| 15 | `client.app.log({body})` | logging strutturato | `logging.ts:14` |
| 16 | `tool()` helper (zod) + `ToolResult` stringa | definizione tool | `delegation/tools.ts:25-33` |
| 17 | formato agente V1 (`prompt`, `permission` map, `disable`, `tools`) | proiezione agenti | `projection.ts:254-344` |
| 18 | config `plugin: [...]` (chiave V1) | installazione | `install/opencode-config-file.ts:126` |
| 19 | `Plugin` type = funzione `(input, options) => Hooks` | entrypoint | `plugin.ts:19-86` |

---

## 5. Delta API V1 → V2 (verificato sui tipi `@opencode/plugin@2.1.3`)

### 5.1 Entrypoint e lifecycle

| V1 | V2 |
|---|---|
| `export const P: Plugin = async (ctx) => ({ ...hooks })` | `export default Plugin.define({ id: "crewbee", async setup(ctx) { ... } })` |
| `ctx` = `PluginInput` | `ctx` = `Context` (domini per dominio) |
| `options` (2° argomento) | `ctx.options` |
| `dispose()` restituito | `return () => {...}` da `setup` |
| hook `event` | `ctx.event.subscribe({ types, signal })` → `AsyncIterable` |
| — | **`id` obbligatorio** (storage scoping, diagnostica) |

### 5.2 Context

| V1 | V2 |
|---|---|
| `ctx.client.app.log({body})` | ❌ non esiste → `console.log/warn` (finestra server) |
| `ctx.directory` | `ctx.location.directory` |
| `ctx.worktree` (stringa) | ❌ non è una stringa → usare `ctx.location.directory` |
| `ctx.project` | `ctx.location.project` |
| `ctx.client.config.providers()` | `ctx.provider.list()` / `ctx.model.list()` |
| `ctx.client.session.*` | `ctx.session.*` (firme diverse) |

### 5.3 Hook → dominio

| V1 | V2 | Note |
|---|---|---|
| `config` (mutazione `cfg.agent`, `cfg.default_agent`) | `ctx.agent.transform(editor)` | `editor.add/update/remove/list/get`, `editor.default(id)` |
| `tool` map | `ctx.tool.transform(editor)` | `editor.add({name, description, input: JSONSchema, execute})` |
| `chat.message` | `ctx.session.hook("prompt", cb)` | evento: `{sessionID, messageID, prompt:{text,files,agents,skills}, metadata, delivery}` |
| `tool.execute.before` | `ctx.tool.hook("execute.before", cb)` | evento: `{tool, sessionID, agent, messageID, id, input}` — `input` mutabile |
| `tool.execute.after` | `ctx.tool.hook("execute.after", cb)` | evento: `{..., status, result}` — `result` = `Tool.Result` (`content`, `metadata`) |
| `experimental.chat.system.transform` | `ctx.session.hook("context", cb)` | `event.system` = `SystemPart[]` (non `string[]`) → push `{type:"text", text}` |
| `experimental.session.compacting` | `ctx.session.hook("compaction", cb)` | evento estende `SessionContext` (`system`, `messages`, `options`, `tools`) |
| `event` | `ctx.event.subscribe({types, signal})` | eventi V2: `session.idle`, `session.status`, `session.deleted`, `session.execution.failed`, `session.compaction.ended` |

### 5.4 Tool

| V1 | V2 |
|---|---|
| `tool({description, args: zodShape, execute})` | `editor.add({name, description, input: JSONSchema, execute})` |
| `args` zod | `input` JSON Schema |
| ritorno `string` | ritorno `{ content: string \| Content[], output?, metadata? }` |
| `ctx.metadata({title, metadata})` | `context.progress({...})` + `result.metadata` |
| `ctx.abort` (AbortSignal) | `context.signal` |
| `ctx.ask(...)` | `ctx.permission.assert(...)` (non usato da CrewBee) |
| nome tool delegazione: **`task`** | tool nativo V2: **`subagent`** (action permission `subagent`) |

### 5.5 Sessioni

| V1 (`client.session.*`) | V2 (`ctx.session.*`) |
|---|---|
| `create({path:{id}, body:{parentID,title}})` | `create({ parentID, title })` |
| `prompt({path:{id}, body:{agent,model,parts}})` | `prompt({ sessionID, text })` + `switchAgent({sessionID, agent})` + `switchModel({sessionID, model})` |
| `promptAsync` (background) | ❌ non esiste → `prompt()` è già non-bloccante (ammissione inbox); `wait({sessionID})` attende |
| `messages({path:{id}})` → `[{info, parts}]` | `context({sessionID})` → `SessionMessageInfo[]` (unione: `type:"assistant"`, `content:[{type:"text",text}]`) |
| `abort({path:{id}})` | `interrupt({sessionID, resume:false})` |
| `todo({path:{id}})` | ❌ **non esiste in V2** → degradazione (vedi §7.4) |

### 5.6 Formato agente

| V1 (`projection.ts:254-274`) | V2 |
|---|---|
| `name` | `id` (+ `name` display) |
| `prompt` | **`system`** |
| `permission: {edit:{allow:[…]}, bash:"ask"}` | **`permissions: [{action, resource, effect}]`** (ultima regola vince) |
| `model: "provider/model"` | `model: "provider/model#variant"` oppure `{providerID, model, variant}` |
| `temperature` / `top_p` | ⚠️ deprecati in V2; `request.body` **non è ancora inviato** (2.1.3) → vedi §7.5 |
| `mode: "primary"\|"subagent"` | `mode: "primary"\|"subagent"\|"all"` |
| `disable: true` | **`disabled: true`** |
| `tools: {…}` | ❌ non esiste → filtri tool via `permissions` (deny per azione) |
| `hidden` | `hidden` ✔ |
| `options.crewbee` (marker di ownership) | `request.body`? no → usare `metadata`/marker interno (vedi §7.6) |

Azioni permission V2 (da `docs/agents`): `shell`, `edit`, `subagent`, `read`, `glob`, `grep`,
`webfetch`, `websearch`, `skill`, `question`, `external_directory`, `doom_loop`, `*`.

### 5.7 Eventi (rinomina necessaria)

| V1 | V2 |
|---|---|
| `session.idle` | `session.idle` ✔ |
| `session.status` | `session.status` ✔ |
| `session.deleted` | `session.deleted` ✔ |
| `session.error` | ❌ → **`session.execution.failed`** |
| `session.compacted` | ❌ → **`session.compaction.ended`** |

---

## 6. Piano di modifica — file per file

### 6.1 `package.json` + build

- `dependencies`: `@opencode-ai/plugin@1.15.10` → **`@opencode/plugin@2.1.3`** (allineato al binario 2.1.3).
- `exports`: mantenuto `{".": "./dist/opencode-plugin.mjs", "./server": …}` ✔ (V2 accetta `.`/`./server`).
- `scripts/build-opencode-plugin.mjs`: invariato (esbuild bundla `src/adapters/opencode/plugin.ts`).
  Verificare che il bundle **non** contenga più import residui da `@opencode-ai/plugin` (i `import type`
  spariscono, ma `zod` resta necessario per gli schemi → in V2 useremo JSON Schema puro per i tool).
- `types`: `dist/src/adapters/opencode/plugin.d.ts` → ok.

### 6.2 `src/adapters/opencode/plugin.ts` — riscrittura principale

Nuova struttura:

```ts
import { Plugin } from "@opencode/plugin";
export default Plugin.define({
  id: "crewbee",
  async setup(ctx) {
    // 1. auto-repair config file (ctx.location.directory al posto di ctx.worktree)
    // 2. load + validate TeamLibrary
    // 3. bootstrap (availableModels da ctx.model.list())
    // 4. ctx.agent.transform(...)  → proietta agenti + default agent
    // 5. ctx.tool.transform(...)   → registra task/subagent + delegate_status + delegate_cancel
    // 6. ctx.session.hook("prompt") → binding sessione
    // 7. ctx.session.hook("context")→ contesto runtime nel system prompt
    // 8. ctx.session.hook("compaction") → continuità
    // 9. ctx.tool.hook("execute.before"/"execute.after") → alias/risultato
    // 10. ctx.event.subscribe() → fine deleghe background
    return () => controller.abort();   // cleanup
  },
});
```

Decisione: **un unico file di entrypoint V2** + un **adapter legacy V1** (`plugin.v1.ts`) che
esporta l'attuale implementazione, così si può mantenere la compatibilità con OpenCode 1.x
nello stesso pacchetto (shape duale: `default` V2 + `server` V1, come suggerito dalla guida
"Support V1 and V2 from one package"). *Da decidere con l'utente: mantenere V1 o tagliare V1.*

### 6.3 `config-hook.ts` → `agent-transform.ts`

- Rimuovere l'hook `config` e la logica di merge su `cfg.agent` (`config-merge.ts` resta solo per
  la logica di collisione/ownership, non più per mutare la config).
- Nuovo: `ctx.agent.transform((editor) => { for (const agent of projected) editor.add(toV2Agent(agent)); editor.default(defaultKey) })`.
- `editor.update(id, ...)` per aggiornare gli agenti già presenti (idempotenza al reload).
- **Attenzione**: i transform sono replayable e sincroni → caricare i dati (model registry, Team library)
  **prima** della registrazione e catturarli nella closure; per ricaricare: `ctx.agent.reload()`.

### 6.4 `projection.ts` — formato agente V2

- `createOpenCodeAgentDefinition()` → nuova `createV2AgentDefinition(agent)` che produce:
  `{ id, name, description, mode, hidden, model, system, permissions, color?, steps? }`.
- `prompt` → `system` (stesso testo prodotto da `createOpenCodeAgentPrompt`).
- `model`: stringa `"provider/model#variant"` (stesso contenuto di oggi).
- Marker di ownership: V2 `Agent.Info` non ha `options` ⇒ usare il campo `request.body`? no.
  → usare un campo libero non consentito dallo schema ⇒ **decidere**: tenere il marker in una
  `Map` in memoria del plugin (ownership = "agent creato da CrewBee" si può dedurre dal prefisso
  `coding-*`/dal fatto che è stato registrato da questo plugin) e usare `ctx.agent.list()` per il check.

### 6.5 `permission-mapper.ts` — mappa V1 → V2

Conversione meccanica:
- `{edit: {allow:["*.ts"], deny:[".env"]}}` → `[{action:"edit", resource:"*.ts", effect:"allow"}, {action:"edit", resource:".env", effect:"deny"}]`
- `{bash:"ask"}` → `[{action:"shell", resource:"*", effect:"ask"}]`
- action-only V1 (`doom_loop`, `question`, `todowrite`, `webfetch`, `websearch`) → action V2
  (`doom_loop`, `question`, `webfetch`, `websearch`; `todowrite` non esiste in V2 → mappare su `skill`? no: **eliminare**).
- `task` (V1) → **`subagent`** (V2), con `resource` = agent id del membro CrewBee consentito.
- `write/patch/multiedit` → `edit`; `lsp_diagnostics` → n/a in V2 (rimuovere); `delegate_task` → `subagent`.

### 6.6 `tool-hooks.ts` + `delegation/tools.ts` — cuore del porting

- Definizione tool V2: `input` come **JSON Schema** (niente zod).
- Nome del tool: registrare **`subagent`** (override del builtin V2) mantenendo anche
  `task` come alias deprecato, oppure **solo** `task`? *Da decidere*: raccomando `subagent`
  (coerente col nativo V2) accettando `agent` **e** `subagent_type` come parametri.
- `execute.before`: riscrivere `event.input.subagent_type`/`event.input.agent` (V2 `input` mutabile).
- `execute.after`: il risultato è `Tool.Result`; normalizzare `result.content` (stringa) e `result.metadata`.
- `ctx.metadata({title})` → `context.progress({...})` e `result.metadata`.
- `ctx.abort` → `context.signal`.
- **Semantica delegazione** (V1 → V2):
  - foreground: `session.create({parentID,title})` → `session.switchAgent({sessionID, agent: configKey})`
    → `session.switchModel({sessionID, model})` → `session.prompt({sessionID, text: envelope})`
    → `session.wait({sessionID})` → `session.context({sessionID})` per estrarre il testo assistant.
  - background: stessa cosa **senza** `wait` (V2 `prompt` ammette e ritorna) + tracciamento stato
    via eventi `session.idle` / `session.execution.failed`.
  - `session.abort` → `session.interrupt({sessionID, resume:false})`.
  - estrazione testo: adattare `delegation/output.ts` al nuovo formato `SessionMessageInfo`
    (`type:"assistant"`, `content:[{type:"text",text}]`); l'anchor (indice messaggio) va ricalcolato
    perché il conteggio messaggi cambia forma.
  - gestione fallback modello "model not found": in V2 l'errore arriva come `SessionError` /
    eccezione dal prompt → stesso pattern (retry senza `model`).

### 6.7 `chat-message-hook.ts` → hook `prompt`

- V1 riceveva `{sessionID, agent, model}`; V2 `prompt` hook dà `{sessionID, messageID, prompt, delivery}`.
- **Il problema**: il hook `prompt` non espone l'agente selezionato né il modello ⇒
  l'agente va letto da `ctx.session.get({sessionID})` (la sessione ha `agent` e `model`).
  Verificare in implementazione se `Session.Info` espone `agent` (V2 sì: `agent` e `model` in `SessionInfo`).
- Alternativa più affidabile: usare l'evento `session.agent.selected` (V2) per il binding, e
  `ctx.session.hook("prompt")` solo come fallback ⇒ **raccomandato**.

### 6.8 `system-transform-hook.ts` → hook `context`

- `output.system.push(stringa)` → `event.system.push({type:"text", text: stringa})`.
- Applicare solo al flusso "primary" (l'hook `context` gira per il loop agent; per compaction/title
  usare hook separati) — verificare `event.kind`/`agent` per non inquinare le richieste ausiliarie.

### 6.9 `compaction-hook.ts` → hook `compaction`

- `output.context.push(...)` non esiste in V2 → `event.system.push({type:"text", text: contextContinuità})`.
- `captureTodoSnapshot` usa `client.session.todo` (inesistente in V2) → **degradare** (§7.4).

### 6.10 `event-hook.ts` → `ctx.event.subscribe()`

- Sostituire i nomi evento V1 con quelli V2 (§5.7).
- `session.error` → `session.execution.failed`; `session.compacted` → `session.compaction.ended`.
- Payload: gli eventi V2 hanno `{type, data}` (non `properties`) → adattare `resolveSessionID`.
- Loop `for await (const event of ctx.event.subscribe({types:[...], signal}))` con `AbortController`
  abortito nel cleanup restituito da `setup`.

### 6.11 `logging.ts`

- `ctx.client.app.log({body})` non esiste in V2 → `console.log`/`console.warn` con prefisso `[crewbee]`.
  Verificare che l'output finisca in `~/.local/share/opencode/log/opencode.log` (il server cattura
  stdout/stderr dei plugin in-process) → **verifica empirica obbligatoria**.

### 6.12 `model-availability.ts`

- `client.config.providers()` → `ctx.provider.list()` e/o `ctx.model.list()`.
  In V2 `Provider.Info` ha `models` come **Map** (non oggetto) → adattare l'estrazione
  `providerID/modelID` (attenzione: `Model.Info.id` vs `modelID`).

### 6.13 `delegation/continuity.ts`

- `captureTodoSnapshot` → nessuna API todo in V2 ⇒ snapshot vuoto + nota.
  Alternativa: leggere lo stato del tool `todowrite` dal transcript della sessione
  (`ctx.session.context({sessionID})` → messaggi con tool part `todowrite`) — implementabile
  se il transcript conserva l'input del tool (verificare).

### 6.14 `update/refresh.ts`

- Usa solo `ctx` per il logging ⇒ adattare la firma a `Context` (V2) o accettare un logger iniettato.
- Il resto (npm registry, lock, state file) è indipendente dall'host ✔.

### 6.15 `install/opencode-config-file.ts` — chiave di config

- Scrive `config.plugin = [...]` (chiave **V1**). In V2 la chiave è **`plugins`**.
- Gestire la migrazione: leggere `plugin` (legacy, ancora accettata dallo schema V2 come campo
  deprecato) e `plugins`; scrivere in `plugins`; mantenere `plugin` intatto se contiene altri plugin.
- `removeCrewBeePluginEntries` deve ripulire entrambe le chiavi.
- Formato entry: V2 accetta `"crewbee"`, `"crewbee@1.2.3"`, `"@scope/pkg"`, path assoluti e `file://`.
  → per il fork locale usare un **path assoluto** al pacchetto installato
  (es. `"plugins": ["/Users/…/Projects/crewbee-v2"]`) oppure pubblicare su npm.

### 6.16 `install/doctor.ts` + `uninstall.ts`

- `findCrewBeePluginEntries` deve leggere `plugins` (e `plugin` legacy).
- Aggiungere al doctor un controllo della **versione OpenCode** (`opencode --version` → major 2 ⇒
  plugin V2) e della **versione SDK** caricata.

### 6.17 `src/runtime/registries/plugin-tools.ts`

- I tool CrewBee registra sono `task`/`delegate_status`/`delegate_cancel` ⇒ in V2 il primo diventa
  `subagent` (alias `task` accettato). Aggiornare il registro e i test.

### 6.18 Test esistenti da aggiornare

`tests/opencode/*` e `tests/install/*` assumono il contratto V1 (forme `cfg.agent`, `permission` map,
`tool.execute.before(input, output)`, `chat.message`). Elenco:

- `tests/opencode/agent-ordering.test.mjs` — forma agente: adattare alle expectations V2.
- `tests/opencode/delegate-task.test.mjs` — `createDelegateTools` con client finto V1 → adattare.
- `tests/opencode/plugin-task-alias.test.mjs` — alias `subagent_type` → nuovo formato.
- `tests/opencode/model-availability.test.mjs` — `client.config.providers()` → `ctx.model.list()`.
- `tests/opencode/partial-team-load.test.mjs`
- `tests/install/plugin-entry.test.mjs` — chiave `plugin` → `plugins`.
- `tests/install/config-writer.test.mjs`, `doctor.test.mjs`, `install-user.test.mjs`, `uninstall.test.mjs`.

Aggiungere nuovi test:
- `tests/opencode/v2-agent-transform.test.mjs` — `Plugin.define` + `setup` con ctx finto ⇒ verifica
  che `ctx.agent.transform` venga chiamato con le definizioni V2 corrette.
- `tests/opencode/v2-tool-registration.test.mjs` — verifica `editor.add` con JSON Schema e `execute`.
- `tests/opencode/v2-hook-mapping.test.mjs` — mapping degli hook (prompt/context/compaction/tool).

---

## 7. Decisioni di design (punti che non mappano 1:1)

### 7.1 Tool delegazione: `task` vs `subagent`
V2 chiama il tool nativo `subagent` con action permission `subagent`. CrewBee ne ridefinisce il
comportamento (delegazione a membri del Team). **Proposta**: registrare `subagent` (override del
builtin) accettando `agent` | `subagent_type`, `description`, `prompt`, `background`, `task_id`;
mantenere `task` come alias secondario per compatibilità con prompt esistenti.
*Alternativa*: non sovrascrivere il builtin e delegare al `subagent` nativo, ma perderebbe il
controllo CrewBee su alias/permessi/nesting.

### 7.2 Binding sessione → agente
In V1 `chat.message` forniva `agent` e `model`. In V2 l'hook `prompt` non li dà.
**Proposta**: ascoltare l'evento `session.agent.selected` (+ `session.model.selected`) per il binding,
e usare `ctx.session.get({sessionID})` come fallback.

### 7.3 Attesa del risultato delegato
V1 `session.prompt` era bloccante (attendeva la risposta). In V2 `prompt` ammette e ritorna subito.
**Proposta**: foreground = `prompt` + `session.wait({sessionID})`; background = `prompt` senza wait.

### 7.4 Snapshot todo in compaction
Nessuna API todo in V2. **Proposta**: snapshot vuoto con nota esplicita nel contesto di continuità;
opzionalmente ricavare i todo dal transcript (`todowrite` tool parts).

### 7.5 Temperature / top_p per agente
In V2 `request.body` **non è ancora inviato** con le richieste modello (2.1.3, warning ufficiale).
**Proposta**: non impostare `temperature` per-agente; se indispensabile, usare l'hook
`ctx.session.hook("context", e => e.options.temperature = ...)` filtrato per `event.agent`.

### 7.6 Marker di ownership degli agenti
V2 `Agent.Info` non ha `options.crewbee`. **Proposta**: tenere un `Set<string>` in memoria con le
configKey proiettate da CrewBee e usare `ctx.agent.list()` per il controllo "non mutare agenti altrui".

### 7.7 Tool availability (`tools` map)
V2 non ha `tools` per agente. **Proposta**: tradurre `requestedTools` in regole permission
(`deny` sull'azione corrispondente) + prompt che elenca gli strumenti consentiti.

### 7.8 Compatibilità V1
Mantenere l'implementazione V1 nello stesso pacchetto (`default` = V2, `server` = V1) per non
rompere gli utenti OpenCode 1.x, oppure rilasciare solo V2 (più semplice, ma rompe la linea 1.x).
*Da decidere con l'utente.*

---

## 8. Strategia di installazione in V2

V2 installa i plugin npm in `~/.cache/opencode/npm/<pkg>@<ver>/<ts>/node_modules/<pkg>` e li
abilita con la chiave `plugins` nella config globale.

Opzioni per il fork:
1. **Path locale** (subito, senza publish): `"plugins": ["/Users/alessandro.muzzi/Projects/crewbee-v2"]`
   nella `~/.config/opencode/opencode.json`. V2 accetta directory locali con `package.json` + `exports`.
2. **npm privato/registry personale** (`npm login` + publish sotto il proprio scope): la via più pulita
   se si vuole distribuire; richiede `npm publish` e un nome tipo `crewbee-v2`.
3. **Tarball locale** installato in `~/.cache/opencode/npm/…` a mano: fragile.

*Da decidere con l'utente.* Per lo sviluppo → opzione 1; per l'uso reale → opzione 2.

---

## 9. Piano di test

1. **Unità** — `npm test` (repo usa `node --test`; `build` richiede `tsc`): estendere i test esistenti
   ai nuovi moduli V2.
2. **Typecheck** — `npm run typecheck` con `@opencode/plugin@2.1.3`.
3. **Simulator** — `npm run simulate:opencode` e `simulate:compact`: adattarli (simulano il runtime V1).
4. **Integrazione reale su opencode 2.1.3** (script automatizzato in `scripts/`):
   - `HOME` isolata + `opencode service set port <port>` (evita conflitti con il servizio reale)
   - `opencode plugin add <path>` / config con `plugins`
   - `opencode plugin list` → deve risultare **active**
   - `opencode debug agents` → devono comparire gli agenti CrewBee (`coding-*`)
   - `opencode debug config` → chiave `plugins` presente
   - log server: nessun `failed to load plugin`; presenza dei log `[crewbee]`
   - test funzionale: avvio sessione, `task` verso un membro del Team, verifica del risultato
     e dello stato `delegate_status`.
5. **Non regressione V1** (se si mantiene la compatibilità): stesso test con `opencode-ai@1.19.4`.

---

## 10. Strategia fork & rilascio

- Upstream: `https://github.com/CrewBeeLab/CrewBee` (MIT).
- Fork personale: da creare sull'account GitHub dell'utente (non è ancora presente `gh` CLI né
  una chiave SSH GitHub personale valida: `ssh -T git@github.com` → *Permission denied*).
  → serve `gh auth login` oppure un PAT, oppure il fork creato a mano da browser.
- Workflow consigliato: branch `feat/opencode-v2-port` sul fork → PR verso upstream (o mantenere
  privato se si preferisce).
- Versioning: `0.2.0-v2.0.0` o `1.0.0`? Proposta: **0.2.0** con chiave `plugins` e supporto V2,
  deprecatando V1.

---

## 11. Checklist ordinata (da seguire)

- [ ] **F1** — Preparazione: fork GitHub (credenziali), working copy `~/Projects/crewbee-v2`, branch `feat/opencode-v2-port` ✔ (fatto)
- [ ] **F2** — Aggiornare `package.json`: `@opencode/plugin@2.1.3`, rimuovere `@opencode-ai/plugin`; allineare `exports`
- [ ] **F3** — Nuovo `src/adapters/opencode/plugin-v2.ts` con `Plugin.define({id:"crewbee", setup})`
- [ ] **F4** — `agent-transform.ts`: `ctx.agent.transform` + `editor.default` (sostituisce `config-hook.ts`)
- [ ] **F5** — `projection.ts`: nuovo formatter agente V2 (`system`, `permissions`, `model`, `disabled`)
- [ ] **F6** — `permission-mapper.ts`: mappa V1 → array `permissions` V2 (`task` → `subagent`)
- [ ] **F7** — `delegation/tools.ts`: tool V2 (`subagent`/`task` + `delegate_status` + `delegate_cancel`), JSON Schema, `result.content`
- [ ] **F8** — `tool-hooks.ts`: `execute.before` (input mutabile) / `execute.after` (`Tool.Result`)
- [ ] **F9** — `chat-message-hook.ts` → binding via `session.agent.selected` + fallback `session.get`
- [ ] **F10** — `system-transform-hook.ts` → `ctx.session.hook("context")` con `SystemPart`
- [ ] **F11** — `compaction-hook.ts` → `ctx.session.hook("compaction")` + degradazione todo
- [ ] **F12** — `event-hook.ts` → `ctx.event.subscribe()` + rinomina eventi V2
- [ ] **F13** — `logging.ts` → console con prefisso `[crewbee]`; verificare il flush nel log del server
- [ ] **F14** — `model-availability.ts` → `ctx.model.list()` / `ctx.provider.list()`
- [ ] **F15** — `update/refresh.ts` → firma `Context` V2
- [ ] **F16** — `install/opencode-config-file.ts` → chiave `plugins` + migrazione da `plugin`
- [ ] **F17** — `install/doctor.ts` / `uninstall.ts` → nuova chiave + check versione OpenCode
- [ ] **F18** — Aggiornare `src/runtime/registries/plugin-tools.ts` (task → subagent)
- [ ] **F19** — Aggiornare i test esistenti + aggiungere i test V2
- [ ] **F20** — Aggiornare simulatori (`simulators/opencode-*.mjs`) al runtime V2
- [ ] **F21** — `npm run typecheck && npm test && npm run build`
- [ ] **F22** — Script di verifica end-to-end su opencode 2.1.3 reale (HOME isolata, porta dedicata)
- [ ] **F23** — Documentazione: `docs/guide/installation.md` (V2), README, `docs/developer/release.md`
- [ ] **F24** — Pubblicazione (npm) o setup locale con path; verifica `opencode plugin list` → active

---

## 12. Rischi e rollback

| Rischio | Impatto | Mitigazione |
|---|---|---|
| Tool `subagent` non sovrascrivibile | delegation CrewBee inutilizzabile | verificare in F7 con un test reale; in alternativa non sovrascrivere e usare il `subagent` nativo |
| `prompt` non bloccante in V2 | foreground delegation che ritorna subito | `session.wait({sessionID})` |
| `temperature` non applicabile | agenti meno deterministici | usare hook `context` (`options.temperature`) |
| Marker ownership perso | sovrascrittura di agenti altrui | `Set` in memoria + `editor.list()` |
| Tool `todowrite` assente in V2 | contesto di continuità più povero | snapshot vuoto + nota; opzionale parsing del transcript |
| Divergenza con upstream | merge difficulty | commit atomici per area, changelog nel PR |
| Rollback | — | il fork non tocca `main`; disinstallazione = rimuovere l'entry da `plugins` + `opencode plugin remove` |

---

## 13. Domande aperte (da decidere prima di F2)

1. **Fork GitHub**: creare il fork sull'account dell'utente? Quale username? Serve `gh auth login`
   (interattivo) o un PAT, oppure il fork viene creato a mano e io pusho sul remote?
2. **Supporto V1**: mantenere il doppio implementation (V1 + V2) nello stesso pacchetto, o tagliare V1?
   (Raccomando: mantenere V1 per qualche release, con `default` = V2 e `server` = V1.)
3. **Nome del pacchetto**: `crewbee` (fork locale) o `crewbee-v2` / `@scope/crewbee`?
4. **Distribuzione**: publish su npm (pubblico o scope privato) vs solo path locale?
5. **Tool**: sovrascrivere il builtin `subagent` (raccomandato) o registrare solo `task` come tool nuovo?
6. **Temperature per agente**: rinunciare (raccomandato, dato il warning V2) o implementare via hook `context`?

---

## Risultato implementazione (port completato)

- **Branch locale**: `feat/opencode-v2-port` (nessun commit fatto; working tree sporco — commit solo su esplicita richiesta dell'utente).
- **Build**: `npm run build` OK; bundle `dist/opencode-plugin.mjs` 1.9MB, solo builtins Node come dipendenze esterne.
- **Test**: `npm test` → 107/107 pass.
- **Verifica empirica su OpenCode 2.1.3** (HOME isolato): il plugin si carica, `ctx.agent.transform` proietta gli 8 agenti CrewBee (leader primario visibile, host agent `build/plan/general/explore` nascosti+demesi a subagent), `ctx.tool.transform` registra `subagent` (override del builtin) + `task` (alias) + `delegate_status` + `delegate_cancel`, `ctx.session.hook("prompt"/"context"/"compaction")` registrati, `event.subscribe` filtrato manualmente.
- **Install locale (dev)**: usare la forma `{ "package": "file:/Users/alessandro.muzzi/Projects/crewbee-v2" }` in `plugins` di `~/.config/opencode/opencode.json`. Il loader installa il pacchetto in `~/.cache/opencode/npm/file:/...` e risolve l'entrypoint `dist/opencode-plugin.mjs`.
- **Install produzione (dopo il fork)**: `opencode plugin add github:<user>/crewbee-v2` (Git package specifier).
- **Dipendenze**: `@opencode/plugin@2.1.3` e `@opencode-ai/plugin@1.15.10` come devDeps (solo tipi); `zod@^4.1.8` + `yaml` come deps runtime.
