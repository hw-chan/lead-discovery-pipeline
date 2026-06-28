import { createHash } from "crypto";
import type { CandidateLead, DiscoverProvider, SearchRequest } from "./types";

const FIRST_NAMES = [
  "Alice",
  "Bob",
  "Carol",
  "David",
  "Eva",
  "Frank",
  "Grace",
  "Henry",
  "Ivy",
  "Jack",
  "Karen",
  "Liam",
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
];

const DOMAINS = [
  "example.com",
  "acme.com",
  "globex.com",
  "initech.com",
  "hooli.com",
  "soylent.com",
];

const TITLES = [
  "CEO",
  "CTO",
  "VP Sales",
  "Director of Engineering",
  "Head of Marketing",
  "Product Manager",
  "Software Engineer",
  "Sales Representative",
];

const MARRIOTT_CONTACTS: CandidateLead[] = [
  {
    name: "Anthony Capuano",
    company: "Marriott",
    title: "Chief Executive Officer",
    email: "anthony.capuano@marriott.com",
    source_url: "https://www.marriott.com/leadership",
  },
  {
    name: "Stephanie Linnartz",
    company: "Marriott",
    title: "President",
    email: "stephanie.linnartz@marriott.com",
    source_url: "https://www.marriott.com/leadership",
  },
  {
    name: "Drew Pinto",
    company: "Marriott",
    title: "Chief Financial Officer",
    email: "drew.pinto@marriott.com",
    source_url: "https://www.marriott.com/leadership",
  },
];

function hashJobId(jobId: string): number {
  const hex = createHash("sha256").update(jobId).digest("hex");
  return parseInt(hex.slice(0, 8), 16);
}

function generateCandidate(
  seed: number,
  company: string,
  includeGenericEmails: boolean,
): CandidateLead {
  const firstName = FIRST_NAMES[seed % FIRST_NAMES.length];
  const lastName = LAST_NAMES[(seed * 3) % LAST_NAMES.length];
  const title = TITLES[(seed * 7) % TITLES.length];
  const domain = DOMAINS[(seed * 11) % DOMAINS.length];

  let email: string;
  if (includeGenericEmails) {
    const emailType = seed % 5;
    if (emailType === 0) {
      email = `info@${domain}`;
    } else if (emailType === 1) {
      email = `noreply@${domain}`;
    } else {
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
    }
  } else {
    email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
  }

  return {
    name: `${firstName} ${lastName}`,
    company,
    title,
    email,
    source_url: `https://${domain.toLowerCase()}/team`,
  };
}

export class MockDiscoverProvider implements DiscoverProvider {
  async discover(input: SearchRequest): Promise<CandidateLead[]> {
    const jobId = input.jobId ?? "";
    const seed = hashJobId(jobId);
    const isMarriott = input.companies.some(
      (c) => c.toLowerCase() === "marriott",
    );

    const targetCount = isMarriott ? Math.max(seed % 11, 3) : seed % 11;

    const candidates: CandidateLead[] = [];

    if (isMarriott) {
      candidates.push(...MARRIOTT_CONTACTS);
    }

    const remaining = targetCount - candidates.length;
    for (let i = 0; i < remaining; i++) {
      const company = input.companies[i % input.companies.length] ?? "Unknown";
      candidates.push(generateCandidate(seed + i, company, true));
    }

    return candidates;
  }
}

export function createMockDiscoverProvider(): DiscoverProvider {
  return new MockDiscoverProvider();
}
