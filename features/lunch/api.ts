import type {
  Capability,
  HistoryAnalysis,
  Meal,
  Selection,
  SessionState,
} from "@/domain/models";
export type Snapshot = {
  state: SessionState;
  csrf: string;
  meals: Meal[];
  selections: Selection[];
  analysis: HistoryAnalysis;
  capabilities: Capability[];
  sensitiveStorageAvailable: boolean;
  runtime: { defaultMode: "demo" | "live" };
};
async function decode<T>(response: Response): Promise<T> {
  const data = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new Error(data.error ?? "연결을 확인하고 다시 시도해 주세요.");
  return data as T;
}
export async function getJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  return decode<T>(
    await fetch("/api/" + path, {
      signal,
      credentials: "same-origin",
      cache: "no-store",
    }),
  );
}
export async function postJson<T>(
  path: string,
  input: unknown,
  csrf: string,
  signal?: AbortSignal,
): Promise<T> {
  return decode<T>(
    await fetch("/api/" + path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify(input),
      signal,
    }),
  );
}
