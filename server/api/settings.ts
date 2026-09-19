import { invalidateGroupsForOwner } from "./groups.ts";
import { z } from "zod";
import { initialState, POLICY_VERSION } from "../../domain/defaults.ts";
import { assertProfilePermission } from "../../domain/safety.ts";
import {
  consentsSchema,
  profileSchema,
  settingsSchema,
} from "../../domain/schemas.ts";
import { analyzeHistory, localDate } from "../../domain/meals.ts";
import { capabilities, aiConfigured } from "../../providers/contracts.ts";
import type { Context } from "../context.ts";
import { seal } from "../crypto.ts";
import { AppError } from "../errors.ts";
export async function getState(c: Context) {
  const meals = await c.repo.getMeals(c.owner);
  return {
    state: c.state,
    csrf: c.csrf,
    meals,
    selections: await c.repo.selections(c.owner),
    analysis: analyzeHistory(
      meals,
      localDate(new Date(), c.state.settings.notifications.timezone),
    ),
    capabilities: capabilities(c.config),
    runtime: { defaultMode: c.config.demoMode ? "demo" : "live" },
    sensitiveStorageAvailable: c.config.encryptionKey.length >= 32,
  };
}
export async function saveSettings(c: Context, input: unknown) {
  const data = z
    .object({
      consents: consentsSchema,
      profile: profileSchema,
      settings: settingsSchema,
    })
    .strict()
    .parse(input);
  assertProfilePermission(data.profile, data.consents.sensitiveProcessing);
  if (
    data.profile.ageBand === "not_provided" &&
    Object.values(data.consents).some(Boolean)
  )
    throw new AppError(
      400,
      "AGE_REQUIRED",
      "개인정보 처리·보관 전 연령 구간을 확인해 주세요.",
    );
  if (
    data.consents.externalAi &&
    (data.profile.ageBand !== "adult" || !aiConfigured(c.config))
  )
    throw new AppError(
      409,
      "AI_UNAVAILABLE",
      "외부 AI는 연결된 제공자가 있고 성인으로 설정한 경우에만 동의할 수 있어요.",
    );
  if (data.consents.saveSensitive && c.config.encryptionKey.length < 32)
    throw new AppError(
      409,
      "ENCRYPTION_REQUIRED",
      "민감정보 보관은 서버 암호화 키를 설정한 뒤 사용할 수 있어요. 이번 세션에서만 사용할 수 있어요.",
    );
  if (data.settings.notifications.enabled)
    throw new AppError(
      409,
      "PUSH_UNAVAILABLE",
      "앱 종료 후 알림은 아직 연결되지 않았어요.",
    );
  await invalidateGroupsForOwner(c);
  const next = { ...c.state, ...data, onboarded: true };
  if (!data.consents.personalization || !data.consents.saveMeals)
    next.learning = initialState().learning;
  const statements = [
    c.repo.statement("DELETE FROM members WHERE owner = ?", c.owner),
    c.repo.statement("DELETE FROM groups WHERE owner = ?", c.owner),
    c.repo.statement(
      "INSERT INTO consent_events (id, owner, version, scopes, created_at) VALUES (?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      c.owner,
      POLICY_VERSION,
      JSON.stringify(data.consents),
      new Date().toISOString(),
    ),
    c.repo.statement("DELETE FROM sensitive_profiles WHERE owner = ?", c.owner),
    c.repo.statement("DELETE FROM selections WHERE owner = ?", c.owner),
  ];
  if (!data.consents.saveMeals)
    statements.push(
      c.repo.statement("DELETE FROM meals WHERE owner = ?", c.owner),
    );
  if (
    !data.consents.groupSharing ||
    (c.state.consents.sensitiveProcessing && !data.consents.sensitiveProcessing)
  ) {
    statements.push(
      c.repo.statement("DELETE FROM members WHERE owner = ?", c.owner),
    );
  }
  if (!data.consents.groupSharing)
    statements.push(
      c.repo.statement("DELETE FROM groups WHERE owner = ?", c.owner),
    );
  if (!data.consents.saveVisits) {
    const meals = await c.repo.getMeals(c.owner);
    for (const meal of meals)
      if (meal.visit)
        statements.push(
          c.repo.statement(
            "UPDATE meals SET payload = ? WHERE owner = ? AND id = ?",
            JSON.stringify({ ...meal, visit: null }),
            c.owner,
            meal.id,
          ),
        );
  }
  await c.repo.batch(statements);
  if (data.consents.saveSensitive)
    await c.repo.run(
      "INSERT INTO sensitive_profiles (owner, payload) VALUES (?, ?)",
      c.owner,
      await seal(data.profile, c.config.encryptionKey),
    );
  await c.repo.invalidate(c.owner);
  await c.repo.saveState(c.owner, next);
  return { state: next };
}
export async function resetLearning(c: Context) {
  c.state.learning = initialState().learning;
  await c.repo.saveState(c.owner, c.state);
  return { state: c.state };
}
export async function exportData(c: Context) {
  return {
    exportedAt: new Date().toISOString(),
    policyVersion: POLICY_VERSION,
    state: c.state,
    meals: await c.repo.getMeals(c.owner),
    feedback: await c.repo.rows(
      "SELECT payload FROM feedback WHERE owner = ?",
      c.owner,
    ),
  };
}
export async function deleteData(c: Context) {
  await invalidateGroupsForOwner(c);
  await c.repo.run("DELETE FROM sessions WHERE id = ?", c.owner);
  return { deleted: true };
}
