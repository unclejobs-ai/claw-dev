import assert from "node:assert/strict";
import test from "node:test";

import { resolveOpenAIAuth } from "@unclecode/providers";

function buildJwtWithExp(expSeconds) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString("base64url");

  return `${header}.${payload}.sig`;
}

test("resolveOpenAIAuth prefers OPENAI_API_KEY over stored oauth", async () => {
  const result = await resolveOpenAIAuth({
    env: { OPENAI_API_KEY: "sk-test-123" },
    readFallbackFile: async () =>
      JSON.stringify({
        authType: "oauth",
        accessToken: buildJwtWithExp(Math.floor(Date.now() / 1000) + 3600),
        refreshToken: "rt_123",
      }),
  });

  assert.equal(result.status, "ok");
  assert.equal(result.authType, "api-key");
  assert.equal(result.source, "env-openai-api-key");
});

test("resolveOpenAIAuth reports expired oauth credentials when refresh is unavailable", async () => {
  const result = await resolveOpenAIAuth({
    env: {},
    readFallbackFile: async () =>
      JSON.stringify({
        authType: "oauth",
        accessToken: buildJwtWithExp(Math.floor(Date.now() / 1000) - 3600),
        refreshToken: "",
      }),
  });

  assert.equal(result.status, "expired");
  assert.equal(result.authType, "oauth");
});
