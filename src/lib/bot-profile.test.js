import test from "node:test";
import assert from "node:assert/strict";
import { readBotProfile, writeBotProfile, clearBotProfilePhoto } from "./bot-profile.js";

test("Telegram profile drafts are isolated by account and bot and photo can be cleared", () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  try {
    const profile = { name: "Cafe", description: "Coffee", shortDescription: "Daily coffee", profilePhoto: { mimeType: "image/jpeg", dataBase64: "abc" } };
    assert.equal(writeBotProfile("user-a", "bot-1", profile), true);
    assert.deepEqual(readBotProfile("user-a", "bot-1"), profile);
    assert.deepEqual(readBotProfile("user-b", "bot-1"), {});
    assert.deepEqual(readBotProfile("user-a", "bot-2"), {});
    assert.equal(clearBotProfilePhoto("user-a", "bot-1"), true);
    assert.deepEqual(readBotProfile("user-a", "bot-1"), { name: "Cafe", description: "Coffee", shortDescription: "Daily coffee" });
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
