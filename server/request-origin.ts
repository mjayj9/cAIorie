import { AppError } from "./errors.ts";
export function requestOrigin(request: Request, vercel = false) {
  const internal = new URL(request.url);
  const host = request.headers.get("host") ?? internal.host;
  try {
    const external = new URL(
      (vercel ? "https:" : internal.protocol) + "//" + host,
    );
    if (
      external.username ||
      external.password ||
      external.pathname !== "/" ||
      external.search ||
      external.hash
    )
      throw new Error("Invalid authority");
    return external.origin;
  } catch {
    throw new AppError(400, "HOST", "요청 주소를 확인해 주세요.");
  }
}
