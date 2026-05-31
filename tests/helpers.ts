import type { Session } from "../src/models.js";

export interface StubResponse {
  status?: number;
  body: unknown;
}

export interface RecordedCall {
  headers: Record<string, string>;
  /** Parsed JSON request body (a GraphQL op array). `any` for terse assertions. */
  body: any;
  at: number;
}

/** A `fetch` stub that returns queued responses and records each request. */
export function stubFetch(responses: StubResponse[]) {
  const calls: RecordedCall[] = [];
  let i = 0;
  const impl = (async (_url: string, init: RequestInit) => {
    calls.push({
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string),
      at: Date.now(),
    });
    const r = responses[Math.min(i, responses.length - 1)]!;
    i++;
    const payload = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(payload, { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

export const SESSION: Session = {
  accessToken: "header.payload.sig",
  customerUuid: "uuid-123",
  cookies: { "OAuth.AccessToken": "header.payload.sig", UUID: "uuid-123", _abck: "x" },
};
