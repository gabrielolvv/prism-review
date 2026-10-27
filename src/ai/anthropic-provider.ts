import Anthropic from "@anthropic-ai/sdk";
import type { SummaryProvider, SummaryRequest } from "./summary.js";

export type AnthropicProviderOptions = {
  apiKey: string;
  model: string;
  timeoutMs: number;
  // Replaced in tests.
  fetch?: typeof fetch;
};

// Models that accept `fallbacks: "default"`, which retries a declined request on the model the API
// recommends for that kind of refusal instead of returning the refusal.
const serverFallbackModels = /^claude-(?:opus-5|fable-5-1|sonnet-5-5)/;

export function createAnthropicProvider(options: AnthropicProviderOptions): SummaryProvider {
  const client = new Anthropic({
    apiKey: options.apiKey,
    timeout: options.timeoutMs,
    maxRetries: 2,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch })
  });

  return {
    model: options.model,
    async complete(request: SummaryRequest): Promise<string> {
      const response = await client.beta.messages.create({
        model: options.model,
        max_tokens: 16_000,
        system: request.system,
        messages: [{ role: "user", content: request.prompt }],
        output_config: { format: { type: "json_schema", schema: request.schema } },
        ...(serverFallbackModels.test(options.model)
          ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
          : {})
      });

      if (response.stop_reason === "refusal") {
        throw new Error("The model declined to summarize this pull request.");
      }
      if (response.stop_reason === "max_tokens") {
        throw new Error("The model's reply was cut off at the token limit.");
      }

      return response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
    }
  };
}
