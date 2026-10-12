import test from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { applyTelegramProfile, normalizeTelegramProfile, TELEGRAM_PROFILE_PHOTO_LIMIT } from "./telegram-profile.js";

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);

test("validates and normalizes Telegram profile copy and one-time JPEG photo payload", () => {
  const result = normalizeTelegramProfile({
    name: "  Coffee House  ", description: "  Напишите нам  ", shortDescription: "   Бронь и меню   ",
    profilePhoto: { mimeType: "image/jpeg", dataBase64: jpeg.toString("base64") },
  });
  assert.equal(result.name, "Coffee House");
  assert.equal(result.description, "Напишите нам");
  assert.equal(result.shortDescription, "Бронь и меню");
  assert.deepEqual(result.photo, jpeg);
});

test("accepts omitted photo and rejects oversized or invalid Telegram profile fields", () => {
  assert.equal(normalizeTelegramProfile({ name: "Магазин" }).photo, null);
  assert.throws(() => normalizeTelegramProfile({ name: "x".repeat(65) }), /64 символов/);
  assert.throws(() => normalizeTelegramProfile({ description: "x".repeat(513) }), /512 символов/);
  assert.throws(() => normalizeTelegramProfile({ shortDescription: "x".repeat(121) }), /120 символов/);
  assert.throws(() => normalizeTelegramProfile({ profilePhoto: { mimeType: "image/png", dataBase64: jpeg.toString("base64") } }), /JPG/);
  assert.throws(() => normalizeTelegramProfile({ profilePhoto: { mimeType: "image/jpeg", dataBase64: Buffer.alloc(TELEGRAM_PROFILE_PHOTO_LIMIT + 1, 1).toString("base64") } }), /500 КБ/);
  assert.throws(() => normalizeTelegramProfile({ profilePhoto: { mimeType: "image/jpeg", dataBase64: Buffer.from("not a jpeg").toString("base64") } }), /500 КБ/);
});

test("applies only provided Telegram profile fields and uploads photo as a fresh InputFile", async () => {
  const calls = [];
  class FakeInputFile { constructor(data, filename) { this.data = data; this.filename = filename; } }
  const api = {
    async setMyName(data) { calls.push(["name", data]); },
    async setMyDescription(data) { calls.push(["description", data]); },
    async setMyShortDescription(data) { calls.push(["shortDescription", data]); },
    async setMyProfilePhoto(data) { calls.push(["photo", data]); },
  };
  await applyTelegramProfile(api, normalizeTelegramProfile({ name: "Cafe", shortDescription: "Меню", profilePhoto: { mimeType: "image/jpeg", dataBase64: jpeg.toString("base64") } }), FakeInputFile);
  assert.deepEqual(calls.map(([method]) => method), ["name", "shortDescription", "photo"]);
  assert.deepEqual(calls[1][1], { short_description: "Меню" });
  assert.equal(calls[2][1].photo.filename, "bot-profile.jpg");
  assert.deepEqual(calls[2][1].photo.data, jpeg);
});

test("does not turn Telegram profile API failures into silent success", async () => {
  await assert.rejects(() => applyTelegramProfile({ setMyName: async () => { throw new Error("Telegram rejected profile update"); } }, { name: "Cafe", description: "", shortDescription: "", photo: null }), /Telegram rejected profile update/);
});
