export const CRITERIA = [
  "health",
  "taste",
  "price",
  "distance",
  "rating",
] as const;
export type Criterion = (typeof CRITERIA)[number];
export type Mode = "demo" | "live";
export type Observation<T> = {
  value: T | null;
  status: "verified" | "estimated" | "unknown" | "conflicting" | "demo";
  evidenceIds: string[];
  unit?: string;
  basis?: string;
  checkedAt: string | null;
};
export type Evidence = {
  id: string;
  providerId: string;
  sourceUrl: string | null;
  retrievedAt: string;
  appliesToPlaceId: string | null;
  appliesToMenuId: string | null;
  attribution: string;
  storageAllowed: boolean;
};
export type Restriction = {
  kind: "food_allergy" | "clinician_restriction" | "intolerance";
  value: string;
  history: "severe_or_trace_sensitive" | "other_reported" | "unspecified";
};
export type Profile = {
  ageBand: "not_provided" | "under14" | "teen" | "adult";
  allergyStatus: "unknown" | "none" | "provided" | "declined";
  restrictions: Restriction[];
  excluded: string[];
  likes: string[];
  dislikes: string[];
  sex: "unspecified" | "female" | "male";
  heightCm: number | null;
  weightKg: number | null;
  nutritionCountry: string;
};
export type Consents = {
  sensitiveProcessing: boolean;
  saveSensitive: boolean;
  saveMeals: boolean;
  savePreferences: boolean;
  saveVisits: boolean;
  personalization: boolean;
  externalAi: boolean;
  groupSharing: boolean;
};
export type Conditions = {
  budget: number | null;
  minDistance: number;
  maxDistance: number | null;
  availableMinutes: number | null;
  returnTrip: boolean;
  partySize: number;
  serviceMode: "dine_in" | "takeout";
  craving: string;
  currency: string;
  minRating: number | null;
  minReviews: number | null;
};
export type Settings = {
  conditions: Conditions;
  weights: Record<Criterion, number>;
  scale: 5 | 10;
  displayMode: "simple" | "normal";
  feedbackMode: "B" | "C";
  ratingWeights: Record<
    "rating" | "count" | "recency" | "menuPraise" | "consistency",
    number
  >;
  retentionDays: 7 | 30 | 90;
  interests: string[];
  guidance: "relaxed" | "normal" | "active";
  notifications: {
    enabled: boolean;
    time: string;
    days: number[];
    timezone: string;
  };
};
export type Location = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
  origin: "device" | "user_selected" | "demo";
  country: string;
  label?: string;
};
export type Menu = {
  id: string;
  placeId: string;
  name: string;
  cuisine: string;
  ingredients: string[] | null;
  foodGroups: string[];
  cooking: string | null;
  price: Observation<number>;
  allergens: Record<
    string,
    | "contains"
    | "potential_cross_contact"
    | "documented_handling"
    | "unknown"
    | "conflicting"
  >;
  nutrition: Record<string, Observation<number>>;
  evidenceIds: string[];
  image: string | null;
  popularity: Observation<number>;
};
export type Place = {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  providerId: string;
  category?: string;
  phone?: string;
  matchedQuery?: string;
  administrativeStatus: "active" | "closed" | "suspended" | "unknown";
  operatingStatus: Observation<"open" | "closed" | "break">;
  rating: Observation<number>;
  ratingScale: number;
  reviewCount: Observation<number>;
  recentReview: Observation<number>;
  reviewConsistency: Observation<number>;
  distance: Observation<number>;
  distanceType: "straight_line" | "route" | "unknown";
  travelMinutes: Observation<number>;
  waitMinutes: Observation<number>;
  mealMinutes: Observation<number>;
  takeout: Observation<boolean>;
  partyCapacity: Observation<number>;
  menus: Menu[];
  url: string | null;
  directionsUrl: string | null;
  evidenceIds: string[];
};
export type SafetyResult = {
  status: "reviewed" | "needs_confirmation" | "blocked";
  reasons: string[];
  mustShowWarnings: string[];
  evidenceIds: string[];
};
export type Score = {
  criteria: Record<Criterion, number | null>;
  observedScore: number | null;
  coverage: number;
  comparisonRange: { lower: number; upper: number } | null;
};
export type RankedCandidate = Score & {
  place: Place;
  menu: Menu;
  safety: SafetyResult;
  candidateStatus: "eligible" | "conditional" | "excluded";
  reasons: string[];
  missingFields: string[];
  groupMenus?: { label: string; menuName: string; price: number | null }[];
};
export type MealItem = {
  foodReference?: import("./foods.ts").CatalogFood;
  name: string;
  amount: number | null;
  unit: string | null;
  foodId: string | null;
  foodGroups: string[];
  cooking: string | null;
  nutrition: Record<string, Observation<number>>;
  tagBasis: string | null;
};
export type Meal = {
  id: string;
  day: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack" | "other";
  timezone: string;
  raw: string;
  items: MealItem[];
  status: "confirmed" | "planned";
  source: "manual" | "search" | "selection";
  confirmedAt: string | null;
  visit: { placeId: string; menuId: string } | null;
  dataMode: Mode;
};
export type Feedback = {
  mealId: string;
  rating: number;
  selectionReason: string | null;
  reasons: string[];
  comment: string;
  mode: "B" | "C";
};
export type SelectionStatus =
  | "awaiting_confirmation"
  | "confirmed_eaten"
  | "changed_meal"
  | "explicitly_not_eaten"
  | "expired_unconfirmed";
export type Selection = {
  id: string;
  dataMode: Mode;
  menu: Menu;
  placeId: string;
  placeName: string;
  status: SelectionStatus;
  createdAt: string;
  mealId: string | null;
  selectionReason: string | null;
};
export type Learning = {
  taste: Record<string, number>;
  observations: number;
  lastProposalAt: string | null;
  rejectedUntil: string | null;
};
export type Relaxation = {
  id: string;
  field: "budget" | "maxDistance" | "minRating";
  before: number;
  after: number;
  verifiedAdditionalCandidates: number | null;
  candidateKind?: "menu" | "place";
  requiresConfirmation: true;
};
export type PlaceCandidate = {
  place: Place;
  reasons: string[];
  checks: string[];
  warnings: string[];
  inquiryOnly: boolean;
};
export type Recommendation = {
  id: string;
  status:
    | "ready"
    | "partial"
    | "needs_input"
    | "no_match"
    | "provider_unavailable";
  dataMode: Mode;
  recommendations: RankedCandidate[];
  conditionalCandidates: RankedCandidate[];
  nearbyPlaces: Place[];
  placeCandidates: PlaceCandidate[];
  requestKey?: string;
  evidence: Evidence[];
  proposals: Relaxation[];
  question: string | null;
  notices: string[];
  footerNotice: string;
};
export type HistoryAnalysis = {
  mealCount: number;
  validDays: number;
  todayCount: number;
  dates: { day: string; count: number | null }[];
  repetitions: { name: string; count: number }[];
  foodGroups: string[];
  cooking: { name: string; count: number }[];
  score: null;
  scoreStatus: string;
};
export type SessionState = {
  onboarded: boolean;
  consents: Consents;
  profile: Profile;
  settings: Settings;
  learning: Learning;
  yesterdayAsked: boolean;
};
export type Capability = {
  id: string;
  name: string;
  configured: boolean;
  mode: Mode | "disabled";
  capabilities: string[];
  detail: string;
  lastContractVerifiedAt: string | null;
};
