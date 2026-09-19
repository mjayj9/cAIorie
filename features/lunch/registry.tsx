"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Place } from "@/domain/models";
import type { RegistryLookup } from "@/domain/foods";

export function NearbyPlaceRow({
  place,
  onLookup,
}: {
  place: Place;
  onLookup: (place: Place) => Promise<RegistryLookup>;
}) {
  const [result, setResult] = useState<RegistryLookup | null>(null);
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="nearby-row">
      <div className="nearby-copy">
        <strong>{place.name}</strong>
        <p>{place.address}</p>
        {place.providerId === "kakao" && (
          <button
            className="text-button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                setResult(await onLookup(place));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "행정정보 확인 중…" : "행정정보 확인"}
          </button>
        )}
        {result && (
          <div className="registry-result" role="status">
            <strong>행정상 상태: {result.label}</strong>
            <p>{result.notice}</p>
            <small>
              조회 {result.checkedAt.slice(0, 10)}
              {result.updatedAt
                ? " · 원자료 수정 " + result.updatedAt.slice(0, 10)
                : ""}
            </small>
            <a
              href={result.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              행정안전부 출처 ↗
            </a>
          </div>
        )}
        {error && (
          <p role="alert" className="warning">
            {error}
          </p>
        )}
      </div>
      {place.url && (
        <a
          className="outline-button"
          href={place.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {place.providerId === "google" ? "Google Maps" : "Kakao"}
          <ArrowUpRight size={15} />
        </a>
      )}
    </div>
  );
}
