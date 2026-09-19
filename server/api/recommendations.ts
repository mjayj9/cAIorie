import { z } from "zod";
import { requestSchema, settingsSchema } from "../../domain/schemas.ts";
import { recommend } from "../orchestrator.ts";
import type { Context } from "../context.ts";
import type { Selection } from "../../domain/models.ts";
import { AppError, requireValue } from "../errors.ts";
import { groupParticipants } from "./groups.ts";
const inputSchema = requestSchema.extend({ settings: settingsSchema });
async function requestKey(input: z.infer<typeof inputSchema>) {
  const { profile, conditions, location, mode, groupId } = input;
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({ profile, conditions, location, mode, groupId }),
    ),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function runRecommendation(c: Context, input: unknown) {
  const data = inputSchema.parse(input);
  if (!c.state.onboarded)
    throw new AppError(
      409,
      "SETUP_REQUIRED",
      "먼저 최소 설정을 확인해 주세요.",
    );
  const meals = await c.repo.getMeals(c.owner);
  const participants = data.groupId
    ? await groupParticipants(c, data.groupId)
    : [];
  const result = await recommend(
    data,
    c.state,
    meals,
    c.config,
    participants,
    c.request.signal,
  );
  result.requestKey = await requestKey(data);
  if (result.question) {
    c.state.yesterdayAsked = true;
    await c.repo.saveState(c.owner, c.state);
  }
  if (
    result.recommendations.length ||
    result.conditionalCandidates.length ||
    result.proposals.length
  )
    await c.repo.storeRecommendation(c.owner, result);
  return result;
}
export async function relax(c: Context, input: unknown) {
  const { recommendationId, proposalId, request } = z
    .object({
      recommendationId: z.string().uuid(),
      proposalId: z.string().uuid(),
      request: inputSchema,
    })
    .strict()
    .parse(input);
  const result = requireValue(
      await c.repo.getRecommendation(c.owner, recommendationId),
    ),
    proposal = requireValue(result.proposals.find((p) => p.id === proposalId));
  if (
    request.conditions[proposal.field] !== proposal.before ||
    (result.requestKey && result.requestKey !== (await requestKey(request)))
  )
    throw new AppError(
      409,
      "STALE_PROPOSAL",
      "조건이 변경되었어요. 다시 추천해 주세요.",
    );
  return runRecommendation(c, {
    ...request,
    skipYesterday: true,
    conditions: { ...request.conditions, [proposal.field]: proposal.after },
  });
}
export async function selectMenu(c: Context, input: unknown) {
  const data = z
    .object({
      recommendationId: z.string().uuid(),
      menuId: z.string(),
      acknowledgeConditions: z.boolean(),
      selectionReason: z.string().max(100).nullable(),
    })
    .strict()
    .parse(input);
  const result = requireValue(
    await c.repo.getRecommendation(c.owner, data.recommendationId),
  );
  const candidate = requireValue(
    [...result.recommendations, ...result.conditionalCandidates].find(
      (x) => x.menu.id === data.menuId,
    ),
  );
  if (candidate.safety.status !== "reviewed")
    throw new AppError(
      409,
      "SAFETY_UNCONFIRMED",
      "제한사항이 확인되지 않은 메뉴는 일반 선택으로 진행할 수 없어요. 식당 확인 후 직접 식사를 기록해 주세요.",
    );
  if (
    candidate.candidateStatus === "conditional" &&
    !data.acknowledgeConditions
  )
    throw new AppError(
      409,
      "CONDITIONS_UNCONFIRMED",
      "미확인 조건을 먼저 확인해 주세요.",
    );
  const current = await c.repo.selections(c.owner);
  const existing = current.find((x) => x.menu.id === data.menuId);
  if (existing) return existing;
  const selection: Selection = {
    id: crypto.randomUUID(),
    dataMode: result.dataMode,
    menu: candidate.menu,
    placeId: candidate.place.id,
    placeName: candidate.place.name,
    status: "awaiting_confirmation",
    createdAt: new Date().toISOString(),
    mealId: null,
    selectionReason: data.selectionReason,
  };
  await c.repo.run(
    "INSERT INTO selections (id, owner, payload, status, expires) VALUES (?, ?, ?, ?, ?)",
    selection.id,
    c.owner,
    JSON.stringify(selection),
    selection.status,
    Date.now() + 12 * 3600000,
  );
  return selection;
}
