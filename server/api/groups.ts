import { z } from "zod";
import { groupMemberSchema } from "../../domain/schemas.ts";
import {
  hasSensitiveProfile,
  assertProfilePermission,
} from "../../domain/safety.ts";
import { initialState } from "../../domain/defaults.ts";
import type { GroupParticipant } from "../../domain/ranking.ts";
import type { Context } from "../context.ts";
import { hash, token, seal, unseal } from "../crypto.ts";
import { AppError, requireValue } from "../errors.ts";
type Member = {
  id: string;
  owner: string;
  label: string;
  payload: string;
  encrypted: number;
};
async function group(c: Context, id: string) {
  return requireValue(
    await c.repo.first<{ id: string; owner: string; expires: number }>(
      "SELECT id, owner, expires FROM groups WHERE id = ? AND expires > ?",
      id,
      Date.now(),
    ),
  );
}
export async function invalidateGroup(c: Context, id: string) {
  const owners = await c.repo.rows<{ owner: string }>(
    "SELECT owner FROM members WHERE group_id = ?",
    id,
  );
  const commands = owners.flatMap((o) => [
    c.repo.statement("DELETE FROM recommendations WHERE owner = ?", o.owner),
    c.repo.statement(
      "DELETE FROM selections WHERE owner = ? AND status = 'awaiting_confirmation'",
      o.owner,
    ),
  ]);
  if (commands.length) await c.repo.batch(commands);
}
function consent(c: Context) {
  if (!c.state.consents.groupSharing)
    throw new AppError(
      403,
      "GROUP_CONSENT",
      "그룹 공유 범위를 확인하고 동의해 주세요.",
    );
}
async function memberPayload(
  c: Context,
  data: z.infer<typeof groupMemberSchema>,
) {
  assertProfilePermission(data.profile, c.state.consents.sensitiveProcessing);
  if (data.profile.ageBand === "not_provided")
    throw new AppError(
      400,
      "AGE_REQUIRED",
      "참여자의 연령 구간을 확인해 주세요.",
    );
  const sensitive = hasSensitiveProfile(data.profile);
  if (sensitive && c.config.encryptionKey.length < 32)
    throw new AppError(
      409,
      "GROUP_ENCRYPTION",
      "그룹의 민감한 제한조건은 서버 암호화를 설정한 뒤 공유할 수 있어요.",
    );
  const participant: GroupParticipant = {
    label: data.label,
    profile: data.profile,
    conditions: data.conditions,
    settings: c.state.settings,
    learning: initialState().learning,
  };
  return {
    payload: sensitive
      ? await seal(participant, c.config.encryptionKey)
      : JSON.stringify(participant),
    encrypted: sensitive ? 1 : 0,
  };
}
export async function createGroup(c: Context, input: unknown) {
  consent(c);
  const data = groupMemberSchema.parse(input),
    member = await memberPayload(c, data),
    id = crypto.randomUUID(),
    invite = token();
  await c.repo.batch([
    c.repo.statement(
      "INSERT INTO groups (id, owner, invite_hash, expires) VALUES (?, ?, ?, ?)",
      id,
      c.owner,
      await hash(invite),
      Date.now() + 24 * 3600000,
    ),
    c.repo.statement(
      "INSERT INTO members (id, group_id, owner, label, payload, encrypted) VALUES (?, ?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      id,
      c.owner,
      data.label,
      member.payload,
      member.encrypted,
    ),
  ]);
  return {
    id,
    invite,
    expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(),
  };
}
export async function joinGroup(c: Context, input: unknown) {
  consent(c);
  const { invite, member } = z
    .object({ invite: z.string().min(20).max(200), member: groupMemberSchema })
    .strict()
    .parse(input);
  const g = requireValue(
    await c.repo.first<{ id: string }>(
      "SELECT id FROM groups WHERE invite_hash = ? AND expires > ?",
      await hash(invite),
      Date.now(),
    ),
    "초대가 만료되었거나 올바르지 않아요.",
  );
  const count = await c.repo.first<{ n: number }>(
    "SELECT count(*) AS n FROM members WHERE group_id = ?",
    g.id,
  );
  if (count!.n >= 20)
    throw new AppError(
      409,
      "GROUP_FULL",
      "그룹은 최대 20명까지 참여할 수 있어요.",
    );
  const payload = await memberPayload(c, member);
  await invalidateGroup(c, g.id);
  await c.repo.run(
    "INSERT INTO members (id, group_id, owner, label, payload, encrypted) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(group_id, owner) DO UPDATE SET label = excluded.label, payload = excluded.payload, encrypted = excluded.encrypted",
    crypto.randomUUID(),
    g.id,
    c.owner,
    member.label,
    payload.payload,
    payload.encrypted,
  );
  return { id: g.id };
}
export async function groupStatus(c: Context, id: string) {
  const g = await group(c, id);
  requireValue(
    await c.repo.first(
      "SELECT id FROM members WHERE group_id = ? AND owner = ?",
      id,
      c.owner,
    ),
  );
  const rows = await c.repo.rows<{ id: string; owner: string; label: string }>(
    "SELECT id, owner, label FROM members WHERE group_id = ?",
    id,
  );
  return {
    id: g.id,
    isOwner: g.owner === c.owner,
    expiresAt: new Date(g.expires).toISOString(),
    members: rows.map((m) => ({
      label: m.label,
      isSelf: m.owner === c.owner,
      guestId:
        g.owner === c.owner && m.owner.startsWith("guest:") ? m.id : null,
    })),
    notice:
      "각자의 조건은 결과 계산에만 사용하며 다른 참여자에게 공개하지 않아요.",
  };
}
export async function groupParticipants(
  c: Context,
  id: string,
): Promise<GroupParticipant[]> {
  consent(c);
  await groupStatus(c, id);
  const members = await c.repo.rows<Member>(
    "SELECT id, owner, label, payload, encrypted FROM members WHERE group_id = ?",
    id,
  );
  members.sort(
    (a, b) => Number(b.owner === c.owner) - Number(a.owner === c.owner),
  );
  return Promise.all(
    members.map((m) =>
      m.encrypted
        ? unseal<GroupParticipant>(m.payload, c.config.encryptionKey)
        : (JSON.parse(m.payload) as GroupParticipant),
    ),
  );
}
export async function leaveGroup(c: Context, input: unknown) {
  const { id } = z.object({ id: z.string().uuid() }).parse(input),
    g = await group(c, id);
  await groupStatus(c, id);
  await invalidateGroup(c, id);
  if (g.owner === c.owner)
    await c.repo.run(
      "DELETE FROM groups WHERE id = ? AND owner = ?",
      id,
      c.owner,
    );
  else
    await c.repo.run(
      "DELETE FROM members WHERE group_id = ? AND owner = ?",
      id,
      c.owner,
    );
  // Any previously ranked group result may be stale after a member leaves.
  await c.repo.run(
    "DELETE FROM recommendations WHERE owner IN (SELECT owner FROM members WHERE group_id = ?)",
    id,
  );
  await c.repo.invalidate(c.owner);
  return { left: true };
}

