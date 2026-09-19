import test from "node:test";
import assert from "node:assert/strict";
import {
  providers,
  readConfiguration,
  inspectProvider,
} from "../scripts/api-key-check.mjs";

const provider = (id: string) => providers.find((p) => p.id === id)!;
test("key diagnostics skip missing values and flag duplicate or encoded keys without requests", async () => {
  const neverFetch = async () => {
    throw new Error("Unexpected network request");
  };
  for (const value of [
    "",
    "sk-000000",
    "YOUR_PUBLIC_DATA_KEY",
    "여기에_입력",
  ]) {
    const c = readConfiguration("AI_API_KEY=" + value);
    assert.equal(
      (
        await inspectProvider(provider("ai"), c, {
          live: true,
          fetchImpl: neverFetch,
        })
      ).status,
      "missing",
    );
  }
  const duplicate = readConfiguration("AI_API_KEY=first\nAI_API_KEY=second");
  assert.equal(
    (await inspectProvider(provider("ai"), duplicate)).status,
    "duplicate",
  );
  const encoded = readConfiguration("NUTRITION_API_KEY=encoded%2Bkey");
  assert.equal(
    (
      await inspectProvider(provider("nutrition"), encoded, {
        live: true,
        fetchImpl: neverFetch,
      })
    ).status,
    "encoding_error",
  );
});
test("public API diagnostics use the published endpoint and encode a decoding key exactly once", async () => {
  const secret = "test+key/with=padding";
  const c = readConfiguration("NUTRITION_API_KEY=" + secret);
  const result = await inspectProvider(provider("nutrition"), c, {
    live: true,
    fetchImpl: async (input: URL, init: RequestInit) => {
      assert.equal(input.origin, "https://apis.data.go.kr");
      assert.equal(
        input.pathname,
        "/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03",
      );
      assert.equal(input.searchParams.get("serviceKey"), secret);
      assert.equal(input.searchParams.get("numOfRows"), "1");
      assert.equal(init.redirect, "manual");
      return Response.json({
        header: { resultCode: "00" },
        body: { items: [{ FOOD_CD: "fixture" }] },
      });
    },
  });
  assert.equal(result.status, "authenticated");
  assert.equal(JSON.stringify(result).includes(secret), false);
});
test("HTTP 200 provider errors and exceptions never expose secrets or report success", async () => {
  const secret = "test-private-secret";
  const c = readConfiguration("PUBLIC_DATA_API_KEY=" + secret);
  for (const response of [
    Response.json({
      response: { header: { resultCode: "30", resultMsg: secret } },
    }),
    new Response("<returnReasonCode>30</returnReasonCode>" + secret),
  ]) {
    const result = await inspectProvider(provider("registry"), c, {
      live: true,
      fetchImpl: async () => response,
    });
    assert.notEqual(result.status, "authenticated");
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
  const failed = await inspectProvider(provider("registry"), c, {
    live: true,
    fetchImpl: async () => {
      throw new Error("request serviceKey=" + secret);
    },
  });
  assert.equal(failed.status, "network_error");
  assert.equal(JSON.stringify(failed).includes(secret), false);
});
test("OpenAI diagnostics reject custom destinations and redirects, and only query the model list", async () => {
  let calls = 0;
  const c = readConfiguration(
    "AI_PROVIDER=openai\nAI_API_KEY=test-secret\nAI_BASE_URL=https://example.invalid",
  );
  const fetchImpl = async (input: URL, init: RequestInit) => {
    calls++;
    assert.equal(input.href, "https://api.openai.com/v1/models");
    assert.equal(init.method, "GET");
    assert.equal(init.body, undefined);
    assert.equal(init.redirect, "manual");
    return new Response(null, {
      status: 302,
      headers: { Location: "https://example.invalid" },
    });
  };
  assert.equal(
    (await inspectProvider(provider("ai"), c, { live: true, fetchImpl }))
      .status,
    "configuration_error",
  );
  assert.equal(calls, 0);
  c.values.AI_BASE_URL = "https://api.openai.com/v1";
  const result = await inspectProvider(provider("ai"), c, {
    live: true,
    fetchImpl,
  });
  assert.equal(result.status, "http_error");
  assert.equal(calls, 1);
  assert.equal(JSON.stringify(result).includes("test-secret"), false);
});

test("OpenRouter diagnostics use current-key authentication without exposing key metadata", async () => {
  const c = readConfiguration(
    "AI_PROVIDER=openrouter\nAI_API_KEY=sk-or-example\nAI_BASE_URL=https://openrouter.ai/api/v1",
  );
  const result = await inspectProvider(provider("ai"), c, {
    live: true,
    fetchImpl: async (url: URL, init: RequestInit) => {
      assert.equal(url.href, "https://openrouter.ai/api/v1/key");
      assert.equal(init.method, "GET");
      return Response.json({
        data: { is_free_tier: true, label: "private-key-label", usage: 123 },
      });
    },
  });
  assert.equal(result.status, "authenticated");
  assert.equal(JSON.stringify(result).includes("private-key-label"), false);
  c.values.AI_PROVIDER = "openai";
  c.values.AI_BASE_URL = "https://api.openai.com/v1";
  assert.equal(
    (
      await inspectProvider(provider("ai"), c, {
        live: true,
        fetchImpl: async () => {
          throw new Error("must not send");
        },
      })
    ).status,
    "configuration_error",
  );
});
