import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpenAIAuthorizationUrl,
  completeOpenAIDeviceLogin,
  completeOpenAIBrowserLogin,
  exchangeOpenAIAuthorizationCode,
  parseOpenAICallback,
  requestOpenAIDeviceAuthorization,
} from "@unclecode/providers";

test("buildOpenAIAuthorizationUrl includes PKCE and oauth context", () => {
  const url = buildOpenAIAuthorizationUrl({
    clientId: "client_123",
    redirectUri: "http://localhost:7777/callback",
    state: "state_123",
    codeChallenge: "challenge_123",
    scopes: ["openid", "profile"],
  });

  assert.equal(url.origin, "https://auth.openai.com");
  assert.equal(url.searchParams.get("client_id"), "client_123");
  assert.equal(url.searchParams.get("code_challenge"), "challenge_123");
  assert.equal(url.searchParams.get("state"), "state_123");
});

test("parseOpenAICallback validates state before returning auth code", () => {
  const code = parseOpenAICallback({
    requestUrl: "http://localhost:7777/callback?code=code_123&state=state_123",
    expectedState: "state_123",
  });

  assert.equal(code, "code_123");
  assert.throws(
    () =>
      parseOpenAICallback({
        requestUrl: "http://localhost:7777/callback?code=code_123&state=wrong",
        expectedState: "state_123",
      }),
  );
});

test("requestOpenAIDeviceAuthorization normalizes the device flow payload", async () => {
  const result = await requestOpenAIDeviceAuthorization({
    clientId: "client_123",
    scopes: ["openid", "profile"],
    fetch: async () =>
      new Response(
        JSON.stringify({
          device_code: "device_123",
          user_code: "user_123",
          verification_uri: "https://auth.openai.com/activate",
          expires_in: 900,
          interval: 5,
        }),
      ),
  });

  assert.equal(result.deviceCode, "device_123");
  assert.equal(result.userCode, "user_123");
});

test("pollOpenAIDeviceAuthorization is exercised via completeOpenAIDeviceLogin with retries", async () => {
  let calls = 0;

  const result = await completeOpenAIDeviceLogin({
    clientId: "client_123",
    scopes: ["openid", "profile"],
    credentialsPath: "/tmp/openai-poll-test.json",
    fetch: async (url) => {
      if (String(url).includes("device/code")) {
        return new Response(
          JSON.stringify({
            device_code: "device_123",
            user_code: "user_poll",
            verification_uri: "https://auth.openai.com/activate",
            expires_in: 900,
            interval: 0,
          }),
        );
      }

      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ error: "authorization_pending" }), { status: 400 });
      }
      return new Response(JSON.stringify({ access_token: "at_poll", refresh_token: "rt_poll" }));
    },
    writeCredentials: async () => {},
  });

  assert.equal(result.userCode, "user_poll");
  assert.ok(calls >= 2, "poll should have retried at least once before succeeding");
});

test("exchangeOpenAIAuthorizationCode returns normalized tokens", async () => {
  const result = await exchangeOpenAIAuthorizationCode({
    clientId: "client_123",
    code: "code_123",
    codeVerifier: "verifier_123",
    redirectUri: "http://localhost:7777/callback",
    baseUrl: "http://fake-oauth.local",
    fetch: async () => new Response(JSON.stringify({ access_token: "at_123", refresh_token: "rt_123" })),
  });


  assert.equal(result.accessToken, "at_123");
  assert.equal(result.refreshToken, "rt_123");
});

test("completeOpenAIDeviceLogin stores returned oauth credentials", async () => {
  const writes = [];

  const result = await completeOpenAIDeviceLogin({
    clientId: "client_123",
    scopes: ["openid", "profile"],
    credentialsPath: "/tmp/openai.json",
    fetch: async (url) => {
      if (String(url).includes("device/code")) {
        return new Response(
          JSON.stringify({
            device_code: "device_123",
            user_code: "user_123",
            verification_uri: "https://auth.openai.com/activate",
            expires_in: 900,
            interval: 0,
          }),
        );
      }

      return new Response(JSON.stringify({ access_token: "at_123", refresh_token: "rt_123" }));
    },
    writeCredentials: async (input) => {
      writes.push(input);
    },
  });

  assert.equal(result.userCode, "user_123");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].credentials.refreshToken, "rt_123");
});

test("completeOpenAIBrowserLogin exchanges callback code and stores oauth credentials", async () => {
  const writes = [];

  const result = await completeOpenAIBrowserLogin({
    clientId: "client_123",
    redirectUri: "http://localhost:7777/callback",
    callbackUrl: "http://localhost:7777/callback?code=code_123&state=state_123",
    expectedState: "state_123",
    codeVerifier: "verifier_123",
    credentialsPath: "/tmp/openai.json",
    baseUrl: "http://fake-oauth.local",
    fetch: async () => new Response(JSON.stringify({ access_token: "at_123", refresh_token: "rt_123" })),
    writeCredentials: async (input) => {
      writes.push(input);
    },
  });

  assert.equal(result.accessToken, "at_123");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].credentials.refreshToken, "rt_123");
});
