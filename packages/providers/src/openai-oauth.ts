import { createHash, randomUUID } from "node:crypto";

import { writeOpenAICredentials } from "./openai-credential-store.js";

export function buildOpenAIAuthorizationUrl(input: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly codeChallenge: string;
  readonly scopes: readonly string[];
}): URL {
  const url = new URL("https://auth.openai.com/oauth/authorize");

  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("scope", input.scopes.join(" "));

  return url;
}

export function parseOpenAICallback(input: {
  readonly requestUrl: string;
  readonly expectedState: string;
}): string {
  const url = new URL(input.requestUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    throw new Error("Missing authorization code.");
  }

  if (state !== input.expectedState) {
    throw new Error("Invalid OAuth state.");
  }

  return code;
}

export function createOpenAIPkcePair(): {
  readonly state: string;
  readonly codeVerifier: string;
  readonly codeChallenge: string;
} {
  const state = randomUUID();
  const codeVerifier = randomUUID().replaceAll("-", "");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  return {
    state,
    codeVerifier,
    codeChallenge,
  };
}

type FetchLike = typeof fetch;
type WriteOpenAICredentialsLike = typeof writeOpenAICredentials;

const DEFAULT_OAUTH_BASE_URL = "https://auth.openai.com";

export async function requestOpenAIDeviceAuthorization(input: {
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly baseUrl?: string | undefined;
  readonly fetch?: FetchLike | undefined;
}): Promise<{
  readonly deviceCode: string;
  readonly userCode: string;
  readonly verificationUri: string;
  readonly expiresIn: number;
  readonly interval: number;
}> {
  const executeFetch = input.fetch ?? fetch;
  const endpoint = `${input.baseUrl ?? DEFAULT_OAUTH_BASE_URL}/oauth/device/code`;
  const response = await executeFetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: input.clientId, scope: input.scopes.join(" ") }),
  });
  const payload = await response.json();

  return {
    deviceCode: String(payload.device_code),
    userCode: String(payload.user_code),
    verificationUri: String(payload.verification_uri),
    expiresIn: Number(payload.expires_in ?? 0),
    interval: Number(payload.interval ?? 5),
  };
}

export async function pollOpenAIDeviceAuthorization(input: {
  readonly clientId: string;
  readonly deviceCode: string;
  readonly intervalSeconds: number;
  readonly baseUrl?: string | undefined;
  readonly fetch?: FetchLike | undefined;
}): Promise<{
  readonly accessToken: string;
  readonly refreshToken: string;
}> {
  const executeFetch = input.fetch ?? fetch;
  const endpoint = `${input.baseUrl ?? DEFAULT_OAUTH_BASE_URL}/oauth/token`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await executeFetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: input.clientId,
        device_code: input.deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const payload = await response.json();

    if (!response.ok && payload?.error === "authorization_pending") {
      continue;
    }

    return {
      accessToken: String(payload.access_token),
      refreshToken: String(payload.refresh_token),
    };
  }

  throw new Error("Device authorization did not complete in time.");
}

export async function exchangeOpenAIAuthorizationCode(input: {
  readonly clientId: string;
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly baseUrl?: string | undefined;
  readonly fetch?: FetchLike | undefined;
}): Promise<{
  readonly accessToken: string;
  readonly refreshToken: string;
}> {
  const executeFetch = input.fetch ?? fetch;
  const endpoint = `${input.baseUrl ?? DEFAULT_OAUTH_BASE_URL}/oauth/token`;
  const response = await executeFetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: input.clientId,
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const payload = await response.json();

  return {
    accessToken: String(payload.access_token),
    refreshToken: String(payload.refresh_token),
  };
}

export async function completeOpenAIDeviceLogin(input: {
  readonly clientId: string;
  readonly scopes: readonly string[];
  readonly credentialsPath: string;
  readonly baseUrl?: string | undefined;
  readonly fetch?: FetchLike | undefined;
  readonly writeCredentials?: WriteOpenAICredentialsLike | undefined;
}): Promise<{
  readonly userCode: string;
  readonly verificationUri: string;
}> {
  const deviceAuthorization = await requestOpenAIDeviceAuthorization({
    clientId: input.clientId,
    scopes: input.scopes,
    baseUrl: input.baseUrl,
    fetch: input.fetch,
  });
  const tokens = await pollOpenAIDeviceAuthorization({
    clientId: input.clientId,
    deviceCode: deviceAuthorization.deviceCode,
    intervalSeconds: deviceAuthorization.interval,
    baseUrl: input.baseUrl,
    fetch: input.fetch,
  });

  await (input.writeCredentials ?? writeOpenAICredentials)({
    credentialsPath: input.credentialsPath,
    credentials: {
      authType: "oauth",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: null,
      organizationId: null,
      projectId: null,
      accountId: null,
    },
  });

  return {
    userCode: deviceAuthorization.userCode,
    verificationUri: deviceAuthorization.verificationUri,
  };
}

export async function completeOpenAIBrowserLogin(input: {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly callbackUrl: string;
  readonly expectedState: string;
  readonly codeVerifier: string;
  readonly credentialsPath: string;
  readonly baseUrl?: string | undefined;
  readonly fetch?: FetchLike | undefined;
  readonly writeCredentials?: WriteOpenAICredentialsLike | undefined;
}): Promise<{
  readonly accessToken: string;
}> {
  const code = parseOpenAICallback({
    requestUrl: input.callbackUrl,
    expectedState: input.expectedState,
  });
  const tokens = await exchangeOpenAIAuthorizationCode({
    clientId: input.clientId,
    code,
    codeVerifier: input.codeVerifier,
    redirectUri: input.redirectUri,
    baseUrl: input.baseUrl,
    fetch: input.fetch,
  });

  await (input.writeCredentials ?? writeOpenAICredentials)({
    credentialsPath: input.credentialsPath,
    credentials: {
      authType: "oauth",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: null,
      organizationId: null,
      projectId: null,
      accountId: null,
    },
  });

  return {
    accessToken: tokens.accessToken,
  };
}
