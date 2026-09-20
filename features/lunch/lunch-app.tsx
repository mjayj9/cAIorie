"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, RotateCcw } from "lucide-react";
import type {
  Conditions,
  Feedback,
  Location,
  Meal,
  Place,
  RankedCandidate,
  Recommendation,
  Selection,
  SessionState,
} from "@/domain/models";
import { initialState, footerNotice } from "@/domain/defaults";
import { analyzeHistory, localDate, shiftDay } from "@/domain/meals";
import { DEMO_CENTER } from "@/fixtures/demo";
import type { RecommendInput } from "@/server/orchestrator";
import { ChosenRestaurant } from "./restaurant-cards";
import { getJson, postJson, type Snapshot } from "./api";
import { AppShell, type View } from "./shell";
import { Onboarding } from "./onboarding";
import { ConditionsDialog, LocationDialog } from "./conditions";
import { HomeHeader, WelcomePreview } from "./home";
import { Results } from "./results";
import { MealEditor, MealHistory, type MealDraft } from "./meals";
import { SettingsView } from "./settings";
import { PrivacyView } from "./privacy";
import { GroupView, type GroupStatus } from "./groups";
import { ConnectionsView } from "./connections";
import {
  FeedbackDialog,
  PendingMeal,
  SelectionDialog,
  type ConfirmedFood,
} from "./confirmation";
export function LunchApp() {
  const [view, setView] = useState<View>("home"),
    [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    ref = useRef<Snapshot | null>(null);
  const [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(false),
    [setup, setSetup] = useState(false),
    [intent, setIntent] = useState<"recommend" | "meal" | null>(null),
    [browseOnly, setBrowseOnly] = useState(false);
  const [today, setToday] = useState<Conditions>(
      initialState().settings.conditions,
    ),
    [mode, setMode] = useState<"demo" | "live">("live"),
    [location, setLocation] = useState<Location | null>(null),
    [conditionOpen, setConditionOpen] = useState(false),
    [locationOpen, setLocationOpen] = useState(false);
  const [result, setResult] = useState<Recommendation | null>(null),
    [question, setQuestion] = useState(false),
    [selecting, setSelecting] = useState<RankedCandidate | null>(null),
    [feedbackMeal, setFeedbackMeal] = useState<Meal | null>(null);
  const [editor, setEditor] = useState<{
      meal: Meal | null;
      day?: string;
      placeName?: string;
      resumeRecommendation?: boolean;
    } | null>(null),
    [deleting, setDeleting] = useState<Meal | null>(null);
  const [group, setGroup] = useState<GroupStatus | null>(null),
    [invite, setInvite] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const pendingRequest = useRef<RecommendInput | null>(null);
  const lastRequest = useRef<RecommendInput | null>(null);
  const [chosenPlace, setChosenPlace] = useState<Place | null>(null);
  const commit = useCallback((s: Snapshot) => {
    ref.current = s;
    setSnapshot(s);
  }, []);
  const refresh = useCallback(
    async (preserve = true) => {
      const data = await getJson<Snapshot>("state");
      if (preserve && ref.current) {
        data.state = {
          ...data.state,
          profile: ref.current.state.profile,
          settings: ref.current.state.settings,
          consents: ref.current.state.consents,
        };
      }
      commit(data);
      if (!preserve) setToday(data.state.settings.conditions);
      setLoadError("");
      return data;
    },
    [commit],
  );
  useEffect(() => {
    let active = true;
    void getJson<Snapshot>("state")
      .then((data) => {
        if (!active) return;
        commit(data);
        setToday(data.state.settings.conditions);
        setMode(data.runtime.defaultMode);
        setLocation(data.runtime.defaultMode === "demo" ? DEMO_CENTER : null);
        setLoadError("");
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, [commit]);
  const post = <T,>(path: string, input: unknown, signal?: AbortSignal) =>
    postJson<T>(path, input, ref.current?.csrf ?? "", signal);
  const perform = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const state = snapshot?.state ?? initialState();
  const requireSetup = (next: "recommend" | "meal") => {
    if (browseOnly) {
      toast.info(
        "개인정보 없는 둘러보기 모드예요. 입력·보관 기능은 사용하지 않아요.",
      );
      return false;
    }
    if (!snapshot) {
      toast.error("먼저 서버 연결을 확인해 주세요.");
      return false;
    }
    if (!snapshot.state.onboarded) {
      setIntent(next);
      setSetup(true);
      return false;
    }
    return true;
  };
  const saveState = async (next: SessionState) => {
    const saved = await post<{ state: SessionState }>("settings", {
      profile: next.profile,
      settings: next.settings,
      consents: next.consents,
    });
    if (ref.current) commit({ ...ref.current, state: saved.state });
    controller.current?.abort();
    setResult(null);
    setChosenPlace(null);
    pendingRequest.current = null;
    lastRequest.current = null;
    setGroup(null);
    setInvite(null);
    await refresh();
    toast.success(
      group
        ? "설정을 적용하고 이전 그룹 공유를 종료했어요."
        : "설정을 적용했어요.",
    );
  };
  const requestInput = (
    s = ref.current?.state ?? initialState(),
    conditions = today,
    groupId: string | null = null,
  ) => ({
    profile: s.profile,
    settings: s.settings,
    conditions,
    location,
    mode,
    skipYesterday: false,
    groupId,
  });
  const submitRecommendation = async (input: RecommendInput) => {
    lastRequest.current = input;
    if (
      input.mode === "live" &&
      (!input.location || input.location.origin === "demo")
    ) {
      pendingRequest.current = input;
      setLocationOpen(true);
      return;
    }
    pendingRequest.current = null;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const next = await post<Recommendation>("recommend", input, abort.signal);
      if (abort.signal.aborted) return;
      if (next.question) {
        setQuestion(true);
      } else {
        setResult(next);
        setQuestion(false);
        if (next.status === "needs_input")
          toast.info(next.notices[0] ?? "조건을 확인해 주세요.");
      }
      setView("home");
    } catch (e) {
      if (!abort.signal.aborted) toast.error((e as Error).message);
    } finally {
      if (controller.current === abort) setBusy(false);
    }
  };
  const runRecommendation = (
    skip = false,
    overrideState?: SessionState,
    groupId: string | null = null,
  ) =>
    submitRecommendation({
      ...requestInput(overrideState ?? ref.current?.state, today, groupId),
      skipYesterday: skip,
    });
  const resumeRecommendation = () => {
    if (lastRequest.current)
      void submitRecommendation({
        ...lastRequest.current,
        skipYesterday: true,
      });
  };
  const recommendClick = () => {
    if (requireSetup("recommend")) void runRecommendation();
  };
  const newMeal = (day?: string) => {
    if (requireSetup("meal")) setEditor({ meal: null, day });
  };
  const onSaveMeal = async (draft: MealDraft, id?: string) => {
    await perform(async () => {
      if (id) {
        await post("meals/edit", { id, draft });
        toast.success("기록을 수정했어요.");
      } else {
        const saved = await post<{
          meal: Meal;
          stored: boolean;
          message?: string;
        }>("meals", draft);
        if (saved.stored)
          toast.success("식사를 기록했어요.", {
            action: {
              label: "저장 취소",
              onClick: () =>
                void perform(async () => {
                  await post("meals/delete", { id: saved.meal.id });
                  await refresh();
                }),
            },
          });
        else toast.info(saved.message);
      }
      if (editor?.placeName && draft.status === "confirmed")
        setChosenPlace(null);
      const resume = editor?.resumeRecommendation;
      setEditor(null);
      await refresh();
      if (resume) resumeRecommendation();
    });
  };
  const confirm = async (
    selection: Selection,
    action: "eaten" | "changed" | "not_eaten" | "later",
    food?: ConfirmedFood,
  ) => {
    await perform(async () => {
      const data = await post<{
        selection: Selection;
        meal: Meal | null;
        stored: boolean;
        message?: string;
      }>("confirm", {
        selectionId: selection.id,
        action,
        ...food,
        timezone: state.settings.notifications.timezone,
      });
      if (action !== "later") {
        toast.success(data.message ?? "섭취하지 않은 상태로 확인했어요.");
        await refresh();
        if (data.meal && data.stored) setFeedbackMeal(data.meal);
      }
    });
  };
  const refreshGroup = async (id = group?.id) => {
    if (id)
      setGroup(
        await getJson<GroupStatus>("groups?id=" + encodeURIComponent(id)),
      );
  };
  const joinInput = (label: string) => ({
    label,
    profile: state.profile,
    conditions: state.settings.conditions,
    consent: true,
  });
  const setDisplay = (displayMode: "simple" | "normal") => {
    if (ref.current)
      commit({
        ...ref.current,
        state: {
          ...ref.current.state,
          settings: { ...ref.current.state.settings, displayMode },
        },
      });
  };
  const changeMode = (next: "demo" | "live") => {
    if (browseOnly) return;
    controller.current?.abort();
    setBusy(false);
    setMode(next);
    setResult(null);
    setChosenPlace(null);
    pendingRequest.current = null;
  };
  useEffect(() => {
    const doc = document as unknown as {
      modelContext?: {
        registerTool: (tool: unknown, options: unknown) => unknown;
      };
    };
    if (!doc.modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        doc.modelContext.registerTool(
          {
            name: "read_lunch_status",
            title: "현재 점심 추천 상태 확인",
            description:
              "현재 화면의 추천 수와 저장 기록 수를 읽습니다. 식사 기록이나 설정을 바꾸지 않습니다.",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== "object" ||
                Object.keys(input).length
              )
                throw new Error("Empty object required");
              return {
                view,
                recordedMeals: ref.current?.meals.length ?? 0,
                dataMode: mode,
                placeCandidates:
                  result?.placeCandidates.map((c) => ({
                    restaurant: c.place.name,
                    menuVerified: false,
                  })) ?? [],
                recommendations:
                  result?.recommendations.map((c) => ({
                    restaurant: c.place.name,
                    menu: c.menu.name,
                  })) ?? [],
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [view, mode, result]);
  return (
    <AppShell
      view={view}
      onNavigate={(v) => {
        if (browseOnly && v !== "home" && v !== "connections") {
          toast.info(
            "개인정보 없는 둘러보기에서는 입력 기능을 사용하지 않아요.",
          );
          return;
        }
        setView(v);
      }}
      dataMode={mode}
    >
      <Toaster position="top-right" theme="light" />
      {loadError && (
        <div className="error-panel" role="alert">
          <strong>서버 연결을 확인해 주세요</strong>
          <p>{loadError}</p>
          <button
            className="outline-button"
            onClick={() =>
              void refresh(false).catch((e) => setLoadError(e.message))
            }
          >
            <RotateCcw size={16} />
            다시 연결
          </button>
        </div>
      )}
      {browseOnly && (
        <div className="notice-box">
          <p>개인정보 없는 둘러보기 모드 · 식당과 사진은 가상 예시입니다.</p>
        </div>
      )}
      {view === "home" && (
        <>
          <HomeHeader
            analysis={
              snapshot?.analysis ?? analyzeHistory([], localDate(new Date()))
            }
            conditions={today}
            location={location}
            busy={busy || !snapshot}
            mode={mode}
            onMode={changeMode}
            onConditions={() => {
              if (!browseOnly) setConditionOpen(true);
            }}
            onLocation={() => {
              if (!browseOnly) setLocationOpen(true);
            }}
            onRecommend={recommendClick}
            onRecord={() => newMeal()}
          />
          {chosenPlace && (
            <ChosenRestaurant
              place={chosenPlace}
              onCancel={() => setChosenPlace(null)}
              onRecord={() =>
                setEditor({ meal: null, placeName: chosenPlace.name })
              }
            />
          )}
          {snapshot?.selections.map((s) => (
            <PendingMeal
              key={s.id}
              selection={s}
              busy={busy}
              onConfirm={(action, food) => void confirm(s, action, food)}
            />
          ))}
          {busy && (
            <div className="busy-bar" role="status">
              <Loader2 size={17} className="spin" />
              입력한 조건과 확인된 자료를 비교하고 있어요.
              <button
                className="text-button"
                onClick={() => {
                  controller.current?.abort();
                  setBusy(false);
                }}
              >
                취소
              </button>
            </div>
          )}
          {result ? (
            <Results
              key={result.id}
              result={result}
              onChoosePlace={(place) => {
                setChosenPlace(place);
                toast.success(
                  "방문할 식당을 선택했어요. 드신 뒤 실제 음식을 기록해 주세요.",
                );
              }}
              onConditions={() => setConditionOpen(true)}
              onLocation={() => setLocationOpen(true)}
              onRetry={() =>
                lastRequest.current
                  ? void submitRecommendation(lastRequest.current)
                  : recommendClick()
              }
              displayMode={state.settings.displayMode}
              onDisplay={setDisplay}
              onSelect={setSelecting}
              onRegistry={(place) =>
                post("places/registry", {
                  name: place.name,
                  address: place.address,
                })
              }
              busy={busy}
              onRelax={(id) =>
                void perform(async () => {
                  const proposal = result.proposals.find((p) => p.id === id)!;
                  const next = await post<Recommendation>("relax", {
                    recommendationId: result.id,
                    proposalId: id,
                    request: lastRequest.current ?? requestInput(),
                  });
                  const changed = {
                    ...today,
                    [proposal.field]: proposal.after,
                  };
                  setToday(changed);
                  if (lastRequest.current)
                    lastRequest.current = {
                      ...lastRequest.current,
                      conditions: changed,
                      skipYesterday: true,
                    };
                  setResult(next);
                })
              }
            />
          ) : (
            <WelcomePreview
              mode={mode}
              hasLocation={!!location && location.origin !== "demo"}
              onRecommend={recommendClick}
              onRecord={() => newMeal()}
            />
          )}
        </>
      )}
      {view === "meals" && (
        <MealHistory
          meals={snapshot?.meals ?? []}
          analysis={
            snapshot?.analysis ?? analyzeHistory([], localDate(new Date()))
          }
          onNew={() => newMeal()}
          onEdit={(meal) => setEditor({ meal })}
          onDelete={setDeleting}
        />
      )}
      {view === "settings" && (
        <SettingsView
          key="settings"
          state={state}
          busy={busy}
          sensitiveStorageAvailable={
            snapshot?.sensitiveStorageAvailable ?? false
          }
          onSave={(next) =>
            perform(async () => {
              await saveState(next);
              setToday(next.settings.conditions);
            })
          }
          onReset={() =>
            void perform(async () => {
              await post("learning/reset", {});
              await refresh();
              toast.success("학습된 취향을 초기화했어요.");
            })
          }
        />
      )}
      {view === "privacy" && (
        <PrivacyView
          aiAvailable={
            snapshot?.capabilities.some((c) => c.id === "ai" && c.configured) ??
            false
          }
          state={state}
          busy={busy}
          sensitiveStorageAvailable={
            snapshot?.sensitiveStorageAvailable ?? false
          }
          onSave={(next) => perform(() => saveState(next))}
          onExport={() =>
            void perform(async () => {
              const data = await getJson("privacy/export"),
                blob = new Blob([JSON.stringify(data, null, 2)], {
                  type: "application/json",
                }),
                url = URL.createObjectURL(blob),
                a = document.createElement("a");
              a.href = url;
              a.download = "hankki-data-" + localDate(new Date()) + ".json";
              a.click();
              URL.revokeObjectURL(url);
              toast.success("내보내기 파일을 만들었어요.");
            })
          }
          onDelete={() =>
            void perform(async () => {
              await post("privacy/delete", {});
              ref.current = null;
              setResult(null);
              setGroup(null);
              setInvite(null);
              setEditor(null);
              await refresh(false);
              setView("home");
              toast.success("이 세션의 정보를 삭제했어요.");
            })
          }
          onDeletePeriod={(before) =>
            void perform(async () => {
              await post("meals/delete", { before });
              await refresh();
              toast.success("선택한 기간의 기록을 삭제했어요.");
            })
          }
          onReset={() =>
            void perform(async () => {
              await post("learning/reset", {});
              await refresh();
              toast.success("학습 상태를 초기화했어요.");
            })
          }
        />
      )}
      {view === "group" && (
        <GroupView
          state={state}
          group={group}
          invite={invite}
          busy={busy}
          onEnable={() =>
            void perform(() =>
              saveState({
                ...state,
                consents: { ...state.consents, groupSharing: true },
              }),
            )
          }
          onCreate={(label) =>
            void perform(async () => {
              const created = await post<{ id: string; invite: string }>(
                "groups",
                joinInput(label),
              );
              setInvite(created.invite);
              await refreshGroup(created.id);
            })
          }
          onJoin={(invite, label) =>
            void perform(async () => {
              const joined = await post<{ id: string }>("groups/join", {
                invite,
                member: joinInput(label),
              });
              await refreshGroup(joined.id);
            })
          }
          onRefresh={() => void perform(() => refreshGroup())}
          onLeave={() =>
            void perform(async () => {
              await post("groups/leave", { id: group?.id });
              setGroup(null);
              setInvite(null);
              setResult(null);
              toast.success("그룹 공유를 종료했어요.");
            })
          }
          onRecommend={() =>
            void runRecommendation(true, undefined, group?.id ?? null)
          }
          onAddGuest={(label, profile, conditions) =>
            void perform(async () => {
              await post("groups/guest", {
                id: group?.id,
                member: { label, profile, conditions, consent: true },
              });
              setResult(null);
              await refreshGroup();
            })
          }
          onRemoveGuest={(guestId) =>
            void perform(async () => {
              await post("groups/guest/remove", { id: group?.id, guestId });
              setResult(null);
              await refreshGroup();
            })
          }
        />
      )}
      {view === "connections" && (
        <ConnectionsView capabilities={snapshot?.capabilities ?? []} />
      )}
      <p className="footer-notice">
        {footerNotice}{" "}
        {mode === "demo" && "현재 화면의 음식점·메뉴·가격은 데모입니다."}{" "}
        <a
          href="https://github.com/mjayj9/cAIorie"
          target="_blank"
          rel="noreferrer"
        >
          소스 코드 · AGPL-3.0
        </a>
      </p>
      {setup && (
        <Onboarding
          key="onboarding"
          open
          state={state}
          busy={busy}
          onClose={() => setSetup(false)}
          onBrowse={() => {
            setBrowseOnly(true);
            setMode("demo");
            setLocation(DEMO_CENTER);
            setSetup(false);
            setView("home");
          }}
          onSave={(next) =>
            perform(async () => {
              await saveState(next);
              setSetup(false);
              if (intent === "meal") setEditor({ meal: null });
              if (intent === "recommend")
                await runRecommendation(false, { ...next, onboarded: true });
            })
          }
        />
      )}
      {conditionOpen && (
        <ConditionsDialog
          value={today}
          onClose={() => setConditionOpen(false)}
          onSave={(v, asDefault) =>
            void perform(async () => {
              if (asDefault)
                await saveState({
                  ...state,
                  settings: { ...state.settings, conditions: v },
                });
              controller.current?.abort();
              setToday(v);
              pendingRequest.current = null;
              setConditionOpen(false);
              setResult(null);
              toast.success(
                asDefault
                  ? "평소 기본값에도 적용했어요."
                  : "오늘의 조건에만 적용했어요.",
              );
            })
          }
        />
      )}
      {locationOpen && (
        <LocationDialog
          value={location}
          onClose={() => {
            setLocationOpen(false);
            pendingRequest.current = null;
          }}
          onSave={(v) => {
            controller.current?.abort();
            setLocation(v);
            setMode("live");
            setLocationOpen(false);
            setResult(null);
            const input = {
              ...(pendingRequest.current ?? requestInput()),
              location: v,
              mode: "live" as const,
            };
            if (ref.current?.state.onboarded) void submitRecommendation(input);
            else {
              setIntent("recommend");
              setSetup(true);
            }
          }}
          onSearch={async (q) =>
            (
              await getJson<{
                items: { name: string; latitude: number; longitude: number }[];
              }>("locations?q=" + encodeURIComponent(q))
            ).items
          }
        />
      )}
      <Dialog open={question} onOpenChange={setQuestion}>
        <DialogContent className="flow-dialog">
          <DialogHeader>
            <DialogTitle>어제는 무엇을 드셨나요?</DialogTitle>
            <DialogDescription>
              최근 식사 기록이 없어요. 어제 점심이나 저녁 메뉴를 알려주시면
              반복을 줄이는 데 참고할게요. 건너뛰어도 괜찮아요.
            </DialogDescription>
          </DialogHeader>
          <div className="button-row">
            <button
              className="primary-button"
              onClick={() => {
                setQuestion(false);
                if (requireSetup("meal"))
                  setEditor({
                    meal: null,
                    day: shiftDay(localDate(new Date()), -1),
                    resumeRecommendation: true,
                  });
              }}
            >
              간단히 입력
            </button>
            <button className="outline-button" onClick={resumeRecommendation}>
              기억 안 남
            </button>
            <button className="outline-button" onClick={resumeRecommendation}>
              그냥 추천
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {editor && (
        <MealEditor
          meal={editor.meal}
          initialDay={editor.day}
          placeName={editor.placeName}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={onSaveMeal}
        />
      )}
      {selecting && result && (
        <SelectionDialog
          candidate={selecting}
          busy={busy}
          onClose={() => setSelecting(null)}
          onConfirm={(ack, reason) =>
            void perform(async () => {
              await post("select", {
                recommendationId: result.id,
                menuId: selecting.menu.id,
                acknowledgeConditions: ack,
                selectionReason: reason,
              });
              setSelecting(null);
              await refresh();
              toast.success(
                "메뉴를 선택했어요. 드신 뒤 실제 식사를 확인해 주세요.",
              );
            })
          }
        />
      )}
      {feedbackMeal && (
        <FeedbackDialog
          meal={feedbackMeal}
          mode={state.settings.feedbackMode}
          busy={busy}
          onClose={() => setFeedbackMeal(null)}
          onSave={(f: Feedback) =>
            void perform(async () => {
              await post("feedback", f);
              setFeedbackMeal(null);
              await refresh();
              toast.success("평가를 남겼어요. 고마워요.");
            })
          }
        />
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 식사 기록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              연결된 식후 평가와 학습 결과도 정리돼요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void perform(async () => {
                  await post("meals/delete", { id: deleting?.id });
                  setDeleting(null);
                  await refresh();
                  toast.success("기록을 삭제했어요.");
                })
              }
            >
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
