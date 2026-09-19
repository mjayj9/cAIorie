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
