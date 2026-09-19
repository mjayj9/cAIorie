import { ProviderError, providerFetch } from "./http.ts";

export const publicDataEndpoints = {
  nutrition:
    "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03",
  registry: "https://apis.data.go.kr/1741000/general_restaurants/info",
};
export function publicDataItems(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object")
    throw new ProviderError("invalid_response");
  const top = value as Record<string, unknown>;
  const envelope = (top.response ?? top) as {
    header?: { resultCode?: unknown };
    body?: { items?: unknown };
  };
  if (
    !/^0+$/.test(String(envelope?.header?.resultCode ?? "")) ||
    !envelope.body
  )
    throw new ProviderError("invalid_response");
  let items = envelope.body.items;
  if (items === null || items === undefined || items === "") return [];
  if (!Array.isArray(items) && typeof items === "object" && "item" in items)
    items = (items as { item: unknown }).item;
  if (items === null || items === undefined || items === "") return [];
  const rows = Array.isArray(items) ? items : [items];
  if (
    !rows.every((row) => row && typeof row === "object" && !Array.isArray(row))
  )
    throw new ProviderError("invalid_response");
  return rows as Record<string, unknown>[];
}
export async function fetchPublicData(
  kind: keyof typeof publicDataEndpoints,
  key: string,
  params: Record<string, string>,
  signal?: AbortSignal,
) {
  if (!key || /%[0-9a-f]{2}/i.test(key))
    throw new ProviderError("unconfigured");
  const url = new URL(publicDataEndpoints[kind]);
  url.searchParams.set("serviceKey", key.trim());
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "20");
  url.searchParams.set(kind === "nutrition" ? "type" : "returnType", "json");
  for (const [name, value] of Object.entries(params))
    url.searchParams.set(name, value);
  return publicDataItems(await providerFetch(url.href, { signal }, 12000));
}
export const publicText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
