"use client";
import { GuestForm } from "./guest-form";
import { useState } from "react";
import { Copy, Users, Plus, RefreshCw, LogOut } from "lucide-react";
import type { Profile, SessionState, Conditions } from "@/domain/models";
import { Field, Check } from "./controls";
export type GroupStatus = {
  id: string;
  isOwner: boolean;
  expiresAt: string;
  members: { label: string; isSelf: boolean; guestId: string | null }[];
  notice: string;
};
export function GroupView({
  state,
  group,
  invite,
  busy,
  onEnable,
  onCreate,
  onJoin,
  onRefresh,
  onLeave,
  onRecommend,
  onAddGuest,
  onRemoveGuest,
}: {
  state: SessionState;
  group: GroupStatus | null;
  invite: string | null;
  busy: boolean;
  onEnable: () => void;
  onCreate: (label: string) => void;
  onJoin: (invite: string, label: string) => void;
  onRefresh: () => void;
  onLeave: () => void;
  onRecommend: () => void;
  onAddGuest: (label: string, profile: Profile, conditions: Conditions) => void;
  onRemoveGuest: (id: string) => void;
}) {
  const [label, setLabel] = useState("참여자"),
    [code, setCode] = useState(""),
    [consent, setConsent] = useState(false),
    [copied, setCopied] = useState(false);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">GOOD LUNCH, TOGETHER</p>
          <h1>각자의 취향, 함께하는 점심</h1>
          <p>각자 먹을 수 있는 메뉴가 있는 식당을 찾아요.</p>
        </div>
        <Users size={32} />
      </div>
      <div className="group-layout">
        <section className="panel">
          <h2>{group ? "오늘의 점심 모임" : "함께 먹을 사람을 초대해요"}</h2>
          {!state.consents.groupSharing ? (
            <>
              <p className="section-intro">
                선호·예산·명시적 제한 등 추천에 필요한 최소 조건만 임시로
                공유해요. 건강 정보는 다른 참여자에게 보여주지 않아요. 초대는
                24시간 후 만료됩니다.
              </p>
              <Check
                label="그룹 공유 범위를 확인했고 동의해요"
                checked={consent}
                onChange={setConsent}
              />
              <button
                className="primary-button"
                disabled={!consent || busy}
                onClick={onEnable}
              >
                그룹 공유 켜기
              </button>
            </>
          ) : group ? (
            <>
              <div className="group-members">
                {group.members.map((m, i) => (
                  <div className="group-person" key={i}>
                    <span>{i + 1}</span>
                    <strong>{m.label}</strong>
                    <small>{m.isSelf ? "나 · 조건 공유됨" : "참여 완료"}</small>
                    {m.guestId && (
                      <button
                        className="text-button"
                        onClick={() => onRemoveGuest(m.guestId!)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="caption">{group.notice}</p>
              {group.isOwner && <GuestForm busy={busy} onAdd={onAddGuest} />}
              {invite && (
                <div className="invite-box">
                  <Field label="24시간 유효한 초대 코드">
                    <input aria-label="초대 코드" readOnly value={invite} />
                  </Field>
                  <button
                    className="outline-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(invite);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }}
                  >
                    <Copy size={16} />
                    {copied ? "복사했어요" : "코드 복사"}
                  </button>
                  <p className="caption">
                    초대한 사람이 다른 브라우저 세션에서 자신의 조건을 직접
                    입력할 수 있어요.
                  </p>
                </div>
              )}
              <p className="caption">
                만료: {new Date(group.expiresAt).toLocaleString("ko-KR")}
              </p>
              <div className="button-row section-intro">
                <button
                  className="outline-button"
                  disabled={busy}
                  onClick={onRefresh}
                >
                  <RefreshCw size={16} />
                  참여 확인
                </button>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={onRecommend}
                >
                  함께 점심 추천받기
                </button>
              </div>
              <button className="text-button" onClick={onLeave}>
                <LogOut size={15} />
                {group.isOwner ? "그룹 해산하기" : "그룹 나가기"}
              </button>
            </>
          ) : (
            <>
              <Field label="임시 표시 이름">
                <input
                  aria-label="임시 표시 이름"
                  maxLength={20}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="실명 대신 별명을 써 주세요"
                />
              </Field>
              <p className="caption">
                현재 프로필의 제한·취향과 평소 예산을 공유해요. 나의 설정에서
                먼저 확인할 수 있어요.
              </p>
              <button
                className="primary-button full section-intro"
                disabled={busy || !label.trim()}
                onClick={() => onCreate(label)}
              >
                <Plus size={17} />
                임시 그룹 만들기
              </button>
              <div className="section-divider" />
              <Field label="받은 초대 코드">
                <input
                  aria-label="받은 초대 코드"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="초대 코드를 붙여 넣으세요"
                />
              </Field>
              <button
                className="outline-button full"
                disabled={busy || !label.trim() || !code.trim()}
                onClick={() => onJoin(code.trim(), label)}
              >
                이 조건으로 참여
              </button>
            </>
          )}
        </section>
        <aside className="panel">
          <span className="eyebrow">EVERYONE GETS A CHOICE</span>
          <h2>
            같은 식당,
            <br />
            다른 메뉴도 괜찮아요.
          </h2>
          <ul className="principles">
            <li>한 사람의 안전·예산을 평균으로 상쇄하지 않아요.</li>
            <li>각자의 메뉴와 가격을 확인해요.</li>
            <li>강한 비선호를 별도로 보호해요.</li>
            <li>그룹을 나가면 공유 조건과 접근권한을 정리해요.</li>
          </ul>
          <p className="caption">
            비회원 초대가 동작합니다. 계정 기반 초대·기기 간 동기화는 계정
            연결이 필요해요. 아동의 실제 정보와 암호화되지 않은 그룹 건강정보는
            받지 않아요.
          </p>
        </aside>
      </div>
    </>
  );
}
