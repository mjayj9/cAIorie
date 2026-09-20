/** Distances are always stored as metres; presentation never changes their meaning. */
export function formatDistance(metres: number): string {
  return metres >= 1000
    ? new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(
        metres / 1000,
      ) + "km"
    : new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(
        metres,
      ) + "m";
}
export function straightLineMetres(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((to.latitude - from.latitude) * rad) / 2) ** 2 +
    Math.cos(from.latitude * rad) *
      Math.cos(to.latitude * rad) *
      Math.sin(((to.longitude - from.longitude) * rad) / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function formatDistanceRange(minimum: number, maximum: number | null) {
  if (maximum === null)
    return minimum > 0 ? formatDistance(minimum) + " 이상" : "제한 없음";
  return formatDistance(minimum) + " ~ " + formatDistance(maximum);
}

/** Four non-overlapping search rectangles cover the band outside an inner square.
 * Final filtering uses the provider's distance from the original origin. */
export function distanceSearchRects(
  origin: { latitude: number; longitude: number },
  minimum: number,
  maximum: number,
): string[] {
  const metresPerDegree = (Math.PI * 6371000) / 180;
  const cos = Math.cos((origin.latitude * Math.PI) / 180);
  const outerY = (maximum * 1.01) / metresPerDegree;
  const outerX = outerY / cos;
  const innerY = (minimum * 0.65) / metresPerDegree;
  const innerX = innerY / cos;
  const x = origin.longitude,
    y = origin.latitude;
  return [
    [x - outerX, y - outerY, x + outerX, y - innerY],
    [x - outerX, y + innerY, x + outerX, y + outerY],
    [x - outerX, y - innerY, x - innerX, y + innerY],
    [x + innerX, y - innerY, x + outerX, y + innerY],
  ].map((rect) => rect.map((n) => n.toFixed(7)).join(","));
}
