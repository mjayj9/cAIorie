import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  csrf: text("csrf").notNull(),
  state: text("state").notNull(),
  expires: integer("expires").notNull(),
});
export const sensitiveProfiles = sqliteTable("sensitive_profiles", {
  owner: text("owner")
    .primaryKey()
    .references(() => sessions.id, { onDelete: "cascade" }),
  payload: text("payload").notNull(),
});
export const meals = sqliteTable(
  "meals",
  {
    id: text("id").primaryKey(),
    owner: text("owner")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    payload: text("payload").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
  },
  (t) => [
    uniqueIndex("idx_meals_owner_idempotency").on(t.owner, t.idempotencyKey),
    index("idx_meals_owner_day").on(t.owner, t.day),
  ],
);
export const selections = sqliteTable(
  "selections",
  {
    id: text("id").primaryKey(),
    owner: text("owner")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    payload: text("payload").notNull(),
    status: text("status").notNull(),
    expires: integer("expires").notNull(),
  },
  (t) => [index("idx_selections_owner_status").on(t.owner, t.status)],
);
export const recommendations = sqliteTable("recommendations", {
  id: text("id").primaryKey(),
  owner: text("owner")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  payload: text("payload").notNull(),
  expires: integer("expires").notNull(),
});
export const feedback = sqliteTable("feedback", {
  mealId: text("meal_id")
    .primaryKey()
    .references(() => meals.id, { onDelete: "cascade" }),
  owner: text("owner")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  payload: text("payload").notNull(),
});
export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  owner: text("owner")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  inviteHash: text("invite_hash").notNull().unique(),
  expires: integer("expires").notNull(),
});
export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    owner: text("owner")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    payload: text("payload").notNull(),
    encrypted: integer("encrypted").notNull().default(0),
  },
  (t) => [uniqueIndex("idx_members_group_owner").on(t.groupId, t.owner)],
);
export const consentEvents = sqliteTable("consent_events", {
  id: text("id").primaryKey(),
  owner: text("owner")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  version: text("version").notNull(),
  scopes: text("scopes").notNull(),
  createdAt: text("created_at").notNull(),
});
