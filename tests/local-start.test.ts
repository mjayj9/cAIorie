import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { localStartArgs } from "../scripts/start-local.mjs";

test("built Worker always reads the project env with an absolute path", () => {
  const root = path.resolve("example workspace");
  const args = localStartArgs(root, ["--port", "5174"]);
  for (const flag of ["--config", "--env-file", "--persist-to"]) {
    assert.equal(path.isAbsolute(args[args.indexOf(flag) + 1]), true);
  }
  assert.equal(args[args.indexOf("--env-file") + 1], path.join(root, ".env"));
  assert.equal(
    args[args.indexOf("--config") + 1],
    path.join(root, "dist", "server", "wrangler.json"),
  );
  assert.equal(args[args.indexOf("--ip") + 1], "127.0.0.1");
  assert.ok(args.includes("--local"));
  assert.deepEqual(args.slice(-2), ["--port", "5174"]);
});
