import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

export const WIDGET_ACCENTS = {
  ocean: { background: "#123e66", surface: "#1b527d", accent: "#f29a58", text: "#ffffff", muted: "#c7dceb" },
  violet: { background: "#392b62", surface: "#4b397b", accent: "#b798ff", text: "#ffffff", muted: "#ddd4f7" },
  forest: { background: "#164e43", surface: "#206657", accent: "#e6a05d", text: "#ffffff", muted: "#cbe6de" },
  graphite: { background: "#25313d", surface: "#344454", accent: "#e99a5f", text: "#ffffff", muted: "#d4dde5" },
};

const MAX_OPTIONS = 4;
const MAX_CHOICES = 8;
const MAX_ITEMS = 50;
const MAX_HTML_BYTES = 32_768;
const MAX_COMPRESSED_BYTES = 4_096;

function clampText(value, max) { return String(value || "").trim().slice(0, max); }
function price(value) { const number = Number(value); return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0; }

export function parseWidgetOptionGroups(value) {
  return String(value || "").split(/\r?\n/u).slice(0, MAX_OPTIONS).map((line) => {
    const separator = line.indexOf(":");
    if (separator <= 0) return null;
    const title = clampText(line.slice(0, separator), 32);
    const choices = line.slice(separator + 1).split(",").slice(0, MAX_CHOICES).map((entry) => {
      const match = entry.trim().match(/^(.*?)(?:\s*\(([+-]?\d[\d\s]*)(?:\s*₸)?\))?\s*$/u);
      if (!match) return null;
      const name = clampText(match[1], 40);
      const delta = match[2] ? Number(match[2].replace(/\s/gu, "")) : 0;
      return name ? { name, price: Number.isFinite(delta) ? Math.round(delta) : 0 } : null;
    }).filter(Boolean);
    return title && choices.length ? { title, choices } : null;
  }).filter(Boolean);
}

export function catalogWidgetKey(nodeId, items, widget = {}) {
  const revision = JSON.stringify({ nodeId: String(nodeId || ""), items: safeItems(items), widget: { ...widget, options: parseWidgetOptionGroups(widget.optionsText) } });
  return createHash("sha256").update(revision).digest("hex").slice(0, 12);
}

export function catalogWidgetKeyFromOrder(data) {
  return String(data || "").match(/^order:([a-f0-9]{12}):/u)?.[1] || "";
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</gu, "\\u003c").replace(/\u2028/gu, "\\u2028").replace(/\u2029/gu, "\\u2029");
}

function safeItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, MAX_ITEMS).map((item) => ({
    name: clampText(item?.name, 80) || "Позиция меню",
    description: clampText(item?.description, 120),
    category: clampText(item?.category, 24),
    emoji: clampText(item?.emoji, 4) || "🛍️",
    price: price(item?.price),
  }));
}

