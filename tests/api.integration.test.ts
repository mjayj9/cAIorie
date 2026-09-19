import type {
  SessionState,
  Meal,
  Selection,
  RankedCandidate,
  Learning,
  Place,
  Capability,
} from "../domain/models.ts";
type TestMember = { label: string; isSelf: boolean; guestId: string | null };
type TestResponse = {
  error?: string;
  csrf?: string;
  state: SessionState;
  meals: Meal[];
  meal: Meal;
  selection: Selection;
  id: string;
  invite: string;
  members: TestMember[];
  status: string;
  recommendations: RankedCandidate[];
  feedback: unknown[];
  stored: boolean;
  dataMode: string;
  nearbyPlaces: Place[];
  proposals: import("../domain/models.ts").Relaxation[];
  conditionalCandidates: RankedCandidate[];
  capabilities: Capability[];
  items: Array<{ name: string; latitude: number; longitude: number }>;
  learning: Learning;
};
import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../domain/defaults.ts";
import { DEMO_CENTER } from "../fixtures/demo.ts";
import { localDate, shiftDay } from "../domain/meals.ts";
const base = process.env.TEST_BASE_URL ?? "http://localhost:5173";
const active = process.env.RUN_API_TESTS === "1";
async function client() {
  let cookie = "",
    csrf = "";
  async function send(
    path: string,
    method = "GET",
    data?: unknown,
    headers: Record<string, string> = {},
  ) {
    const response = await fetch(base + "/api/" + path, {
      method,
      headers: {
        Cookie: cookie,
        ...(method === "GET"
          ? {}
          : {
              Origin: base,
              "Content-Type": "application/json",
              "X-CSRF-Token": csrf,
            }),
        ...headers,
      },
      body: method === "GET" ? undefined : JSON.stringify(data),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const raw = await response.text();
    let result: TestResponse;
    try {
      result = JSON.parse(raw);
    } catch {
      result = { error: raw } as TestResponse;
    }
    if (result.csrf) csrf = result.csrf;
    return { status: response.status, data: result };
  }
  await send("state");
  return {
    send,
    async setup(patch: Record<string, unknown> = {}) {
      const s = initialState();
      s.profile.ageBand = "adult";
      s.profile.allergyStatus = "none";
      s.consents.saveMeals = true;
      s.consents.savePreferences = true;
      s.consents.personalization = true;
      s.consents.groupSharing = true;
      const response = await send("settings", "POST", {
        profile: s.profile,
        settings: s.settings,
        consents: s.consents,
        ...patch,
      });
      assert.equal(response.status, 200, JSON.stringify(response.data));
      return response.data.state;
    },
  };
}
test(
  "API: end-to-end recommendation, idempotent confirmation, feedback and deletion",
  { skip: !active },
  async () => {
    const c = await client();
    try {
      const s = await c.setup(),
        input = {
          profile: s.profile,
          settings: s.settings,
          conditions: s.settings.conditions,
          location: DEMO_CENTER,
          mode: "demo",
          groupId: null,
          skipYesterday: false,
        };
      const question = await c.send("recommend", "POST", input);
      assert.equal(question.data.status, "needs_input");
      const r = await c.send("recommend", "POST", {
        ...input,
        skipYesterday: true,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.recommendations.length, 3);
      const selected = await c.send("select", "POST", {
        recommendationId: r.data.id,
        menuId: r.data.recommendations[0].menu.id,
        acknowledgeConditions: false,
        selectionReason: null,
      });
      assert.equal(selected.status, 200);
      assert.equal((await c.send("state")).data.meals.length, 0);
      const confirmations = await Promise.all(
        [1, 2].map(() =>
          c.send("confirm", "POST", {
            selectionId: selected.data.id,
            action: "eaten",
            timezone: "Asia/Seoul",
          }),
        ),
      );
      assert.ok(confirmations.every((r) => r.status === 200));
      assert.equal(confirmations[0].data.selection.placeId, "");
      assert.equal(confirmations[0].data.selection.menu.id, "");
      const stored = (await c.send("state")).data;
      assert.equal(stored.meals.length, 1);
      assert.equal(stored.meals[0].visit, null);
      const feedback = {
        mealId: stored.meals[0].id,
        rating: 5,
        reasons: ["맛"],
        selectionReason: null,
        comment: "",
        mode: "C",
      };
      assert.equal((await c.send("feedback", "POST", feedback)).status, 200);
      assert.equal(
        (await c.send("feedback", "POST", feedback)).data.learning.observations,
        1,
        "rating edit must not double learn",
      );
      assert.equal(
        (await c.send("meals/delete", "POST", { id: stored.meals[0].id }))
          .status,
        200,
      );
      const final = (await c.send("state")).data;
      assert.equal(final.meals.length, 0);
      assert.equal(final.state.learning.observations, 0);
    } finally {
      await c.send("privacy/delete", "POST", {});
    }
  },
);
test(
  "API: session ownership and CSRF enforced",
  { skip: !active },
  async () => {
    const a = await client(),
      b = await client();
    try {
      const sa = await a.setup();
      await b.setup();
      const meal = await a.send("meals", "POST", {
        raw: "밥",
        day: localDate(new Date()),
        slot: "lunch",
        timezone: "Asia/Seoul",
        status: "confirmed",
        source: "manual",
        foodId: null,
        amount: null,
        unit: null,
        idempotencyKey: crypto.randomUUID(),
      });
      assert.equal(meal.status, 200);
      const attack = await b.send("feedback", "POST", {
        mealId: meal.data.meal.id,
        rating: 1,
        reasons: [],
        selectionReason: null,
        comment: "",
        mode: "B",
      });
      assert.equal(attack.status, 404);
      const forgery = await a.send(
        "settings",
        "POST",
        { profile: sa.profile, settings: sa.settings, consents: sa.consents },
        { "X-CSRF-Token": "bad", Origin: "https://example.com" },
      );
      assert.equal(forgery.status, 403);
      assert.equal((await b.send("state")).data.meals.length, 0);
    } finally {
      await a.send("privacy/delete", "POST", {});
      await b.send("privacy/delete", "POST", {});
    }
  },
);
test(
  "API: no storage consent, future plans, and validation",
  { skip: !active },
  async () => {
    const c = await client();
    try {
      const s = initialState();
      s.profile.ageBand = "teen";
      await c.setup({ profile: s.profile, consents: s.consents });
      const draft = {
        raw: "카레",
        day: localDate(new Date()),
        slot: "lunch",
        timezone: "Asia/Seoul",
        status: "confirmed",
        source: "manual",
        foodId: null,
        amount: null,
        unit: null,
        idempotencyKey: crypto.randomUUID(),
      };
      const response = await c.send("meals", "POST", draft);
      assert.equal(response.data.stored, false);
      assert.equal((await c.send("state")).data.meals.length, 0);
      assert.equal(
        (
          await c.send("meals", "POST", {
            ...draft,
            day: shiftDay(draft.day, 1),
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await c.send("meals", "POST", {
            ...draft,
            status: "planned",
            day: shiftDay(draft.day, 1),
          })
        ).status,
        200,
      );
      assert.equal(
        (await c.send("meals", "POST", { ...draft, raw: "" })).status,
        400,
      );
    } finally {
      await c.send("privacy/delete", "POST", {});
    }
  },
);
test(
  "API: allergy consent, children and placeholder encryption fail closed",
  { skip: !active },
  async () => {
    const c = await client();
    try {
      const s = initialState();
      s.profile.ageBand = "teen";
      s.profile.allergyStatus = "provided";
      s.profile.restrictions = [
        { kind: "food_allergy", value: "달걀", history: "unspecified" },
      ];
      const input = {
        profile: s.profile,
        settings: s.settings,
        consents: s.consents,
      };
      assert.equal((await c.send("settings", "POST", input)).status, 403);
      assert.equal(
        (
          await c.send("settings", "POST", {
            ...input,
            profile: { ...initialState().profile, ageBand: "under14" },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await c.send("settings", "POST", {
            ...input,
            consents: {
              ...s.consents,
              sensitiveProcessing: true,
              saveSensitive: true,
            },
          })
        ).status,
        409,
      );
    } finally {
      await c.send("privacy/delete", "POST", {});
    }
  },
);
test(
  "API: group admission, private constraints, leave invalidates stale recommendation",
  { skip: !active },
  async () => {
    const a = await client(),
      b = await client(),
      outsider = await client();
    try {
      const sa = await a.setup(),
        sb = await b.setup();
      const member = (s: SessionState, label: string) => ({
        label,
        profile: s.profile,
        conditions: s.settings.conditions,
        consent: true,
      });
      const created = await a.send("groups", "POST", member(sa, "하나"));
      assert.equal(created.status, 200);
      assert.equal(
        (await outsider.send("groups?id=" + created.data.id)).status,
        404,
      );
      const joined = await b.send("groups/join", "POST", {
        invite: created.data.invite,
        member: member(sb, "둘"),
      });
      assert.equal(joined.status, 200);
      const status = (await a.send("groups?id=" + created.data.id)).data;
      assert.equal(status.members.length, 2);
      assert.ok(
        status.members.every(
          (m: TestMember) => !("profile" in m) && !("payload" in m),
        ),
      );
      const result = await a.send("recommend", "POST", {
        profile: sa.profile,
        settings: sa.settings,
        conditions: sa.settings.conditions,
        location: DEMO_CENTER,
        mode: "demo",
        groupId: created.data.id,
        skipYesterday: true,
      });
      assert.equal(result.status, 200);
      assert.ok(result.data.recommendations[0].groupMenus?.length === 2);
      await b.send("groups/leave", "POST", { id: created.data.id });
      const stale = await a.send("select", "POST", {
        recommendationId: result.data.id,
        menuId: result.data.recommendations[0].menu.id,
        acknowledgeConditions: false,
        selectionReason: null,
      });
      assert.equal(stale.status, 404);
      assert.equal((await b.send("groups?id=" + created.data.id)).status, 404);
    } finally {
      await a.send("privacy/delete", "POST", {});
      await b.send("privacy/delete", "POST", {});
      await outsider.send("privacy/delete", "POST", {});
    }
  },
);
test(
  "API: consent withdrawal removes records and learned state",
  { skip: !active },
  async () => {
    const c = await client();
    try {
      const s = await c.setup();
      const meal = await c.send("meals", "POST", {
        raw: "비빔밥",
        day: localDate(new Date()),
        slot: "lunch",
        timezone: "Asia/Seoul",
        status: "confirmed",
        source: "manual",
        foodId: null,
        amount: null,
        unit: null,
        idempotencyKey: crypto.randomUUID(),
      });
      await c.send("feedback", "POST", {
        mealId: meal.data.meal.id,
        rating: 5,
        reasons: ["맛"],
        selectionReason: null,
        comment: "",
        mode: "C",
      });
      const saved = await c.send("settings", "POST", {
        profile: s.profile,
        settings: s.settings,
        consents: { ...s.consents, saveMeals: false, personalization: false },
      });
      assert.equal(saved.status, 200);
      const result = (await c.send("state")).data;
      assert.equal(result.meals.length, 0);
      assert.equal(result.state.learning.observations, 0);
      const exported = (await c.send("privacy/export")).data;
      assert.equal(exported.feedback.length, 0);
    } finally {
      await c.send("privacy/delete", "POST", {});
    }
  },
);
test(
  "LIVE Kakao: authenticated address search and nearby restaurants",
  { skip: !active || process.env.RUN_LIVE_KAKAO_TESTS !== "1" },
  async () => {
    const c = await client();
    try {
      const status = await c.send("state");
      assert.equal(
        status.data.capabilities.find((p) => p.id === "kakao")?.configured,
        true,
      );
      const initial = initialState();
      initial.profile.ageBand = "adult";
      const s = await c.setup({
        profile: initial.profile,
        consents: initial.consents,
      });
      // Public landmark address; this test never reads the user's location.
      const address = await c.send(
        "locations?q=" + encodeURIComponent("서울특별시 중구 세종대로 110"),
      );
      assert.equal(address.status, 200);
      assert.ok(address.data.items.length > 0);
      const match = address.data.items[0];
      const result = await c.send("recommend", "POST", {
        profile: s.profile,
        settings: s.settings,
        conditions: { ...s.settings.conditions, maxDistance: 1000 },
        location: {
          latitude: match.latitude,
          longitude: match.longitude,
          accuracyMeters: null,
          capturedAt: new Date().toISOString(),
          origin: "user_selected",
          country: "KR",
        },
        mode: "live",
        groupId: null,
        skipYesterday: true,
      });
      assert.equal(result.status, 200);
      assert.equal(result.data.dataMode, "live");
      assert.equal(result.data.status, "partial");
      assert.ok(result.data.nearbyPlaces.length > 0);
      assert.ok(
        result.data.nearbyPlaces.every(
          (p) => p.providerId === "kakao" && p.menus.length === 0,
        ),
      );
      assert.equal(result.data.recommendations.length, 0);
    } finally {
      assert.equal((await c.send("privacy/delete", "POST", {})).status, 200);
    }
  },
);

test(
  "API: guest consent, host authorization, private data and removal",
  { skip: !active },
  async () => {
    const a = await client(),
      b = await client();
    try {
      const sa = await a.setup(),
        sb = await b.setup();
      const member = {
        label: "나",
        profile: sa.profile,
        conditions: sa.settings.conditions,
        consent: true,
      };
      const g = (await a.send("groups", "POST", member)).data;
      await b.send("groups/join", "POST", {
        invite: g.invite,
        member: { ...member, profile: sb.profile, label: "초대 참여자" },
      });
      const guest = {
        id: g.id,
        member: {
          ...member,
          label: "동행인",
          conditions: { ...member.conditions, budget: 10000 },
        },
      };
      assert.equal((await b.send("groups/guest", "POST", guest)).status, 403);
      assert.equal(
        (
          await a.send("groups/guest", "POST", {
            ...guest,
            member: { ...guest.member, consent: false },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await a.send("groups/guest", "POST", {
            ...guest,
            member: {
              ...guest.member,
              profile: { ...guest.member.profile, ageBand: "under14" },
            },
          })
        ).status,
        403,
      );
      assert.equal((await a.send("groups/guest", "POST", guest)).status, 200);
      const state = (await a.send("groups?id=" + g.id)).data;
      assert.equal(state.members.length, 3);
      const gm = state.members.find((m: TestMember) => m.guestId);
      assert.ok(gm);
      assert.equal(gm.label, "동행인");
      const outsiderView = (await b.send("groups?id=" + g.id)).data;
      assert.ok(
        outsiderView.members.every((m: TestMember) => m.guestId === null),
      );
      const r = await a.send("recommend", "POST", {
        profile: sa.profile,
        settings: sa.settings,
        conditions: sa.settings.conditions,
        location: DEMO_CENTER,
        mode: "demo",
        groupId: g.id,
        skipYesterday: true,
      });
      assert.equal(r.status, 200);
      assert.equal(r.data.recommendations[0].groupMenus?.length, 3);
      await a.send("groups/guest/remove", "POST", {
        id: g.id,
        guestId: gm.guestId,
      });
      assert.equal((await a.send("groups?id=" + g.id)).data.members.length, 2);
      assert.equal(
        (
          await a.send("select", "POST", {
            recommendationId: r.data.id,
            menuId: r.data.recommendations[0].menu.id,
            acknowledgeConditions: false,
            selectionReason: null,
          })
        ).status,
        404,
      );
    } finally {
      await a.send("privacy/delete", "POST", {});
      await b.send("privacy/delete", "POST", {});
    }
  },
);
test(
  "API: retention expiry rebuilds derived learning",
  { skip: !active },
  async () => {
    const c = await client();
    try {
      const s = await c.setup();
      const m = await c.send("meals", "POST", {
        raw: "비빔밥",
        day: shiftDay(localDate(new Date()), -10),
        slot: "lunch",
        timezone: "Asia/Seoul",
        status: "confirmed",
        source: "manual",
        foodId: null,
        amount: null,
        unit: null,
        idempotencyKey: crypto.randomUUID(),
      });
      assert.equal(m.status, 200);
      const f = await c.send("feedback", "POST", {
        mealId: m.data.meal.id,
        rating: 5,
        reasons: ["맛"],
        selectionReason: null,
        comment: "",
        mode: "C",
      });
      assert.equal(f.data.learning.observations, 1);
      await c.send("settings", "POST", {
        profile: s.profile,
        settings: { ...s.settings, retentionDays: 7 },
        consents: s.consents,
      });
      const result = (await c.send("state")).data;
      assert.equal(result.meals.length, 0);
      assert.equal(result.state.learning.observations, 0);
      assert.equal((await c.send("privacy/export")).data.feedback.length, 0);
    } finally {
      await c.send("privacy/delete", "POST", {});
    }
  },
);
test(
  "API: group revocation invalidates other members' cached results",
  { skip: !active },
  async () => {
    const a = await client(),
      b = await client(),
      x = await client();
    try {
      const sa = await a.setup(),
        sb = await b.setup();
      const group = (
        await a.send("groups", "POST", {
          label: "나",
          profile: sa.profile,
          conditions: sa.settings.conditions,
          consent: true,
        })
      ).data;
      await b.send("groups/join", "POST", {
        invite: group.invite,
        member: {
          label: "동료",
          profile: sb.profile,
          conditions: sb.settings.conditions,
          consent: true,
        },
      });
      const r = (
        await a.send("recommend", "POST", {
          profile: sa.profile,
          settings: sa.settings,
          conditions: sa.settings.conditions,
          location: DEMO_CENTER,
          mode: "demo",
          groupId: group.id,
          skipYesterday: true,
        })
      ).data;
      assert.equal(
        (await x.send("groups/leave", "POST", { id: group.id })).status,
        404,
      );
      assert.equal(
        (await a.send("groups?id=" + group.id)).data.members.length,
        2,
      );
      await b.send("settings", "POST", {
        profile: sb.profile,
        settings: sb.settings,
        consents: { ...sb.consents, groupSharing: false },
      });
      const stale = await a.send("select", "POST", {
        recommendationId: r.id,
        menuId: r.recommendations[0].menu.id,
        acknowledgeConditions: false,
        selectionReason: null,
      });
      assert.equal(stale.status, 404);
    } finally {
      await a.send("privacy/delete", "POST", {});
      await b.send("privacy/delete", "POST", {});
      await x.send("privacy/delete", "POST", {});
    }
  },
);
test(
  "API: unauthenticated personal meal parsing and storage blocked",
  { skip: !active },
  async () => {
    const c = await client();
    try {
      assert.equal(
        (await c.send("meals/parse", "POST", { text: "밥" })).status,
        403,
      );
      assert.equal(
        (
          await c.send("meals", "POST", {
            raw: "밥",
            day: localDate(new Date()),
            slot: "lunch",
            timezone: "Asia/Seoul",
            status: "confirmed",
            source: "manual",
            foodId: null,
            amount: null,
            unit: null,
            idempotencyKey: crypto.randomUUID(),
          })
        ).status,
        403,
      );
    } finally {
      await c.send("privacy/delete", "POST", {});
    }
  },
);

test(
  "API: verified relaxation keeps its location, constraints and group context",
  { skip: !active },
  async () => {
    const c = await client();
    try {
      const s = await c.setup();
      const input = {
        profile: s.profile,
        settings: s.settings,
        conditions: {
          ...s.settings.conditions,
          maxDistance: 15,
          budget: 25000,
        },
        location: DEMO_CENTER,
        mode: "demo",
        groupId: null as string | null,
        skipYesterday: true,
      };
      const first = await c.send("recommend", "POST", input);
      assert.equal(first.status, 200);
      assert.equal(first.data.proposals.length, 1);
      const proposal = first.data.proposals[0];
      const apply = (
        request: typeof input,
        recommendationId = first.data.id,
        proposalId = proposal.id,
      ) => c.send("relax", "POST", { recommendationId, proposalId, request });
      assert.equal(
        (
          await apply({
            ...input,
            conditions: { ...input.conditions, budget: 12000 },
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await apply({
            ...input,
            location: { ...DEMO_CENTER, latitude: 37.5 },
          })
        ).status,
        409,
      );
      const accepted = await apply(input);
      assert.equal(accepted.status, 200);
      assert.equal(accepted.data.recommendations.length, 3);
      const g = await c.send("groups", "POST", {
        label: "나",
        profile: s.profile,
        conditions: s.settings.conditions,
        consent: true,
      });
      assert.equal(g.status, 200);
      const grouped = { ...input, groupId: g.data.id };
      const groupResult = await c.send("recommend", "POST", grouped);
      assert.ok(groupResult.data.proposals.length > 0);
      const groupProposal = groupResult.data.proposals[0];
      const lostGroup = await apply(
        { ...grouped, groupId: null },
        groupResult.data.id,
        groupProposal.id,
      );
      assert.equal(lostGroup.status, 409);
      const validGroup = await apply(
        grouped,
        groupResult.data.id,
        groupProposal.id,
      );
      assert.equal(validGroup.status, 200);
      assert.ok(
        [
          ...validGroup.data.recommendations,
          ...validGroup.data.conditionalCandidates,
        ].every((c) => c.groupMenus?.length === 1),
      );
    } finally {
      assert.equal((await c.send("privacy/delete", "POST", {})).status, 200);
    }
  },
);
