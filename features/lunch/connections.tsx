import { Plug, ExternalLink, Info } from "lucide-react";
import type { Capability } from "@/domain/models";
export function ConnectionsView({
  capabilities,
}: {
  capabilities: Capability[];
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">HONEST BY DESIGN</p>
          <h1>무엇이 연결되어 있나요?</h1>
          <p>작동하는 기능과 외부 설정이 필요한 기능을 구분해요.</p>
        </div>
        <Plug size={32} />
      </div>
      <div className="notice-box">
        <Info size={21} />
        <p>
          데모와 실제 자료는 한 추천 결과에 섞지 않아요. 키가 없다고 실제
          메뉴·가격·영양값을 만들어내지 않습니다.
        </p>
      </div>
      <div className="connection-grid">
        {capabilities.map((c) => (
          <section className="panel" key={c.id}>
            <div className="section-heading">
              <h2>{c.name}</h2>
              <span
                className={"pill " + (c.mode === "disabled" ? "neutral" : "")}
              >
                {c.mode === "demo"
                  ? "데모"
                  : c.configured
                    ? "키 설정됨"
                    : "설정 필요"}
              </span>
            </div>
            <p>{c.detail}</p>
            {c.lastContractVerifiedAt && (
              <small>
                공식 문서 확인: {c.lastContractVerifiedAt} · 인증 API 응답
                검증과 구분
              </small>
            )}
          </section>
        ))}
      </div>
      <section className="panel section-space">
        <h2>정보를 확인하는 기준</h2>
        <div className="source-links">
          <a
            href="https://www.data.go.kr/data/15154916/openapi.do"
            target="_blank"
            rel="noopener noreferrer"
          >
            행정안전부 일반음식점 데이터
            <ExternalLink size={15} />
          </a>
          <a
            href="https://various.foodsafetykorea.go.kr/nutrient/general/down/info.do"
            target="_blank"
            rel="noopener noreferrer"
          >
            식약처 K-FIND
            <ExternalLink size={15} />
          </a>
          <a
            href="https://developers.kakao.com/docs/ko/local/dev-guide"
            target="_blank"
            rel="noopener noreferrer"
          >
            Kakao Local 공식 문서
            <ExternalLink size={15} />
          </a>
        </div>
        <p className="caption">
          SDG 3의 건강한 생활과 SDG 12의 정보에 근거한 소비를 지향합니다. 이
          앱으로 건강 개선·탄소 감축·음식물 낭비 감소를 측정했다고 주장하지
          않아요.
        </p>
      </section>
    </>
  );
}
