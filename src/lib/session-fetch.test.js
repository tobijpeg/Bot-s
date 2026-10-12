import test from "node:test";
import assert from "node:assert/strict";
import { fetchWithSessionRefresh } from "./session-fetch.js";

test("refreshes an expired Supabase session and retries the original API request once", async () => {
  const calls = [];
  let refreshCount = 0;
  const fakeFetch = async (input, options) => {
    calls.push({ input, options });
    return calls.length === 1
      ? new Response("expired", { status: 401 })
      : new Response("ok", { status: 200 });
  };

  const response = await fetchWithSessionRefresh(
    fakeFetch,
    async () => { refreshCount += 1; return { data: { session: { access_token: "new-token" } }, error: null }; },
    "/api/ai/workflow",
    { method: "POST", headers: { Authorization: "Bearer expired-token", "Content-Type": "application/json" }, body: "{\"question\":\"build\"}" },
  );

  assert.equal(response.status, 200);
  assert.equal(refreshCount, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers.get("Authorization"), "Bearer new-token");
  assert.equal(calls[1].options.headers.get("Content-Type"), "application/json");
  assert.equal(calls[1].options.body, "{\"question\":\"build\"}");
});

test("does not refresh successful or unauthenticated requests", async () => {
  let refreshCount = 0;
  let callCount = 0;
  const fakeFetch = async () => { callCount += 1; return new Response("ok", { status: 200 }); };
  const refresh = async () => { refreshCount += 1; return { data: { session: { access_token: "new-token" } }, error: null }; };

  await fetchWithSessionRefresh(fakeFetch, refresh, "/api/health");
  await fetchWithSessionRefresh(fakeFetch, refresh, "/api/health", { headers: { Authorization: "Bearer token" } });

  assert.equal(callCount, 2);
  assert.equal(refreshCount, 0);
});

test("returns the original unauthorized response when session refresh fails", async () => {
  let callCount = 0;
  const response = await fetchWithSessionRefresh(
    async () => { callCount += 1; return new Response("unauthorized", { status: 401 }); },
    async () => ({ data: { session: null }, error: new Error("refresh failed") }),
    "/api/ai/workflow",
    { headers: { Authorization: "Bearer expired-token" } },
  );

  assert.equal(response.status, 401);
  assert.equal(callCount, 1);
});
