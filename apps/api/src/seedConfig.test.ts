import assert from "node:assert/strict";
import test from "node:test";
import { getSeedAdminPassword } from "./seedConfig";

test("getSeedAdminPassword fails when the seed password is missing", () => {
  const previous = process.env.SEED_ADMIN_PASSWORD;
  delete process.env.SEED_ADMIN_PASSWORD;

  try {
    assert.throws(
      () => getSeedAdminPassword(),
      /SEED_ADMIN_PASSWORD must be set before running seed/i,
    );
  } finally {
    if (previous === undefined) {
      delete process.env.SEED_ADMIN_PASSWORD;
    } else {
      process.env.SEED_ADMIN_PASSWORD = previous;
    }
  }
});

test("getSeedAdminPassword rejects blank or placeholder seed passwords", () => {
  const previous = process.env.SEED_ADMIN_PASSWORD;

  try {
    for (const value of ["   ", "replace_me"]) {
      process.env.SEED_ADMIN_PASSWORD = value;
      assert.throws(
        () => getSeedAdminPassword(),
        /SEED_ADMIN_PASSWORD must be set to a real password before running seed/i,
      );
    }
  } finally {
    if (previous === undefined) {
      delete process.env.SEED_ADMIN_PASSWORD;
    } else {
      process.env.SEED_ADMIN_PASSWORD = previous;
    }
  }
});

test("getSeedAdminPassword returns the configured seed password", () => {
  const previous = process.env.SEED_ADMIN_PASSWORD;
  process.env.SEED_ADMIN_PASSWORD = "local-dev-password";

  try {
    assert.equal(getSeedAdminPassword(), "local-dev-password");
  } finally {
    if (previous === undefined) {
      delete process.env.SEED_ADMIN_PASSWORD;
    } else {
      process.env.SEED_ADMIN_PASSWORD = previous;
    }
  }
});
