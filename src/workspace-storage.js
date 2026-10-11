const storagePrefix = "bots-kz-workspace-v2";

export function workspaceStorageKey(userId) {
  return userId ? `${storagePrefix}:${userId}` : null;
}

export function readWorkspace(userId, storage = globalThis.localStorage) {
  const key = workspaceStorageKey(userId);
  if (!key || !storage) return null;
  try { return JSON.parse(storage.getItem(key) || "null"); }
  catch { return null; }
}

export function writeWorkspace(userId, value, storage = globalThis.localStorage) {
  const key = workspaceStorageKey(userId);
  if (!key || !storage) return false;
  try { storage.setItem(key, JSON.stringify(value)); return true; }
  catch { return false; }
}
