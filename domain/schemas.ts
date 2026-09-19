import { z } from "zod";
const text = z.string().trim().max(120);
export const restrictionsSchema = z
  .array(
    z
      .object({
        kind: z.enum(["food_allergy", "clinician_restriction", "intolerance"]),
        value: text.min(1),
        history: z.enum([
          "severe_or_trace_sensitive",
          "other_reported",
          "unspecified",
        ]),
      })
      .strict(),
  )
  .max(20);
export const profileSchema = z
  .object({
    ageBand: z.enum(["not_provided", "under14", "teen", "adult"]),
    allergyStatus: z.enum(["unknown", "none", "provided", "declined"]),
    restrictions: restrictionsSchema,
    excluded: z.array(text.min(1)).max(20),
    likes: z.array(text).max(20),
    dislikes: z.array(text).max(20),
    sex: z.enum(["unspecified", "female", "male"]),
    heightCm: z.number().min(30).max(250).nullable(),
    weightKg: z.number().min(1).max(400).nullable(),
    nutritionCountry: z.string().regex(/^[A-Z]{2}$/),
  })
  .strict()
  .refine(
    (p) =>
      p.allergyStatus !== "provided" ||
      p.restrictions.some((r) => r.kind === "food_allergy"),
    "알레르기 항목을 입력해 주세요.",
  )
  .refine(
    (p) =>
      p.allergyStatus !== "none" ||
      !p.restrictions.some((r) => r.kind === "food_allergy"),
    "알레르기 없음과 제한을 함께 입력할 수 없어요.",
  );
export const consentsSchema = z
  .object({
    sensitiveProcessing: z.boolean(),
    saveSensitive: z.boolean(),
    saveMeals: z.boolean(),
    savePreferences: z.boolean(),
    saveVisits: z.boolean(),
    personalization: z.boolean(),
    externalAi: z.boolean(),
    groupSharing: z.boolean(),
  })
  .strict()
  .refine(
    (c) => !c.saveSensitive || c.sensitiveProcessing,
    "민감정보 처리 동의가 필요해요.",
  );
export const conditionsSchema = z
  .object({
    budget: z.number().finite().min(0).max(10000000).nullable(),
    maxDistance: z.number().finite().positive().max(50000).nullable(),
    availableMinutes: z.number().finite().positive().max(600).nullable(),
    returnTrip: z.boolean(),
    partySize: z.number().int().min(1).max(20),
    serviceMode: z.enum(["dine_in", "takeout"]),
    craving: z.string().trim().max(100),
    currency: z.string().regex(/^[A-Z]{3}$/),
    minRating: z.number().min(0).max(5).nullable(),
    minReviews: z.number().int().nonnegative().max(100000).nullable(),
  })
  .strict();
export const weightsSchema = z
  .object({
    health: z.number().min(0).max(1),
    taste: z.number().min(0).max(1),
    price: z.number().min(0).max(1),
    distance: z.number().min(0).max(1),
    rating: z.number().min(0).max(1),
  })
  .strict();
export const timezoneSchema = z
  .string()
  .max(80)
  .refine((s) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: s });
      return true;
    } catch {
      return false;
    }
  }, "올바른 시간대를 선택해 주세요.");
export const settingsSchema = z
  .object({
    conditions: conditionsSchema,
    weights: weightsSchema,
    scale: z.union([z.literal(5), z.literal(10)]),
    displayMode: z.enum(["simple", "normal"]),
    feedbackMode: z.enum(["B", "C"]),
    ratingWeights: z
      .object({
        rating: z.number().min(0).max(5),
        count: z.number().min(0).max(5),
        recency: z.number().min(0).max(5),
        menuPraise: z.number().min(0).max(5),
        consistency: z.number().min(0).max(5),
      })
      .strict(),
    retentionDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    interests: z.array(z.enum(["다양성", "채소", "나트륨 정보"])).max(3),
    guidance: z.enum(["relaxed", "normal", "active"]),
    notifications: z
      .object({
        enabled: z.boolean(),
        time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        days: z.array(z.number().int().min(0).max(6)).max(7),
        timezone: timezoneSchema,
      })
      .strict(),
  })
  .strict();
export const locationSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracyMeters: z.number().nonnegative().nullable(),
    capturedAt: z.string().datetime(),
    origin: z.enum(["device", "user_selected", "demo"]),
    country: z.string().regex(/^[A-Z]{2}$/),
    label: z.string().trim().max(200).optional(),
  })
  .strict();
export const requestSchema = z
  .object({
    profile: profileSchema,
    conditions: conditionsSchema,
    location: locationSchema.nullable(),
    groupId: z.string().uuid().nullable(),
    skipYesterday: z.boolean(),
    mode: z.enum(["demo", "live"]),
  })
  .strict();
export const mealDraftSchema = z
  .object({
    raw: z.string().trim().min(1).max(2000),
    day: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(
        (s) =>
          !Number.isNaN(Date.parse(s)) &&
          new Date(s).toISOString().slice(0, 10) === s,
      ),
    slot: z.enum(["breakfast", "lunch", "dinner", "snack", "other"]),
    timezone: timezoneSchema,
    status: z.enum(["confirmed", "planned"]),
    source: z.enum(["manual", "search", "selection"]),
    foodId: z.string().max(80).nullable(),
    amount: z.number().positive().max(10000).nullable(),
    unit: z.string().max(20).nullable(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
export const feedbackSchema = z
  .object({
    mealId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    selectionReason: z.string().max(100).nullable(),
    reasons: z
      .array(
        z.enum([
          "맛",
          "가격",
          "거리",
          "양",
          "대기",
          "식사 균형",
          "동행",
          "기타",
        ]),
      )
      .max(8),
    comment: z.string().max(500),
    mode: z.enum(["B", "C"]),
  })
  .strict();
export const groupMemberSchema = z
  .object({
    label: z.string().trim().min(1).max(20),
    profile: profileSchema,
    conditions: conditionsSchema,
    consent: z.literal(true),
  })
  .strict();
