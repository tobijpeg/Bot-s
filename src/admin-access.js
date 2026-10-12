function splitEmails(value) {
  return String(value || "")
    .split(/[,;\s]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function configuredAdminEmails(env = {}) {
  return [...new Set([
    ...splitEmails(env.ADMIN_EMAILS),
    ...splitEmails(env.ADMIN_EMAIL),
  ])];
}

export function isConfiguredAdmin(email, env = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return Boolean(normalizedEmail) && configuredAdminEmails(env).includes(normalizedEmail);
}
