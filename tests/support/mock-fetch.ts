export type RecordedRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type MockResponse = {
  status?: number;
  json?: unknown;
  text?: string;
};

type Responder = (request: RecordedRequest) => MockResponse;

export async function withMockFetch(
  responder: Responder,
  run: (requests: RecordedRequest[]) => Promise<void>
): Promise<void> {
  const originalFetch = globalThis.fetch;
  const requests: RecordedRequest[] = [];

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const request: RecordedRequest = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: { ...(init?.headers as Record<string, string> | undefined) },
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined
    };
    requests.push(request);

    const { status = 200, json, text } = responder(request);
    const payload = text ?? (json === undefined ? null : JSON.stringify(json));
    return new Response(status === 204 ? null : payload, { status });
  }) as typeof fetch;

  try {
    await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}
