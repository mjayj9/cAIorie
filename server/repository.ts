import type { Database, SqlStatement } from "./database/contracts.ts";
import { recommendationForCache } from "../providers/persistence.ts";
import { archiveSelection } from "../domain/selections.ts";
import type {
  Meal,
  SessionState,
  Selection,
  Recommendation,
  Feedback,
} from "../domain/models.ts";
import { initialState } from "../domain/defaults.ts";
import { requireValue } from "./errors.ts";
export class Repository {
  constructor(public db: Database) {}
  statement(sql: string, ...args: unknown[]) {
    return { sql, args };
  }
  async first<T>(sql: string, ...args: unknown[]) {
    return this.db.first<T>(this.statement(sql, ...args));
  }
  async rows<T>(sql: string, ...args: unknown[]) {
    return this.db.rows<T>(this.statement(sql, ...args));
  }
  async run(sql: string, ...args: unknown[]) {
    return this.db.run(this.statement(sql, ...args));
  }
  async batch(statements: SqlStatement[]) {
    return this.db.batch(statements);
  }
  async state(owner: string) {
    const row = await this.first<{ state: string }>(
      "SELECT state FROM sessions WHERE id = ?",
      owner,
    );
    return row ? (JSON.parse(row.state) as SessionState) : null;
  }
  async saveState(owner: string, state: SessionState) {
    const stored = structuredClone(state),
      defaults = initialState();
    if (!state.consents.savePreferences) {
      stored.settings = defaults.settings;
      stored.profile = { ...defaults.profile, ageBand: state.profile.ageBand };
    } else
      stored.profile = {
        ...stored.profile,
        allergyStatus: "unknown",
        restrictions: [],
        sex: "unspecified",
        heightCm: null,
        weightKg: null,
      };
    stored.settings.retentionDays = state.settings.retentionDays;
    if (!state.consents.personalization || !state.consents.saveMeals)
      stored.learning = defaults.learning;
    await this.run(
      "UPDATE sessions SET state = ?, expires = ? WHERE id = ?",
      JSON.stringify(stored),
      Date.now() +
        (state.consents.saveMeals || state.consents.savePreferences ? 30 : 1) *
          86400000,
      owner,
    );
  }
  async getMeals(owner: string) {
    return (
      await this.rows<{ payload: string }>(
        "SELECT payload FROM meals WHERE owner = ? ORDER BY day DESC LIMIT 500",
        owner,
      )
    ).map((x) => JSON.parse(x.payload) as Meal);
  }
  async getMeal(owner: string, id: string) {
    const row = await this.first<{ payload: string }>(
      "SELECT payload FROM meals WHERE id = ? AND owner = ?",
      id,
      owner,
    );
    return row ? (JSON.parse(row.payload) as Meal) : null;
  }
  async insertMeal(owner: string, meal: Meal, key: string) {
    await this.run(
      "INSERT INTO meals (id, owner, day, payload, idempotency_key) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
      meal.id,
      owner,
      meal.day,
      JSON.stringify(meal),
      key,
    );
    const row = await this.first<{ payload: string }>(
      "SELECT payload FROM meals WHERE owner = ? AND idempotency_key = ?",
      owner,
      key,
    );
    return JSON.parse(requireValue(row).payload) as Meal;
  }
  async selection(owner: string, id: string) {
    const r = await this.first<{
      payload: string;
      status: Selection["status"];
    }>(
      "SELECT payload, status FROM selections WHERE id = ? AND owner = ? AND expires > ?",
      id,
      owner,
      Date.now(),
    );
    return r
      ? ({ ...JSON.parse(r.payload), status: r.status } as Selection)
      : null;
  }
  async selections(owner: string) {
    return (
      await this.rows<{ payload: string; status: Selection["status"] }>(
        "SELECT payload, status FROM selections WHERE owner = ? AND expires > ? AND status = 'awaiting_confirmation'",
        owner,
        Date.now(),
      )
    ).map((r) => ({ ...JSON.parse(r.payload), status: r.status }) as Selection);
  }
  async getRecommendation(owner: string, id: string) {
    const r = await this.first<{ payload: string }>(
      "SELECT payload FROM recommendations WHERE id = ? AND owner = ? AND expires > ?",
      id,
      owner,
      Date.now(),
    );
    return r ? (JSON.parse(r.payload) as Recommendation) : null;
  }
  async storeRecommendation(owner: string, result: Recommendation) {
    await this.run(
      "INSERT INTO recommendations (id, owner, payload, expires) VALUES (?, ?, ?, ?)",
      result.id,
      owner,
      JSON.stringify(recommendationForCache(result)),
      Date.now() + 20 * 60000,
    );
  }
  async confirm(
    owner: string,
    selection: Selection,
    meal: Meal | null,
    status: Selection["status"],
    saveVisits = false,
  ) {
    const payload = archiveSelection(selection, status, meal, saveVisits);
    const statements: SqlStatement[] = [];
    if (meal)
      statements.push(
        this.statement(
          "INSERT INTO meals (id, owner, day, payload, idempotency_key) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM selections WHERE id = ? AND owner = ? AND status = 'awaiting_confirmation') ON CONFLICT DO NOTHING",
          meal.id,
          owner,
          meal.day,
          JSON.stringify(meal),
          selection.id,
          selection.id,
          owner,
        ),
      );
    statements.push(
      this.statement(
        "UPDATE selections SET status = ?, payload = ? WHERE id = ? AND owner = ? AND status = 'awaiting_confirmation'",
        status,
        JSON.stringify(payload),
        selection.id,
        owner,
      ),
    );
    await this.batch(statements);
    return this.selection(owner, selection.id);
  }
  async feedback(owner: string, feedback: Feedback) {
    await this.run(
      "INSERT INTO feedback (meal_id, owner, payload) VALUES (?, ?, ?) ON CONFLICT(meal_id) DO UPDATE SET payload = excluded.payload WHERE feedback.owner = excluded.owner",
      feedback.mealId,
      owner,
      JSON.stringify(feedback),
    );
  }
  async invalidate(owner: string) {
    await this.batch([
      this.statement("DELETE FROM recommendations WHERE owner = ?", owner),
      this.statement(
        "DELETE FROM selections WHERE owner = ? AND status = 'awaiting_confirmation'",
        owner,
      ),
    ]);
  }
  async cleanup(owner: string, cutoff: string) {
    const result = await this.batch([
      this.statement("DELETE FROM sessions WHERE expires < ?", Date.now()),
      this.statement("DELETE FROM groups WHERE expires < ?", Date.now()),
      this.statement(
        "DELETE FROM recommendations WHERE expires < ?",
        Date.now(),
      ),
      this.statement("DELETE FROM selections WHERE expires < ?", Date.now()),
      this.statement(
        "DELETE FROM meals WHERE owner = ? AND day < ?",
        owner,
        cutoff,
      ),
    ]);
    return result[result.length - 1]?.changes ?? 0;
  }
}
