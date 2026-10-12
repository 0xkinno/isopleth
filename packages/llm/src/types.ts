export type LlmProviderName = "gemini" | "qwen" | "none";

export interface LlmRequest {
  system?: string;
  prompt: string;
  /** Ask the driver to return strict JSON when it supports it. */
  json?: boolean;
}

export interface LlmResult {
  text: string;
  provider: LlmProviderName;
  /** Raw provider response, cached to disk by callers for offline replay. */
  raw: unknown;
}

export interface LlmDriver {
  readonly name: LlmProviderName;
  /** Set by a fallback chain: which provider actually answered the last call. */
  lastProvider?: LlmProviderName | undefined;
  complete(req: LlmRequest): Promise<LlmResult>;
}
