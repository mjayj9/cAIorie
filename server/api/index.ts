import { ZodError } from "zod";
import { context, body, type Context } from "../context.ts";
import { AppError } from "../errors.ts";
import {
  getState,
  saveSettings,
  resetLearning,
  exportData,
  deleteData,
} from "./settings.ts";
import { runRecommendation, relax, selectMenu } from "./recommendations.ts";
import {
  saveMeal,
  editMeal,
  deleteMeals,
  confirmMeal,
  parse,
  saveFeedback,
} from "./meals.ts";
import {
  createGroup,
  joinGroup,
  leaveGroup,
  groupStatus,
  addGuest,
  removeGuest,
} from "./groups.ts";
import { searchFoods, registryStatus } from "./catalog.ts";
import { geocodeKakao } from "../../providers/places.ts";
type Handler = (c: Context, input: unknown) => Promise<unknown>;
const mutations: Record<string, Handler> = {
  settings: saveSettings,
  "places/registry": registryStatus,
  recommend: runRecommendation,
  relax: relax,
  select: selectMenu,
  meals: saveMeal,
  "meals/edit": editMeal,
  "meals/delete": deleteMeals,
  "meals/parse": parse,
  confirm: confirmMeal,
  feedback: saveFeedback,
  "learning/reset": resetLearning,
  "privacy/delete": deleteData,
  groups: createGroup,
  "groups/join": joinGroup,
  "groups/leave": leaveGroup,
  "groups/guest": addGuest,
  "groups/guest/remove": removeGuest,
};
export async function handle(request: Request) {
  let cookie: string | null = null;
  try {
    const c = await context(request);
    cookie = c.cookie;
    const url = new URL(request.url),
      path = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
    let result: unknown;
    if (request.method === "GET") {
      if (path === "state") result = await getState(c);
      else if (path === "privacy/export") result = await exportData(c);
      else if (path === "foods") {
        result = await searchFoods(c, url.searchParams.get("q") ?? "");
      } else if (path === "groups")
        result = await groupStatus(c, url.searchParams.get("id") ?? "");
      else if (path === "locations") {
        const q = (url.searchParams.get("q") ?? "").trim();
        if (!q || q.length > 100)
          throw new AppError(400, "QUERY", "지역 이름을 입력해 주세요.");
        result = { items: await geocodeKakao(c.config, q, request.signal) };
      } else throw new AppError(404, "NOT_FOUND", "지원하지 않는 경로예요.");
    } else if (request.method === "POST" && mutations[path])
      result = await mutations[path](c, await body(request));
    else throw new AppError(405, "METHOD", "지원하지 않는 요청이에요.");
    return json(result, 200, cookie);
  } catch (e) {
    if (e instanceof ZodError)
      return json(
        {
          error: e.issues[0]?.message ?? "입력값을 확인해 주세요.",
          code: "VALIDATION",
        },
        400,
        cookie,
      );
    if (e instanceof AppError)
      return json({ error: e.message, code: e.code }, e.status, cookie);
    if (e instanceof Error && e.message === "AGE_REQUIRED")
      return json(
        {
          error: "건강정보 처리 전 연령 구간을 확인해 주세요.",
          code: e.message,
        },
        403,
        cookie,
      );
    if (e instanceof Error && e.message === "SENSITIVE_CONSENT_REQUIRED")
      return json(
        {
          error: "건강·알레르기 정보는 별도 처리 동의가 필요해요.",
          code: e.message,
        },
        403,
        cookie,
      );
    if (e instanceof Error && e.message === "CHILD_DEMO_ONLY")
      return json(
        {
          error: "만 14세 미만은 개인정보 없는 둘러보기만 사용할 수 있어요.",
          code: e.message,
        },
        403,
        cookie,
      );
    // Deliberately never log payloads, URLs, keys, or precise positions.
    return json(
      {
        error: "처리를 마치지 못했어요. 입력은 유지되며 다시 시도할 수 있어요.",
        code: "UNAVAILABLE",
      },
      503,
      cookie,
    );
  }
}
function json(data: unknown, status: number, cookie: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
}
