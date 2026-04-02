export type RuntimeBrokerErrorCode =
  | "SPAWN_FAILED"
  | "KILL_FAILED"
  | "TIMEOUT"
  | "ADAPTER_UNAVAILABLE"
  | "INVALID_CONFIG";

export class RuntimeBrokerError extends Error {
  override readonly name = "RuntimeBrokerError";
  readonly code: RuntimeBrokerErrorCode;
  override readonly cause?: Error | undefined;

  constructor(
    message: string,
    code: RuntimeBrokerErrorCode,
    cause?: Error | undefined,
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.code = code;
  }
}
