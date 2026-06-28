import type { CandidateLead, VerifyProvider, VerifyResult } from "./types";

export class MockVerifyProvider implements VerifyProvider {
  async verify(candidate: CandidateLead): Promise<VerifyResult> {
    const localPart = candidate.email?.split("@")[0]?.toLowerCase() ?? "";

    if (localPart === "info" || localPart === "noreply") {
      return {
        ok: false,
        reason: "Generic email addresses are not accepted",
      };
    }

    const score = Math.floor(Math.random() * 41) + 60;
    return { ok: true, score };
  }
}

export function createMockVerifyProvider(): VerifyProvider {
  return new MockVerifyProvider();
}
