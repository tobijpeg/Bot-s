import test from "node:test";
import assert from "node:assert/strict";
import { builderReply, summarizeWorkflowChange } from "./ai-safety.js";

test("builder responses stay short and understandable to business owners", () => {
  assert.equal(builderReply("Добавил шаг записи. Проверьте текст.", "fallback"), "Добавил шаг записи. Проверьте текст.");
  assert.equal(builderReply("Use API node id=3", "Готово, сценарий обновлён."), "Готово, сценарий обновлён.");
  assert.equal(builderReply('{"answer":"hello"}', "Готово."), "Готово.");
  assert.equal(builderReply("x".repeat(501), "Готово."), "Готово.");
});

test("workflow change summary is deterministic and never includes model reasoning", () => {
  assert.equal(summarizeWorkflowChange({ added: 2, updated: 1 }), "Готово: добавил 2 новых шага, обновил 1 шаг. Проверьте текст шагов и сохраните сценарий.");
  assert.equal(summarizeWorkflowChange(), "Сценарий оставил без изменений.");
});
