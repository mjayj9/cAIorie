import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const projectRoot = fileURLToPath(new URL("../", import.meta.url));
export function localStartArgs(root = projectRoot, extra = []) {
  return [
    "dev",
    "--config",
    path.resolve(root, "dist/server/wrangler.json"),
    // Wrangler resolves relative env files against the config directory.
    "--env-file",
    path.resolve(root, ".env"),
    "--local",
    "--persist-to",
    path.resolve(root, ".wrangler/state"),
    "--ip",
    "127.0.0.1",
    "--inspector-port",
    "0",
    ...extra,
  ];
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const extra = process.argv.slice(2);
  await import("./sites-env.mjs");
  const cli = new URL(
    "../node_modules/wrangler/bin/wrangler.js",
    import.meta.url,
  );
  const child = spawn(
    process.execPath,
    [fileURLToPath(cli), ...localStartArgs(projectRoot, extra)],
    {
      cwd: projectRoot,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  child.on("error", () => {
    console.error("로컬 서버를 시작하지 못했습니다.");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 0;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
}
