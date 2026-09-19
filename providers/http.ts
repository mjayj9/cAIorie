export class ProviderError extends Error {
  constructor(
    public code:
      | "unconfigured"
      | "unavailable"
      | "quota"
      | "invalid_response"
      | "aborted",
  ) {
    super(code);
    this.name = "ProviderError";
  }
}
const states = new Map<
  string,
  {
    inflight: number;
    calls: number;
    window: number;
    failures: number;
    opened: number;
  }
>();
const allowed = new Set([
  "dapi.kakao.com",
  "places.googleapis.com",
  "apis.data.go.kr",
  "openrouter.ai",
]);
export function safeSourceUrl(raw: string | null) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}
export async function providerFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = 6000,
): Promise<unknown> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !allowed.has(u.hostname))
    throw new ProviderError("unconfigured");
  const now = Date.now(),
    s = states.get(u.host) ?? {
      inflight: 0,
      calls: 0,
      window: now,
      failures: 0,
      opened: 0,
    };
  if (now - s.window > 60000) {
    s.calls = 0;
    s.window = now;
  }
  states.set(u.host, s);
  if (s.inflight >= 3 || s.calls >= 30 || s.opened > now)
    throw new ProviderError("quota");
  s.inflight++;
  s.calls++;
  try {
    const signal = init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);
    // Workers supports manual redirects. Reject non-2xx responses below so
    // credentials never follow a redirect to another host.
    const response = await fetch(url, { ...init, redirect: "manual", signal });
    if (!response.ok)
      throw new ProviderError(
        response.status === 429 ? "quota" : "unavailable",
      );
    const payload = await response.text();
    if (payload.length > 1500000) throw new ProviderError("invalid_response");
    const result = JSON.parse(payload);
    s.failures = 0;
    return result;
  } catch (error) {
    if (init.signal?.aborted) throw new ProviderError("aborted");
    s.failures++;
    if (s.failures >= 3) s.opened = Date.now() + 30000;
    throw error instanceof ProviderError
      ? error
      : new ProviderError("unavailable");
  } finally {
    s.inflight--;
  }
}
