import test from "node:test";
import assert from "node:assert/strict";
import { configuredAdminEmails, isConfiguredAdmin } from "./admin-access.js";

test("supports multiple normalized admin emails and the legacy single-email setting", () => {
  const env = {
    ADMIN_EMAIL: " Legacy.Admin@example.com ",
    ADMIN_EMAILS: "First@example.com, second@example.com; THIRD@example.com",
  };

  assert.deepEqual(configuredAdminEmails(env), [
    "first@example.com",
    "second@example.com",
    "third@example.com",
    "legacy.admin@example.com",
  ]);
  assert.equal(isConfiguredAdmin(" SECOND@example.com ", env), true);
  assert.equal(isConfiguredAdmin("outsider@example.com", env), false);
});

test("handles unset and empty admin email configuration", () => {
  assert.deepEqual(configuredAdminEmails({}), []);
  assert.equal(isConfiguredAdmin("admin@example.com", {}), false);
  assert.equal(isConfiguredAdmin("", { ADMIN_EMAIL: "admin@example.com" }), false);
});
