export const MAX_BOT_AVATAR_BYTES = 500 * 1024;
const keyFor = (userId, botId) => userId && botId ? `bots-kz-telegram-profile-v1:${userId}:${botId}` : null;

export function readBotProfile(userId, botId) {
  const key = keyFor(userId, botId);
  if (!key) return {};
  try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return {}; }
}

export function writeBotProfile(userId, botId, profile) {
  const key = keyFor(userId, botId);
  if (!key) return false;
  try { localStorage.setItem(key, JSON.stringify(profile)); return true; } catch { return false; }
}

export function clearBotProfilePhoto(userId, botId) {
  const profile = readBotProfile(userId, botId);
  delete profile.profilePhoto;
  return writeBotProfile(userId, botId, profile);
}

export async function compressProfilePhoto(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Выберите изображение JPG, PNG или WebP.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Исходное фото должно быть меньше 10 МБ.");
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error("Не удалось прочитать это изображение."); }
  try {
    if (!bitmap.width || !bitmap.height || Math.max(bitmap.width, bitmap.height) > 10000) throw new Error("Размер изображения не поддерживается.");
    const side = Math.min(bitmap.width, bitmap.height);
    const sourceX = Math.floor((bitmap.width - side) / 2);
    const sourceY = Math.floor((bitmap.height - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = 640; canvas.height = 640;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не смог обработать изображение.");
    context.drawImage(bitmap, sourceX, sourceY, side, side, 0, 0, 640, 640);
    for (const quality of [0.86, 0.78, 0.7, 0.62, 0.54]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_BOT_AVATAR_BYTES) {
        const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Не удалось подготовить изображение.")); reader.readAsDataURL(blob); });
        return { mimeType: "image/jpeg", dataBase64: dataUrl.split(",", 2)[1], dataUrl, size: blob.size, fileName: "bot-profile.jpg" };
      }
    }
    throw new Error("Не удалось сжать фото до 500 КБ. Выберите другое изображение.");
  } finally { bitmap.close?.(); }
}
