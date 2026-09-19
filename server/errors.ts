export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
export function requireValue<T>(
  value: T | null | undefined,
  message = "요청한 항목을 찾을 수 없거나 접근 권한이 없어요.",
): T {
  if (value === null || value === undefined)
    throw new AppError(404, "NOT_FOUND", message);
  return value;
}
