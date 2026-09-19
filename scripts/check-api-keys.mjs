import { readFileSync } from "node:fs";
import {
  providers,
  readConfiguration,
  inspectProvider,
} from "./api-key-check.mjs";
const args = process.argv.slice(2);
const live = args.includes("--live");
const only = args.find((arg) => arg.startsWith("--only="))?.slice(7);
if (
  args.some((arg) => arg !== "--live" && !arg.startsWith("--only=")) ||
  (only && !providers.some((provider) => provider.id === only))
) {
  console.error(
    "사용법: node scripts/check-api-keys.mjs [--live] [--only=ai|nutrition|registry|google|kakao]",
  );
  process.exitCode = 1;
} else {
  try {
    const configuration = readConfiguration(readFileSync(".env", "utf8"));
    const selected = providers.filter(
      (provider) => !only || provider.id === only,
    );
    let failed = false;
    console.log(
      live
        ? "인증 검사: 제공자별 최대 1회, 개인 기록 전송 없음"
        : "설정 검사: 외부 요청 없음",
    );
    for (const provider of selected) {
      const result = await inspectProvider(provider, configuration, { live });
      console.log(JSON.stringify(result));
      if (!["missing", "configured", "authenticated"].includes(result.status))
        failed = true;
    }
    if (failed) process.exitCode = 1;
  } catch {
    console.error(
      ".env 설정 파일을 읽거나 검사할 수 없습니다. 키 값은 출력하지 않았습니다.",
    );
    process.exitCode = 1;
  }
}
