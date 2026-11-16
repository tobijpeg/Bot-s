import test from "node:test";
import assert from "node:assert/strict";
import { buildCatalogWidgetHtml, catalogWidgetKey, catalogWidgetKeyFromOrder, catalogWidgetState, parseCatalogWidgetOrder, parseWidgetOptionGroups } from "./telegram-widget.js";

const items = [
  { name: "Американо", category: "Кофе", emoji: "☕", description: "Двойной эспрессо и горячая вода", price: 1200 },
  { name: "Матча", category: "Чай", emoji: "🍵", description: "Нежный зелёный чай", price: 1600 },
];
const widget = { enabled: true, title: "Кофейня Зерно", subtitle: "Выберите напиток", accent: "ocean", optionsText: "Размер: S 250 мл (+0 ₸), M 350 мл (+200 ₸), L 450 мл (+400 ₸)\nМолоко: Обычное (+0 ₸), Овсяное (+50 ₸)" };

test("parses custom option groups and price adjustments", () => {
  assert.deepEqual(parseWidgetOptionGroups(widget.optionsText), [
    { title: "Размер", choices: [{ name: "S 250 мл", price: 0 }, { name: "M 350 мл", price: 200 }, { name: "L 450 мл", price: 400 }] },
    { title: "Молоко", choices: [{ name: "Обычное", price: 0 }, { name: "Овсяное", price: 50 }] },
  ]);
});

test("creates a self-contained Telegram HTML widget with safe text and request actions", () => {
  const html = buildCatalogWidgetHtml([{ ...items[0], name: "<script>alert(1)</script>" }], widget);
  assert.match(html, /W\.request\(data\)/);
  assert.match(html, /chatDataChanged/);
  assert.match(html, /\\u003cscript>/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.throws(() => buildCatalogWidgetHtml([], widget), /хотя бы одну позицию/);
});

test("validates submitted item and option indexes and calculates price server-side", () => {
  const key = catalogWidgetKey("catalog-one", items, widget);
  const data = `order:${key}:0:2:11`;
  const order = parseCatalogWidgetOrder(data, items, widget, "catalog-one");
  assert.equal(order.product.name, "Американо");
  assert.equal(order.quantity, 2);
  assert.equal(order.total, 2900);
  assert.match(order.summary, /Американо × 2/);
  assert.equal(parseCatalogWidgetOrder(`order:${key}:9:2:11`, items, widget, "catalog-one"), null);
  assert.equal(parseCatalogWidgetOrder(`order:${key}:0:999:11`, items, widget, "catalog-one"), null);
  assert.equal(parseCatalogWidgetOrder(`order:${key}:0:2:19`, items, widget, "catalog-one"), null);
  assert.equal(parseCatalogWidgetOrder(data, items, widget, "catalog-two"), null, "widget actions stay bound to their catalog block");
  assert.equal(parseCatalogWidgetOrder(data, [{ ...items[0], price: 1 }], widget, "catalog-one"), null, "old widgets cannot charge against a changed catalog");
  assert.equal(catalogWidgetKeyFromOrder(data), key);
});

test("supports no options and exposes server-updated submitted state", () => {
  const noOptions = { optionsText: "" };
  const key = catalogWidgetKey("catalog", items, noOptions);
  const order = parseCatalogWidgetOrder(`order:${key}:1:3:`, items, noOptions);
  assert.equal(order.total, 4800);
  assert.deepEqual(JSON.parse(catalogWidgetState("Заказ передан")), { submitted: true, text: "Заказ передан" });
});
