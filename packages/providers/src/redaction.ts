// Mirror of session-store's secret patterns. Duplicated here so the providers
// package stays free of session-store as a dependency. Keep in sync.

const SECRET_PATTERNS = [
  /ghp_[0-9A-Za-z]{36}/g,
  /github_pat_[0-9A-Za-z_]{82}/g,
  /gh[ousr]_[0-9A-Za-z]{36}/g,
  /glpat-[\w-]{20}/g,
  /\b(AIza[\w-]{35})\b/g,
  /\b(dapi[a-f0-9]{32}(?:-\d)?)\b/g,
  /\b(npm_[0-9A-Za-z]{36})\b/g,
  /\b(hf_[A-Za-z]{34})\b/g,
  /\b(sk-ant-api03-[A-Za-z0-9_\-]{93}AA)\b/g,
  /\b(sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,})\b/g,
  /\b(sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20})\b/g,
  /-----BEGIN[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----[\s\S-]{64,}?-----END[ A-Z0-9_-]{0,100}PRIVATE KEY(?: BLOCK)?-----/gi,
] as const;

export function redactSecrets(content: string): string {
  let redacted = content;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}
