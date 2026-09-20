import { requestOrigin } from "./request-origin.ts";
import { rebuildLearning } from "./learning-service.ts";
import { getRuntime } from "#lunch-runtime";
import { initialState } from "../domain/defaults.ts";
import { localDate, shiftDay } from "../domain/meals.ts";
import type { SessionState } from "../domain/models.ts";
import type { ProviderConfig } from "../providers/contracts.ts";
import { Repository } from "./repository.ts";
import { hash, token, unseal } from "./crypto.ts";
import { AppError } from "./errors.ts";
export type Context = {
  repo: Repository;
  owner: string;
  state: SessionState;
  csrf: string;
  cookie: string | null;
  config: ProviderConfig;
  request: Request;
};
export async function context(request: Request): Promise<Context> {
  const { database, bindings } = getRuntime();
  const externalOrigin = requestOrigin(request, bindings.VERCEL === "1");
  const config: ProviderConfig = {
    demoMode: bindings.DEMO_MODE !== "false",
    kakaoKey: bindings.KAKAO_REST_API_KEY ?? "",
    googleKey: bindings.GOOGLE_PLACES_API_KEY ?? "",
    encryptionKey: bindings.DATA_ENCRYPTION_KEY ?? "",
    aiKey: bindings.AI_API_KEY ?? "",
    aiProvider: bindings.AI_PROVIDER ?? "mock",
    aiModel: bindings.AI_MODEL ?? "",
    aiBaseUrl: bindings.AI_BASE_URL ?? "",
    nutritionKey: bindings.NUTRITION_API_KEY ?? "",
    registryKey:
      bindings.RESTAURANT_REGISTRY_API_KEY ??
      bindings.PUBLIC_DATA_API_KEY ??
      "",
  };
  const repo = new Repository(database),
    cookieValue = request.headers
      .get("cookie")
      ?.match(/(?:^|;\s*)lunch_session=([^;]+)/)?.[1];
  let owner = await hash(
      (config.demoMode ? "demo:" : "live:") + (cookieValue ?? token()),
    ),
    cookie: string | null = null;
  let row = await repo.first<{ state: string; csrf: string; expires: number }>(
    "SELECT state, csrf, expires FROM sessions WHERE id = ?",
    owner,
  );
  if (row && row.expires <= Date.now()) row = null;
  if (!row) {
    const raw = token();
    owner = await hash((config.demoMode ? "demo:" : "live:") + raw);
    row = {
      state: JSON.stringify(initialState()),
      csrf: token(),
      expires: Date.now() + 86400000,
    };
    await repo.run(
      "INSERT INTO sessions (id, csrf, state, expires) VALUES (?, ?, ?, ?)",
      owner,
      row.csrf,
      row.state,
      row.expires,
    );
    cookie =
      "lunch_session=" +
      raw +
      "; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000" +
      (externalOrigin.startsWith("https:") ? "; Secure" : "");
  }
  const state = JSON.parse(row.state) as SessionState;
  if (state.consents.saveSensitive && config.encryptionKey.length >= 32) {
    const sensitive = await repo.first<{ payload: string }>(
      "SELECT payload FROM sensitive_profiles WHERE owner = ?",
      owner,
    );
    if (sensitive)
      try {
        state.profile = {
          ...state.profile,
          ...(await unseal(sensitive.payload, config.encryptionKey)),
        };
      } catch {
        throw new AppError(
          503,
          "PROFILE_UNAVAILABLE",
          "보호된 프로필을 읽을 수 없어요. 암호화 설정을 확인해 주세요.",
        );
      }
  }
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin"),
      expected = externalOrigin;
    if (origin !== expected || request.headers.get("x-csrf-token") !== row.csrf)
      throw new AppError(403, "CSRF", "새로고침 후 다시 시도해 주세요.");
  }
  if (cookieValue && cookie === null) {
    await repo.run(
      "UPDATE sessions SET expires = ? WHERE id = ?",
      Date.now() +
        (state.consents.saveMeals || state.consents.savePreferences ? 30 : 1) *
          86400000,
      owner,
    );
    cookie =
      "lunch_session=" +
      cookieValue +
      "; HttpOnly; SameSite=Strict; Path=/; Max-Age=2592000" +
      (externalOrigin.startsWith("https:") ? "; Secure" : "");
  }
  const removed = await repo.cleanup(
    owner,
    shiftDay(
      localDate(new Date(), state.settings.notifications.timezone),
      -state.settings.retentionDays + 1,
    ),
  );
  if (removed) await rebuildLearning({ repo, owner, state });
  return { repo, owner, state, csrf: row.csrf, cookie, config, request };
}
export async function body(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 40000)
    throw new AppError(413, "TOO_LARGE", "입력 내용이 너무 길어요.");
  const raw = await request.text();
  if (raw.length > 40000)
    throw new AppError(413, "TOO_LARGE", "입력 내용이 너무 길어요.");
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError(400, "INVALID_JSON", "입력 형식을 확인해 주세요.");
  }
}
