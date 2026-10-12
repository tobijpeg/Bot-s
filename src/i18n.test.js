import test from "node:test";
import assert from "node:assert/strict";
import { translate } from "./i18n.js";

test("interface text is translated into Kazakh and English with Russian fallback", () => {
  const source = "Настройки платформы";
  assert.equal(translate("ru", source), source);
  assert.equal(translate("en", source), "Platform settings");
  assert.equal(translate("kk", source), "Платформа баптаулары");
  assert.equal(translate("en", "unmapped text"), "unmapped text");
});

test("key creation and inbox controls are present in all supported languages", () => {
  for (const language of ["en", "kk"]) {
    assert.notEqual(translate(language, "Входящие обращения"), "Входящие обращения");
    assert.notEqual(translate(language, "Профиль бота в Telegram"), "Профиль бота в Telegram");
    assert.notEqual(translate(language, "Сохранить и запустить бота"), "Сохранить и запустить бота");
  }
});
