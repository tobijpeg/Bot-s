import { Buffer } from "node:buffer";

export const TELEGRAM_PROFILE_PHOTO_LIMIT = 500 * 1024;
const JPEG_PREFIX = Buffer.from([0xff, 0xd8, 0xff]);

export function normalizeTelegramProfile(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Проверьте данные профиля Telegram.");
  const name = String(input.name ?? "").trim();
  const description = String(input.description ?? "").trim();
  const shortDescription = String(input.shortDescription ?? "").trim();
  if (name.length > 64) throw new RangeError("Имя Telegram-бота должно быть не длиннее 64 символов.");
  if (description.length > 512) throw new RangeError("Описание Telegram-бота должно быть не длиннее 512 символов.");
  if (shortDescription.length > 120) throw new RangeError("Краткое описание Telegram-бота должно быть не длиннее 120 символов.");

  let photo = null;
  if (input.profilePhoto != null) {
    const encoded = input.profilePhoto.dataBase64;
    if (input.profilePhoto.mimeType !== "image/jpeg" || typeof encoded !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
      throw new TypeError("Фото профиля должно быть корректным изображением JPG.");
    }
    photo = Buffer.from(encoded, "base64");
    if (!photo.length || photo.length > TELEGRAM_PROFILE_PHOTO_LIMIT || photo.toString("base64") !== encoded || !photo.subarray(0, 3).equals(JPEG_PREFIX)) {
      throw new RangeError("Фото профиля должно быть JPG размером не более 500 КБ.");
    }
  }

  return { name, description, shortDescription, photo };
}

export async function applyTelegramProfile(api, profile, InputFile) {
  if (profile.name) await api.setMyName({ name: profile.name });
  if (profile.description) await api.setMyDescription({ description: profile.description });
  if (profile.shortDescription) await api.setMyShortDescription({ short_description: profile.shortDescription });
  if (profile.photo) {
    if (typeof InputFile !== "function") throw new TypeError("Telegram file upload is unavailable on this server.");
    await api.setMyProfilePhoto({ type: "static", photo: new InputFile(profile.photo, "bot-profile.jpg") });
  }
}
