import test from "node:test";
import assert from "node:assert/strict";
import { requestOrigin } from "../server/request-origin.ts";
test("Next internal localhost does not replace the browser request host", () => {
  const request = new Request("http://localhost:5175/api/settings", {
    headers: { host: "127.0.0.1:5175" },
  });
  assert.equal(requestOrigin(request), "http://127.0.0.1:5175");
});
test("Vercel HTTPS origin uses the incoming project domain", () => {
  const request = new Request("http://localhost:3000/api/settings", {
    headers: { host: "example.vercel.app" },
  });
  assert.equal(requestOrigin(request, true), "https://example.vercel.app");
});
test("Forwarded host and scheme headers cannot override the browser host", () => {
  const request = new Request("http://localhost:5175/api/settings", {
    headers: {
      host: "127.0.0.1:5175",
      "x-forwarded-host": "attacker.example",
      "x-forwarded-proto": "https",
    },
  });
  assert.equal(requestOrigin(request), "http://127.0.0.1:5175");
});
test("Malformed host authorities are rejected", () => {
  const request = new Request("http://localhost/api/settings", {
    headers: { host: "user@attacker.example" },
  });
  assert.throws(() => requestOrigin(request));
});