export function buildCatalogWidgetHtml(items, widget = {}, nodeId = "catalog") {
  const products = safeItems(items);
  if (!products.length) throw new Error("Добавьте в каталог хотя бы одну позицию для виджета.");
  const groups = parseWidgetOptionGroups(widget.optionsText);
  const palette = WIDGET_ACCENTS[widget.accent] || WIDGET_ACCENTS.ocean;
  const title = clampText(widget.title, 60) || "Выберите напиток";
  const subtitle = clampText(widget.subtitle, 140) || "Настройте заказ и отправьте заявку кофейне";
  const categories = products.some((item) => item.category)
    ? [...new Set(products.map((item) => item.category || "Другое"))]
    : [];
  const key = catalogWidgetKey(nodeId, products, widget);
  const payload = safeJson({ products, groups, categories, title, subtitle, key });
  const html = `<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;padding:9px;font:14px system-ui,sans-serif;color:var(--tg-theme-text-color,#20252b);color-scheme:light dark}.shell{background:${palette.background};border-radius:18px;padding:12px;color:${palette.text}}.title{font-size:18px;font-weight:750;margin:2px 2px 3px}.subtitle{font-size:12px;color:${palette.muted};margin:0 2px 12px}.products,.choices{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}.chip{border:0;border-radius:12px;background:${palette.surface};color:${palette.text};font:600 12px system-ui,sans-serif;padding:9px 11px;max-width:100%}.chip.active{background:${palette.accent};color:#20252b}.card{background:${palette.surface};border-radius:15px;padding:12px;display:flex;gap:10px;align-items:center;margin-bottom:11px}.emoji{font-size:34px;min-width:42px;text-align:center}.name{font-weight:750;font-size:16px}.desc{font-size:12px;color:${palette.muted};margin-top:3px}.group{margin-top:10px}.group-title{font-size:10px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:${palette.accent};margin:0 0 6px}.qty{display:flex;align-items:center;gap:9px}.qty button{width:40px;height:40px;font-size:19px}.qty strong{min-width:18px;text-align:center}.total{font-size:14px;font-weight:750;margin-left:auto}.bar{display:flex;align-items:center;gap:8px;margin-top:12px}.submit{border:0;border-radius:13px;background:${palette.accent};color:#20252b;font:750 14px system-ui,sans-serif;min-height:44px;padding:10px 14px;flex:1}.status{min-height:18px;color:${palette.muted};font-size:11px;margin:7px 2px 0}.chip:active,.submit:active{opacity:.8}
</style><div class="shell"><div class="title" id="title"></div><div class="subtitle" id="subtitle"></div><div class="products" id="categories"></div><div class="products" id="products"></div><div class="card"><div class="emoji" id="emoji"></div><div><div class="name" id="name"></div><div class="desc" id="description"></div></div></div><div id="groups"></div><div class="bar"><div class="qty"><button id="minus" type="button">−</button><strong id="quantity">1</strong><button id="plus" type="button">+</button></div><strong class="total" id="total"></strong></div><button id="submit" class="submit" type="button">Добавить в заказ</button><div class="status" id="status"></div></div><script>
const C=${payload},W=TelegramWidget;let category=C.categories[0]||'',pi=C.categories.length?C.products.findIndex(p=>(p.category||'Другое')===category):0,qty=1,selected=C.groups.map(()=>0),busy=false;const $=id=>document.getElementById(id);function rub(n){return new Intl.NumberFormat('ru-RU').format(n)+' ₸'}function render(){const item=C.products[pi];$('title').textContent=C.title;$('subtitle').textContent=C.subtitle;$('categories').replaceChildren(...C.categories.map(name=>{const b=document.createElement('button');b.className='chip'+(name===category?' active':'');b.textContent=name;b.onclick=()=>{category=name;pi=C.products.findIndex(p=>(p.category||'Другое')===name);selected=C.groups.map(()=>0);qty=1;render()};return b}));const visible=C.categories.length?C.products.map((p,i)=>({p,i})).filter(x=>(x.p.category||'Другое')===category):C.products.map((p,i)=>({p,i}));$('products').replaceChildren(...visible.map(({p,i})=>{const b=document.createElement('button');b.className='chip'+(i===pi?' active':'');b.textContent=(p.emoji?p.emoji+' ':'')+p.name;b.onclick=()=>{pi=i;selected=C.groups.map(()=>0);qty=1;render()};return b}));$('emoji').textContent=item.emoji;$('name').textContent=item.name;$('description').textContent=item.description;$('groups').replaceChildren(...C.groups.map((g,gi)=>{const wrap=document.createElement('div');wrap.className='group';const h=document.createElement('div');h.className='group-title';h.textContent=g.title;const row=document.createElement('div');row.className='choices';g.choices.forEach((choice,ci)=>{const b=document.createElement('button');b.className='chip'+(selected[gi]===ci?' active':'');b.textContent=choice.name+(choice.price?' +'+rub(choice.price):'');b.onclick=()=>{selected[gi]=ci;render()};row.append(b)});wrap.append(h,row);return wrap}));const total=(item.price+C.groups.reduce((sum,g,gi)=>sum+(g.choices[selected[gi]]?.price||0),0))*qty;$('quantity').textContent=qty;$('total').textContent=rub(total);$('submit').disabled=busy||Boolean(chatState()?.submitted);$('submit').textContent=chatState()?.submitted?'Заказ принят':busy?'Отправляем…':'Добавить в заказ';}function chatState(){try{return W.chatData?JSON.parse(W.chatData):null}catch{return null}}function applyState(){const s=chatState();if(s?.text)$('status').textContent=s.text;if(s?.submitted){$('status').textContent='Заказ передан кофейне';render()}else if(s?.text){busy=false;render()}}$('minus').onclick=()=>{qty=Math.max(1,qty-1);render()};$('plus').onclick=()=>{qty=Math.min(20,qty+1);render()};$('submit').onclick=()=>{if(busy||chatState()?.submitted)return;busy=true;render();const packed=selected.map(n=>n.toString(36)).join('');const data='order:'+C.key+':'+pi.toString(36)+':'+qty.toString(36)+':'+packed;W.request(data).then(r=>{$('status').textContent=r.result||'Заказ отправляется…'}).catch(e=>{$('status').textContent='Не удалось отправить заказ: '+(e.code||e.message);busy=false;render()})};W.onEvent('chatDataChanged',applyState);render();applyState();
</script>`;
  const byteLength = Buffer.byteLength(html, "utf8");
  if (byteLength > MAX_HTML_BYTES || deflateSync(Buffer.from(html, "utf8"), { level: 9 }).byteLength > MAX_COMPRESSED_BYTES) {
    throw new Error("Настройки виджета превышают лимит Telegram. Сократите текст или список товаров.");
  }
  return html;
}

export function parseCatalogWidgetOrder(data, items, widget = {}, nodeId = "catalog") {
  const match = String(data || "").match(/^order:([a-f0-9]{12}):([0-9a-z]+):([0-9a-z]+):([0-9a-z]*)$/u);
  if (!match) return null;
  if (match[1] !== catalogWidgetKey(nodeId, items, widget)) return null;
  const productIndex = Number.parseInt(match[2], 36);
  const quantity = Number.parseInt(match[3], 36);
  const products = safeItems(items);
  const groups = parseWidgetOptionGroups(widget.optionsText);
  if (!Number.isInteger(productIndex) || productIndex < 0 || productIndex >= products.length || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || match[4].length !== groups.length) return null;
  const selected = [...match[4]].map((character) => Number.parseInt(character, 36));
  if (selected.some((index, groupIndex) => !Number.isInteger(index) || index < 0 || index >= groups[groupIndex].choices.length)) return null;
  const product = products[productIndex];
  const additions = selected.map((index, groupIndex) => ({ group: groups[groupIndex].title, choice: groups[groupIndex].choices[index] }));
  const total = (product.price + additions.reduce((sum, item) => sum + item.choice.price, 0)) * quantity;
  const details = additions.map(({ group, choice }) => `${group}: ${choice.name}`).join("; ");
  return { product, quantity, additions, total, summary: `Заказ: ${product.name} × ${quantity}${details ? `; ${details}` : ""}; итого ${total.toLocaleString("ru-RU")} ₸` };
}

export function catalogWidgetState(data) {
  return JSON.stringify({ submitted: true, text: clampText(data, 160) });
}
