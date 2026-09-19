"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Location } from "@/domain/models";
import { Choice, Field } from "./controls";
type SearchLocation = { name: string; latitude: number; longitude: number };
export function LocationDialog({
  value,
  onSave,
  onClose,
  onSearch,
}: {
  value: Location | null;
  onSave: (value: Location) => void;
  onClose: () => void;
  onSearch: (query: string) => Promise<SearchLocation[]>;
}) {
  const [query, setQuery] = useState(""),
    [items, setItems] = useState<SearchLocation[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [country, setCountry] = useState(value?.country ?? "KR"),
    [lat, setLat] = useState(
      value?.origin === "demo" ? "" : String(value?.latitude ?? ""),
    ),
    [lng, setLng] = useState(
      value?.origin === "demo" ? "" : String(value?.longitude ?? ""),
    );
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const find = async () => {
    if (!query.trim() || busy) return;
    const id = ++generation.current;
    setBusy(true);
    setError("");
    setItems([]);
    try {
      const found = await onSearch(query.trim());
      if (generation.current !== id) return;
      setItems(found);
      if (!found.length)
        setError(
          "검색 결과가 없어요. 가까운 역·건물 이름이나 도로명 주소로 다시 검색해 주세요.",
        );
    } catch (e) {
      if (generation.current === id) setError((e as Error).message);
    } finally {
      if (generation.current === id) setBusy(false);
    }
  };
  const locate = () => {
    const id = ++generation.current;
    setBusy(true);
    setError("");
    if (!navigator.geolocation) {
      setError(
        "위치 기능을 지원하지 않아요. 아래에서 역·주소를 검색해 주세요.",
      );
      setBusy(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (generation.current !== id) return;
        setBusy(false);
        const inKorea =
          pos.coords.latitude >= 33 &&
          pos.coords.latitude <= 39 &&
          pos.coords.longitude >= 124 &&
          pos.coords.longitude <= 132;
        if (!inKorea && country === "KR") {
          setError(
            "대한민국 밖의 위치예요. 아래 직접 입력에서 국가를 선택해 주세요.",
          );
          return;
        }
        onSave({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
          capturedAt: new Date().toISOString(),
          origin: "device",
          country: inKorea ? "KR" : country,
          label: "현재 위치",
        });
      },
      () => {
        if (generation.current !== id) return;
        setBusy(false);
        setError(
          "위치를 사용하지 못했어요. 역·건물·주소를 검색하거나 좌표를 직접 입력해 주세요.",
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  };
  const valid =
    lat !== "" &&
    lng !== "" &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flow-dialog location-dialog">
        <DialogHeader>
          <DialogTitle>점심을 먹을 위치</DialogTitle>
          <DialogDescription>
            현재 위치를 사용하거나 역·건물·주소를 검색하세요. 선택한 위치는 이번
            화면에서만 사용해요.
          </DialogDescription>
        </DialogHeader>
        <button className="primary-button" disabled={busy} onClick={locate}>
          <Navigation size={17} />
          현재 위치 사용
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void find();
          }}
        >
          <Field
            label="역·건물·주소 검색"
            hint="예: 서울역, 강남역, 서울 중구 세종대로 110 · 국내 검색"
          >
            <div className="button-row">
              <input
                aria-label="지역·주소 검색"
                value={query}
                maxLength={100}
                placeholder="가까운 역이나 건물 이름"
                disabled={busy}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setItems([]);
                  setError("");
                }}
              />
              <button
                className="outline-button"
                type="submit"
                disabled={!query.trim() || busy}
              >
                <Search size={16} />
                {busy ? "확인 중…" : "검색"}
              </button>
            </div>
          </Field>
        </form>
        <div className="location-search-results">
          {items.map((item, i) => (
            <button
              className="search-item"
              key={item.name + i}
              disabled={busy}
              onClick={() =>
                onSave({
                  latitude: item.latitude,
                  longitude: item.longitude,
                  country: "KR",
                  capturedAt: new Date().toISOString(),
                  origin: "user_selected",
                  accuracyMeters: null,
                  label: item.name,
                })
              }
            >
              <MapPin size={16} />
              <span>
                {item.name}
                <small>여기에서 식당 찾기</small>
              </span>
            </button>
          ))}
        </div>
        {error && (
          <p className="warning" role="alert">
            {error}
          </p>
        )}
        <details className="manual-location">
          <summary>국가·좌표 직접 입력</summary>
          <Choice
            label="음식점을 찾을 국가"
            value={country}
            onChange={setCountry}
            options={[
              { value: "KR", label: "대한민국" },
              { value: "JP", label: "일본" },
              { value: "US", label: "미국" },
              { value: "GB", label: "영국" },
            ]}
          />
          <div className="form-grid">
            <Field label="위도">
              <input
                aria-label="위도"
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </Field>
            <Field label="경도">
              <input
                aria-label="경도"
                type="number"
                step="any"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </Field>
          </div>
          <button
            className="outline-button"
            disabled={!valid || busy}
            onClick={() =>
              onSave({
                latitude: Number(lat),
                longitude: Number(lng),
                country,
                accuracyMeters: null,
                capturedAt: new Date().toISOString(),
                origin: "user_selected",
                label: "직접 선택한 위치",
              })
            }
          >
            직접 선택한 위치 적용
          </button>
        </details>
      </DialogContent>
    </Dialog>
  );
}
