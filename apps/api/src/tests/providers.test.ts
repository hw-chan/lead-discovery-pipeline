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

test("MockDiscoverProvider returns between 0 and 50 candidates", async () => {
  for (let i = 0; i < 60; i++) {
    const request = {
      jobId: `job-${i}`,
      companies: ["Globex"],
      roles: ["Engineer"],
      region: "US",
    };
    const candidates = await discoverProvider.discover(request);
    assert.ok(candidates.length >= 0 && candidates.length <= 50);
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

test("MockDiscoverProvider always includes a junk email for the Marriott demo", async () => {
  const request = {
    jobId: "marriott-demo-job",
    companies: ["Marriott"],
    roles: ["Director of Sales"],
    region: "Malaysia",
  };

  const candidates = await discoverProvider.discover(request);
  const junkEmails = candidates.filter(
    (c) =>
      c.email?.startsWith("info@") || c.email?.startsWith("noreply@"),
  );
  assert.ok(junkEmails.length >= 1);
});

test("MockDiscoverProvider includes requested Marriott sales matches", async () => {
  const request = {
    jobId: "marriott-demo-job",
    companies: ["Marriott"],
    roles: ["Director of Sales"],
    region: "Malaysia",
  };

  const candidates = await discoverProvider.discover(request);
  const matches = candidates.filter(
    (c) =>
      c.company?.toLowerCase().includes("marriott") &&
      c.title?.toLowerCase().includes("director of sales"),
  );
  const companyCount = new Set(candidates.map((c) => c.company)).size;
  const titleCount = new Set(candidates.map((c) => c.title)).size;

  assert.ok(matches.length >= 1);
  assert.ok(companyCount >= 2);
  assert.ok(titleCount >= 3);
  assert.ok(candidates.length >= 3 && candidates.length <= 50);
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
