import assert from "node:assert/strict";
import test from "node:test";

import { formatOpenAIAuthStatus, resolveOpenAIAuthStatus } from "@unclecode/providers";

test("resolveOpenAIAuthStatus exposes source, context, and expiry without secrets", async () => {
  const status = await resolveOpenAIAuthStatus({
    env: { OPENAI_API_KEY: "sk-test-123", OPENAI_ORG_ID: "org_123", OPENAI_PROJECT_ID: "proj_456" },
  });

  assert.equal(status.activeSource, "api-key-env");
  assert.equal(status.organizationId, "org_123");
  assert.equal(status.projectId, "proj_456");
});

test("formatOpenAIAuthStatus redacts secrets from rendered output", () => {
  const rendered = formatOpenAIAuthStatus({
    providerId: "openai",
    activeSource: "api-key-env",
    authType: "api-key",
    organizationId: "org_123",
    projectId: "proj_456",
    expiresAt: null,
    isExpired: false,
  });

  assert.match(rendered, /api-key-env/);
  assert.match(rendered, /org_123/);
  assert.doesNotMatch(rendered, /sk-test-123/);
});
