import test from "node:test";
import assert from "node:assert/strict";
import { readWorkspace, workspaceStorageKey, writeWorkspace } from "./workspace-storage.js";

function createStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("workspace drafts are isolated by authenticated user", () => {
  const storage = createStorage();
  writeWorkspace("user-a", { botUsername: "first_bot" }, storage);
  writeWorkspace("user-b", { botUsername: "second_bot" }, storage);
  assert.notEqual(workspaceStorageKey("user-a"), workspaceStorageKey("user-b"));
  assert.deepEqual(readWorkspace("user-a", storage), { botUsername: "first_bot" });
  assert.deepEqual(readWorkspace("user-b", storage), { botUsername: "second_bot" });
  assert.equal(readWorkspace(null, storage), null);
});