export async function invalidateGroupsForOwner(c: Context) {
  const groups = await c.repo.rows<{ id: string }>(
    "SELECT id FROM groups WHERE owner = ? UNION SELECT group_id AS id FROM members WHERE owner = ?",
    c.owner,
    c.owner,
  );
  for (const g of groups) await invalidateGroup(c, g.id);
}

export async function addGuest(c: Context, input: unknown) {
  consent(c);
  const { id, member } = z
    .object({ id: z.string().uuid(), member: groupMemberSchema })
    .parse(input);
  const g = await group(c, id);
  if (g.owner !== c.owner)
    throw new AppError(
      403,
      "OWNER_REQUIRED",
      "모임을 만든 사람만 동행인 조건을 추가할 수 있어요.",
    );
  if (member.profile.ageBand === "not_provided")
    throw new AppError(
      400,
      "AGE_REQUIRED",
      "동행인의 연령 구간을 확인해 주세요.",
    );
  const total = await c.repo.first<{ n: number }>(
    "SELECT count(*) AS n FROM members WHERE group_id = ?",
    id,
  );
  if (total!.n >= 20)
    throw new AppError(409, "GROUP_FULL", "최대 20명까지 참여할 수 있어요.");
  if (hasSensitiveProfile(member.profile))
    throw new AppError(
      403,
      "GUEST_SENSITIVE",
      "건강·알레르기 정보는 당사자가 자신의 세션에서 공유해 주세요.",
    );
  const payload = await memberPayload(c, member),
    guestOwner = "guest:" + crypto.randomUUID();
  await invalidateGroup(c, id);
  await c.repo.batch([
    c.repo.statement(
      "INSERT INTO sessions (id, csrf, state, expires) VALUES (?, ?, ?, ?)",
      guestOwner,
      token(),
      JSON.stringify(initialState()),
      g.expires,
    ),
    c.repo.statement(
      "INSERT INTO members (id, group_id, owner, label, payload, encrypted) VALUES (?, ?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      id,
      guestOwner,
      member.label,
      payload.payload,
      payload.encrypted,
    ),
  ]);
  return { added: true };
}
export async function removeGuest(c: Context, input: unknown) {
  const { id, guestId } = z
      .object({ id: z.string().uuid(), guestId: z.string().uuid() })
      .parse(input),
    g = await group(c, id);
  if (g.owner !== c.owner)
    throw new AppError(
      403,
      "OWNER_REQUIRED",
      "모임을 만든 사람만 정리할 수 있어요.",
    );
  const m = requireValue(
    await c.repo.first<{ owner: string }>(
      "SELECT owner FROM members WHERE id = ? AND group_id = ?",
      guestId,
      id,
    ),
  );
  if (!m.owner.startsWith("guest:"))
    throw new AppError(
      403,
      "GUEST_REQUIRED",
      "초대 참여자는 직접 나가거나 모임을 해산해 주세요.",
    );
  await invalidateGroup(c, id);
  await c.repo.run("DELETE FROM sessions WHERE id = ?", m.owner);
  return { removed: true };
}
