const INTERNAL_BUILDER_LANGUAGE = /```|\b(api|json|backend|frontend|endpoint|database|developer|prompt|llm|token|node|nodes|kind|id)\b|разработчик|разработка|программирован|массив|функция\s*\(/i;

/** Keep model text aimed at a non-technical business owner. Never expose raw planning/code. */
export function builderReply(value, fallback, maxLength = 500) {
  const text = Array.from(String(value || "")).filter((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127 || character === "\n" || character === "\t"; }).join("").replace(/\s+/g, " ").trim();
  if (!text || text.length > maxLength || INTERNAL_BUILDER_LANGUAGE.test(text) || /^[{[]/.test(text)) return fallback;
  return text;
}

export function summarizeWorkflowChange({ added = 0, updated = 0, removed = 0 } = {}) {
  const changes = [];
  if (added) changes.push(`добавил${added === 1 ? "" : ""} ${added} ${added === 1 ? "новый шаг" : "новых шага"}`);
  if (updated) changes.push(`обновил ${updated} ${updated === 1 ? "шаг" : "шага"}`);
  if (removed) changes.push(`убрал ${removed} ${removed === 1 ? "шаг" : "шага"}`);
  if (!changes.length) return "Сценарий оставил без изменений.";
  return `Готово: ${changes.join(", ")}. Проверьте текст шагов и сохраните сценарий.`;
}
