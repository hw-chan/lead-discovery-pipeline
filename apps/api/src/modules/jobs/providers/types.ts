export interface SearchRequest {
  jobId?: string;
  companies: string[];
  roles: string[];
  region: string;
}

export interface CandidateLead {
  name: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  source_url?: string | null;
}

export interface DiscoverProvider {
  discover(input: SearchRequest): Promise<CandidateLead[]>;
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  score?: number;
}

export interface VerifyProvider {
  verify(candidate: CandidateLead): Promise<VerifyResult>;
}
