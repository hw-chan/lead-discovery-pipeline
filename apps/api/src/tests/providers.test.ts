import assert from "node:assert/strict";
import test from "node:test";
import {
  createMockDiscoverProvider,
  createMockVerifyProvider,
} from "../modules/jobs/providers";

const discoverProvider = createMockDiscoverProvider();
const verifyProvider = createMockVerifyProvider();

test("MockDiscoverProvider returns deterministic output for the same jobId", async () => {
  const request = {
    jobId: "job-abc-123",
    companies: ["Acme"],
    roles: ["CEO"],
    region: "US",
  };

  const first = await discoverProvider.discover(request);
  const second = await discoverProvider.discover(request);

  assert.equal(first.length, second.length);
  assert.deepEqual(first, second);
});

test("MockDiscoverProvider returns between 0 and 10 candidates", async () => {
  for (let i = 0; i < 20; i++) {
    const request = {
      jobId: `job-${i}`,
      companies: ["Globex"],
      roles: ["Engineer"],
      region: "US",
    };
    const candidates = await discoverProvider.discover(request);
    assert.ok(candidates.length >= 0 && candidates.length <= 10);
  }
});

test("MockDiscoverProvider returns at least three Marriott contacts", async () => {
  const request = {
    jobId: "marriott-job",
    companies: ["Marriott"],
    roles: ["Executive"],
    region: "US",
  };

  const candidates = await discoverProvider.discover(request);
  assert.ok(candidates.length >= 3);

  const marriottContacts = candidates.filter(
    (c) => c.company?.toLowerCase() === "marriott",
  );
  assert.ok(marriottContacts.length >= 3);
});

test("MockVerifyProvider rejects info@ emails", async () => {
  const result = await verifyProvider.verify({
    name: "Info Desk",
    company: "Acme",
    title: "Contact",
    email: "info@acme.com",
  });

  assert.equal(result.ok, false);
  assert.ok(result.reason);
});

test("MockVerifyProvider rejects noreply@ emails", async () => {
  const result = await verifyProvider.verify({
    name: "No Reply",
    company: "Acme",
    title: "Bot",
    email: "noreply@acme.com",
  });

  assert.equal(result.ok, false);
  assert.ok(result.reason);
});

test("MockVerifyProvider approves personal emails with a score between 60 and 100", async () => {
  const result = await verifyProvider.verify({
    name: "Alice Smith",
    company: "Acme",
    title: "CEO",
    email: "alice.smith@acme.com",
  });

  assert.equal(result.ok, true);
  assert.ok(result.score !== undefined);
  assert.ok(result.score! >= 60 && result.score! <= 100);
});
