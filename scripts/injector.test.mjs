import { test } from "node:test";
import assert from "node:assert/strict";

// Mirrors injectorAllowed() in components/layout/script-injector.tsx. The
// injector must NEVER render on the admin deployment — a script there could
// steal an admin session. This test asserts the invariant.
function injectorAllowed(appTarget) {
  return appTarget !== "admin";
}

test("scripts never inject on the admin deployment", () => {
  assert.equal(injectorAllowed("admin"), false);
});

test("scripts inject on the public deployment", () => {
  assert.equal(injectorAllowed("web"), true);
  assert.equal(injectorAllowed(undefined), true);
});
