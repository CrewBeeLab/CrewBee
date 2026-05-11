import test from "node:test";
import assert from "node:assert/strict";

import { listOpenCodeAvailableModels } from "../../dist/src/adapters/opencode/model-availability.js";

test("OpenCode model registry probe preserves SDK receiver binding", async () => {
  const configApi = {
    payload: {
      providers: [
        {
          id: "openai",
          models: {
            "gpt-5.4-mini": {},
          },
        },
      ],
    },
    async providers() {
      assert.equal(this, configApi);
      return this.payload;
    },
  };

  const models = await listOpenCodeAvailableModels({
    client: { config: configApi },
    timeoutMs: 50,
  });

  assert.deepEqual(models, ["openai/gpt-5.4-mini"]);
});

test("OpenCode model registry probe times out instead of blocking plugin startup", async () => {
  const startedAt = Date.now();
  const models = await listOpenCodeAvailableModels({
    client: {
      config: {
        providers: async () => new Promise(() => {}),
      },
    },
    timeoutMs: 10,
  });

  assert.equal(models, undefined);
  assert.ok(Date.now() - startedAt < 500);
});
